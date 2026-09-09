/**
 * `context:check` — is the Project Brain still trustworthy?
 *
 * DETERMINISTIC AND READ-ONLY. It writes nothing, fetches nothing and reaches
 * no network. It does not judge whether a claim is TRUE — only whether the
 * structure holds and whether anything has moved underneath it. A doc is not
 * false because HEAD advanced; it is only suspect when code in the subsystem it
 * describes changed after the commit it was reviewed against.
 *
 * WHAT IT CANNOT DO, said once so no reader over-reads a green run: it cannot
 * tell whether a status, a decision, a task state or a verification claim is
 * honest. Those are read by people, at the project's own acceptance gates. A
 * PASS here is a STRUCTURAL result.
 *
 * Nothing here names a project or a decision id. Per-project configuration
 * lives in the `brain:` block of `PROJECT.yaml`.
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  BRAIN,
  CANONICAL_DOCS,
  CANONICAL_YAML,
  CODE_ROOTS,
  DATED_DOCS,
  EXTERNAL_REGISTRY,
  EXTRA_CORE_SECTION_PATHS,
  EXTRA_FULL_SECTION_PATHS,
  FEATURE_STATES,
  ID_PREFIX,
  LIVE_STATE_DOCS,
  LIVE_STATE_SURFACES,
  NOT_APPLICABLE,
  PACK_PATH,
  PACK_TOKEN_TARGET,
  PINNED_OWNER_DETERMINATIONS,
  PLACEHOLDER_RE,
  PROVENANCE,
  QUESTION_ID_RE,
  RELEASE_ACTORS,
  RELEASE_PHASES,
  REPO_STATE,
  REVIEW_BASELINE,
  SECRET_VALUE_PATTERNS,
  SIZE_LIMITS,
  TASK_ID_RE,
  UNSET_SHA,
  YamlError,
  auditLiveStateWrapper,
  auditRepoState,
  classifyDrift,
  classifyExternalRows,
  classifyRepoSync,
  externalSummary,
  entryExists,
  exists,
  existsInRepo,
  gitState,
  isDirectoryPath,
  isSymlinkPath,
  readDirInRepo,
  uncontainedDirs,
  uncontainedPaths,
  indexDecisions,
  isAncestorOfHead,
  isCommit,
  parseYaml,
  read,
  readBaseline,
  readRegistry,
  referencedPaths,
  repoPath,
  reviewedAgainst,
  secretFindingForLine,
} from './lib.mjs'

const results = []
const pass = (m) => results.push(['PASS', m])
const warn = (m) => results.push(['WARN', m])
const fail = (m) => results.push(['FAIL', m])

/** An `evidence:`-style field may carry a path plus prose. Take the path. */
const evidencePath = (v) => String(v ?? '').split(/\s/)[0]

for (const p of BRAIN.problems) warn(`brain config: ${p}`)

