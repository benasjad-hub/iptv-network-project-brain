/**
 * `context:pack-audit` — can a fresh agent still orient from the CORE pack?
 *
 * The CORE pack summarizes three canonical files instead of inlining them
 * (`pack.mjs`). Summarizing is only safe if the pack still carries the facts a
 * fresh session must recover before it is allowed to touch anything. This is
 * the regression control for exactly that.
 *
 * WHAT IT PROVES, PRECISELY: that for each required fact, evidence to recover
 * it is PRESENT in the generated CORE pack. It is a CONTAINMENT check, not a
 * comprehension test — it cannot show that a model would read the evidence
 * correctly. Judging that is a fresh-session run, which no script can replace
 * and which this file does not claim to be.
 *
 * THE ANSWER KEY IS DERIVED, NOT TYPED. Every generic expectation below is
 * computed from the canonical files themselves — the project id from
 * `PROJECT.yaml`, the decision, question and feature ids from their own
 * sources — so this file names no project, no decision and no repository, and
 * cannot go stale as a Brain grows. The project-specific half is a list of
 * phrases the project itself declares in `brain.pack_audit_required_phrases`:
 * the expectations live in the Brain being audited, never in the auditor, and
 * nothing is injected into the pack to make them pass.
 *
 * Deterministic and read-only, like the rest of the tooling.
 */
import {
  BRAIN,
  PACK_PATH,
  exists,
  existsInRepo,
  indexDecisions,
  indexFeatures,
  parseYaml,
  read,
  uncontainedPaths,
} from './lib.mjs'

/* `existsInRepo`, not a bare existsSync: PACK_PATH comes out of PROJECT.yaml,
 * and this reads the file it names. Every other consumer of that value is
 * containment-checked; this one was the outlier. */
if (!existsInRepo(PACK_PATH)) {
  console.log(`FAIL  ${PACK_PATH} does not exist inside this repository — run \`make context-pack\` first`)
  process.exit(1)
}

/* Same reason as pack.mjs: this is a standalone target that never runs
 * check.mjs, and it reads the canonical sources to DERIVE its expectations. */
{
  const bad = uncontainedPaths([PACK_PATH, 'DECISIONS.md', 'FEATURE_MATRIX.yaml', 'PROJECT.yaml'])
  if (bad.length) {
    console.log(`FAIL  path(s) do not resolve to a plain file inside this repository: ${bad.join(', ')}`)
    process.exit(1)
  }
}
const pack = read(PACK_PATH)
const has = (...needles) => needles.every((n) => pack.includes(n))

