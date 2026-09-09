/**
 * Shared helpers for the Project Brain context tooling.
 *
 * ZERO DEPENDENCIES ON PURPOSE. This tooling has to run in a fresh clone before
 * anyone has installed anything, and a Project Brain whose validator needs an
 * install step is a validator nobody runs. Runtime requirement: Node 18+ and
 * `git` on PATH. There is deliberately no `package.json`.
 *
 * NOTHING IN THIS DIRECTORY NAMES ANY PARTICULAR PROJECT OR ANY PARTICULAR
 * DECISION. The canonical file NAMES below are part of the standard itself;
 * everything project-specific — id prefix, paths, roots, limits, surfaces,
 * extra dated docs, extra pack sections, pack-audit expectations — is read from
 * the `brain:` block of `PROJECT.yaml` at the bottom of this file. If you find
 * yourself editing this file to name one of your own paths, ids or decisions,
 * add it to `PROJECT.yaml` instead. That property is what lets the same
 * validator check another product's Brain without being forked, and a rule is
 * therefore referred to here by NAME rather than by a decision id, because a
 * decision id belongs to one project's decision log.
 *
 * WHAT THIS TOOLING MAY NEVER DO: it may not write, promote or invent an owner
 * decision, a product status, a task completion, a release acceptance or a
 * verification claim. The ONLY file any script here writes is the generated
 * `REPO_STATE.json`, plus the gitignored context pack. `guards-test` also
 * writes fixtures, under the gitignored pack directory, and removes them.
 *
 * BOTH WRITE DESTINATIONS ARE REFUSED IF THEY ARE NOT PLAIN FILES INSIDE THIS
 * REPOSITORY. `REPO_STATE.json` was once exempted on the reasoning that its
 * path is a fixed constant rather than a configured value — a sentence that
 * stood in this very header and was WRONG. A constant path STRING says nothing
 * about what it resolves to: a committed symlink there made the checkpoint
 * write above the repository root, write into a DIFFERENT repository, and —
 * because a dangling link makes `existsSync` false — adopt HEAD with no
 * `--adopt` behind it. Containment applies to BOTH destinations; only the
 * pack's is additionally required to be untracked and gitignored, because only
 * it is configurable and only it is a throwaway artifact.
 *
 * Every `git` invocation IN THIS FILE, and in the four shipping scripts, is
 * read-only. `guards.test.mjs` is the carve-out — it builds throwaway fixture
 * repositories and so runs init/add/commit/push against them, never against
 * this repository — and it is named here for the same reason the write claim
 * above names it: a categorical whose exceptions live somewhere else is a
 * categorical a reader stops believing.
 *
 * Every revision taken from repository state or a document header is
 * shape-validated before it reaches a git argument (`isShaShaped`); ref NAMES
 * produced by git itself are the one documented carve-out (`revIsCommit`).
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

export const repoPath = (...p) => path.join(ROOT, ...p)
export const exists = (rel) => fs.existsSync(repoPath(rel))

/** Thrown when a read would leave the repository. Never carries file content. */
export class ContainmentError extends Error {}

/**
 * Read a repository file — refusing anything that does not resolve INSIDE.
 *
 * THE CHECK LIVES HERE, NOT AT THE CALL SITES, and that is the whole lesson of
 * two review rounds: the same escape was closed in `check.mjs` and left open in
 * `pack.mjs`, because containment was a rule each reader had to remember. A
 * committed symlink — at the file or at any directory above it — is ordinary
 * repository content, and following one let out-of-repository text reach a
 * generated pack. A rule the primitive enforces cannot be forgotten by the next
 * reader added.
 *
 * The error names the path and never the content: a checker that quoted what it
 * found outside the tree would be the leak it exists to prevent.
 */
export const read = (rel) => {
  if (!isInsideRepo(rel)) {
    throw new ContainmentError(`refusing to read "${rel}": it does not resolve inside this repository`)
  }
  return fs.readFileSync(repoPath(rel), 'utf8')
}

/** Enumerate a directory, refusing one that does not resolve inside. */
export function readDirInRepo(rel) {
  if (!isInsideRepo(rel)) {
    throw new ContainmentError(`refusing to enumerate "${rel}": it does not resolve inside this repository`)
  }
  return fs.readdirSync(repoPath(rel), { withFileTypes: true })
}

/**
 * Which of `paths` would take a read out of the repository?
 *
 * A path is uncontained if it resolves outside, OR if ANY component of it
 * beneath the repository root is a symlink — the second is stricter than
 * containment on purpose: a canonical file has no reason to be reached through a
 * link even when the link stays inside, and allowing it would make the rule
 * depend on where the link happens to point today. It reads the whole path and
 * not merely the leaf because every caller's refusal says "a link — at the file
 * OR AT ANY DIRECTORY ABOVE IT", and a leaf-only test made that claim false for
 * exactly the links that stay inside the tree.
 *
 * `entryExists`, NOT `exists`, and the difference is the same one that made a
 * dangling `REPO_STATE.json` link a fail-open for the checkpoint: `existsSync`
 * follows the link, so a DANGLING one reads as "nothing here" and was not
 * flagged — while the caller's PASS line went on to report that none of the
 * paths it read is a link. Fail-closed either way, because a dangling link has
 * nothing to read and the parse fails instead; but the claim was false and the
 * refusal named the wrong thing. A link is an entry whether or not its target
 * exists today, and its target can be created tomorrow.
 *
 * A NON-REGULAR FILE IS REFUSED TOO, because every caller's refusal says "plain
 * file" and, until this term existed, none of them verified it. Both shapes are
 * expressible in a git tree or reachable from repository content, and each
 * defeated the designed step-0 abort in its own way: a FIFO at a read path made
 * `readFileSync` block forever, so the run produced NO output at all and no
 * refusal — a gate that hangs reports nothing, which is worse than a gate that
 * fails; and a DIRECTORY at a canonical path threw an uncaught `EISDIR` stack
 * trace from the reading step instead of the refusal that names the path. The
 * checkpoint's write guard already refused a non-regular destination; the read
 * side did not, so the same rule held on one half of the tooling only.
 */
export function uncontainedPaths(paths) {
  return paths.filter((p) => entryExists(p) && (hasSymlinkComponent(p) || !existsInRepo(p) || !isRegularFile(p)))
}

/**
 * Is the entry at `rel` a regular file?
 *
 * `lstat`, so a symlink answers false on its own account rather than on its
 * target's — `uncontainedPaths` refuses links separately, and a rule that
 * followed the link here would disagree with the one beside it. A directory,
 * FIFO, socket or device answers false. Nothing there answers false, which the
 * callers gate behind `entryExists` so an absent optional path is not refused.
 */
export function isRegularFile(rel) {
  try {
    return fs.lstatSync(path.resolve(ROOT, String(rel ?? ''))).isFile()
  } catch {
    return false
  }
}

/**
 * The same rule for paths the run ENUMERATES rather than reads.
 *
 * `uncontainedPaths` requires a regular file, which is right for every path
 * that reaches `readFileSync` and wrong for the evidence directory and the
 * record directories under it. Splitting the two keeps each refusal exact
 * instead of widening the file rule until it admits a directory — the shape
 * that has to be refused at the read paths.
 */
export function uncontainedDirs(paths) {
  return paths.filter((p) => entryExists(p) && (hasSymlinkComponent(p) || !existsInRepo(p) || !isDirectoryPath(p)))
}

/** Is the entry at `rel` a directory? `lstat`, so a link answers false. */
export function isDirectoryPath(rel) {
  try {
    return fs.lstatSync(path.resolve(ROOT, String(rel ?? ''))).isDirectory()
  } catch {
    return false
  }
}

/**
 * Does `rel` name an existing file INSIDE the repository?
 *
 * Existence checks run over repo-controlled strings — a path quoted in a
 * document, an `evidence:` field — and `path.join` happily normalizes
 * `docs/../../../elsewhere` to somewhere outside the tree. This never reads the
 * file, so nothing could leak, but "the tooling never touches a path outside
 * the repository" should be true by construction rather than by luck.
 */
export function existsInRepo(rel) {
  return isInsideRepo(rel) && fs.existsSync(path.resolve(ROOT, String(rel ?? '')))
}

/**
 * Does `rel` resolve to a location INSIDE the repository?
 *
 * Separate from `existsInRepo` because the WRITE paths need it too, and a file
 * that does not exist yet cannot be tested for existence. `brain.pack_path`
 * comes out of `PROJECT.yaml`, so `../../elsewhere/pack.md` is a value a
 * repository can carry — and the pack writer creating directories and a file
 * above the root would falsify the same repository-wide claim that the git
 * shape gate protects. Containment must hold by construction on every write,
 * not only on the reads that happen to be checked.
 */
/**
 * Does a directory ENTRY exist at `rel` — link or not?
 *
 * `fs.existsSync` follows symlinks, so a DANGLING link reads as "nothing here".
 * That is the wrong question for a destination this tooling is about to write,
 * and getting it wrong was a real fail-open: a dangling `REPO_STATE.json ->
 * ../elsewhere/x.json` made the checkpoint believe no state file existed, skip
 * the refusal that keeps `--adopt` meaningful, adopt HEAD on its own authority,
 * and write the result outside the repository.
 */
export function entryExists(rel) {
  try {
    fs.lstatSync(path.resolve(ROOT, String(rel ?? '')))
    return true
  } catch {
    return false
  }
}

/** Is the entry at `rel` a symlink? False when nothing is there. */
export function isSymlinkPath(rel) {
  try {
    return fs.lstatSync(path.resolve(ROOT, String(rel ?? ''))).isSymbolicLink()
  } catch {
    return false
  }
}

/**
 * Is ANY component of `rel` beneath the repository root a symlink?
 *
 * `isSymlinkPath` asks about the LEAF only, and `uncontainedPaths` used it while
 * every caller's PASS line went on to claim that none of the guarded paths is a
 * link — "a link, at the file OR AT ANY DIRECTORY ABOVE IT". That claim was
 * false. What covered the gap by accident was `isInsideRepo`, which
 * realpath-resolves the whole path: a directory link that leaves the tree fails
 * containment, so the only links that ever reached a read were caught for the
 * wrong reason. A directory link that stays INSIDE the tree — `gitdir -> .git`,
 * `docs/notes -> .git` — passes containment, passes the leaf lstat, and
 * redirects the read anyway. The invariant has to be tested to be claimed.
 *
 * THE WALK STOPS AT THE REPOSITORY ROOT, deliberately. The root itself, and
 * every directory above it, may legitimately be reached through a link — a
 * checkout under a symlinked home or a symlinked `/tmp` is somebody's ordinary
 * setup, and refusing it would refuse the whole run for a link this repository
 * neither owns nor can change. `ROOT` is the already-resolved boundary; only the
 * components this repository's own content can introduce are its business.
 *
 * A component that does not exist ends the walk: nothing is there to follow, and
 * an absent optional path is not the concern here — the callers gate on
 * `entryExists` for that.
 */