/* 0 — every canonical path must RESOLVE INSIDE THIS REPOSITORY, and must not
 *     be a link.
 *
 *     A symlink is committable content that redirects every later step: the
 *     sweep reads whatever it points at — a home directory, another repository
 *     — which is exactly what the secrets policy forbids this tooling from
 *     doing. An earlier version of this check lstat'd only the FINAL path
 *     component, so a link at a DIRECTORY component (`docs/design -> …`) sailed
 *     past it while the run printed "no check follows a link out of the
 *     repository" and then read out-of-repository files. `isInsideRepo`
 *     realpath-resolves the whole path and is the primitive that catches it.
 *
 *     THIS ONE ABORTS. Recording a FAIL and continuing meant the later steps
 *     still read through the link — and a parse error then echoed a line of an
 *     out-of-repository file to the terminal. Nothing after this point may run
 *     against a canonical set that does not resolve inside the repository.
 *
 *     AND IT RUNS FIRST, BEFORE ANY STEP READS ANYTHING. It used to sit after
 *     the placeholder sweep, which reads every canonical file — so for a
 *     symlinked canonical path the run died in `read()` with an uncaught
 *     ContainmentError stack trace and this block's message was unreachable for
 *     exactly the paths it was written for. Fail-closed either way, but the
 *     designed refusal only ever fired for the non-canonical entries. An abort
 *     placed after a read is not an abort. */
{
  /* EVERY PATH THIS RUN WILL READ, not only the canonical set. An earlier
   * version guarded the canonical files alone, so a symlinked `README.md` or a
   * symlinked verification record — neither of which is canonical — was read
   * from outside the repository and the run still exited 0. The evidence
   * DIRECTORY is included too: a link there makes the enumeration itself walk
   * somewhere else. */
  const evidenceDir = 'docs/verification'
  const evidenceRecords = []
  const evidenceRecordDirs = []
  /* `isDirectoryPath` GATES THE ENUMERATION, not just the refusal below. Without
   * it `readDirInRepo` ran first and a regular file or FIFO at this path threw an
   * uncaught ENOTDIR — a raw stack trace, no refusal, and no verdict lines — and
   * the `!isDirectoryPath` term in `uncontainedDirs` was unreachable at every
   * call site, which is dead code wearing the shape of a guard. An abort placed
   * after a read is not an abort; neither is one placed after an enumeration. */
  if (existsInRepo(evidenceDir) && !isSymlinkPath(evidenceDir) && isDirectoryPath(evidenceDir)) {
    for (const entry of readDirInRepo(evidenceDir)) {
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        evidenceRecordDirs.push(path.join(evidenceDir, entry.name))
        evidenceRecords.push(path.join(evidenceDir, entry.name, 'README.md'))
      }
    }
  }
  const willRead = [
    ...CANONICAL_DOCS,
    ...CANONICAL_YAML,
    ...DATED_DOCS,
    /* The configured extra CORE pack sections. `pack.mjs` INLINES these verbatim
     * into the generated pack, and `brain.pack_extra_core_sections` is ordinary
     * committable repository content that may name any path in the tree — so a
     * value pointing at an unswept file routed its contents, credential shapes
     * included, into the artifact handed to a model or a person, while this run
     * printed `PASS secret hygiene` and the gate exited 0. The sweep step below
     * now covers them for that reason; guarding them here is the other half. */
    ...EXTRA_CORE_SECTION_PATHS,
    /* And the FULL-only sections, for the identical reason. `pack.mjs --full` is
     * the same inliner reading the same configuration, so a guard scoped to the
     * CORE key alone would be a gap the moment a project moves a section from
     * one list to the other. Both lists dedupe against the canonical set. */
    ...EXTRA_FULL_SECTION_PATHS,
    /* Both of these are PROJECT.yaml-supplied path values that later steps read
     * — `live_state_docs` at the live-state rule, the `size_limits` keys at the
     * size targets — and both were missing from this list while the comment
     * above claimed it was every path the run reads. A traversing value in
     * either produced an uncaught ContainmentError stack trace and no report at
     * all, instead of the refusal below. `read()` still refused, so nothing
     * leaked; the abort simply never fired for the paths it was written for. */
    ...LIVE_STATE_DOCS,
    ...Object.keys(SIZE_LIMITS),
    /* The generated pack too. It is read for its size at the budget step, and it
     * was the last read path outside this set: `existsInRepo` kept it contained
     * but not the stricter no-links rule, so a symlinked pack made this run stat
     * a file outside the tree and report ITS size as the budget. Absent on a
     * fresh clone, which `uncontainedPaths` already ignores. */
    PACK_PATH,
    REPO_STATE,
    /* The governed-repository registry and its generated baseline. Both are
     * read by step 11c below, and both are OPTIONAL — `uncontainedPaths`
     * already ignores what is absent, so naming them here costs nothing in a
     * Brain that governs no external repository and closes the same link hole
     * for one that does. */
    EXTERNAL_REGISTRY,
    REVIEW_BASELINE,
    'README.md',
    /* The `Makefile` is guarded although no step reads it today. It is named
     * here so a step that starts reading it inherits the guard rather than
     * needing to remember one — which is why the PASS line below says GUARDS
     * rather than reads. Conservative in the safe direction, and stated so no
     * reader takes the set as an enumeration of what is actually read. */
    'Makefile',
    ...evidenceRecords,
  ].filter((v, i, a) => a.indexOf(v) === i)
  /* Directories are guarded by the same rule minus one term: they must be
   * directories, not regular files. A link at the evidence directory makes the
   * enumeration itself walk somewhere else, which is the reason it is here. */
  const willEnumerate = [evidenceDir, ...evidenceRecordDirs].filter((v, i, a) => a.indexOf(v) === i)
  const bad = [...uncontainedPaths(willRead), ...uncontainedDirs(willEnumerate)]
  if (bad.length) {
    console.log(`FAIL  path(s) this run would read do not resolve to a plain file inside this repository: ${bad.join(', ')}`)
    console.log('      A link — at the file or at any directory above it — redirects every check that follows it,')
    console.log('      including the secret sweep. A FIFO would hang the run with no output at all, and a')
    console.log('      directory would throw before any refusal printed. Aborting before anything reads through it.')
    console.log('\nFRESHNESS: UNKNOWN')
    console.log('REPOSITORY SYNC: UNKNOWN')
    console.log('FAIL — aborted at the canonical-path check; no later check was run')
    process.exit(1)
  }
  pass(`every one of the ${willRead.length + willEnumerate.length} paths this run guards resolves inside this repository, none is reached through a link at ANY component, and each is the kind of entry it is read as`)
}

/* 0b — unfilled placeholders. A Brain nobody finished is a Brain nobody can
 *      trust, so say exactly which files are still wearing the template. */
{
  const unfilled = []
  const seen = new Set()
  for (const f of [...CANONICAL_DOCS, ...CANONICAL_YAML, ...DATED_DOCS]) {
    if (seen.has(f) || !exists(f)) continue
    seen.add(f)
    const n = (read(f).match(PLACEHOLDER_RE) ?? []).length
    if (n) unfilled.push(`${f} (${n})`)
  }
  if (unfilled.length) fail(`NOT BOOTSTRAPPED — unfilled placeholder tokens remain in: ${unfilled.join(', ')}`)
  else pass('no unfilled placeholder tokens in any canonical file')
}

/* 1 — canonical ROOT files exist.
 *
 * This counts the required canonical files at the repository root only. It is
 * deliberately NOT the full canonical document set: the dated docs under docs/
 * are checked for existence in step 4, alongside their reviewed-against
 * headers, and REPO_STATE.json lists both groups together under
 * `canonical_docs`. A smaller number here than there is two scopes, not a
 * disagreement. */
{
  const required = [...CANONICAL_DOCS, ...CANONICAL_YAML].filter((f) => !NOT_APPLICABLE.includes(f))
  const missing = required.filter((f) => !exists(f))
  if (missing.length) fail(`missing canonical root files: ${missing.join(', ')}`)
  else
    pass(
      `all ${required.length} required canonical root files present (dated docs under docs/ are checked in step 4)`,
    )
  if (NOT_APPLICABLE.length) pass(`declared not applicable: ${NOT_APPLICABLE.join(', ')}`)
}

/* 2 — YAML parses, in the strict Brain subset. A parser that silently read
 *     "something else" would report PASS on a file it had misread. */
