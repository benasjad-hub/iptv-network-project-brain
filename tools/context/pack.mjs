/**
 * `context:pack` — one portable orientation artifact to hand to a model or a
 * person.
 *
 * TWO LAYERS, because a pack that inlines everything grows with the project and
 * eventually forces a choice between "truncate the pack" and "compress the
 * truth". Compressing canonical truth to fit a generated artifact is the wrong
 * trade, so the pack summarizes instead:
 *
 *   CORE (default)  full text of the orientation and current-state files, plus
 *                   DETERMINISTICALLY GENERATED indexes of the three that grow
 *                   without bound — decisions, the feature matrix and the
 *                   project facts — each printed with its canonical pointer.
 *   FULL (--full)   every canonical file inlined, for handing someone a single
 *                   self-contained document. Written to a separate path so it
 *                   can never be mistaken for the CORE pack.
 *
 * AN INDEX IS NOT THE SOURCE. The CORE pack says so in its own header, and the
 * rule is load-bearing: an agent must open the canonical file before changing a
 * decision, resolving a question, moving a phase, touching a gate or a security
 * rule, or acting anywhere the rationale matters. UNKNOWN beats reconstructing
 * omitted detail.
 *
 * CANONICAL CURRENT STATE ONLY. No history: the whole point of the Project
 * Brain is that a fresh agent does not have to read the whole repository, and a
 * pack that quietly reintroduced history would defeat it. Planning documents
 * are excluded for the same reason — a plan mistaken for the present is as
 * misleading as a superseded report.
 *
 * NOTHING HERE NAMES A PROJECT. The title comes from `PROJECT.yaml`, the extra
 * CORE sections from `brain.pack_extra_core_sections`, and the excluded
 * planning documents from `brain.live_state_docs`.
 *
 * Output is gitignored, so it is generated locally and never committed.
 *
 * SECRET RULE, AND ITS EXACT CONDITIONS. Every section below derives from a file
 * `context:check` sweeps — the canonical set plus the configured extra CORE
 * sections — and summarizing cannot introduce a value the source did not have.
 * A credential file or a path under `.git/` is refused as a section where the
 * sections are parsed, so no configured value can route one in.
 *
 * **The rule is conditional on the check having run, and this target does not
 * run it.** `make brain-gate` runs `context-check` first and stops on its FAIL,
 * so nothing is written; `make context-pack` alone will happily inline a
 * credential someone planted in a canonical file. That is the gate's job, not
 * this script's, and it is stated here so no reader takes the pack's existence
 * as evidence the sweep passed.
 *
 * The header additionally stamps git state — the branch name is not swept.
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  BRAIN,
  EXTRA_CORE_SECTIONS,
  EXTRA_FULL_SECTIONS,
  ID_PREFIX,
  LIVE_STATE_DOCS,
  PACK_PATH,
  PACK_TOKEN_TARGET,
  exists,
  gitState,
  indexDecisions,
  gitOk,
  indexFeatures,
  mdTable,
  parseYaml,
  plain,
  read,
  repoPath,
  uncontainedPaths,
  writeDestinationProblem,
} from './lib.mjs'

const FULL = process.argv.includes('--full')

/* Read PROJECT.yaml once: the pack's identity comes from the Brain, never from
 * a name typed into this file. */
let project = {}
if (uncontainedPaths(['PROJECT.yaml']).length) {
  console.error('pack: refusing to read PROJECT.yaml — it does not resolve to a plain file inside this repository.')
  process.exit(1)
}
try {
  if (exists('PROJECT.yaml')) project = parseYaml(read('PROJECT.yaml'))
} catch {
  /* check.mjs reports an unparseable PROJECT.yaml; the pack should still run. */
}
const PROJECT_TITLE = String(project.project_name || project.project_id || 'Project Brain')

/**
 * The STANDARD CORE sections — orientation, now-state, active work, current
 * architecture, gate state, and the security rules an agent must not have to go
 * looking for. A project adds its own through `brain.pack_extra_core_sections`,
 * each written as `Title|path`.
 */