export function hasSymlinkComponent(rel) {
  const raw = String(rel ?? '')
  if (raw === '' || path.isAbsolute(raw)) return false

  const abs = path.resolve(ROOT, raw)
  if (abs === ROOT) return false
  if (!abs.startsWith(ROOT + path.sep)) return false

  let probe = ROOT
  for (const component of path.relative(ROOT, abs).split(path.sep).filter(Boolean)) {
    probe = path.join(probe, component)
    let st
    try {
      st = fs.lstatSync(probe)
    } catch {
      return false
    }
    if (st.isSymbolicLink()) return true
  }
  return false
}

/**
 * Where `abs` would ACTUALLY land, with every symlink on the path resolved.
 *
 * Returns `null` when nothing can be resolved, so every caller fails closed on a
 * path it cannot reason about rather than assuming it is safe.
 *
 * The deepest-existing-ancestor walk is what makes this usable on a destination
 * that does not exist yet: `realpathSync` throws on an absent leaf, and a write
 * gate that could not answer for a file it is about to create would be no gate.
 *
 * ONE DEFINITION, because two consumers need the same answer: containment asks
 * whether the real location is under the root, and the pack-section guard asks
 * whether it is under `.git/`. A second hand-copied resolver is exactly how the
 * read side once shipped without a rule the write side already had.
 */
function realLocation(abs) {
  let probe = abs
  const notYetCreated = []
  while (probe !== path.dirname(probe) && !fs.existsSync(probe)) {
    notYetCreated.unshift(path.basename(probe))
    probe = path.dirname(probe)
  }
  try {
    return path.resolve(fs.realpathSync(probe), ...notYetCreated)
  } catch {
    return null
  }
}

/**
 * Is `child` the directory `parent`, or something inside it?
 *
 * COMPONENT-AWARE, and that is the whole point: `child.startsWith(parent)` reads
 * `<root>/.git-evil/config` as a path under `<root>/.git` — a false refusal that
 * teaches the next reader the guard is noisy — and, run the other way, would
 * let a carefully named sibling stand in for the real directory. Comparing on
 * `parent + path.sep` can only match at a component boundary.
 */
const isAtOrUnder = (child, parent) => child === parent || child.startsWith(parent + path.sep)

export function isInsideRepo(rel) {
  const raw = String(rel ?? '')
  if (raw === '' || path.isAbsolute(raw)) return false

  const abs = path.resolve(ROOT, raw)
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return false

  /* LEXICAL CONTAINMENT IS NOT ENOUGH, and this is not theoretical: a symlink
   * is ordinary committable repository content (mode 120000), so replacing
   * `dist` with a link to somewhere else makes `mkdirSync` and `writeFileSync`
   * follow it straight out of the tree while the path string still reads
   * `dist/context/…`. Resolve the deepest ancestor that actually exists and
   * re-test against the real root. Anything unresolvable is refused rather than
   * assumed safe. */
  let realRoot
  try {
    realRoot = fs.realpathSync(ROOT)
  } catch {
    return false
  }

  const realAbs = realLocation(abs)
  if (realAbs === null) return false
  return isAtOrUnder(realAbs, realRoot)
}

/* ── Git — read-only, and shape-validated ─────────────────────────────────── */