/** The body of one `## <title>` section, up to the next `## ` heading. */
const section = (title) => {
  const i = pack.indexOf(`\n${title}\n`)
  if (i === -1) return ''
  const rest = pack.slice(i + title.length + 2)
  const end = rest.search(/\n## /)
  return end === -1 ? rest : rest.slice(0, end)
}

/* Read the canonical sources so the id checks below are DERIVED, not hard-coded:
 * an audit whose expectations were typed out by hand would go stale the moment a
 * decision or feature was added — and would then be edited rather than believed. */
const canonical = { decisions: [], questions: [], features: [], projectId: '' }
if (exists('DECISIONS.md')) {
  const idx = indexDecisions(read('DECISIONS.md'))
  canonical.decisions = idx.decisions.filter((d) => d.section === 'active')
  canonical.questions = idx.questions
}
if (exists('FEATURE_MATRIX.yaml')) {
  try {
    canonical.features = indexFeatures(parseYaml(read('FEATURE_MATRIX.yaml')).features)
  } catch {
    /* check.mjs reports an unparseable matrix; the audit should still run. */
  }
}
if (exists('PROJECT.yaml')) {
  try {
    canonical.projectId = String(parseYaml(read('PROJECT.yaml')).project_id ?? '')
  } catch {
    /* likewise */
  }
}

const decisionsIndex = () => section('## DECISIONS INDEX — canonical source: `DECISIONS.md`')
const featureIndex = () => section('## FEATURE MATRIX INDEX — canonical source: `FEATURE_MATRIX.yaml`')

/* ── The generic checks: true of any Project Brain, naming none ───────────── */
const CHECKS = [
  [
    'project identity is recoverable',
    () => Boolean(canonical.projectId) && has(canonical.projectId, 'project_id'),
  ],

  [
    'every binding decision id appears in the decisions index',
    () => {
      const idx = decisionsIndex()
      const missing = canonical.decisions.filter((d) => !idx.includes(d.id))
      if (missing.length) console.log(`      missing decision ids: ${missing.map((d) => d.id).join(', ')}`)
      /* A BRAIN WITH NO DECISIONS PASSES THIS, VACUOUSLY AND OUT LOUD.
       *
       * This check asks whether the pack CONTAINS every decision the canonical
       * file records. With none recorded there is nothing to contain, and the
       * answer is yes. Requiring at least one conflated "the pack is complete"
       * with "the project has decided something" — two different claims — and
       * failed every freshly installed Brain, whose DECISIONS.md is empty BY
       * CONSTRUCTION because neither an installer nor an agent may write an
       * owner decision. The failure message named no reason a reader could act
       * on, which is how a correct empty state gets "fixed" by inventing a
       * decision: the worst outcome this whole system exists to prevent.
       *
       * It is announced rather than silent, so nobody reads the PASS as
       * evidence that decisions exist. */
      if (canonical.decisions.length === 0) {
        console.log('      no decision is recorded in DECISIONS.md — nothing to contain, so this passes vacuously')
      }
      return missing.length === 0
    },
  ],
  [
    'every open question id appears, and is presented as open',
    () => {
      const idx = decisionsIndex()
      const missing = canonical.questions.filter((q) => !idx.includes(q.id))
      if (missing.length) console.log(`      missing question ids: ${missing.map((q) => q.id).join(', ')}`)
      return missing.length === 0 && (canonical.questions.length === 0 || idx.includes('OPEN question'))
    },
  ],
  [
    'every feature row appears with a state',
    () => {
      const idx = featureIndex()
      const missing = canonical.features.filter((f) => !idx.includes(f.id))
      if (missing.length) console.log(`      missing feature ids: ${missing.slice(0, 6).map((f) => f.id).join(', ')}`)
      return canonical.features.length > 0 && missing.length === 0
    },
  ],
  [
    'the pack declares itself derived and non-authoritative',
    () => has('GENERATED FILE', 'canonical file wins'),
  ],
  ['the pack declares that an index is not the source', () => has('AN INDEX IS A FINDING AID, NEVER THE SOURCE')],
  ['history is declared excluded by construction', () => has('EXCLUDED BY CONSTRUCTION', 'docs/history/')],
  [
    'the secrets rule travels with the pack',
    () => has('SECRETS POLICY') && has('secret_ref'),
  ],
]

/* ── The project's own required phrases ───────────────────────────────────── */
/* Each is a fact THIS Brain says a fresh session must be able to recover. The
 * list is the project's, declared in PROJECT.yaml; this file supplies none. */
for (const phrase of BRAIN.pack_audit_required_phrases) {
  const p = String(phrase)
  CHECKS.push([`declared orientation fact is recoverable: "${p}"`, () => pack.includes(p)])
}

let failed = 0
for (const [name, fn] of CHECKS) {
  let ok = false
  try {
    ok = Boolean(fn())
  } catch (e) {
    /* A CHECK THAT THREW HAS NOT PASSED. No fixture reaches this branch — every
     * predicate above is a string test over an already-read pack — so mutating
     * `ok = false` to `ok = true` survives the guard suite, and that is said here
     * rather than left for the next reviewer to re-derive. It is defence against
     * a predicate added later that can throw, and the direction it fails in is
     * the safe one. */
    console.log(`      ${name}: threw ${e.message}`)
    ok = false
  }
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
}

if (!BRAIN.pack_audit_required_phrases.length) {
  console.log('WARN  brain.pack_audit_required_phrases is empty — only the generic containment checks ran')
}

console.log()
console.log(
  `${failed ? 'FAIL' : 'PASS'} — ${CHECKS.length - failed}/${CHECKS.length} orientation facts contained in the CORE pack`,
)
console.log('CONTAINMENT ONLY. It does not prove a model would read them correctly — that is a fresh-session test.')
process.exit(failed ? 1 : 0)