const STANDARD_CORE_SECTIONS = [
  ['START HERE', 'START_HERE.md'],
  ['STATUS', 'STATUS.md'],
  ['TASKS', 'TASKS.md'],
  ['ARCHITECTURE (current only)', 'docs/architecture/ARCHITECTURE.md'],
  ['RELEASE / GATE STATE', 'docs/qa/RELEASE_STATE.md'],
  ['SECRETS POLICY', 'SECRETS_POLICY.md'],
  ['SERVICES', 'SERVICES.yaml'],
  ['ACCESS MAP', 'ACCESS_MAP.yaml'],
]

/* EXTRA_CORE_SECTIONS is parsed in lib.mjs, not here, so the script that WRITES
 * the pack and the check that SWEEPS its sources cannot disagree about which
 * files the pack inlines. They did, and the pack carried unswept content. */
const CORE_SECTIONS = [...STANDARD_CORE_SECTIONS, ...EXTRA_CORE_SECTIONS]

/* Inlined only in the FULL pack: the three that grow without bound, plus the
 * registries a self-contained hand-off needs. */
const STANDARD_FULL_EXTRA_SECTIONS = [
  ['DECISIONS', 'DECISIONS.md'],
  ['FEATURE MATRIX', 'FEATURE_MATRIX.yaml'],
  ['PROJECT', 'PROJECT.yaml'],
  ['HARDWARE', 'HARDWARE.yaml'],
  ['ARTIFACTS', 'ARTIFACTS.yaml'],
  ['DESIGN INDEX', 'docs/design/DESIGN_INDEX.md'],
]

/* A project's own FULL-only sections, parsed in lib.mjs beside the CORE ones and
 * under the same refusals. THE CORE LIST IS INCLUDED IN FULL ABOVE, so this key
 * is what lets a section leave CORE without leaving the pack entirely — which is
 * the layered design's own answer to the CORE budget, and it would have been a
 * silent deletion from BOTH profiles without a list of its own. */
const FULL_EXTRA_SECTIONS = [...STANDARD_FULL_EXTRA_SECTIONS, ...EXTRA_FULL_SECTIONS]

/* REFUSE BEFORE READING ANYTHING. `pack.mjs` is a documented standalone target
 * and never runs `check.mjs`, so the containment check `check.mjs` performs does
 * not protect it — which is exactly how a committed symlink copied
 * out-of-repository content, credential values included, straight into a
 * generated pack while this script exited 0. `read()` now refuses such a path on
 * its own; this check exists so the refusal is a clean message naming every
 * offending path rather than the first exception thrown. */
{
  const willRead = [...CORE_SECTIONS, ...FULL_EXTRA_SECTIONS].map(([, f]) => f).concat('PROJECT.yaml')
  const bad = uncontainedPaths([...new Set(willRead)])
  if (bad.length) {
    console.error(`pack: refusing to read — path(s) do not resolve to a plain file inside this repository: ${bad.join(', ')}`)
    console.error('A link — at the file or at any directory above it — would copy content from outside the tree into the pack.')
    process.exit(1)
  }
}

const g = gitState()
const out = []
const w = (s = '') => out.push(s)

/* CORE and FULL must never resolve to the same file — the whole reason FULL has
 * its own path is that it can otherwise be mistaken for CORE. A `pack_path`
 * without a `.md` suffix used to make the replace a no-op, silently collapsing
 * the two onto one destination. */
const outPath = FULL
  ? /\.md$/.test(PACK_PATH)
    ? PACK_PATH.replace(/\.md$/, '_FULL.md')
    : `${PACK_PATH}_FULL.md`
  : PACK_PATH