export function git(...args) {
  try {
    // stderr is silenced: "not a git repository" is a state the callers handle,
    // not an error a reader needs shouted at them four times.
    return execFileSync('git', ['-C', ROOT, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

/** True when `git <args>` exits zero. Used for existence/ancestry probes. */
export function gitOk(...args) {
  try {
    execFileSync('git', ['-C', ROOT, ...args], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * The only shape this tooling will interpolate into a git revision argument.
 *
 * THIS IS LOAD-BEARING, NOT COSMETIC. `code_review_base` is read out of
 * `REPO_STATE.json`, a committed file this tooling explicitly models as
 * possibly forged (`auditRepoState`). A value shaped `--output=…` interpolated
 * into `git diff` is read by git as its own `--output=<file>` option and
 * CREATES A FILE — which would falsify, from inside the tooling, the
 * repository-wide claim that every git call here is read-only.
 *
 * THE SHAPE GATE IS THE ONLY DEFENCE AGAINST THAT, and it must not be relaxed
 * in the belief that something else backs it up. A `--` separator does NOT: git
 * parses options up to the separator, so `git diff --name-only
 * "--output=X..HEAD" --` still writes `X..HEAD`. That was verified rather than
 * assumed. The `--` this tooling passes disambiguates revisions from pathspecs
 * and does nothing about option injection.
 */
export const SHA_RE = /^[0-9a-f]{7,40}$/
/* `typeof` first, deliberately: coercing meant `["39d4011…"]` stringified to a
 * bare sha and passed, and was then written back into the generated state as an
 * array. A field that is not a string is not a commit id. */
export const isShaShaped = (v) => typeof v === 'string' && SHA_RE.test(v)

export const gitState = () => ({
  branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
  head: git('rev-parse', 'HEAD'),
  headShort: git('rev-parse', '--short', 'HEAD'),
  dirty: git('status', '--porcelain').length > 0,
})

/**
 * Is `sha` a real commit in this repository?
 *
 * Shape-gated, because every caller passes UNTRUSTED input: a sha out of the
 * generated state, or one scraped from a document header.
 */
export const isCommit = (sha) => isShaShaped(sha) && gitOk('cat-file', '-e', `${sha}^{commit}`)

/** Is `sha` reachable from HEAD (an ancestor, or HEAD itself)? */
export const isAncestorOfHead = (sha) =>
  isCommit(sha) && gitOk('merge-base', '--is-ancestor', sha, 'HEAD')

/**
 * Does the commit at HEAD contain `rel`?
 *
 * Distinguishes a FIRST RUN, where a generated file has never existed, from a
 * DELETION of a committed one. Only the first may adopt HEAD without `--adopt`:
 * removing the tracked state file is otherwise a lower-friction way to move
 * `code_review_base` than hand-writing it, and it fabricates the same audit.
 *
 * `cat-file -e HEAD:<path>` and not `ls-files`, because `git rm` empties the
 * index while HEAD still carries the file — the index answers "is it staged",
 * and the question here is "did this repository ever commit it".
 */
export const isInHeadCommit = (rel) => gitOk('cat-file', '-e', `HEAD:${String(rel ?? '')}`)

/**
 * Does a git revision NAME resolve to a commit? For refs produced BY git
 * itself — `@{upstream}`, a remote-tracking branch — which are not sha-shaped
 * and so cannot pass `isShaShaped`.
 *
 * THIS IS THE ONE DOCUMENTED CARVE-OUT from the shape gate, and every claim
 * about the gate elsewhere in the Brain must name it. The value comes from
 * `git rev-parse --abbrev-ref @{upstream}` — git's own output about this
 * checkout's configuration — not from a document, a generated file, or any
 * other input this tooling treats as forgeable. Anyone who can set that
 * configuration can already run git directly.
 */
const revIsCommit = (rev) => Boolean(rev) && gitOk('rev-parse', '--verify', '--quiet', `${rev}^{commit}`)

/**
 * Files changed between a base commit and HEAD.
 *
 * Returns `null` — NOT an empty array — when the base cannot be resolved.
 * The difference is the whole point: an empty array means "nothing changed",
 * and returning that for an unresolvable base would report a tree as CURRENT on
 * the strength of a question nobody could answer. `git()` swallows failures by
 * design, so the resolution has to happen here, before the call.
 *
 * RESIDUAL, STATED RATHER THAN HIDDEN: because `git()` returns `''` on failure,
 * a `git diff` that failed for some OTHER reason would still be read as "no
 * files changed". The `isCommit` gate above removes every input this tooling
 * accepts that could cause it, so it is not reachable today — but it is the
 * same shape as the defect this function was rewritten to fix, and it is named
 * here rather than left for the next reader to rediscover.
 */
export function changedSince(base) {
  if (!isCommit(base)) return null
  /* REACHABILITY, NOT MERE EXISTENCE. `git diff base..HEAD` compares two TREES,
   * so a real commit on an abandoned line of history — one HEAD cannot reach —
   * yields an empty diff whenever the two trees happen to agree, and "nothing
   * moved since the audited base" is then reported for a base this tree never
   * advanced from. `check.mjs` already FAILS such a state file as not generated;
   * without this the same run still printed `freshness CURRENT` beside that
   * FAIL, and `checkpoint.mjs`, which never audits the state file, wrote
   * `"freshness": "CURRENT"` with only a generic warning. What moved since an
   * unreachable base is unanswerable, and unanswerable is UNKNOWN. */
  if (!isAncestorOfHead(base)) return null
  const out = git('diff', '--name-only', `${base}..HEAD`, '--')
  return out ? out.split('\n').filter(Boolean) : []
}

/* ── Local versus remote repository state ─────────────────────────────────── */

/**
 * The owner-approved vocabulary for how a working copy stands against its
 * canonical remote.
 */
export const REPO_SYNC_STATES = [
  'SYNCED',
  'LOCAL_AHEAD',
  'REMOTE_AHEAD',
  'DIRTY',
  'DIVERGED',
  'UNKNOWN',
]

/** How this tree stands against the commit the Brain content was audited at. */
export const FRESHNESS_STATES = ['CURRENT', 'DOCS-ONLY ADVANCE', 'SUBSYSTEM STALE', 'UNKNOWN']

/**
 * Classify this working copy against its tracked remote branch.
 *
 * READ-ONLY AND OFFLINE BY CONSTRUCTION. It compares against the remote-tracking
 * ref AS OF THE LAST FETCH and performs NO network operation of its own — this
 * tooling never fetches, pushes or mutates a remote. A stale remote-tracking ref
 * therefore yields a stale answer, which is why the returned object carries
 * `basis` and why `UNKNOWN` is returned rather than a guess whenever the ref is
 * missing, git is unavailable, or the branch is detached.
 *
 * THIS IS NOT session-start reconciliation. That belongs to an automation
 * runtime. This function is the Brain's own read-only classifier and no more.
 *
 * DIRTY WINS. An uncommitted change is invisible to the remote and to any
 * downstream consumer, so a dirty tree is reported DIRTY even when the committed
 * history happens to match — never as SYNCED.
 */
export function classifyRepoSync() {
  const unknown = (reason) => ({ state: 'UNKNOWN', ahead: 0, behind: 0, upstream: '', reason, basis: 'none' })
  const head = git('rev-parse', 'HEAD')
  if (!head) return unknown('not a git repository, or git is unavailable')

  const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
  if (!branch || branch === 'HEAD') return unknown('detached HEAD — no branch to compare')

  const upstream = git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}')
  if (!upstream) return unknown(`no upstream configured for ${branch}`)
  if (!revIsCommit(upstream)) return unknown(`upstream ${upstream} has no local ref — fetch first`)

  const counts = git('rev-list', '--left-right', '--count', `${upstream}...HEAD`, '--')
  const m = counts.match(/^(\d+)\s+(\d+)$/)
  if (!m) return unknown(`could not count divergence against ${upstream}`)
  const behind = Number(m[1])
  const ahead = Number(m[2])
  const dirty = git('status', '--porcelain').length > 0

  const basis = `remote-tracking ref ${upstream} as of the last fetch — NOT a live remote read`
  let state
  if (dirty) state = 'DIRTY'
  else if (ahead && behind) state = 'DIVERGED'
  else if (ahead) state = 'LOCAL_AHEAD'
  else if (behind) state = 'REMOTE_AHEAD'
  else state = 'SYNCED'

  return { state, ahead, behind, upstream, basis, reason: '' }
}

/**
 * Fail closed. Only a clean, synced working copy may be treated as a promotable
 * snapshot source. Everything else, UNKNOWN included, is not.
 */
export const isPromotableSyncState = (state) => state === 'SYNCED'

/* ── Minimal YAML (strict subset) ─────────────────────────────────────────── */

class YamlError extends Error {}
export { YamlError }

const stripComment = (line) => {
  // Only ` #` or a leading `#` starts a comment. A `#` inside a token is kept.
  if (line.trimStart().startsWith('#')) return ''
  const i = line.indexOf(' #')
  return i === -1 ? line : line.slice(0, i)
}

const scalar = (raw) => {
  const v = raw.trim()
  if (v === '') return ''
  if (v === '[]') return []
  if (v === '{}') return {}
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length > 1) ||
    (v.startsWith("'") && v.endsWith("'") && v.length > 1)
  ) {
    return v.slice(1, -1)
  }
  if (v === 'true') return true
  if (v === 'false') return false
  if (v === 'null' || v === '~') return null
  if (/^-?\d+$/.test(v)) return Number(v)
  return v
}

/**
 * Parse the subset the Project Brain YAML files use: nested maps by
 * indentation, `- ` scalar lists, quoted and bare scalars, `#` comments, and
 * block scalars (`>`, `>-`, `|`, `|-`).
 *
 * ANYTHING ELSE THROWS, WHICH IS THE POINT. A validator that silently parsed
 * "something else" would report PASS on a file it had misread, and a Brain
 * whose checker can be wrong quietly is worse than no checker.
 *
 * NOT SUPPORTED, deliberately: flow mappings/sequences beyond the empty `[]`
 * and `{}` forms, anchors, aliases, tags, multiple documents, and MAPS INSIDE
 * LIST ITEMS (`- key: value`). The last one is the trap worth naming: a parser
 * that stops early on it truncates a file and every later check then passes by
 * inspecting nothing. This one raises instead — see the trailing-content guard
 * at the end of the function. A list item whose text merely CONTAINS a colon is
 * a plain scalar and is fine; quote it if you want that to be obvious.
 */
export function parseYaml(text) {
  const lines = []
  text.split('\n').forEach((raw, i) => {
    if (raw.includes('\t')) {
      throw new YamlError(`line ${i + 1}: tab character — the Brain YAML subset requires spaces`)
    }
    const line = stripComment(raw)
    if (line.trim() === '') return
    lines.push({ indent: line.length - line.trimStart().length, text: line.trim(), no: i + 1 })
  })

  let pos = 0

  const blockScalar = (parentIndent, style) => {
    const parts = []
    while (pos < lines.length && lines[pos].indent > parentIndent) {
      parts.push(lines[pos].text)
      pos++
    }
    return (style.startsWith('|') ? parts.join('\n') : parts.join(' ')).trim()
  }

  const parseBlock = (indent) => {
    // A list?
    if (pos < lines.length && lines[pos].indent === indent && lines[pos].text.startsWith('- ')) {
      const arr = []
      while (pos < lines.length && lines[pos].indent === indent && lines[pos].text.startsWith('- ')) {
        const item = lines[pos].text.slice(2)
        if (/^[|>][-+]?$/.test(item.trim())) {
          throw new YamlError(
            `line ${lines[pos].no}: block scalar directly inside a list item is outside the supported subset — write it on one line`,
          )
        }
        arr.push(scalar(item))
        pos++
      }
      return arr
    }
    // Otherwise a map.
    const map = {}
    while (pos < lines.length && lines[pos].indent === indent) {
      const { text, no } = lines[pos]
      if (text.startsWith('- ')) {
        throw new YamlError(`line ${no}: list item at map indentation — mixed block kinds`)
      }
      const colon = text.indexOf(':')
      if (colon === -1) throw new YamlError(`line ${no}: expected "key: value" but got "${text}"`)
      const key = text.slice(0, colon).trim()
      if (key === '') throw new YamlError(`line ${no}: empty key`)
      const rest = text.slice(colon + 1).trim()
      pos++
      if (/^[|>][-+]?$/.test(rest)) {
        map[key] = blockScalar(indent, rest)
      } else if (rest === '') {
        if (pos < lines.length && lines[pos].indent > indent) map[key] = parseBlock(lines[pos].indent)
        else map[key] = null
      } else {
        map[key] = scalar(rest)
      }
    }
    return map
  }

  if (lines.length === 0) return {}
  const doc = parseBlock(lines[0].indent)

  /* THE TRUNCATION GUARD. If anything is left over, the parser stopped early —
   * usually on a construction outside the subset, such as a map inside a list
   * item. Returning the partial document here is the silent-misread failure
   * this parser exists to avoid, so it is an error instead. */
  if (pos < lines.length) {
    throw new YamlError(
      `line ${lines[pos].no}: unparsed trailing content "${lines[pos].text.slice(0, 60)}" — outside the supported subset (a map inside a list item is the usual cause)`,
    )
  }
  return doc
}

/* ── Doc metadata ─────────────────────────────────────────────────────────── */

/** Pull `Reviewed against commit: <sha>` out of a markdown doc. */
export function reviewedAgainst(text) {
  const m = text.match(/Reviewed against(?: commit)?:\*{0,2}\s*`?([0-9a-f]{7,40})`?/i)
  return m ? m[1] : null
}

/**
 * The sentinel a freshly copied template carries in place of a real commit.
 * It parses like a SHA so the structure checks still run, and `context:check`
 * reports it as "not bootstrapped yet" rather than pretending it is a review.
 */
export const UNSET_SHA = '0000000'

/**
 * Placeholder syntax. Anything still wearing these angle brackets was never
 * filled in, and a Brain full of them is a Brain nobody can trust.
 */
export const PLACEHOLDER_RE = /<<[A-Z0-9_]+>>/g

/* ── The canonical set — the standard's own file names ────────────────────── */

export const CANONICAL_DOCS = [
  'START_HERE.md',
  'STATUS.md',
  'TASKS.md',
  'DECISIONS.md',
  'SECRETS_POLICY.md',
  'AGENTS.md',
  'CLAUDE.md',
]

export const CANONICAL_YAML = [
  'PROJECT.yaml',
  'FEATURE_MATRIX.yaml',
  'ACCESS_MAP.yaml',
  'HARDWARE.yaml',
  'ARTIFACTS.yaml',
  'SERVICES.yaml',
]

/**
 * Docs that must carry a reviewed-against commit. The STANDARD set; a project
 * adds its own through `brain.extra_dated_docs`, and the exported `DATED_DOCS`
 * at the bottom of this file is the union.
 */
export const STANDARD_DATED_DOCS = [
  'START_HERE.md',
  'STATUS.md',
  'TASKS.md',
  'DECISIONS.md',
  'SECRETS_POLICY.md',
  'docs/architecture/ARCHITECTURE.md',
  'docs/design/DESIGN_INDEX.md',
  'docs/qa/RELEASE_STATE.md',
  'docs/history/INDEX.md',
]

export const REPO_STATE = 'REPO_STATE.json'

/** The one tool permitted to write REPO_STATE.json. Recorded IN the file. */
export const REPO_STATE_GENERATOR = 'tools/context/checkpoint.mjs'

/**
 * Files that DESCRIBE the checkpoint rather than being described by it.
 *
 * `REPO_STATE.json` records the commit the Brain was audited against, so the
 * commit that writes it always lands after that commit and the file then shows
 * up as "changed since the base it declares". That is arithmetic, not drift,
 * and reporting it trains readers to ignore a real warning. Excluded from the
 * drift diff only — never from the canonical list.
 */
export const SELF_REPORTING = ['REPO_STATE.json']

/* ── Validation vocabularies (the Brain's own schema) ─────────────────────── */

/** Who has to act. `external` is a third party neither agent nor owner controls. */
export const RELEASE_ACTORS = ['agent', 'owner', 'external']

/** Where an item sits relative to shipping. */
export const RELEASE_PHASES = ['release_blocker', 'release_gate', 'owner_action', 'later', 'closed']

/** The declared feature-state vocabulary. A state is a claim about a WHOLE capability. */
export const FEATURE_STATES = [
  'not_started',
  'planned',
  'implemented',
  'hardware_verified',
  'blocked',
  'coming_soon',
  'deprecated',
  'not_applicable',
]

/**
 * HOW A CLAIM CAME TO BE BELIEVED. This is the truth taxonomy, and it is the
 * single most valuable rule in the Brain: it keeps a judgement from being
 * reported as a measurement.
 *
 *   owner_determination  the owner judged it; NOT a measurement
 *   owner_decision       the owner decided it; a rule, not an observation
 *   hardware_verified    observed on the real running system, evidence on disk
 *   code_verified        read out of THIS repository at a named commit/path
 *   inference            believed, reasoned, unproven — say so
 *   external             a third party's fact, or one whose source lies outside
 *                        this repository, so a reader here cannot reproduce it
 */
export const PROVENANCE = [
  'owner_determination',
  'owner_decision',
  'hardware_verified',
  'code_verified',
  'inference',
  'external',
]

/**
 * Keys that must never carry a value in a canonical file.
 * `secret_ref` and `*_policy` are labels, not values, and are allowed through —
 * the pattern matches value-bearing keys only, by construction.
 *
 * THE LEADING-MARKER CLASS IS NOT DECORATION. Anchoring hard at the start of the
 * line meant a single Markdown character hid the key entirely: `# password: …`,
 * `- password: …` and `> password: …` all slipped past while the same line
 * without its prefix was caught. Comment markers, blockquote markers and ALL
 * THREE list bullets — `-`, `*`, `+` — are therefore skipped over rather than
 * treated as "not a key". An earlier version covered only `-`, which left two
 * of the three bullets hiding a credential exactly as before.
 *
 * A BULLET IS DISTINGUISHED FROM EMPHASIS BY THE SPACE AFTER IT, not by leaving
 * `*` out of the class. Excluding it outright was the first attempt, and it
 * traded one blind spot for another; requiring the whitespace keeps `* password:`
 * matched while `**Pass:**` — ordinary prose in this Brain's own acceptance
 * document — does not. A guard that cries wolf on its own documentation is one
 * people learn to skip, which costs more than the narrow case it buys.
 */
export const SECRET_KEY_RE =
  /^(?:[\s>#]|[-*+](?=\s))*(password|passwd|pass|secret|token|api_key|apikey|access_key|private_key|client_secret|service_role|keystore_password|auth_token)\s*:\s*(\S.*)$/i

/**
 * Shapes that are a credential no matter what key they sit under. A value
 * matching one of these is a leak even if somebody called the field `note`.
 */
export const SECRET_VALUE_PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'PEM private key'],
  /* Bounded for the same reason as the URL shape below, and found the same way:
   * two unbounded greedy quantifiers followed by a literal `.`, with `-` inside
   * the class, made this quadratic. A line of repeated `eyJ`+padding+`-` gives
   * O(n) start positions each scanning O(n) — measured at 0.25s → 4.5s → 40s as
   * one committed line grew 48k → 192k → 576k, which stalls the whole gate.
   *
   * THE BOUNDS DO NARROW DETECTION, and saying "they cost nothing" would be the
   * overclaim this file exists to avoid: more than 512 characters AFTER the
   * literal `eyJ` — a 515-character header segment — or a payload segment above
   * 2048 is NOT matched, and JWTs with payloads over 2 KB exist. (The first
   * draft of this sentence said "a header segment above 512", the same
   * off-by-`eyJ` the control's own first draft made.) It is a deliberate trade:
   * a sweep one committed line can stall protects nothing, and the narrowing
   * sits inside limits the policy already states — best-effort detection over
   * nine fixed shapes. Both boundaries are pinned by a control, so re-tightening
   * cannot pass unnoticed. THE LESSON GENERALIZES: a new pattern with an
   * unbounded quantifier followed by a literal is a bug. */
  [/\beyJ[A-Za-z0-9_-]{10,512}\.[A-Za-z0-9_-]{10,2048}\./, 'JWT'],
  /* The lookahead requires a digit somewhere in the token. Widening the class
   * to `_-` (so `sk-proj-…` and `sk-ant-api03-…` match) also made ordinary
   * hyphenated words like `sk-learn-classifier-pipeline` match; real keys are
   * high-entropy and carry digits, ordinary words usually do not. A HEURISTIC,
   * and named as one: a digitless key would be missed. */
  [/\bsk-(?=[A-Za-z0-9_-]{0,64}\d)[A-Za-z0-9_-]{16,}/, 'sk- API key'],
  [/\bghp_[A-Za-z0-9]{20,}/, 'GitHub token'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/, 'GitHub fine-grained token'],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
  [/\bAIza[0-9A-Za-z_-]{30,}/, 'Google API key'],
  /* Bounded on purpose. Unbounded `+` quantifiers made this quadratic: a single
   * pathological committed line took seconds and would stall the gate. A
   * credential-bearing URL has short userinfo fields, so the bound costs nothing
   * real. */
  [/\b[a-z][a-z0-9+.-]{0,32}:\/\/[^\s/@]{1,256}:[^\s/@]{1,256}@/i, 'credential-bearing URL'],
]

/**
 * May this tooling write to `rel`? Returns a problem string, or null.
 *
 * PURE AND TESTABLE ON PURPOSE. These refusals used to live inline in the
 * scripts, where no regression control could reach them — and by this Brain's
 * own doctrine a guard nothing exercises is indistinguishable from one that is
 * switched off. Every one of them exists because a reviewer reproduced the
 * write it prevents.
 *
 * `tracked` and `ignored` are supplied by the caller, because answering them
 * needs git and this stays pure. Pass `requireIgnored` for a generated artifact
 * that must never become a committed second source of truth.
 */
/**
 * Names a generated artifact must never take, whatever else is true of them.
 *
 * `requireIgnored` exists to keep a generated file from becoming a committed
 * second source of truth — and it made every gitignored path a legal
 * destination, including the ones `.gitignore` lists BECAUSE they might hold a
 * credential. A `brain.pack_path` of `.env` or `deploy.key` breaches no
 * containment rule and destroys the file in silence. Refusing the shapes costs
 * nothing: no generated artifact wants these names.
 */
const CREDENTIAL_FILE_RE = /^(\.env(\..*)?|.*\.(pem|key|p12|pfx|jks|keystore))$/i

/**
 * ONE trailing-`[ .]` normalisation rule, defined once and used by every caller.
 *
 * `"dist/deploy.key "` and `"dist/deploy.key."` slipped past the pattern above
 * when it was anchored on the raw string. On Linux those are distinct files, so
 * nothing was destroyed here — but on a filesystem that normalises trailing
 * spaces and dots (NTFS, SMB) they resolve to the credential file itself, and a
 * rule that holds only on the reviewer's filesystem is not a rule.
 *
 * IT IS A NAMED HELPER RATHER THAN A SECOND INLINE `.replace`, because the
 * write side had it and the pack-section read side did not — the same rule
 * expressed once holds on both, and a divergence between two copies is exactly
 * how the read side shipped without it.
 */
const stripTrailingDotsAndSpaces = (s) => String(s ?? '').replace(/[ .]+$/, '')

/** The basename a write would actually land on, normalised by that rule. */
const writeBasename = (rel) => stripTrailingDotsAndSpaces(path.basename(path.resolve(ROOT, String(rel ?? ''))))

export function writeDestinationProblem(rel, { tracked = false, ignored = true, requireIgnored = false } = {}) {
  if (!isInsideRepo(rel)) return `"${rel}" resolves outside the repository`
  if (CREDENTIAL_FILE_RE.test(writeBasename(rel))) {
    return `"${rel}" is a credential-shaped filename — a generated artifact must never be written over one`
  }

  /* The git-derived answers first: they hold whether or not anything is there
   * yet, and a destination that is tracked or unignored is wrong before it
   * exists. Ordering them after the lstat was a real bug — a not-yet-created
   * unignored path returned "fine". */
  if (tracked) return `"${rel}" is a TRACKED file — a generated artifact must never replace a committed one`
  if (requireIgnored && !ignored) return `"${rel}" is not gitignored (or git could not tell)`

  let st = null
  try {
    st = fs.lstatSync(path.resolve(ROOT, String(rel)))
  } catch {
    return null /* nothing there yet: the normal case on a fresh clone */
  }
  if (st.isSymbolicLink()) return `"${rel}" is a symlink, not a file`
  if (st.isDirectory()) return `"${rel}" is a directory, not a file`
  if (!st.isFile()) return `"${rel}" is not a regular file (a FIFO or device would hang or corrupt the write)`
  return null
}

/** Values that mean "no value here" and are allowed after a credential key. */
const SECRET_KEY_ALLOWED_RE = /^(UNKNOWN|NONE_CONFIGURED|none|null|~|''|"")$/i

/**
 * What, if anything, is credential-shaped about one line?
 *
 * BOTH CHECKS RUN ON EVERY LINE OF EVERY SCANNED FILE. There is no comment
 * exemption, and its absence is the point: an earlier version skipped every
 * line whose first non-space character was `#`, which is a comment in YAML but
 * a HEADING in Markdown — and, inside a fenced shell block, exactly where a
 * commented-out credential sits. A commented-out token is still a token in the
 * repository. Dropping the exemption produced zero false positives across the
 * whole canonical set, so the documented claim and the code now agree with
 * nothing left to carve out.
 *
 * Returns a short label, or null. It never returns the value it matched.
 */
export function secretFindingForLine(line, { keyRule = true } = {}) {
  if (keyRule) {
    const m = String(line).match(SECRET_KEY_RE)
    if (m && !SECRET_KEY_ALLOWED_RE.test(m[2].trim())) return `key "${m[1]}"`
  }
  for (const [re, label] of SECRET_VALUE_PATTERNS) {
    if (re.test(line)) return `looks like a ${label}`
  }
  return null
}

/** Extract repo-relative paths referenced in backticks or markdown links. */
export function referencedPaths(text, roots) {
  const prefixes = (roots && roots.length ? roots : ['docs/', 'tools/']).map((r) => r.replace(/\/$/, ''))
  const found = new Set()
  const push = (raw) => {
    const p = raw.replace(/[.,;:]$/, '').split('#')[0].split(':')[0].trim()
    if (!p || p.startsWith('http') || p.startsWith('~')) return
    if (!prefixes.some((r) => p === r || p.startsWith(`${r}/`))) return
    /* `<TOPIC>_<DATE>` is a naming TEMPLATE and `packages/*` is a glob. Neither
       is a path that should resolve, and flagging them would train a reader to
       ignore this check — the only failure mode that matters for it. */
    if (p.includes('<') || p.includes('*')) return
    found.add(p)
  }
  for (const m of text.matchAll(/`([^`\n]+)`/g)) push(m[1])
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) push(m[1])
  return [...found]
}

/* ── Per-project configuration, read from PROJECT.yaml `brain:` ───────────── */

const CONFIG_DEFAULTS = {
  id_prefix: 'PRJ',
  pack_path: 'dist/context/PROJECT_CONTEXT.md',
  pack_token_target: 25000,
  code_roots: ['tools/'],
  doc_roots: ['docs/', 'tools/'],
  doc_subsystems: {},
  size_limits: {},
  pinned_owner_determinations: [],
  not_applicable: [],
  extra_dated_docs: [],
  live_state_surfaces: ['STATUS.md', 'TASKS.md', 'FEATURE_MATRIX.yaml'],
  live_state_docs: [],
  pack_extra_core_sections: [],
  pack_extra_full_sections: [],
  pack_audit_required_phrases: [],
}

const asList = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v])
const asMapOfLists = (v) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const out = {}
  for (const [k, val] of Object.entries(v)) out[k] = asList(val)
  return out
}

function loadBrainConfig() {
  const problems = []
  let raw = {}
  if (exists('PROJECT.yaml') && !isInsideRepo('PROJECT.yaml')) {
    /* Read at module import, before any check runs — so containment is asserted
     * here or not at all. A symlinked PROJECT.yaml would otherwise supply this
     * tooling's own configuration from outside the repository. */
    problems.push('PROJECT.yaml resolves outside the repository — refusing to read it; using default brain config')
  } else if (exists('PROJECT.yaml')) {
    try {
      raw = parseYaml(read('PROJECT.yaml')).brain ?? {}
      if (typeof raw !== 'object' || Array.isArray(raw)) {
        problems.push('PROJECT.yaml `brain:` is not a mapping — using defaults')
        raw = {}
      }
    } catch (e) {
      problems.push(`PROJECT.yaml could not be parsed for the brain config: ${e.message}`)
      raw = {}
    }
  } else {
    problems.push('PROJECT.yaml is missing — using default brain config')
  }
  const cfg = {
    ...CONFIG_DEFAULTS,
    ...raw,
    code_roots: asList(raw.code_roots ?? CONFIG_DEFAULTS.code_roots),
    doc_roots: asList(raw.doc_roots ?? CONFIG_DEFAULTS.doc_roots),
    doc_subsystems: asMapOfLists(raw.doc_subsystems),
    size_limits:
      raw.size_limits && typeof raw.size_limits === 'object' && !Array.isArray(raw.size_limits)
        ? raw.size_limits
        : CONFIG_DEFAULTS.size_limits,
    pinned_owner_determinations: asList(raw.pinned_owner_determinations),
    not_applicable: asList(raw.not_applicable),
    extra_dated_docs: asList(raw.extra_dated_docs),
    live_state_surfaces: asList(raw.live_state_surfaces ?? CONFIG_DEFAULTS.live_state_surfaces),
    live_state_docs: asList(raw.live_state_docs),
    pack_extra_core_sections: asList(raw.pack_extra_core_sections),
    pack_extra_full_sections: asList(raw.pack_extra_full_sections),
    pack_audit_required_phrases: asList(raw.pack_audit_required_phrases),
  }
  cfg.problems = problems
  return cfg
}

export const BRAIN = loadBrainConfig()

/* Coerced AND required to be non-blank, for two different failures. A NUMBER
 * here reached `path.*` and `String.prototype.replace` and produced an uncaught
 * TypeError instead of a report — fail-closed, but a run that dies has told the
 * reader nothing. An EMPTY value coerced cleanly and then reached the read guard
 * as `''`, which refuses correctly and prints a refusal naming no path at all.
 * Both are answered where the value is read, not where it is used. */
const RAW_PACK_PATH = String(BRAIN.pack_path ?? '').trim()
export const PACK_PATH = RAW_PACK_PATH || CONFIG_DEFAULTS.pack_path
if (PACK_PATH !== RAW_PACK_PATH) {
  BRAIN.problems.push(
    `PROJECT.yaml brain.pack_path is empty or not a path — using "${CONFIG_DEFAULTS.pack_path}"`,
  )
}
export const PACK_TOKEN_TARGET = Number(BRAIN.pack_token_target) || CONFIG_DEFAULTS.pack_token_target
export const CODE_ROOTS = BRAIN.code_roots
export const DOC_SUBSYSTEMS = BRAIN.doc_subsystems
export const PINNED_OWNER_DETERMINATIONS = BRAIN.pinned_owner_determinations
export const SIZE_LIMITS = BRAIN.size_limits
export const NOT_APPLICABLE = BRAIN.not_applicable
const RAW_ID_PREFIX = String(BRAIN.id_prefix || CONFIG_DEFAULTS.id_prefix)
export const ID_PREFIX = /^[A-Za-z][A-Za-z0-9_]{0,15}$/.test(RAW_ID_PREFIX)
  ? RAW_ID_PREFIX
  : CONFIG_DEFAULTS.id_prefix
if (ID_PREFIX !== RAW_ID_PREFIX) {
  BRAIN.problems.push(
    `PROJECT.yaml brain.id_prefix ${JSON.stringify(RAW_ID_PREFIX)} is not a plain identifier — using "${CONFIG_DEFAULTS.id_prefix}"`,
  )
}

/** The standard's dated docs plus whatever this project adds. */
export const DATED_DOCS = [...STANDARD_DATED_DOCS, ...BRAIN.extra_dated_docs].filter(
  (v, i, a) => a.indexOf(v) === i,
)

/**
 * What is wrong with the place a configured pack section RESOLVES TO — or null.
 *
 * THE LEXICAL RULE BELOW IS NOT ENOUGH, and the bypass is a two-line fixture: a
 * committed directory symlink `gitdir -> .git` (mode 120000 is ordinary
 * repository content) plus a configured section of `gitdir/config`. The
 * configured string has no `.git` component to find, so every per-component test
 * — case-folded, trailing-dot-normalised, backslash-split — answers "clean", and
 * `pack.mjs` then opens `.git/config` and inlines it verbatim. Containment does
 * not catch it either: the target is INSIDE the repository. The rule has to be
 * asked of the resolved filesystem path, because that is the file that gets read.
 *
 * BOTH CLAUSES ARE RE-ASKED OF THE REAL LOCATION, not only the `.git` one: a
 * `keys -> secrets` directory link, or a leaf link `notes.md -> deploy.key`,
 * routes a credential file through exactly the same hole.
 *
 * FAIL-CLOSED ON AN UNRESOLVABLE PATH. A section this tooling cannot locate is a
 * section it cannot prove anything about, and the answer to "I don't know" at a
 * guard that decides what gets inlined verbatim is no.
 *
 * CONTENT-FREE BY CONSTRUCTION: this returns a reason, never a byte of the file.
 * It also runs where the sections are PARSED, so a refused entry never reaches
 * `pack.mjs` and the file is never opened at all.
 */
function sectionTargetProblem(rel) {
  const real = realLocation(path.resolve(ROOT, String(rel ?? '')))
  if (real === null) return 'its real location on disk cannot be resolved'

  if (CREDENTIAL_FILE_RE.test(stripTrailingDotsAndSpaces(path.basename(real)))) {
    return 'it resolves to a credential-shaped filename'
  }

  /* No `.git` entry at all — an exported tarball — leaves nothing here to route
   * a read into. The lexical rule still refuses the literal shapes. */
  if (!entryExists('.git')) return null
  const realGit = realLocation(path.resolve(ROOT, '.git'))
  if (realGit === null) return 'this repository’s .git directory cannot be resolved, so containment cannot be proven'
  if (isAtOrUnder(real, realGit)) return 'it resolves to this repository’s .git directory or a file inside it'
  return null
}

/**
 * The pack sections a project adds, each written `Title|path`.
 *
 * PARSED HERE RATHER THAN IN `pack.mjs`, which is where it used to live, so the
 * writer and the checker cannot disagree about what the pack inlines. They did:
 * `pack.mjs` inlines these files verbatim, and the secret sweep's scope was the
 * canonical set alone, so a configured path outside that set carried whatever it
 * held — credential shapes included — into the generated pack while the run
 * reported `PASS secret hygiene` and the gate exited 0. `pack.mjs` asserted the
 * opposite categorically ("the pack cannot become a secret-delivery channel by
 * accident"), and the value that decides it is ordinary committable repository
 * content. Both consumers now read one definition.
 *
 * ONE FUNCTION FOR BOTH KEYS. The CORE and FULL extra-section lists are the same
 * kind of value read by the same inliner, so a refusal written for one and not
 * the other is a gap by construction — which is what a second, hand-copied
 * filter would be.
 */
function parseExtraSections(key, values) {
  return values
    .map((s) => String(s).split('|').map((x) => x.trim()))
    .filter((p) => {
      /* MALFORMED ENTRIES ARE REPORTED, NOT SILENTLY DROPPED. Dropping them left a
       * pipe-less value producing a refusal that named no path at all — correct,
       * and undiagnosable. */
      if (p.length !== 2 || !p[0] || !p[1]) {
        BRAIN.problems.push(
          `PROJECT.yaml brain.${key} entry ${JSON.stringify(p.join('|'))} is not "Title|path" — ignoring it`,
        )
        return false
      }
      /* A CREDENTIAL FILE MAY NOT BE A PACK SECTION, and neither may anything
       * under `.git/`. Containment is not the right test here: both are INSIDE the
       * repository, so every containment rule permits them — and `pack.mjs`
       * inlines a section verbatim. A value of `.env` or `.git/config` put that
       * file's contents straight into the generated pack, which falsified
       * `SECRETS_POLICY.md` §1 rule 7 ("it never opens `.env`, `.git/`, a home
       * directory or another repository") on two of its four clauses. The write
       * side already refused these shapes as a destination; the read side did not.
       * Widening the code keeps that rule true rather than qualifying it.
       *
       * THE COMPARISON IS NORMALISED, PER COMPONENT, because matching the raw
       * string is a rule that holds only on the reviewer's filesystem — the same
       * defect the write side had fixed and this side had not. `.git./config`
       * and `deploy.key ` resolve to `.git/config` and `deploy.key` wherever
       * trailing dots and spaces are normalised (NTFS, SMB), and `.GIT/config`
       * resolves to `.git/config` on every case-insensitive filesystem, macOS
       * included. Each of those was accepted here, opened, and inlined verbatim.
       * `.git` is matched case-INSENSITIVELY for that reason; the credential
       * pattern already carries its own `i` flag. */
      const parts = String(p[1])
        .split(/[\\/]/)
        .filter(Boolean)
        .map(stripTrailingDotsAndSpaces)
      const basename = parts[parts.length - 1] ?? ''
      const underGit = parts.some((c) => c.toLowerCase() === '.git')
      if (CREDENTIAL_FILE_RE.test(basename) || underGit) {
        /* CONTENT-FREE AND FAIL-CLOSED: the entry is dropped before any consumer
         * receives the path, so `pack.mjs` never opens it, and the message names
         * the configured value and nothing the file contains. */
        BRAIN.problems.push(
          `PROJECT.yaml brain.${key} may not name ${JSON.stringify(p[1])} — a credential file or a path under .git/ would be inlined verbatim into the generated pack`,
        )
        return false
      }
      /* AND THE SAME TWO QUESTIONS ASKED OF THE RESOLVED PATH, because a
       * directory symlink inside the tree answers both of them differently from
       * the configured string. Second, not first: the lexical rule holds for a
       * path that does not exist yet and names the shape the reader configured,
       * which is the more useful message when both would fire. */
      const resolved = sectionTargetProblem(p[1])
      if (resolved) {
        BRAIN.problems.push(
          `PROJECT.yaml brain.${key} may not name ${JSON.stringify(p[1])} — ${resolved}, and a pack section is inlined verbatim into the generated pack`,
        )
        return false
      }
      return true
    })
}

/** The CORE pack sections a project adds. */
export const EXTRA_CORE_SECTIONS = parseExtraSections('pack_extra_core_sections', BRAIN.pack_extra_core_sections)

/**
 * The FULL-only pack sections a project adds.
 *
 * A DETAILED DOCUMENT THAT COSTS MORE CORE BUDGET THAN A FRESH SESSION NEEDS
 * BELONGS HERE, not out of the pack: the layered design's answer to the CORE
 * budget is to move a section to FULL, and `pack.mjs` builds FULL from the CORE
 * list plus this one, so a section dropped from CORE alone would leave FULL too.
 */
export const EXTRA_FULL_SECTIONS = parseExtraSections('pack_extra_full_sections', BRAIN.pack_extra_full_sections)

/** Just the paths, deduplicated — what the sweep and the read guard need. */
const sectionPaths = (sections) => sections.map(([, f]) => f).filter((v, i, a) => a.indexOf(v) === i)

export const EXTRA_CORE_SECTION_PATHS = sectionPaths(EXTRA_CORE_SECTIONS)
/* Guarded and swept on the same grounds: the FULL pack inlines these verbatim
 * too, and it is generated by the same script from the same configuration. */
export const EXTRA_FULL_SECTION_PATHS = sectionPaths(EXTRA_FULL_SECTIONS)

/* THE PREFIX ABOVE REACHES A REGEXP COMPILER, which is why it is shape-gated
 * first — the same rule as every revision that reaches a git argument: a
 * configured value is repository content, whoever wrote it. `id_prefix: "["`
 * threw an uncaught SyntaxError at module import and took every tool down with
 * it; `id_prefix: ".*"` silently made every id check match anything, which is a
 * guard switched off by configuration. Neither is expressible now, and a
 * rejected value is reported rather than swallowed. */

/** `<PREFIX>-T-001` — task ids in the release ledger. */
export const TASK_ID_RE = new RegExp(`^${ID_PREFIX}-T-\\d{3}$`)
/** `<PREFIX>-D-001` / `<PREFIX>-Q-001` — decision and open-question ids. */
export const DECISION_ID_RE = new RegExp(`^${ID_PREFIX}-D-\\d{3}$`)
export const QUESTION_ID_RE = new RegExp(`^${ID_PREFIX}-Q-\\d{3}$`)

/**
 * Classify what moved since the audited base, so a reader never has to run a
 * git diff to know whether the Brain can be trusted.
 *
 *   CURRENT            nothing moved (self-reporting files excluded)
 *   DOCS-ONLY ADVANCE  docs moved, no code did
 *   SUBSYSTEM STALE    code moved — detail claims need re-verification
 *   UNKNOWN            the base is unreachable from HEAD, so the question is unanswered
 *
 * UNKNOWN IS A REAL ANSWER AND MUST NEVER COLLAPSE INTO CURRENT. A base that
 * is not a commit reachable from HEAD is a question nobody could answer, not a
 * tree that did not move, and reporting the second would be exactly the fail-open the fail-closed
 * rule forbids. `resolved` says which happened.
 *
 * Otherwise deliberately conservative: ANY change under `code_roots` lands in
 * SUBSYSTEM STALE, even when no doc declares that path, because an unmapped
 * path is an unknown, not a clean bill of health.
 */
export function classifyDrift(base) {
  const raw = changedSince(base)
  if (raw === null) {
    return { changed: [], code: [], staleDocs: [], unmapped: [], freshness: 'UNKNOWN', resolved: false }
  }
  const changed = raw.filter((f) => !SELF_REPORTING.includes(f))
  const code = changed.filter((f) => CODE_ROOTS.some((r) => f.startsWith(r)))
  const staleDocs = []
  for (const [doc, subs] of Object.entries(DOC_SUBSYSTEMS)) {
    const hits = changed.filter((c) => subs.some((s) => c.startsWith(s)))
    if (hits.length) staleDocs.push({ doc, files: hits.length })
  }
  const mapped = new Set(Object.values(DOC_SUBSYSTEMS).flat())
  const unmapped = code.filter((f) => ![...mapped].some((s) => f.startsWith(s)))
  const freshness = code.length ? 'SUBSYSTEM STALE' : changed.length ? 'DOCS-ONLY ADVANCE' : 'CURRENT'
  return { changed, code, staleDocs, unmapped, freshness, resolved: true }
}

/* ── Canonical-source indexers, for the CORE context pack ─────────────────── */
/*
 * These read the canonical Markdown/YAML and return a STRUCTURE, so `pack.mjs`
 * can emit a compact INDEX instead of inlining a whole file. They summarize;
 * they never rewrite the source, and the pack prints the canonical pointer next
 * to every summary.
 *
 * Deliberately conservative: only SHORT, SINGLE-LINE fields are extracted.
 * Prose fields — Decision, Reason, Scope, Evidence — are NOT excerpted, because
 * a truncated rule reads like the whole rule and that is exactly the failure the
 * Brain exists to prevent.
 */

/**
 * Markdown emphasis and links flattened for a table cell. `*` only: `_` is left
 * alone because it appears inside ids like `owner_decision` and `not_started`,
 * and mangling those would make the index wrong rather than merely terse.
 */
export const plain = (s) =>
  String(s ?? '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*{1,3}/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const cell = (s) => plain(s).replace(/\|/g, '\\|')

/** Short single-line fields worth indexing. Prose fields are deliberately absent. */
const INDEXED_FIELDS = new Set(['status', 'provenance', 'class', 'approval', 'supersedes'])

/**
 * Index the entries in a decisions file.
 *
 * Convention parsed: a heading whose text starts with a backticked id, then
 * `**Field:** value` lines until the next heading. Entries after a `SUPERSEDED`
 * or `NEEDS OWNER CONFIRMATION` heading are tagged, so the pack can separate
 * binding decisions from the waiting room instead of flattening the two.
 */
export function indexDecisions(text) {
  const decisions = []
  const questions = []
  let section = 'active'
  let cur = null

  const flush = () => {
    if (!cur) return
    ;(cur.kind === 'question' ? questions : decisions).push(cur)
    cur = null
  }

  for (const raw of String(text).split('\n')) {
    const line = raw.trimEnd()

    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      flush()
      const body = h[2].trim()
      const withId = body.match(/^`([^`]+)`\s*(?:[—:-]\s*)?(.*)$/)
      const id = withId?.[1]?.trim()
      if (id && (DECISION_ID_RE.test(id) || QUESTION_ID_RE.test(id))) {
        cur = {
          id,
          kind: QUESTION_ID_RE.test(id) ? 'question' : 'decision',
          title: plain(withId[2]) || '(untitled)',
          section,
          fields: {},
        }
      } else {
        const t = plain(body).toUpperCase()
        if (t.includes('SUPERSEDED')) section = 'superseded'
        else if (t.includes('NEEDS OWNER CONFIRMATION')) section = 'unconfirmed'
      }
      continue
    }

    // A field line begins with `**Name:` — the colon must sit inside the bold,
    // so an ordinary bolded phrase mid-paragraph is not mistaken for a field.
    const f = line.match(/^\*\*([A-Za-z][A-Za-z /-]{0,30}):/)
    if (f && cur) {
      const key = plain(f[1]).toLowerCase()
      if (INDEXED_FIELDS.has(key) && !(key in cur.fields)) {
        cur.fields[key] = plain(line.slice(f[0].length))
      }
    }
  }
  flush()
  return { decisions, questions }
}

/** One row per feature: id, phase, every declared surface state, authority. */
export function indexFeatures(featuresMap) {
  const rows = []
  for (const [id, v] of Object.entries(featuresMap ?? {})) {
    if (!v || typeof v !== 'object') continue
    const states = Object.entries(v)
      .filter(([k]) => !['phase', 'authority', 'notes', 'evidence'].includes(k))
      .map(([k, s]) => `${k}: ${s}`)
    rows.push({
      id,
      phase: String(v.phase ?? 'UNKNOWN'),
      states,
      authority: String(v.authority ?? ''),
      evidence: String(v.evidence ?? ''),
      hasNotes: Boolean(v.notes),
    })
  }
  return rows
}

/** Render a Markdown table; cells are flattened and pipe-escaped. */
export function mdTable(headers, rows) {
  const out = [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`]
  for (const r of rows) out.push(`| ${r.map(cell).join(' | ')} |`)
  return out.join('\n')
}

/* ── The Single Live-State Rule ───────────────────────────────────────────── */

/**
 * A planning or contract document must POINT AT the canonical live-state
 * surfaces instead of duplicating them. Both lists are per-project and come
 * from `PROJECT.yaml` `brain.live_state_surfaces` / `brain.live_state_docs`.
 */
export const LIVE_STATE_SURFACES = BRAIN.live_state_surfaces
export const LIVE_STATE_DOCS = BRAIN.live_state_docs

const WRAPPER_BEGIN = '<!-- LIVE-STATE-WRAPPER:BEGIN'
const WRAPPER_END = '<!-- LIVE-STATE-WRAPPER:END'
const POINTER_BEGIN = '<!-- LIVE-STATE-POINTER:BEGIN'
const POINTER_END = '<!-- LIVE-STATE-POINTER:END'

/**
 * Constructions that mean "this is today's implementation progress". They are
 * rejected ONLY inside the protected wrapper — the body of a contract may say
 * whatever its dated history says.
 *
 * These are STRUCTURAL: a planning wrapper never has a legitimate reason to
 * carry a live task status or a live merge/review state, whatever today's value
 * happens to be. That is deliberate — a guard that knew today's value would
 * itself go stale tomorrow.
 *
 * `PROPOSED`, `PLANNED`, `DRAFT` and `NOT IMPLEMENTED` are absent on purpose:
 * they are normative contract vocabulary and must never be forbidden.
 */
export const LIVE_STATE_FORBIDDEN = [
  ['live task status', /\bin progress\b/i],
  ['live merge/review state', /\bunmerged\b|\breview candidate\b|\bawaiting (?:merge|integration|review)\b/i],
  [
    'live implementation status',
    /\bstill not implemented\b|\bnothing has been built\b|\bno code exists yet\b|\bcurrently implemented\b|\b(?:current|next) attempt\b/i,
  ],
]

/**
 * Audit one planning document against the Single Live-State Rule. Returns a
 * list of problems; empty means the invariant holds.
 *
 * It checks STRUCTURE, never today's value: that the protected wrapper exists
 * and covers the header, that it carries a pointer naming the canonical
 * surfaces, and that it has not reacquired ownership of mutable progress.
 */
export function auditLiveStateWrapper(text) {
  const problems = []
  const count = (needle) => text.split(needle).length - 1

  if (count(WRAPPER_BEGIN) !== 1 || count(WRAPPER_END) !== 1) {
    problems.push(`expected exactly one ${WRAPPER_BEGIN} …:END --> region`)
    return problems
  }
  const b = text.indexOf(WRAPPER_BEGIN)
  const e = text.indexOf(WRAPPER_END)
  if (e < b) {
    problems.push('LIVE-STATE-WRAPPER:END appears before :BEGIN')
    return problems
  }

  /* The wrapper must BE the document header, not a block buried in the body:
   * the region has to open before the first `## ` section. */
  const firstSection = text.indexOf('\n## ')
  if (firstSection !== -1 && b > firstSection) {
    problems.push('LIVE-STATE-WRAPPER opens after the first `## ` section — it does not cover the header')
  }

  /* …and it must cover the header COMPLETELY. Opening early is not enough: a
   * line of live progress parked one line below the END marker is still header
   * text a reader will believe, and it would sit outside the protected region.
   * So the gap between the closing marker and the first `## ` section may hold
   * only non-semantic separators — blank lines and a Markdown horizontal rule. */
  if (firstSection !== -1 && firstSection > e) {
    const close = text.indexOf('-->', e)
    const gapStart = close === -1 ? e : close + 3
    const escaped = text
      .slice(gapStart, firstSection)
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '' && !/^-{3,}$/.test(l))
    if (escaped.length) {
      problems.push(
        `semantic header content escapes the wrapper — between LIVE-STATE-WRAPPER:END and the first \`## \` section only blank lines and \`---\` are allowed, found: "${escaped[0].slice(0, 60)}"`,
      )
    }
  }

  const wrapper = text.slice(b, e)

  const pb = wrapper.indexOf(POINTER_BEGIN)
  const pe = wrapper.indexOf(POINTER_END)
  if (pb === -1 || pe === -1 || pe < pb) {
    problems.push('no LIVE-STATE-POINTER block inside the wrapper')
  } else {
    const pointer = wrapper.slice(pb, pe)
    const missing = LIVE_STATE_SURFACES.filter((s) => !pointer.includes(s))
    if (missing.length) problems.push(`live-state pointer does not name ${missing.join(', ')}`)
  }

  for (const [label, re] of LIVE_STATE_FORBIDDEN) {
    const m = wrapper.match(re)
    if (m) problems.push(`${label}: "${m[0].trim()}"`)
  }
  return problems
}

/* ── Generated-state integrity ────────────────────────────────────────────── */

/**
 * Audit `REPO_STATE.json` for signs it was WRITTEN BY HAND rather than
 * generated. Returns a list of problems; empty means nothing detectable is
 * wrong.
 *
 * WHAT THIS IS, EXACTLY: BEST-EFFORT DETECTION, NOT PROOF. There is no secret
 * in this repository and none may be added, so no signature is possible and a
 * determined author could hand-write a file that passes every check below. What
 * it does catch is the failure that actually happens: a fabricated or copied
 * state file whose commits do not exist in this repository, whose generator
 * stamp is absent, or whose fields are shaped wrongly. Its value is that
 * fabricating generated state stops being FREE.
 */
export function auditRepoState(state, head) {
  const problems = []
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return ['not a JSON object']
  }
  if (state.generator !== REPO_STATE_GENERATOR) {
    problems.push(`generator is "${state.generator ?? '(absent)'}" — expected "${REPO_STATE_GENERATOR}"`)
  }
  if (state.schema_version !== 1) problems.push(`schema_version is ${state.schema_version}, expected 1`)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(String(state.generated_at ?? ''))) {
    problems.push(`generated_at "${state.generated_at}" is not an ISO-8601 UTC timestamp`)
  }
  if (!['clean', 'dirty'].includes(String(state.tree_status))) {
    problems.push(`tree_status "${state.tree_status}" is not clean|dirty`)
  }
  if (!REPO_SYNC_STATES.includes(String(state.repo_sync_state))) {
    problems.push(`repo_sync_state "${state.repo_sync_state}" is not in ${REPO_SYNC_STATES.join('|')}`)
  }
  if (!FRESHNESS_STATES.includes(String(state.freshness))) {
    problems.push(`freshness "${state.freshness}" is not in ${FRESHNESS_STATES.join('|')}`)
  }
  /* Commit shape and reachability are the load-bearing half: a hand-written or
   * copied-from-another-repo state file names commits this repository does not
   * contain, and no amount of careful prose hides that. The shape check comes
   * first and stands on its own — a non-hexadecimal value is not merely absent
   * from this repository, it is not a commit id at all, and it is the shape
   * that would reach a git argument. */
  for (const field of ['head', 'code_review_base']) {
    const sha = state[field]
    if (!sha) {
      problems.push(`${field} is absent`)
    } else if (!isShaShaped(sha)) {
      problems.push(`${field} "${String(sha).slice(0, 40)}" is not a hexadecimal commit id`)
    } else if (head) {
      if (!isCommit(sha)) problems.push(`${field} ${String(sha).slice(0, 12)} is not a commit in this repository`)
      else if (!isAncestorOfHead(sha)) problems.push(`${field} ${String(sha).slice(0, 12)} is not reachable from HEAD`)
    }
  }
  return problems
}

/* ── Governed external code repositories (UPS-D-021) ──────────────────────── */

/**
 * The committed registry of code repositories this Brain governs, and the
 * GENERATED record of what was last observed about each one.
 *
 * Both are OPTIONAL by construction. A Brain whose code lives in its own tree
 * governs nothing external and ships neither file; making either mandatory
 * would break every such Brain, this repository included, so `check.mjs`
 * validates them the way it validates `SERVICES.yaml` — only when present.
 */
export const EXTERNAL_REGISTRY = 'EXTERNAL_REPOS.yaml'
export const REVIEW_BASELINE = 'REVIEW_BASELINE.json'

/** The one tool permitted to write REVIEW_BASELINE.json. Recorded IN the file. */
export const REVIEW_BASELINE_GENERATOR = 'tools/context/observe-external.mjs'

/**
 * How an observation ended. This is what the OBSERVER saw, recorded as a fact
 * about a moment; it is deliberately separate from the classification below,
 * which is a judgement made later and offline about whether that fact is still
 * usable.
 */
export const OBSERVATION_RESULTS = ['OBSERVED', 'MISSING', 'UNREADABLE']

/**
 * What a governed repository's record is worth, right now, to a reader.
 *
 * Ordered from usable to unusable. `UNKNOWN` is last and is never a synonym for
 * "probably fine": it means the question was not answered, which is exactly the
 * case a reader must not build on (`UPS-D-015`).
 */
export const EXTERNAL_STATES = [
  'CURRENT',
  'DRIFTED',
  'DIRTY',
  'STALE_OBSERVATION',
  'NO_BASELINE',
  'MISSING',
  'UNREGISTERED',
  'UNKNOWN',
]

/** Only CURRENT is a state a reader may rely on without further work. */
export const isRelianceGrade = (state) => state === 'CURRENT'

/**
 * How old an observation may be before it stops counting as knowledge.
 * A default rather than a constant: a fast-moving product wants days, a
 * dormant one wants months, and the registry declares which.
 */
export const DEFAULT_MAX_OBSERVATION_AGE_DAYS = 30

const isHttpsRemote = (v) => typeof v === 'string' && /^https:\/\/[^\s@]+$/.test(v)

/**
 * Validate the committed registry against the declared schema.
 *
 * STRICT, AND DELIBERATELY SO. Every finding here is a FAIL rather than a
 * warning, because each one makes a later classification meaningless: an entry
 * without a remote cannot be observed, and an entry whose id disagrees with its
 * key cannot be matched to a baseline row. A registry that half-parses is worse
 * than an absent one — it produces confident answers about repositories nobody
 * declared.
 *
 * A REMOTE MUST BE `https://` AND MUST CARRY NO USERINFO. A remote embedding
 * credentials in the userinfo position — what a URL permits between the scheme
 * and the host — would put a credential into committed content, which
 * `SECRETS_POLICY.md` forbids outright; an `ssh://` or `git@` form encodes the
 * key of whoever generated it, which is the machine dependence `UPS-D-020`
 * forbids.
 */
export function readRegistry(raw) {
  const problems = []
  const repos = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { repos, policy: {}, problems: ['the document is not a mapping'] }
  }
  if (raw.schema_version !== 1) {
    problems.push(`schema_version must be 1 (got ${JSON.stringify(raw.schema_version ?? null)})`)
  }
  if (!raw.reviewed_against) problems.push('reviewed_against is absent')

  const policyRaw = raw.policy && typeof raw.policy === 'object' && !Array.isArray(raw.policy) ? raw.policy : {}
  const rawAge = policyRaw.max_observation_age_days
  let maxAge = DEFAULT_MAX_OBSERVATION_AGE_DAYS
  if (rawAge !== undefined && rawAge !== null) {
    if (typeof rawAge !== 'number' || !Number.isFinite(rawAge) || rawAge <= 0) {
      problems.push(`policy.max_observation_age_days must be a positive number (got ${JSON.stringify(rawAge)})`)
    } else {
      maxAge = rawAge
    }
  }

  const entries = raw.repos && typeof raw.repos === 'object' && !Array.isArray(raw.repos) ? raw.repos : null
  if (raw.repos !== undefined && raw.repos !== null && entries === null) {
    problems.push('repos must be a mapping of id to entry')
  }
  for (const [id, v] of Object.entries(entries ?? {})) {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(id)) {
      problems.push(`${id}: id must be lowercase letters, digits and hyphens`)
      continue
    }
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      problems.push(`${id}: not a mapping`)
      continue
    }
    if (v.id !== undefined && v.id !== id) problems.push(`${id}: id field says "${v.id}"`)
    if (!v.remote) problems.push(`${id}: missing remote`)
    else if (!isHttpsRemote(v.remote)) {
      problems.push(
        `${id}: remote must be an https URL carrying no userinfo — an ssh or credential-bearing remote is either machine-bound (UPS-D-020) or a secret in committed content`,
      )
    }
    if (!v.branch) problems.push(`${id}: missing branch (name it; "the default" is not a branch)`)
    if (!v.role) problems.push(`${id}: missing role`)
    if (!v.governs) problems.push(`${id}: missing governs — say what this Brain claims authority over`)
    if (!v.authority) problems.push(`${id}: missing authority`)
    repos[id] = { id, ...v }
  }
  return { repos, policy: { max_observation_age_days: maxAge }, problems }
}

