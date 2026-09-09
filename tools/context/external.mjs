/**
 * `external:check` — is what this Brain believes about the code repositories it
 * governs still trustworthy?
 *
 * READ-ONLY AND OFFLINE, and deterministic over the tree WITH ONE STATED
 * EXCEPTION: `STALE_OBSERVATION` is a function of wall-clock time at the moment
 * this runs, so it is the one verdict here that can change with no commit in
 * between. Everything else answers from the tree alone. Saying "deterministic"
 * flatly would have been an overclaim in the file that exists to refuse those.
 *
 * It opens two files inside this repository and nothing else: the committed registry `EXTERNAL_REPOS.yaml`
 * and the generated record `REVIEW_BASELINE.json`. It makes NO network call,
 * needs NO credential, and — this is the load-bearing part — it never touches a
 * governed repository. That separation is `UPS-D-021` property 3, and it is why
 * this step can sit inside `make brain-gate` while the observation that feeds it
 * cannot.
 *
 * WHAT IT ANSWERS: "is the recorded baseline still a thing a reader may rely
 * on?" WHAT IT CANNOT ANSWER: "what is in the governed repository right now."
 * Only `tools/context/observe-external.mjs` can ask that, because only it is
 * allowed to reach the network. A stale record therefore classifies as STALE,
 * never as CURRENT — the fail-closed rule (`UPS-D-015`) applied to a second
 * repository.
 *
 * NOTHING HERE NAMES A PROJECT OR A REPOSITORY. The registry is per-project
 * committed content; this file is the standard.
 */
import {
  EXTERNAL_REGISTRY,
  REVIEW_BASELINE,
  YamlError,
  classifyExternalRows,
  exists,
  externalSummary,
  parseYaml,
  read,
  readBaseline,
  readRegistry,
  uncontainedPaths,
} from './lib.mjs'

/* The same containment gate every standalone target carries. `check.mjs`'s own
 * gate does not run here, and a link at either path would make this run read a
 * registry or a baseline from outside the repository — which is how a Brain
 * ends up reporting another tree's answer as its own. */
{
  const bad = uncontainedPaths([EXTERNAL_REGISTRY, REVIEW_BASELINE])
  if (bad.length) {
    console.error(
      `external:check: refusing to read — path(s) do not resolve to a plain file inside this repository: ${bad.join(', ')}`,
    )
    process.exit(1)
  }
}

/* A Brain that governs no external repository is the ORDINARY case, not a
 * degenerate one: the Universal repository itself is one, and so is any product
 * whose code lives in the same tree as its Brain. Absence of the registry is
 * therefore a clean PASS with an explicit line saying so — never a warning that
 * trains readers to expect the file. */
if (!exists(EXTERNAL_REGISTRY)) {
  console.log(`PASS  no ${EXTERNAL_REGISTRY} — this Brain declares no governed external repository`)
  console.log('      A Brain whose code lives in its own tree needs none. Nothing to classify.')
  console.log('\nEXTERNAL REPOSITORIES: NONE DECLARED')
  process.exit(0)
}

let registry
try {
  registry = readRegistry(parseYaml(read(EXTERNAL_REGISTRY)))
} catch (e) {
  console.error(`external:check: ${EXTERNAL_REGISTRY} does not parse: ${e instanceof YamlError ? e.message : e}`)
  process.exit(1)
}

if (registry.problems.length) {
  for (const p of registry.problems) console.log(`FAIL  ${EXTERNAL_REGISTRY}: ${p}`)
  console.log('\nEXTERNAL REPOSITORIES: UNKNOWN')
  console.log('FAIL — the registry does not satisfy the declared schema; nothing was classified against it')
  process.exit(1)
}

/* The baseline is GENERATED and may legitimately be absent — a registry
 * committed before the first observation. Absent is NOT "fine": every declared
 * repository then classifies NO_BASELINE, which is a real finding, so the run
 * continues rather than exiting early. */
let baseline = null
if (exists(REVIEW_BASELINE)) {
  try {
    baseline = JSON.parse(read(REVIEW_BASELINE))
  } catch (e) {
    console.error(`external:check: ${REVIEW_BASELINE} exists but does not parse (${e.message}).`)
    console.error('Delete it and re-run `make external-observe`; never hand-write a generated record.')
    process.exit(1)
  }
}

const readBase = readBaseline(baseline)
if (readBase.problems.length) {
  for (const p of readBase.problems) console.log(`FAIL  ${REVIEW_BASELINE}: ${p}`)
  console.log('\nEXTERNAL REPOSITORIES: UNKNOWN')
  console.log(
    `FAIL — ${REVIEW_BASELINE} does not look generated; regenerate with \`make external-observe\`, never hand-write it`,
  )
  process.exit(1)
}

const rows = classifyExternalRows(registry, readBase.entries, new Date())
const summary = externalSummary(rows)

for (const r of rows) {
  const level = r.ok ? 'PASS' : r.fatal ? 'FAIL' : 'WARN'
  console.log(`${level}  ${r.id}: ${r.state} — ${r.reason}`)
}

console.log(`\nEXTERNAL REPOSITORIES: ${summary.verdict}`)
console.log(
  `${summary.fail ? 'FAIL' : summary.warn ? 'WARN' : 'PASS'} — ${rows.length} governed repositor${rows.length === 1 ? 'y' : 'ies'}: ${summary.pass} current, ${summary.warn} needing attention, ${summary.fail} failing`,
)
console.log('OFFLINE RESULT. It classifies the RECORD, not the governed repository as it stands right now.')
process.exit(summary.fail ? 1 : 0)
