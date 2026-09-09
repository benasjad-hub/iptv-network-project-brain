/**
 * `context:checkpoint` — refresh the machine-readable repository state and say
 * what a human or agent should look at.
 *
 * IT NEVER INVENTS A DECISION. It does not read commit messages and promote
 * them, and it does not edit STATUS, TASKS, DECISIONS, the feature matrix or
 * any verification record. Implementing something is not the same as approving
 * it, and semantic truth is never written automatically. The ONLY file this
 * script writes is `REPO_STATE.json` — a description of the tree, not a claim
 * about the product.
 *
 * `--pack`  also regenerates the context pack.
 * `--adopt` moves `code_review_base` to HEAD. PASS IT ONLY when you have
 *           actually re-audited the canonical docs against this tree: `--adopt`
 *           asserts that an audit happened, so passing it without one fabricates
 *           the audit rather than the file.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import {
  CANONICAL_DOCS,
  CANONICAL_YAML,
  DATED_DOCS,
  DOC_SUBSYSTEMS,
  REPO_STATE,
  REPO_STATE_GENERATOR,
  changedSince,
  classifyDrift,
  classifyRepoSync,
  exists,
  gitState,
  entryExists,
  isInHeadCommit,
  isPromotableSyncState,
  isShaShaped,
  read,
  repoPath,
  reviewedAgainst,
  uncontainedPaths,
  writeDestinationProblem,
} from './lib.mjs'

const argv = process.argv.slice(2)
const wantPack = argv.includes('--pack')
const adopt = argv.includes('--adopt')

const g = gitState()
if (!g.head) {
  console.error('checkpoint: not a git repository (or git unavailable). A checkpoint records a commit; there is none.')
  process.exit(1)
}

/* THE DESTINATION MUST BE A PLAIN FILE, CHECKED BEFORE ANYTHING ELSE.
 *
 * A symlink is ordinary committable content, and `REPO_STATE.json` is the one
 * write destination that was exempted from every containment guard on the
 * reasoning that its path is a fixed constant. A constant path STRING says
 * nothing about what it resolves to: a committed link here made this script
 * write outside the repository, overwrite a file in a DIFFERENT repository, and
 * — because a dangling link makes `existsSync` false — skip the refusal below
 * and adopt HEAD with no `--adopt` and no audit behind it. All three from one
 * committable file. */
/* This script reads every dated doc for its reviewed-against sha. Same reason
 * as the other standalone targets: check.mjs's containment gate does not run
 * here, and its exit code is informative rather than fatal. */
{
  const bad = uncontainedPaths([...DATED_DOCS, REPO_STATE, 'PROJECT.yaml'])
  if (bad.length) {
    console.error(`checkpoint: refusing to read — path(s) do not resolve to a plain file inside this repository: ${bad.join(', ')}`)
    process.exit(1)
  }
}

const stateProblem = writeDestinationProblem(REPO_STATE)
if (stateProblem) {
  console.error(`checkpoint: refusing to write — ${stateProblem}.`)
  console.error('The generated state must be a plain file at its own path inside the repository.')
  process.exit(1)
}

/* A corrupt prior state must produce a clean message, not a stack trace: this
 * script's whole job is to be the thing that repairs it. */
let prior = null
if (entryExists(REPO_STATE)) {
  try {
    prior = JSON.parse(read(REPO_STATE))
  } catch (e) {
    console.error(`checkpoint: ${REPO_STATE} exists but does not parse (${e.message}).`)
    console.error('Delete it and re-run with --adopt, having actually re-audited the Brain against this tree.')
    process.exit(1)
  }
}
/* An unusable base in an EXISTING state file must never be silently replaced.
 *
 * Adopting HEAD is what `--adopt` means, and `--adopt` asserts that a human
 * re-audited the canonical docs against this tree. Doing it automatically
 * fabricates that audit — and it is worse than the malformed case, because a
 * malformed base at least fails closed to UNKNOWN on every later run, whereas a
 * silently adopted HEAD reads `CURRENT`.
 *
 * THE EMPTY STRING WAS THE FIRST CASE THAT MATTERED. An earlier version guarded
 * only a malformed-but-truthy value, so `"code_review_base": ""` fell through to
 * a falsy test that treated it exactly like `--adopt`: a tree reading SUBSYSTEM
 * STALE became `CURRENT` with no flag, no warning and no "ADOPTED" annotation.
 *
 * THE LITERAL `null` WAS THE SECOND. Guarding on `prior !== null` reopened the
 * same hole one layer up: a state file whose entire content is `null` parses
 * fine, leaves `prior` null, and slipped past into the auto-HEAD path. The
 * question was never "did the parse yield an object" but "does a state file
 * exist" — so that is what is asked now, and every shape of unusable base
 * inside an existing file is one case. */