/**
 * Validate the GENERATED baseline record and hand back its rows.
 *
 * BEST-EFFORT DETECTION, NOT PROOF — the same disclosure `auditRepoState`
 * carries, and for the same reason: no secret exists in a Brain repository and
 * none may be added, so nothing here is a signature. It catches the failure
 * that actually happens, which is a hand-written or copied record.
 *
 * A null or absent record is NOT a problem here. It means "never observed", and
 * every declared repository then classifies NO_BASELINE, which is the honest
 * answer and a finding in its own right.
 */
export function readBaseline(raw) {
  const problems = []
  const entries = {}
  if (raw === null || raw === undefined) return { entries, problems, generated: false }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { entries, problems: ['the document is not a mapping'], generated: false }
  }
  if (raw.generator !== REVIEW_BASELINE_GENERATOR) {
    problems.push(
      `generator is "${raw.generator ?? '(absent)'}" — a generated record carries "${REVIEW_BASELINE_GENERATOR}"`,
    )
  }
  if (raw.schema_version !== 1) {
    problems.push(`schema_version must be 1 (got ${JSON.stringify(raw.schema_version ?? null)})`)
  }
  if (!raw.generated_at || Number.isNaN(Date.parse(raw.generated_at))) {
    problems.push(`generated_at "${raw.generated_at ?? '(absent)'}" is not an ISO timestamp`)
  }
  const rows = raw.repos && typeof raw.repos === 'object' && !Array.isArray(raw.repos) ? raw.repos : null
  if (raw.repos !== undefined && raw.repos !== null && rows === null) {
    problems.push('repos must be a mapping of id to entry')
  }
  for (const [id, v] of Object.entries(rows ?? {})) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      problems.push(`${id}: not a mapping`)
      continue
    }
    if (!OBSERVATION_RESULTS.includes(String(v.observation))) {
      problems.push(`${id}: observation "${v.observation}" is not in ${OBSERVATION_RESULTS.join('|')}`)
    }
    if (!v.observed_at || Number.isNaN(Date.parse(v.observed_at))) {
      problems.push(`${id}: observed_at "${v.observed_at ?? '(absent)'}" is not an ISO timestamp`)
    }
    entries[id] = v
  }
  return { entries, problems, generated: true }
}