const yamls = {}
for (const f of CANONICAL_YAML) {
  if (!exists(f)) continue
  try {
    yamls[f] = parseYaml(read(f))
    pass(`${f} parses`)
  } catch (e) {
    fail(`${f} does not parse: ${e instanceof YamlError ? e.message : e}`)
  }
}

/* 3 — the generated repository state parses, and looks generated. */
const g = gitState()
let repoState = null
/* `parsed` is tracked separately from the value: JSON.parse can legitimately
 * yield `null`, `0` or `false`, and testing the VALUE for truthiness skipped the
 * integrity audit entirely for exactly those inputs — which is how a state file
 * whose whole content was `null` passed with 0 FAIL. */
let repoStateParsed = false
if (entryExists(REPO_STATE)) {
  try {
    repoState = JSON.parse(read(REPO_STATE))
    repoStateParsed = true
    pass(`${REPO_STATE} parses`)
  } catch (e) {
    fail(`${REPO_STATE} does not parse: ${e.message}`)
  }
} else {
  warn(`${REPO_STATE} not generated yet — run \`make context-checkpoint\``)
}

/* 3b — generated-state integrity. BEST-EFFORT DETECTION, NOT PROOF: no secret
 *      exists in this repository and none may be added, so nothing here is a
 *      signature. It catches a fabricated or foreign state file — absent
 *      generator stamp, malformed fields, commits this repository does not
 *      contain — which is the failure that actually happens. */
if (repoStateParsed) {
  const problems = auditRepoState(repoState, g.head)
  if (problems.length)
    fail(
      `${REPO_STATE} does not look generated: ${problems.join('; ')} — regenerate with \`make context-checkpoint\`, never hand-write it`,
    )
  else if (g.head)
    pass(
      `${REPO_STATE} carries its generator stamp, well-formed fields and commits reachable from HEAD (detection, not proof)`,
    )
  else
    /* Without git the reachability half of auditRepoState never ran, so saying
     * the commits are reachable would report a check that did not happen. */
    warn(`${REPO_STATE} field shapes are well formed, but git is unavailable — commit reachability is UNKNOWN`)
}

/* 4 — the dated docs exist and carry reviewed-against metadata. Together with
 *     step 1 this covers the full canonical set REPO_STATE.json records. */
const reviewed = {}
let unsetHeaders = 0
for (const f of DATED_DOCS) {
  if (!exists(f)) {
    if (NOT_APPLICABLE.includes(f)) continue
    fail(`dated doc missing: ${f}`)
    continue
  }
  const sha = reviewedAgainst(read(f))
  if (!sha) fail(`${f} has no "Reviewed against commit" line`)
  else {
    reviewed[f] = sha
    if (sha === UNSET_SHA) unsetHeaders++
  }
}
if (unsetHeaders)
  warn(
    `${unsetHeaders} dated doc(s) still carry the ${UNSET_SHA} sentinel — never reviewed against a real commit`,
  )
if (Object.keys(reviewed).length === DATED_DOCS.filter((f) => exists(f)).length)
  pass(`all ${Object.keys(reviewed).length} dated docs present, every one carrying a reviewed-against commit`)

/* 4b — a reviewed-against commit must be a commit HEAD CAN REACH.
 *      A doc reviewed against a SHA nobody can check out is not dated, it is
 *      decorated. The sentinel is exempt: it says "never reviewed", honestly.
 *
 *      REACHABILITY, not existence, and the two came apart: `changedSince` was
 *      tightened to require reachability while this step still asked only
 *      whether the object exists, so a header pinned to a real commit on an
 *      abandoned line of history PASSED here while the checkpoint reported it
 *      unreachable. One question, two answers, in the same tree. Existence is
 *      also the weaker question: what a header claims is that the doc was
 *      reviewed against an ancestor of this tree. */
{
  const bogus = Object.entries(reviewed).filter(([, sha]) => sha !== UNSET_SHA && !isAncestorOfHead(sha))
  if (!g.head) warn('git unavailable — reviewed-against commits could not be resolved')
  else if (bogus.length)
    fail(
      `reviewed-against commit is not reachable from HEAD in this repository: ${bogus.map(([f, s]) => `${f} -> ${s}`).join(', ')}`,
    )
  else pass('every reviewed-against commit resolves to a commit reachable from HEAD')
}

/* 4c — the same rule for the YAML files, which carry `reviewed_against`. */
{
  const bogus = []
  for (const [f, y] of Object.entries(yamls)) {
    const sha = y?.reviewed_against
    if (!sha) {
      bogus.push(`${f} has no reviewed_against`)
      continue
    }
    /* REACHABILITY, matching step 4b. This asked only whether the object exists
     * while 4b asked whether HEAD can reach it — the same question with two
     * answers in one tree, and ARCHITECTURE.md states the reachability rule
     * categorically for both. A YAML file pinned to a real commit on an
     * abandoned line of history passed here and would have failed as a Markdown
     * header. */
    if (String(sha) !== UNSET_SHA && g.head && !isAncestorOfHead(String(sha)))
      bogus.push(`${f} -> ${sha} is not a commit reachable from HEAD`)
  }
  if (bogus.length) fail(`canonical YAML provenance: ${bogus.join('; ')}`)
  else
    pass(
      `all ${Object.keys(yamls).length} canonical YAML files carry a reviewed_against commit reachable from HEAD`,
    )
}

/* 5 — referenced local paths resolve, and resolve INSIDE the repository. */
{
  let brokenTotal = 0
  for (const f of [...DATED_DOCS, 'AGENTS.md', 'CLAUDE.md', 'README.md']) {
    if (!exists(f)) continue
    const broken = referencedPaths(read(f), BRAIN.doc_roots).filter((p) => !existsInRepo(p))
    if (broken.length) {
      brokenTotal += broken.length
      warn(
        `${f} references ${broken.length} path(s) that do not exist: ${broken.slice(0, 4).join(', ')}${broken.length > 4 ? ' …' : ''}`,
      )
    }
  }
  if (brokenTotal === 0) pass('every referenced repo path resolves inside the repository')
}