if (!adopt && entryExists(REPO_STATE) && !isShaShaped(prior?.code_review_base)) {
  const shown =
    prior?.code_review_base === undefined ? '(absent)' : `"${String(prior?.code_review_base).slice(0, 40)}"`
  console.error(`checkpoint: the existing ${REPO_STATE} code_review_base ${shown} is not a commit id.`)
  console.error('Refusing to adopt HEAD on its behalf: --adopt asserts that a human re-audited the')
  console.error('canonical docs against this tree, and this run has no such assertion behind it.')
  console.error('Re-run with --adopt once you have actually done that audit.')
  process.exit(1)
}

/* DELETING THE STATE FILE IS NOT A FIRST RUN.
 *
 * The auto-adopt path below exists for a clone that has never had a checkpoint.
 * Absence alone cannot tell that apart from `rm REPO_STATE.json`, and the second
 * moves `code_review_base` to HEAD with no flag — a lower-friction route to the
 * fabricated audit than hand-writing the file, which is the very thing the
 * refusal above exists to stop. If HEAD carries the file, its absence from the
 * tree is a deletion, and adopting still requires saying so. */
if (!adopt && !entryExists(REPO_STATE) && isInHeadCommit(REPO_STATE)) {
  console.error(`checkpoint: ${REPO_STATE} is missing from the working tree but HEAD contains it.`)
  console.error('That is a DELETION, not a first run, and adopting HEAD on its behalf would move')
  console.error('code_review_base with no audit behind it. Restore it with `git checkout --` and')
  console.error(`re-run, or pass --adopt if you have actually re-audited the Brain against this tree.`)
  process.exit(1)
}

const base = adopt || !entryExists(REPO_STATE) ? g.head : prior.code_review_base

/* 1 — run the checker first; its exit code is informative, not fatal here. */
console.log('── context:check ──')
let checkOk = true
try {
  execFileSync(process.execPath, [repoPath('tools/context/check.mjs')], { stdio: 'inherit' })
} catch {
  checkOk = false
}

/* 2 — what changed since the audited base, classified once so no reader has to
 *     run a git diff to decide whether the Brain is trustworthy. An
 *     unresolvable base yields UNKNOWN, never CURRENT. */
const drift = classifyDrift(base)
const changed = drift.changed
const staleDocs = drift.staleDocs

/* 3 — docs whose own reviewed-against is behind AND whose subsystem moved.
 *
 * A bare SHA comparison is noise: adding documentation advances HEAD without
 * touching a line of the code these docs describe, and reporting every doc as
 * "behind" would train the reader to skip this section. What matters is whether
 * CODE in the doc's own subsystem changed since the doc was last reviewed. */
const behind = []
const unresolvedHeaders = []
for (const f of DATED_DOCS) {
  if (!exists(f)) continue
  const sha = reviewedAgainst(read(f))
  if (!sha) continue
  const subs = DOC_SUBSYSTEMS[f]
  if (!subs) continue
  const changedForDoc = changedSince(sha)
  if (changedForDoc === null) {
    unresolvedHeaders.push({ doc: f, reviewed: sha })
    continue
  }
  const moved = changedForDoc.filter((c) => subs.some((s) => c.startsWith(s)))
  if (moved.length) behind.push({ doc: f, reviewed: sha, files: moved.length })
}

/* 4 — write REPO_STATE.json (the only thing this script writes) */
const sync = classifyRepoSync()
const warnings = []
if (g.dirty) warnings.push('working tree is dirty')
if (!checkOk) warnings.push('context:check reported FAIL')
if (!drift.resolved) warnings.push(`code_review_base ${String(base).slice(0, 12)} is not a commit reachable from HEAD — freshness is UNKNOWN`)
if (!isPromotableSyncState(sync.state))
  warnings.push(`repository sync is ${sync.state} — not promotable as a snapshot source`)
for (const s of staleDocs) warnings.push(`${s.doc} may be stale (${s.files} file(s) changed in its subsystem)`)
for (const u of unresolvedHeaders)
  warnings.push(`${u.doc} is reviewed against ${u.reviewed}, which is not a commit reachable from HEAD in this repository`)