/**
 * Classify ONE governed repository. Pure, and separated from the file reading
 * above so a regression control can drive every branch without a filesystem.
 *
 * ORDER IS THE DESIGN. Each earlier case makes the later questions
 * unanswerable, so asking them in this sequence is what keeps a worse state
 * from being reported as a better one:
 *
 *   1. no record at all           -> NO_BASELINE   (nothing to judge)
 *   2. the observer found nothing -> MISSING       (the repository is gone)
 *   3. the observer could not read it -> UNKNOWN   (fail closed, never CURRENT)
 *   4. no reviewed sha            -> NO_BASELINE   (observed, never reviewed)
 *   5. malformed shas             -> UNKNOWN       (not a commit id at all)
 *   6. observation too old        -> STALE_OBSERVATION
 *   7. reviewed != observed       -> DRIFTED
 *   8. observed dirty             -> DIRTY
 *   9. otherwise                  -> CURRENT
 *
 * DIRTY IS CHECKED AFTER DRIFT ON PURPOSE. A dirty worktree observed at a head
 * that ALSO differs from the review is two problems, and drift is the one that
 * invalidates the Brain's documented claims; reporting DIRTY there would let a
 * reader fix the worktree and believe the record had become reliable.
 */
export function classifyExternalRepo(entry, now, maxAgeDays) {
  const at = (state, reason) => ({ state, reason })
  if (!entry) {
    return at('NO_BASELINE', 'declared in the registry but never observed — run `make external-observe`')
  }
  /* THE OBSERVER'S OWN NOTE IS SURFACED, NOT REPLACED BY A GUESS.
   *
   * The generic wording used to read "renamed, deleted, made private, or the
   * remote is wrong" — a list of guesses — while `observation_note` already
   * held what the observer actually saw. Against a real registered repository
   * whose branch simply did not exist yet, that sent the reader looking for a
   * deleted repository whose true state the record already described. A
   * classifier that has the reason and prints a guess instead is worse than one
   * that says nothing. */
  const note = entry.observation_note ? ` — ${entry.observation_note}` : ''
  if (entry.observation === 'MISSING') {
    return at('MISSING', `the observer could not find this repository at ${entry.observed_at}${note || ' — it was renamed, deleted, made private, or the remote is wrong'}`)
  }
  if (entry.observation !== 'OBSERVED') {
    return at(
      'UNKNOWN',
      `the observation ended "${entry.observation}" rather than OBSERVED, so the head was never read${note} — UNKNOWN is not "probably fine"`,
    )
  }
  const reviewed = entry.reviewed_sha
  const observed = entry.observed_head
  if (!reviewed) {
    return at(
      'NO_BASELINE',
      'observed, but no reviewed_sha was ever recorded — nothing states which commit this Brain was written against',
    )
  }
  if (!isShaShaped(reviewed) || !isShaShaped(observed)) {
    const which = !isShaShaped(reviewed) ? `reviewed_sha "${String(reviewed).slice(0, 40)}"` : `observed_head "${String(observed).slice(0, 40)}"`
    return at('UNKNOWN', `${which} is not a hexadecimal commit id, so no comparison is possible`)
  }
  const ageDays = (now.getTime() - Date.parse(entry.observed_at)) / 86400000
  if (Number.isFinite(ageDays) && ageDays > maxAgeDays) {
    return at(
      'STALE_OBSERVATION',
      `last observed ${Math.floor(ageDays)} days ago (policy allows ${maxAgeDays}) — the repository may have moved since, and this record cannot say`,
    )
  }
  if (reviewed !== observed) {
    return at(
      'DRIFTED',
      `reviewed against ${String(reviewed).slice(0, 7)} but observed at ${String(observed).slice(0, 7)} — code moved after the Brain was written against it`,
    )
  }
  if (entry.worktree_status === 'dirty') {
    return at(
      'DIRTY',
      'observed at the reviewed commit, but the observed working copy had uncommitted changes — what was measured is not what is committed',
    )
  }
  return at('CURRENT', `reviewed and observed at ${String(reviewed).slice(0, 7)}, observed ${entry.observed_at}`)
}