/* 6 — git state */
if (g.head) {
  pass(`branch ${g.branch} @ ${g.headShort}`)
  if (g.dirty) warn('working tree is DIRTY — commit or stash before trusting a checkpoint')
} else {
  warn('not a git repository (or git unavailable) — freshness cannot be computed')
}

/* 6b — how this working copy stands against its canonical remote.
 *      OFFLINE: it compares against the remote-tracking ref as of the LAST
 *      FETCH and performs no network operation. UNKNOWN is a real answer and
 *      never a guess — the fail-closed rule. */
const sync = classifyRepoSync()
if (sync.state === 'SYNCED') pass(`repository sync SYNCED against ${sync.upstream} (${sync.basis})`)
else if (sync.state === 'UNKNOWN') warn(`repository sync UNKNOWN — ${sync.reason}. UNKNOWN is not "probably fine"`)
else
  warn(
    `repository sync ${sync.state}${sync.upstream ? ` against ${sync.upstream}` : ''}` +
      `${sync.ahead || sync.behind ? ` (ahead ${sync.ahead}, behind ${sync.behind})` : ''}` +
      ' — NOT promotable as a snapshot source',
  )

/* 7 — HEAD vs the audited base, as ONE classification a reader can act on.
 *
 * Four states, no git required of the reader: CURRENT · DOCS-ONLY ADVANCE ·
 * SUBSYSTEM STALE · UNKNOWN. `REPO_STATE.json` is excluded from the diff
 * because the commit that writes it necessarily lands after the base it
 * records. Any code change still raises SUBSYSTEM STALE.
 *
 * AN UNRESOLVABLE BASE IS A FAILURE, NOT A SHRUG: it means the freshness
 * question was never answered, and reporting an unanswered question as CURRENT
 * is precisely the fail-open the fail-closed rule forbids. A base that is
 * simply ABSENT — a fresh clone before the first checkpoint — is a WARN
 * instead, deliberately: nothing is being misreported there, the state file
 * has just not been generated yet. */
const base = repoState?.code_review_base
let freshness = 'UNKNOWN'
if (!g.head) {
  warn('freshness UNKNOWN — git is unavailable, so nothing can be compared')
} else if (!base) {
  warn(`freshness UNKNOWN — ${REPO_STATE} declares no code_review_base`)
} else {
  const d = classifyDrift(base)
  freshness = d.freshness
  if (!d.resolved) {
    fail(
      `freshness UNKNOWN — code_review_base "${String(base).slice(0, 40)}" is not a commit reachable from HEAD in this repository, so what moved since it is unanswerable and must never be reported as CURRENT`,
    )
  } else if (d.freshness === 'CURRENT') {
    pass(
      base === g.head
        ? `freshness CURRENT — Project Brain audited against this exact tree (${base.slice(0, 7)})`
        : `freshness CURRENT — only checkpoint bookkeeping moved since ${base.slice(0, 7)}`,
    )
  } else if (d.freshness === 'DOCS-ONLY ADVANCE') {
    pass(
      `freshness DOCS-ONLY ADVANCE — ${d.changed.length} file(s) changed since ${base.slice(0, 7)}, none under ${CODE_ROOTS.join(' ')} — claims about the tooling still describe this tree`,
    )
  } else {
    warn(
      `freshness SUBSYSTEM STALE — ${d.code.length} code file(s) changed since ${base.slice(0, 7)} — re-verify before trusting detail claims`,
    )
    for (const s of d.staleDocs) warn(`  ${s.doc} describes code that changed (${s.files} file(s))`)
    if (d.unmapped.length)
      warn(`  ${d.unmapped.length} changed code path(s) map to no doc subsystem: ${d.unmapped.slice(0, 4).join(', ')}`)
  }
}

/* 8 — one canonical source per fact */
if (yamls['PROJECT.yaml']) {
  const p = yamls['PROJECT.yaml']
  const declared = Object.values(p.canonical_docs ?? {})
  const dupes = declared.filter((v, i) => declared.indexOf(v) !== i)
  if (dupes.length) fail(`PROJECT.yaml declares the same canonical doc twice: ${[...new Set(dupes)].join(', ')}`)
  else pass('no duplicate canonical-source declarations')

  const brainBranch = p.active_branch
  if (brainBranch && g.branch && brainBranch !== g.branch) {
    warn(`PROJECT.yaml active_branch is "${brainBranch}" but the checkout is on "${g.branch}"`)
  }
}

/* 9 — feature matrix hygiene: declared vocabulary only, every surface declared,
 *     and no hardware_verified without evidence a reader can open. */
if (yamls['FEATURE_MATRIX.yaml']) {
  const fm = yamls['FEATURE_MATRIX.yaml']
  const feats = fm.features ?? {}
  const surfaces = Array.isArray(fm.surfaces) ? fm.surfaces : []
  const META = ['phase', 'authority', 'notes', 'evidence']
  const problems = []
  for (const [id, v] of Object.entries(feats)) {
    if (!v || typeof v !== 'object') {
      problems.push(`${id}: not a mapping`)
      continue
    }
    for (const [k, s] of Object.entries(v)) {
      if (META.includes(k)) continue
      if (!surfaces.includes(k)) problems.push(`${id}: "${k}" is not a declared surface`)
      if (!FEATURE_STATES.includes(String(s))) problems.push(`${id}.${k}: state "${s}" is not in the declared vocabulary`)
    }
    if (!v.phase) problems.push(`${id}: missing phase`)
    if (!v.authority) problems.push(`${id}: missing authority`)
    if (Object.values(v).includes('hardware_verified') && !v.evidence)
      problems.push(`${id}: hardware_verified without an evidence path`)
    if (v.evidence && !existsInRepo(evidencePath(v.evidence)))
      problems.push(`${id}: evidence path does not exist: ${v.evidence}`)
  }
  if (problems.length) fail(`feature matrix: ${problems.join('; ')}`)
  else
    pass(
      `feature matrix: ${Object.keys(feats).length} features across ${surfaces.length} surfaces, every state in vocabulary, every evidence path resolves`,
    )
}