w(`# ${FULL ? 'FULL' : 'CORE'} CONTEXT PACK — ${PROJECT_TITLE}`)
w()
w('**GENERATED FILE — DO NOT EDIT AND DO NOT COMMIT.**')
w(`Generated at \`${new Date().toISOString()}\` from branch \`${g.branch}\` @ \`${g.headShort}\`.`)
w('Regenerate with `make context-pack`. It is derived from the canonical files and')
w('has no authority of its own: where this pack and a canonical file disagree, the')
w('**canonical file wins**, always.')
w()
if (!FULL) {
  w('**THIS IS THE CORE PACK. It INDEXES three canonical files rather than inlining them:**')
  w('`DECISIONS.md`, `FEATURE_MATRIX.yaml` and `PROJECT.yaml`.')
  w()
  w('**AN INDEX IS A FINDING AID, NEVER THE SOURCE.** Open the canonical file before')
  w('relying on or changing a decision, an open question, a phase, a gate, a task')
  w('state or a security rule. `UNKNOWN` beats reconstructing omitted detail.')
  w()
}
w('**EXCLUDED BY CONSTRUCTION:** `docs/history/` (history misleads a fresh agent)')
if (LIVE_STATE_DOCS.length) {
  w(`and the planning document(s) ${LIVE_STATE_DOCS.map((d) => `\`${d}\``).join(', ')} (a plan`)
  w('mistaken for the present is as misleading as a superseded report).')
} else {
  w('(no planning document is declared for exclusion).')
}
w()
w('---')
w()

const inline = (title, file) => {
  if (!exists(file)) return
  w(`## ${title} — \`${file}\``)
  w()
  const body = read(file).trimEnd()
  if (file.endsWith('.yaml')) {
    w('```yaml')
    w(body)
    w('```')
  } else {
    w(body)
  }
  w()
  w('---')
  w()
}

for (const [title, file] of CORE_SECTIONS) inline(title, file)

if (FULL) {
  for (const [title, file] of FULL_EXTRA_SECTIONS) inline(title, file)
} else {
  /* ── Generated index: decisions and open questions ───────────────────────── */
  w('## DECISIONS INDEX — canonical source: `DECISIONS.md`')
  w()
  w('Ids, titles and short single-line fields only. **The Decision, Reason, Scope and')
  w('Evidence prose is NOT reproduced here** — a truncated rule reads like the whole')
  w('rule, which is exactly the failure the Brain exists to prevent.')
  w()
  if (exists('DECISIONS.md')) {
    const { decisions, questions } = indexDecisions(read('DECISIONS.md'))
    const active = decisions.filter((d) => d.section === 'active')
    const other = decisions.filter((d) => d.section !== 'active')
    w(`**${active.length} binding owner-approved decision(s).**`)
    w()
    w(mdTable(['id', 'title', 'provenance'], active.map((d) => [d.id, d.title, d.fields.provenance ?? ''])))
    w()
    if (other.length) {
      w(`**${other.length} superseded / unconfirmed entr(y/ies) — NOT binding.**`)
      w()
      w(mdTable(['id', 'title', 'section'], other.map((d) => [d.id, d.title, d.section])))
      w()
    }
    w(`**${questions.length} OPEN question(s).** An open question is not a decision and may not be answered by an agent.`)
    w()
    if (questions.length)
      w(mdTable(['id', 'question', 'status'], questions.map((q) => [q.id, q.title, q.fields.status ?? 'OPEN'])))
    w()
  } else {
    w('`DECISIONS.md` is missing — UNKNOWN.')
    w()
  }
  w('---')
  w()

  /* ── Generated index: feature matrix ─────────────────────────────────────── */
  w('## FEATURE MATRIX INDEX — canonical source: `FEATURE_MATRIX.yaml`')
  w()
  w('`phase` is roadmap POSITION, not progress. A state is a claim about a whole')
  w('capability: partial work never promotes a row.')
  w()
  if (exists('FEATURE_MATRIX.yaml')) {
    try {
      const fm = parseYaml(read('FEATURE_MATRIX.yaml'))
      const rows = indexFeatures(fm.features)
      w(
        mdTable(
          ['feature', 'phase', 'state(s)', 'authority'],
          rows.map((r) => [r.id, r.phase, r.states.join(' · '), r.authority]),
        ),
      )
      w()
      const cls = Object.entries(fm.classifications ?? {})
      if (cls.length) {
        w('**Provenance pins** — how a claim came to be believed, kept separate from the states above.')
        w()
        w(
          mdTable(
            ['classification', 'provenance', 'repo measurement', 'authority'],
            cls.map(([k, c]) => [k, c?.provenance ?? '', c?.repo_measurement ?? 'n/a', c?.authority ?? '']),
          ),
        )
        w()
      }
    } catch (e) {
      w(`\`FEATURE_MATRIX.yaml\` did not parse in the Brain YAML subset: ${e.message}`)
      w()
    }
  }
  w('---')
  w()

  /* ── Generated index: PROJECT.yaml headline facts + release ledger ───────── */
  w('## PROJECT INDEX — canonical source: `PROJECT.yaml`')
  w()
  if (exists('PROJECT.yaml')) {
    const p = project
    const headline = [
      ['project_id', p.project_id],
      ['active_branch', p.active_branch],
      ['brain_state', p.brain_state],
      ['brain_state_provenance', p.brain_state_provenance],
      ['phase_state', p.phase_state],
      ['automation_runtime_state', p.automation_runtime_state],
      ['portfolio_sync_state', p.portfolio_sync_state],
      ['dashboard_state', p.dashboard_state],
      ['next_task', p.next_task],
    ].filter(([, v]) => v != null && v !== '')
    w(mdTable(['field', 'value'], headline.map(([k, v]) => [k, plain(String(v))])))
    w()
    const rel = p.release ?? {}
    const tasks = Object.entries(rel.tasks ?? {})
    w(`**Release ledger** — a DERIVED PROJECTION of \`TASKS.md\`, never a second task source. ${tasks.length} task(s).`)
    w()
    w(
      mdTable(
        ['id', 'actor', 'blocking', 'phase', 'status'],
        tasks.map(([id, t]) => [id, t?.actor ?? '', String(t?.blocking), t?.phase ?? '', plain(String(t?.status ?? ''))]),
      ),
    )
    w()
    const gates = Object.entries(rel.gates ?? {})
    if (gates.length) {
      w(`**Gates** — ${gates.length}. Source of truth for each: \`${rel.gate_source ?? 'UNKNOWN'}\`.`)
      w()
      w(
        mdTable(
          ['gate', 'requires', 'status', 'actor'],
          gates.map(([id, gt]) => [id, gt?.requires ?? '', plain(String(gt?.status ?? '')), gt?.actor ?? '']),
        ),
      )
      w()
    }
  }
  w('---')
  w()
}