/**
 * Classify every declared repository, plus every baseline row that names a
 * repository the registry does NOT declare.
 *
 * THE UNREGISTERED CASE IS NOT PEDANTRY. A baseline row nobody declared is
 * either a repository that was removed from the registry while its record
 * stayed behind — so a reader sees governance that no longer exists — or a
 * record copied in from another Brain. Both are the record disagreeing with the
 * committed truth, and silently ignoring the row hides it (`UPS-D-021`
 * property 2).
 */
export function classifyExternalRows(registry, baselineEntries, now) {
  const maxAge = registry.policy?.max_observation_age_days ?? DEFAULT_MAX_OBSERVATION_AGE_DAYS
  const rows = []
  for (const id of Object.keys(registry.repos).sort()) {
    const { state, reason } = classifyExternalRepo(baselineEntries[id], now, maxAge)
    rows.push({
      id,
      state,
      reason,
      ok: isRelianceGrade(state),
      /* DRIFT AND STALENESS ARE WARNINGS, NOT FAILURES. Code moving after a
       * document was written is the ordinary condition of a live product; a
       * gate that failed on it would fail every day and be switched off within
       * a week. The three that FAIL are the ones where the record itself is
       * broken rather than merely behind: the repository is gone, the record is
       * unreadable, or it describes something nobody declared. */
      fatal: ['MISSING', 'UNKNOWN', 'UNREGISTERED'].includes(state),
    })
  }
  for (const id of Object.keys(baselineEntries).sort()) {
    if (registry.repos[id]) continue
    rows.push({
      id,
      state: 'UNREGISTERED',
      reason: `${REVIEW_BASELINE} carries a record for "${id}", which ${EXTERNAL_REGISTRY} does not declare — a baseline entry is never an implicit registration`,
      ok: false,
      fatal: true,
    })
  }
  return rows
}

/** Roll the rows up into the one verdict a reader acts on. */
export function externalSummary(rows) {
  const pass = rows.filter((r) => r.ok).length
  const fail = rows.filter((r) => r.fatal).length
  const warn = rows.length - pass - fail
  const verdict = rows.length === 0 ? 'NONE DECLARED' : fail ? 'UNKNOWN' : warn ? 'NEEDS ATTENTION' : 'CURRENT'
  return { pass, warn, fail, verdict }
}
