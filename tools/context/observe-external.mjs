/**
 * `external:observe` — read the current head of each governed code repository
 * and record what was seen.
 *
 * THIS IS THE ONE SCRIPT IN THIS TOOLING THAT REACHES THE NETWORK, and it is
 * deliberately NOT part of `make brain-gate`. The gate is documented as needing
 * no network and no credential (`START_HERE.md` §10), and that categorical is
 * worth more than the convenience of folding this in: a gate that sometimes
 * needs a credential is a gate people stop running. `UPS-D-021` property 3
 * states the separation; this file is one half of it and `external.mjs` is the
 * other.
 *
 * IT WRITES EXACTLY ONE FILE: `REVIEW_BASELINE.json`. It never edits STATUS,
 * TASKS, DECISIONS or any document, and it never writes into a governed
 * repository — it only ever asks one for its refs.
 *
 *   --repo <id>          observe only this one (default: all declared)
 *   --local <id>=<path>  ALSO inspect a local working copy of that repository,
 *                        to record whether it was clean. THE PATH IS NOT
 *                        STORED: only the derived status is. Storing it would
 *                        put a machine-specific path into committed content,
 *                        which UPS-D-020 forbids outright.
 *   --review <id>        move that repository's reviewed_sha to the head just
 *                        observed. ASSERTS THAT YOU RE-AUDITED the Brain's
 *                        claims against that commit — the same assertion
 *                        `--adopt` makes in `checkpoint.mjs`, and passing it
 *                        without the audit fabricates the audit, not the file.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import {
  EXTERNAL_REGISTRY,
  REVIEW_BASELINE,
  REVIEW_BASELINE_GENERATOR,
  YamlError,
  exists,
  gitState,
  parseYaml,
  read,
  readBaseline,
  readRegistry,
  repoPath,
  uncontainedPaths,
  writeDestinationProblem,
} from './lib.mjs'

const argv = process.argv.slice(2)
const flag = (name) => {
  const i = argv.indexOf(name)
  return i === -1 ? null : argv[i + 1]
}
const flagAll = (name) => argv.map((a, i) => (a === name ? argv[i + 1] : null)).filter((v) => v != null)

{
  const bad = uncontainedPaths([EXTERNAL_REGISTRY, REVIEW_BASELINE])
  if (bad.length) {
    console.error(`external:observe: refusing to read — path(s) do not resolve inside this repository: ${bad.join(', ')}`)
    process.exit(1)
  }
}
if (!exists(EXTERNAL_REGISTRY)) {
  console.error(`external:observe: no ${EXTERNAL_REGISTRY} — this Brain declares no governed external repository.`)
  console.error('Nothing to observe. Create the registry first; a baseline never registers a repository on its own.')
  process.exit(1)
}
const destProblem = writeDestinationProblem(REVIEW_BASELINE)
if (destProblem) {
  console.error(`external:observe: refusing to write — ${destProblem}.`)
  process.exit(1)
}

let registry
try {
  registry = readRegistry(parseYaml(read(EXTERNAL_REGISTRY)))
} catch (e) {
  console.error(`external:observe: ${EXTERNAL_REGISTRY} does not parse: ${e instanceof YamlError ? e.message : e}`)
  process.exit(1)
}
if (registry.problems.length) {
  console.error(`external:observe: ${EXTERNAL_REGISTRY} does not satisfy the schema:`)
  for (const p of registry.problems) console.error(`  - ${p}`)
  console.error('Refusing to observe against a registry that does not parse as declared.')
  process.exit(1)
}

const only = flag('--repo')
if (only && !registry.repos[only]) {
  console.error(`external:observe: --repo "${only}" is not declared in ${EXTERNAL_REGISTRY}`)
  process.exit(1)
}
const reviewIds = new Set(flagAll('--review'))
for (const id of reviewIds) {
  if (!registry.repos[id]) {
    console.error(`external:observe: --review "${id}" is not declared in ${EXTERNAL_REGISTRY}`)
    process.exit(1)
  }
}

/* Local working copies to ALSO inspect, as `id=path`. Parsed into a map that
 * lives only for this process — nothing here is written to the record. */
const localPaths = new Map()
for (const spec of flagAll('--local')) {
  const eq = String(spec).indexOf('=')
  if (eq === -1) {
    console.error(`external:observe: --local expects "<id>=<path>", got "${spec}"`)
    process.exit(1)
  }
  const id = spec.slice(0, eq)
  if (!registry.repos[id]) {
    console.error(`external:observe: --local "${id}" is not declared in ${EXTERNAL_REGISTRY}`)
    process.exit(1)
  }
  localPaths.set(id, spec.slice(eq + 1))
}