/* 10 — the release ledger: deterministic answers to "what blocks acceptance"
 *      and "agent or owner". It is a PROJECTION of TASKS.md, so every id must
 *      exist there; a ledger that could drift from its source would be worse
 *      than no ledger at all. The declared counts are checked against the
 *      entries, so a hand-edited summary cannot quietly disagree with its rows. */
if (yamls['PROJECT.yaml']) {
  const rel = yamls['PROJECT.yaml'].release
  if (!rel || typeof rel !== 'object') {
    fail('PROJECT.yaml has no `release:` ledger — "what blocks acceptance" is not machine-answerable')
  } else {
    const tasksDoc = exists('TASKS.md') ? read('TASKS.md') : ''
    const entries = Object.entries(rel.tasks ?? {})
    const problems = []
    for (const [id, t] of entries) {
      if (!TASK_ID_RE.test(id)) problems.push(`${id}: not a ${ID_PREFIX}-T-nnn id`)
      if (!t || typeof t !== 'object') {
        problems.push(`${id}: not a mapping`)
        continue
      }
      if (!RELEASE_ACTORS.includes(t.actor)) problems.push(`${id}: actor "${t.actor}" not in ${RELEASE_ACTORS.join('|')}`)
      if (typeof t.blocking !== 'boolean') problems.push(`${id}: blocking must be true or false`)
      if (!RELEASE_PHASES.includes(t.phase)) problems.push(`${id}: phase "${t.phase}" not in ${RELEASE_PHASES.join('|')}`)
      if (!t.status) problems.push(`${id}: missing status`)
      if (!t.purpose) problems.push(`${id}: missing purpose`)
      if (!t.authority) problems.push(`${id}: missing authority`)
      if (t.blocking === true && t.phase === 'later') problems.push(`${id}: blocking but filed as later`)
      if (t.blocking === true && t.phase === 'closed') problems.push(`${id}: blocking but closed`)
      if (t.outcome_provenance && !PROVENANCE.includes(t.outcome_provenance))
        problems.push(`${id}: outcome_provenance "${t.outcome_provenance}" not in ${PROVENANCE.join('|')}`)
      if (t.evidence && !existsInRepo(evidencePath(t.evidence)))
        problems.push(`${id}: evidence path does not exist: ${t.evidence}`)
      if (tasksDoc && !tasksDoc.includes(id)) problems.push(`${id}: absent from TASKS.md — the ledger must not invent work`)
    }
    const blocking = entries.filter(([, t]) => t?.blocking === true)
    const s = rel.summary ?? {}
    const counted = {
      blocking_total: blocking.length,
      blocking_agent: blocking.filter(([, t]) => t.actor === 'agent').length,
      blocking_owner: blocking.filter(([, t]) => t.actor === 'owner').length,
      blocking_external: blocking.filter(([, t]) => t.actor === 'external').length,
    }
    for (const [k, v] of Object.entries(counted)) {
      if (s[k] !== undefined && s[k] !== v) problems.push(`summary.${k} says ${s[k]} but the entries count ${v}`)
    }
    for (const [gid, gate] of Object.entries(rel.gates ?? {})) {
      if (!gate?.requires) problems.push(`gate ${gid}: missing requires (use NONE for a verification step)`)
      else if (gate.requires !== 'NONE' && !rel.tasks?.[gate.requires])
        problems.push(`gate ${gid}: requires ${gate.requires}, which is not in the ledger`)
      if (!gate?.source) problems.push(`gate ${gid}: missing source`)
      if (!gate?.status) problems.push(`gate ${gid}: missing status`)
    }
    if (problems.length) fail(`release ledger: ${problems.join('; ')}`)
    else
      pass(
        `release ledger: ${entries.length} tasks, ${counted.blocking_total} blocking (${counted.blocking_agent} agent / ${counted.blocking_owner} owner / ${counted.blocking_external} external), ${Object.keys(rel.gates ?? {}).length} gates`,
      )
  }
}

/* 11 — service registry: metadata only, UNKNOWN where unverified. */
if (yamls['SERVICES.yaml']) {
  const svcs = Object.entries(yamls['SERVICES.yaml'].services ?? {})
  const problems = []
  for (const [id, s] of svcs) {
    if (!s || typeof s !== 'object') {
      problems.push(`${id}: not a mapping`)
      continue
    }
    for (const field of ['id', 'purpose', 'status', 'login_identity', 'secret_ref']) {
      if (!s[field]) problems.push(`${id}: missing ${field} (use UNKNOWN or NONE_CONFIGURED rather than omitting it)`)
    }
    if (s.id && s.id !== id) problems.push(`${id}: id field says "${s.id}"`)
  }
  if (problems.length) fail(`SERVICES.yaml: ${problems.join('; ')}`)
  else pass(`service registry: ${svcs.length} service(s), every entry carries status, login_identity and secret_ref`)
}

/* 11b — vault state coupling. Deciding WHICH vault to adopt is not the same as
 *       having one, and the gap between those two is exactly where a document
 *       starts implying a credential store exists. Structural only — the three
 *       facts must agree, and no prose is matched. A named PRODUCT is
 *       deliberately NOT evidence of any of them. */