const state = {
  schema_version: 1,
  generator: REPO_STATE_GENERATOR,
  generated_note:
    'GENERATED FILE. Never hand-write or hand-edit it: `--adopt` asserts that the canonical docs were re-audited against this tree, so writing this file by hand fabricates an audit. Regenerate with `make context-checkpoint`.',
  generated_at: new Date().toISOString(),
  branch: g.branch,
  head: g.head,
  tree_status: g.dirty ? 'dirty' : 'clean',
  repo_sync_state: sync.state,
  repo_sync_vocabulary: 'SYNCED | LOCAL_AHEAD | REMOTE_AHEAD | DIRTY | DIVERGED | UNKNOWN',
  repo_sync_upstream: sync.upstream || 'UNKNOWN',
  repo_sync_ahead: sync.ahead,
  repo_sync_behind: sync.behind,
  repo_sync_basis: sync.basis || sync.reason || 'UNKNOWN',
  repo_sync_note:
    'THIS FIELD IS THE LAST GENERATED CHECKPOINT of "had this history reached the canonical remote?" — answered for the branch and head recorded above, at generated_at, and for no later commit. It classified the working copy against its remote-tracking ref AS OF THE LAST FETCH; this tooling performs no network operation, so a stale ref yielded a stale answer. THE CURRENT LIVE ANSWER IS NOT IN THIS FILE: run `make context-check` in a verification-ready checkout after a read-only `git fetch`. Only SYNCED is promotable; UNKNOWN fails closed and is never "probably fine". This is NOT an automation runtime session-start reconciliation.',
  promotable_snapshot_source: isPromotableSyncState(sync.state) && !g.dirty && checkOk && drift.resolved,
  promotable_snapshot_source_note:
    'Whether this tree would be eligible as a snapshot source — clean, SYNCED, structurally valid and with a resolvable audit base. It is a PRECONDITION, not an authorization: nothing consumes this field today.',
  code_review_base: base,
  code_review_base_note:
    'The commit the Project Brain content was audited against. It is NOT required to equal HEAD; context:check reports what changed since.',
  canonical_docs: [...CANONICAL_DOCS, ...CANONICAL_YAML, ...DATED_DOCS].filter((v, i, a) => a.indexOf(v) === i),
  canonical_docs_note:
    'The FULL canonical document set: the required canonical root files plus the dated docs under docs/. context:check reports the root-file count on its own line and the dated-doc count on another, so a smaller number there is a narrower scope, not a disagreement with this list.',
  changed_since_base: drift.resolved ? changed.length : 'UNKNOWN',
  code_changed_since_base: drift.resolved ? drift.code.length : 'UNKNOWN',
  freshness: drift.freshness,
  freshness_vocabulary: 'CURRENT | DOCS-ONLY ADVANCE | SUBSYSTEM STALE | UNKNOWN',
  freshness_note:
    'CURRENT = nothing but checkpoint bookkeeping moved. DOCS-ONLY ADVANCE = docs moved, no code, so claims about the tooling still describe this tree. SUBSYSTEM STALE = code moved; re-verify detail claims. UNKNOWN = code_review_base is not a commit reachable from HEAD, so the question was never answered — it never means CURRENT.',
  possibly_stale_docs: staleDocs,
  warnings,
}
fs.writeFileSync(repoPath(REPO_STATE), `${JSON.stringify(state, null, 2)}\n`)
/* Derived from what actually happened, not from the flag: the one run that
 * moves the base without `--adopt` is the first checkpoint of a repository, and
 * it is exactly the run that must say so. */
const movedToHead = base === g.head && base !== prior?.code_review_base
console.log(
  `\nwrote ${REPO_STATE} (code_review_base ${String(base).slice(0, 7)}${movedToHead ? ', ADOPTED to HEAD' : ''})`,
)

/* 5 — optional pack */
if (wantPack) {
  console.log('\n── context:pack ──')
  execFileSync(process.execPath, [repoPath('tools/context/pack.mjs')], { stdio: 'inherit' })
}

/* 6 — say what a human should do. Never do it automatically. */
console.log(`\nFRESHNESS: ${drift.freshness}`)
console.log(`REPOSITORY SYNC: ${sync.state}`)

console.log('\n── what needs a human or agent ──')
if (drift.resolved && !changed.length && !behind.length && !unresolvedHeaders.length && !g.dirty && isPromotableSyncState(sync.state)) {
  console.log('nothing — the Project Brain matches the audited tree and the working copy is SYNCED')
} else {
  if (g.dirty) console.log('· commit or stash the working tree, then re-run')
  if (!drift.resolved)
    console.log(`· code_review_base ${String(base).slice(0, 12)} is not a commit reachable from HEAD — freshness is UNKNOWN, not CURRENT`)
  if (!isPromotableSyncState(sync.state))
    console.log(`· repository sync is ${sync.state} — reconcile with the canonical remote before promoting anything`)
  if (changed.length) console.log(`· ${changed.length} file(s) changed since the audited base`)
  for (const s of staleDocs) console.log(`· re-verify ${s.doc} (${s.files} file(s) changed in its subsystem)`)
  for (const b of behind)
    console.log(
      `· ${b.doc} is reviewed against ${b.reviewed} and ${b.files} file(s) in its subsystem changed since — re-verify, then refresh its header`,
    )
  for (const u of unresolvedHeaders)
    console.log(`· ${u.doc} is reviewed against ${u.reviewed}, which is not a commit reachable from HEAD in this repository`)
}
console.log('\nUpdate STATUS.md / TASKS.md only if current state actually changed.')
console.log('Update DECISIONS.md ONLY for an explicitly owner-approved durable decision.')
console.log('Implementation is not approval. Do not promote a decision from a commit message.')