/** Read-only, and bounded: a hung remote must not hang the operator's terminal. */
const lsRemote = (remote, branch) => {
  try {
    const out = execFileSync('git', ['ls-remote', '--heads', '--', remote, branch], {
      encoding: 'utf8',
      timeout: 60_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const line = out.split('\n').find((l) => l.trim())
    if (!line) return { observation: 'MISSING', note: `the remote answered, but carries no branch "${branch}"` }
    return { observation: 'OBSERVED', head: line.split(/\s+/)[0] }
  } catch (e) {
    const stderr = String(e.stderr ?? e.message ?? '')
    /* A repository that is gone, renamed or private-to-someone-else is a
     * DIFFERENT finding from one this machine merely could not authenticate to,
     * and collapsing them would tell an operator to go looking for a deleted
     * repository when the real answer is an expired credential. */
    const gone = /not found|does not exist|repository not found|could not read from remote/i.test(stderr)
    return {
      observation: gone ? 'MISSING' : 'UNREADABLE',
      note: gone
        ? 'the remote reports no such repository'
        : `the remote could not be read (${stderr.split('\n')[0].slice(0, 120) || 'no detail'})`,
    }
  }
}

/**
 * Was a local working copy clean? Returns `clean`, `dirty` or `UNKNOWN`.
 *
 * UNKNOWN when the path is absent or is not a git repository — never `clean`.
 * Reporting an unreadable directory as clean would be the fail-open this whole
 * system is built to refuse.
 */
const worktreeStatus = (p) => {
  try {
    const abs = path.resolve(p)
    if (!fs.existsSync(abs)) return 'UNKNOWN'
    const out = execFileSync('git', ['-C', abs, 'status', '--porcelain'], {
      encoding: 'utf8',
      timeout: 60_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return out.trim() === '' ? 'clean' : 'dirty'
  } catch {
    return 'UNKNOWN'
  }
}

const prior = exists(REVIEW_BASELINE) ? readBaseline(JSON.parse(read(REVIEW_BASELINE))).entries : {}
const now = new Date().toISOString()
const g = gitState()
const repos = {}

for (const [id, cfg] of Object.entries(registry.repos)) {
  /* A repository not observed on this run KEEPS ITS PRIOR ROW verbatim. It is
   * still governed, and dropping it would silently downgrade its state to
   * NO_BASELINE — a fabricated regression, and one that would tempt the next
   * reader to re-review something that never changed. */
  if (only && id !== only) {
    if (prior[id]) repos[id] = prior[id]
    continue
  }
  const seen = lsRemote(cfg.remote, cfg.branch)
  const row = {
    remote: cfg.remote,
    branch: cfg.branch,
    observation: seen.observation,
    observed_at: now,
    observation_method: 'git ls-remote --heads (read-only)',
  }
  if (seen.observation === 'OBSERVED') row.observed_head = seen.head
  if (seen.note) row.observation_note = seen.note

  if (localPaths.has(id)) {
    row.worktree_status = worktreeStatus(localPaths.get(id))
    row.worktree_status_note =
      'Derived from a local working copy at observation time. THE PATH IS DELIBERATELY NOT RECORDED: a machine-specific path in committed content is what UPS-D-020 forbids. UNKNOWN means the path was absent or not a git repository — never assume clean.'
  } else if (prior[id]?.worktree_status) {
    /* Carried forward, and MARKED as carried forward. Dropping it would read as
     * "clean"; silently keeping it would read as "observed on this run". */
    row.worktree_status = prior[id].worktree_status
    row.worktree_status_note = `Carried forward from the observation at ${prior[id].observed_at}; no local working copy was inspected on this run.`
  }

  const priorReviewed = prior[id]?.reviewed_sha
  if (reviewIds.has(id)) {
    if (seen.observation !== 'OBSERVED') {
      console.error(`external:observe: --review ${id} refused — this run did not observe a head (${seen.observation}).`)
      console.error('A review baseline may only be moved to a commit that was actually read.')
      process.exit(1)
    }
    row.reviewed_sha = seen.head
    row.reviewed_at = now
    row.reviewed_note =
      'Moved by an explicit --review, which ASSERTS that the Brain\'s claims about this repository were re-audited against this commit. The tool cannot verify that assertion; a reader is entitled to hold the person who passed the flag to it.'
  } else if (priorReviewed) {
    row.reviewed_sha = priorReviewed
    row.reviewed_at = prior[id].reviewed_at
    if (prior[id].reviewed_note) row.reviewed_note = prior[id].reviewed_note
  }
  repos[id] = row
}

const doc = {
  schema_version: 1,
  generator: REVIEW_BASELINE_GENERATOR,
  generated_note:
    'GENERATED FILE. Never hand-write or hand-edit it: --review asserts that the Brain was re-audited against a governed repository at a named commit, so writing this file by hand fabricates that audit. Regenerate with `make external-observe`.',
  generated_at: now,
  brain_head: g.head ?? null,
  observation_note:
    'Each row records what a READ-ONLY `git ls-remote` saw at observed_at, and nothing later. It is a fact about a moment, not a live answer: `make external-check` classifies whether that fact is still usable, offline. No governed repository is ever written to.',
  repos,
}
fs.writeFileSync(repoPath(REVIEW_BASELINE), `${JSON.stringify(doc, null, 2)}\n`)

console.log(`external:observe: wrote ${REVIEW_BASELINE} for ${Object.keys(repos).length} governed repositor${Object.keys(repos).length === 1 ? 'y' : 'ies'}`)
for (const [id, r] of Object.entries(repos)) {
  console.log(`  ${id}: ${r.observation}${r.observed_head ? ` @ ${r.observed_head.slice(0, 7)}` : ''}${r.worktree_status ? ` (worktree ${r.worktree_status})` : ''}`)
}
console.log('Now run `make external-check` — the offline classifier is what judges the record.')