if (yamls['SERVICES.yaml'] && yamls['PROJECT.yaml']) {
  const v = yamls['SERVICES.yaml'].vault ?? {}
  const projectSays = yamls['PROJECT.yaml'].security?.vault_configured
  const svcSays = v.configured
  const resolved = Object.entries(yamls['SERVICES.yaml'].services ?? {}).filter(
    ([, s]) => s?.secret_ref && !['NONE_CONFIGURED', 'UNKNOWN'].includes(String(s.secret_ref)),
  )
  const problems = []
  if (projectSays !== svcSays)
    problems.push(`PROJECT.yaml says vault_configured=${projectSays} but SERVICES.yaml vault.configured=${svcSays}`)
  if (v.provisioned === true && svcSays !== true) problems.push('vault.provisioned is true while vault.configured is not')
  if (svcSays !== true && resolved.length)
    problems.push(
      `no vault is configured, yet ${resolved.length} secret_ref(s) claim to resolve: ${resolved.map(([id]) => id).join(', ')}`,
    )
  if (svcSays === true && v.secret_ref_scheme === 'UNKNOWN')
    problems.push('vault.configured is true but secret_ref_scheme is still UNKNOWN')
  if (problems.length) fail(`vault state: ${problems.join('; ')}`)
  else
    pass(
      `vault state consistent: configured=${svcSays}, product ${v.product && !/^UNKNOWN\b/i.test(String(v.product)) ? 'named' : 'UNKNOWN'} (naming one proves nothing), ${resolved.length} resolving secret_ref(s)`,
    )
}

/* 11c — governed external code repositories (`UPS-D-021`).
 *
 *       OPTIONAL BY CONSTRUCTION, and validated only when the registry exists.
 *       A Brain whose code lives in its own tree governs nothing external and
 *       ships neither file; making either mandatory would fail every such Brain
 *       — this repository included — which is why the shape here follows
 *       `SERVICES.yaml` at step 11 rather than the canonical-set rule at step 1.
 *
 *       OFFLINE. This step never reaches a governed repository. It judges the
 *       RECORD: does the registry satisfy the declared schema, does the
 *       generated baseline look generated, and is what it says still usable.
 *       Reading a governed repository's current head is a network act and lives
 *       in `tools/context/observe-external.mjs`, deliberately outside this gate
 *       so the gate keeps needing no network and no credential.
 *
 *       DRIFT AND STALENESS WARN; a broken record FAILS. Code moving after a
 *       document was written is the ordinary condition of a live product, and a
 *       gate that failed on it would fail every day and be switched off. */
if (exists(EXTERNAL_REGISTRY)) {
  let registry = null
  try {
    registry = readRegistry(parseYaml(read(EXTERNAL_REGISTRY)))
  } catch (e) {
    fail(`${EXTERNAL_REGISTRY} does not parse: ${e instanceof YamlError ? e.message : e}`)
  }
  if (registry) {
    if (registry.problems.length) fail(`${EXTERNAL_REGISTRY}: ${registry.problems.join('; ')}`)
    else pass(`${EXTERNAL_REGISTRY}: ${Object.keys(registry.repos).length} governed repositor${Object.keys(registry.repos).length === 1 ? 'y' : 'ies'}, every entry carrying remote, branch, role, governs and authority`)

    let baselineRaw = null
    let baselineBroken = false
    if (entryExists(REVIEW_BASELINE)) {
      try {
        baselineRaw = JSON.parse(read(REVIEW_BASELINE))
      } catch (e) {
        fail(`${REVIEW_BASELINE} does not parse: ${e.message} — regenerate with \`make external-observe\`, never hand-write it`)
        baselineBroken = true
      }
    }
    if (!baselineBroken) {
      const b = readBaseline(baselineRaw)
      if (b.problems.length)
        fail(`${REVIEW_BASELINE} does not look generated: ${b.problems.join('; ')} — regenerate with \`make external-observe\`, never hand-write it`)
      else if (b.generated) pass(`${REVIEW_BASELINE} carries its generator stamp and well-formed rows (detection, not proof)`)
      else warn(`${REVIEW_BASELINE} not generated yet — run \`make external-observe\``)

      if (!registry.problems.length) {
        const rows = classifyExternalRows(registry, b.entries, new Date())
        const summary = externalSummary(rows)
        for (const r of rows) {
          if (r.fatal) fail(`governed repository ${r.id}: ${r.state} — ${r.reason}`)
          else if (!r.ok) warn(`governed repository ${r.id}: ${r.state} — ${r.reason}`)
        }
        if (rows.length && !summary.fail && !summary.warn)
          pass(`governed repositories: all ${rows.length} CURRENT against the recorded baseline (offline — the record, not a live read)`)
      }
    }
  }
} else {
  pass(`no ${EXTERNAL_REGISTRY} — this Brain declares no governed external repository, which is the ordinary case`)
}