w('## HOW TO USE THIS PACK')
w()
w('1. Orientation order is `START_HERE.md` → `STATUS.md` → `TASKS.md` → `DECISIONS.md` (only when you need decision context) → one task-specific doc.')
w(`2. Every durable decision id has the shape \`${ID_PREFIX}-D-nnn\`; every open question \`${ID_PREFIX}-Q-nnn\`; every task \`${ID_PREFIX}-T-nnn\`.`)
w('3. If a fact is not in a canonical file, the answer is **UNKNOWN**. Do not reconstruct it, and do not take it from chat memory or a commit message.')
w('4. Run `make context-check` to see whether this pack still describes the tree.')
w()

const text = `${out.join('\n')}\n`

/* CONTAINMENT, CHECKED BEFORE THE WRITE. `pack_path` comes out of
 * `PROJECT.yaml`, so `../../elsewhere/pack.md` is a value a repository can
 * carry — and without this the pack writer would create directories and a file
 * above the repository root, falsifying the tree's own claim that nothing here
 * writes outside the repository. `check.mjs` already guards the same value
 * before reading it; a write is the half that matters more. Refuse loudly
 * rather than silently falling back to a default, because a silent fallback
 * would hide a `PROJECT.yaml` that means something the author did not intend. */
const destinationProblem = writeDestinationProblem(outPath, {
  tracked: gitOk('ls-files', '--error-unmatch', '--', outPath),
  ignored: gitOk('check-ignore', '--quiet', '--', outPath),
  requireIgnored: true,
})
if (destinationProblem) {
  console.error(`pack: refusing to write — ${destinationProblem}.`)
  console.error('brain.pack_path must name a gitignored, untracked plain file inside the repository (e.g. dist/…).')
  process.exit(1)
}

fs.mkdirSync(path.dirname(repoPath(outPath)), { recursive: true })
fs.writeFileSync(repoPath(outPath), text)

/* Count real lines: the trailing newline would otherwise be counted as one. */
const lineCount = text.replace(/\n$/, '').split('\n').length
const approxTokens = Math.round(Buffer.byteLength(text) / 4)
console.log(`wrote ${outPath} — ${lineCount} lines, ~${approxTokens} tokens`)
if (!FULL && approxTokens > PACK_TOKEN_TARGET) {
  console.log(`WARN  ~${approxTokens} tokens exceeds the ${PACK_TOKEN_TARGET} target — trim a canonical file, never the truth`)
}