/* 12 — secret hygiene, in two halves.
 *      (a) a canonical YAML file may NAME a key; it may never carry its value.
 *          `secret_ref` labels are allowed by construction — the pattern
 *          matches value-bearing keys only.
 *      (b) some values are a credential whatever they are called.
 *
 *      SCOPE IS THE DECLARED CANONICAL SET PLUS WHAT THE CORE PACK INLINES, AND
 *      NOTHING ELSE. This check never opens `.env`, `.git/`, a home directory or
 *      another repository — the secrets policy forbids going looking, and a
 *      scanner that wandered would create exposure rather than reduce it. The
 *      scope limit is disclosed in the PASS line so no reader mistakes it for a
 *      repository-wide clearance.
 *
 *      THE EXTRA CORE SECTIONS ARE IN SCOPE BECAUSE THE PACK INLINES THEM. The
 *      canonical set alone was a fail-open: `brain.pack_extra_core_sections` is
 *      committable repository content that may name any path in the tree, and
 *      `pack.mjs` copies each one into the generated pack verbatim. A value
 *      pointing outside the canonical set put its contents — credential shapes
 *      included — into the artifact handed to a model or a person, while this
 *      step printed PASS and `make brain-gate` exited 0. Sweeping what the pack
 *      actually carries is what makes `pack.mjs`'s own categorical true — BOTH
 *      profiles of it, since `--full` inlines a project's FULL-only sections by
 *      the same route. */
{
  const leaks = []
  const scan = [
    ...CANONICAL_YAML,
    ...CANONICAL_DOCS,
    ...DATED_DOCS,
    ...EXTRA_CORE_SECTION_PATHS,
    ...EXTRA_FULL_SECTION_PATHS,
    /* The governed-repository registry is committed content carrying REMOTE
     * URLS, which is precisely the shape a credential hides in — an
     * remote embedding credentials in the userinfo position is a leak that also
     * happens to work.
     * `readRegistry` refuses that form outright, but a refusal in one validator
     * is not a reason to leave the file unswept: the sweep is what makes the
     * secret-hygiene PASS line true about everything committed here. */
    EXTERNAL_REGISTRY,
  ].filter((f) => exists(f))
  const seen = new Set()
  for (const f of scan) {
    if (seen.has(f)) continue
    seen.add(f)
    read(f)
      .split('\n')
      .forEach((line, i) => {
        /* BOTH CHECKS, EVERY LINE, EVERY FILE — no comment exemption anywhere.
         * The per-line decision lives in lib.mjs so a regression control can
         * reach it: it used to be inline here, where nothing could test it, and
         * that is precisely how a blind spot in it survived a full round of
         * independent review. */
        const finding = secretFindingForLine(line)
        if (finding) leaks.push(`${f}:${i + 1} ${finding}`)
      })
  }
  if (leaks.length) fail(`possible secret VALUE in a scanned file: ${leaks.join(', ')} — remove it, do not print it`)
  else
    pass(
      `secret hygiene: ${seen.size} file(s) — the canonical set plus what the CORE pack inlines — every line scanned for ${SECRET_VALUE_PATTERNS.length} credential shapes and value-bearing keys, none found (that set only — NOT a repository-wide clearance)`,
    )
}

/* 13 — provenance pins. An OWNER DETERMINATION is a judgement, not a
 *      measurement, and must never be re-labelled as one. */
if (yamls['FEATURE_MATRIX.yaml']) {
  const cls = yamls['FEATURE_MATRIX.yaml'].classifications ?? {}
  const problems = []
  for (const [k, c] of Object.entries(cls)) {
    if (!c || typeof c !== 'object') {
      problems.push(`${k}: not a mapping`)
      continue
    }
    if (!PROVENANCE.includes(c.provenance)) problems.push(`${k}: provenance "${c.provenance}" not in ${PROVENANCE.join('|')}`)
    if (!c.authority) problems.push(`${k}: missing authority`)
    if (c.provenance === 'owner_determination' && !c.repo_measurement)
      problems.push(`${k}: an owner_determination must state its repo_measurement (none | partial | yes)`)
  }
  for (const k of PINNED_OWNER_DETERMINATIONS) {
    if (!cls[k]) problems.push(`${k}: PINNED owner determination is missing from classifications`)
    else if (cls[k].provenance !== 'owner_determination')
      problems.push(
        `${k}: PINNED as owner_determination but reads "${cls[k].provenance}" — never flatten a determination into a measurement`,
      )
  }
  if (problems.length) fail(`provenance: ${problems.join('; ')}`)
  else
    pass(
      `provenance: ${Object.keys(cls).length} classifications, ${PINNED_OWNER_DETERMINATIONS.length} owner determination(s) pinned`,
    )
}

/* 13b — answered questions must not still read as open.
 *
 * The failure this catches is specific: an owner answers a `-Q-` with a new
 * `-D-`, the decision is recorded correctly, and a sentence somewhere else
 * still says that question "stays open". Both statements look authoritative
 * and one of them is false.
 *
 * Two checks, deliberately small. The first is STRUCTURAL and has no prose in
 * it at all: an id may not be both answered by a decision and listed in the
 * waiting room. The second scans for a TINY fixed vocabulary of present-tense
 * open-assertions, and only ever for ids that are provably answered — so
 * time-scoped history ("was open when this was recorded") passes on purpose. */
if (exists('DECISIONS.md')) {
  const text = read('DECISIONS.md')
  const { decisions, questions } = indexDecisions(text)

  const answered = new Set()
  const add = (id) => {
    if (id && QUESTION_ID_RE.test(id)) answered.add(id)
  }
  for (const d of decisions) {
    /* THE BACKTICK IS OPTIONAL, AND THAT MATTERS MORE THAN IT LOOKS. Every
     * other id in `DECISIONS.md` is written in backticks, so `(answers
     * \`UPS-Q-001\`)` is the form an author naturally writes — and `plain()`
     * does not strip backticks, so the un-tolerant pattern silently registered
     * NOTHING for it. The failure was invisible in exactly the wrong direction:
     * the decision existed, the question was correctly removed from the waiting
     * room, and this step reported "0 answered" and found no contradiction to
     * look for. A detector that quietly matches nothing is worse than one that
     * is absent, because the PASS line reads the same either way. */
    for (const m of String(d.title).matchAll(/answers?\s+`?([A-Z]+-Q-\d{3})`?/gi)) add(m[1])
    add(String(d.fields.supersedes ?? '').match(/[A-Z]+-Q-\d{3}/)?.[0])
  }
  const openIds = new Set(questions.map((q) => q.id))

  const problems = []
  for (const id of answered) {
    if (openIds.has(id)) problems.push(`${id}: answered by a decision AND still listed as an open question`)
  }

  const OPEN_CLAIM = /(?:stays?|remains?|is|are|still)\s+open/i
  const scan = [...CANONICAL_DOCS, ...CANONICAL_YAML, ...DATED_DOCS].filter((f) => exists(f))
  const seen = new Set()
  for (const f of scan) {
    if (seen.has(f)) continue
    seen.add(f)
    read(f)
      .split('\n')
      .forEach((line, i) => {
        for (const id of answered) {
          if (!line.includes(id)) continue
          let tail = line.slice(line.indexOf(id) + id.length, line.indexOf(id) + 120)
          const next = tail.search(/[A-Z]+-Q-\d{3}/)
          if (next !== -1) tail = tail.slice(0, next)
          const hit = tail.match(OPEN_CLAIM)
          const past = hit && /\b(?:was|were)\s+$/.test(tail.slice(0, hit.index))
          if (hit && !past) problems.push(`${f}:${i + 1} says ${id} is open, but a decision answers it`)
        }
      })
  }

  if (problems.length) fail(`answered questions read as open: ${problems.join('; ')}`)
  else pass(`open-question consistency: ${answered.size} answered, ${openIds.size} open, no contradiction`)
}

/* 14 — the Single Live-State Rule. Planning and contract documents reference
 *      the canonical live-state surfaces; they never mirror mutable progress.
 *      This enforces the STRUCTURAL invariant — a protected wrapper carrying a
 *      pointer and owning no live progress — and deliberately knows nothing
 *      about how much has been built, so it cannot go stale as work lands. */
{
  const problems = []
  let audited = 0
  for (const f of LIVE_STATE_DOCS) {
    if (!exists(f)) {
      problems.push(`${f}: declared in brain.live_state_docs but missing`)
      continue
    }
    audited++
    for (const p of auditLiveStateWrapper(read(f))) problems.push(`${f}: ${p}`)
  }
  if (problems.length) fail(`live-state rule: ${problems.join('; ')}`)
  else
    pass(
      `live-state rule: ${audited} planning doc(s) point to ${LIVE_STATE_SURFACES.join(', ')} and own no live progress`,
    )
}

/* 15 — verification evidence records. A record is a claim about a commit; one
 *      without a commit proves nothing about any tree. STRUCTURE ONLY — it
 *      cannot check whether what a record says is true. */
{
  const problems = []
  let records = 0
  if (existsInRepo('docs/verification')) {
    for (const entry of readDirInRepo('docs/verification')) {
      if (!entry.isDirectory()) continue
      const rel = path.join('docs/verification', entry.name, 'README.md')
      if (!exists(rel)) {
        problems.push(`${entry.name}/: no README.md — a verification directory without a record is not evidence`)
        continue
      }
      records++
      const text = read(rel)
      if (!/\b[0-9a-f]{7,40}\b/.test(text)) problems.push(`${rel}: records no commit SHA`)
      if (!/\b\d{4}-\d{2}-\d{2}\b/.test(text)) problems.push(`${rel}: records no ISO date`)
      if (!/(LIMIT|LIMITATION|WHAT THIS DOES NOT PROVE|NOT PROVEN|does not prove)/i.test(text))
        problems.push(`${rel}: states no limits — evidence that claims no boundary will be read as proving everything`)
    }
  }
  if (problems.length) fail(`verification evidence: ${problems.join('; ')}`)
  else pass(`verification evidence: ${records} record(s), each naming a commit, a date and its own limits`)
}

/* 16 — context size limits. A Brain nobody can read in one sitting is not a
 *      Brain; these are targets, so they WARN rather than FAIL. */
for (const [f, max] of Object.entries(SIZE_LIMITS)) {
  if (!exists(f)) continue
  const n = read(f).split('\n').length
  if (n > Number(max)) warn(`${f} is ${n} lines (target <= ${max})`)
}
pass('size targets checked')

/* The pack is generated and gitignored, so it is present on some runs and not
 * others. Its budget line is reported only when it exists — which is why the
 * PASS total differs by one between a run with a pack and a run without. */
if (existsInRepo(PACK_PATH)) {
  const bytes = fs.statSync(repoPath(PACK_PATH)).size
  const approxTokens = Math.round(bytes / 4)
  if (approxTokens > PACK_TOKEN_TARGET) warn(`context pack ~${approxTokens} tokens (target <= ${PACK_TOKEN_TARGET / 1000}k)`)
  else pass(`context pack ~${approxTokens} tokens`)
}

/* ── Report ───────────────────────────────────────────────────────────────── */
const fails = results.filter((r) => r[0] === 'FAIL')
const warns = results.filter((r) => r[0] === 'WARN')

for (const [level, msg] of results) {
  if (level === 'PASS') continue
  console.log(`${level}  ${msg}`)
}
for (const [level, msg] of results) if (level === 'PASS') console.log(`PASS  ${msg}`)

console.log(`\nFRESHNESS: ${freshness}`)
console.log(`REPOSITORY SYNC: ${sync.state}`)
console.log(
  `${fails.length ? 'FAIL' : warns.length ? 'WARN' : 'PASS'} — ${results.length - fails.length - warns.length} pass, ${warns.length} warn, ${fails.length} fail`,
)
console.log('STRUCTURAL RESULT ONLY. It says nothing about whether a status, decision or verification claim is honest.')
process.exit(fails.length ? 1 : 0)
