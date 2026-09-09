/**
 * The canonical Project Brain installer — the pure half.
 *
 * NO FILESYSTEM, NO CHILD PROCESS, NO NETWORK in this module. Rendering,
 * placeholder validation and manifest construction are all decisions, and a
 * decision that can only be exercised by writing a directory tree is a decision
 * nobody writes a control for. `install.mjs` performs the writes.
 *
 * WHAT THE INSTALLER PRODUCES, and the line it must not cross: a
 * STRUCTURALLY COMPLETE Brain whose every semantic field is either a value the
 * operator supplied or the literal `UNKNOWN`. It renders no status, no
 * decision, no verified claim and no feature state that anyone has asserted.
 * An installer that pre-filled "PHASE 0: COMPLETE" would manufacture the exact
 * kind of unearned truth this whole system exists to refuse (`UPS-D-007`,
 * `UPS-D-008`, `UPS-D-010`).
 *
 * THE PORTABILITY CONTRACT (`UPS-D-020`) is what shapes the rest. An installed
 * Brain must run its own validation from a FRESH CLONE using only documented
 * dependencies — so the validator is COPIED IN, never referenced. The copy
 * carries its source commit and a per-file SHA-256 digest, which is what makes
 * it "versioned, pinned, documented and integrity-verifiable" rather than a
 * fork nobody can trace.
 */
import { createHash } from 'node:crypto'

/** The installer's own format version, recorded in every manifest it writes. */
export const INSTALL_MANIFEST_VERSION = 1
export const INSTALL_MANIFEST = 'INSTALL_MANIFEST.json'

/**
 * The validator files copied into an installed Brain.
 *
 * THE TEST FILES ARE NOT OPTIONAL. `make brain-gate` runs `guards-test` and
 * `external-test`; an installation that copied the checks but not their
 * regression controls would give the operator a gate that silently proves less
 * than the one it came from, while printing the same lines. Portability means
 * the whole gate travels, not the convenient half of it.
 */
export const INSTALLED_TOOLING = [
  'tools/context/lib.mjs',
  'tools/context/check.mjs',
  'tools/context/checkpoint.mjs',
  'tools/context/pack.mjs',
  'tools/context/pack-audit.mjs',
  'tools/context/external.mjs',
  'tools/context/observe-external.mjs',
  'tools/context/guards.test.mjs',
  'tools/context/external.test.mjs',
  /* The verifier and the module it verifies WITH. Shipping `core.mjs` means the
   * digest comparison has ONE implementation, controlled once, rather than a
   * second copy inside the verifier that drifts from it — and a drifted
   * integrity check is worse than none, because it still prints PASS. */
  'tools/install/core.mjs',
  'tools/install/verify-manifest.mjs',
]

/**
 * The manifest pins the COPIED VALIDATOR and nothing else.
 *
 * IT DELIBERATELY DOES NOT PIN THE RENDERED BRAIN. `STATUS.md`, `TASKS.md` and
 * the rest exist to be written — that is the operator's first task — and a
 * manifest that failed the moment someone filled in a status would be an
 * integrity check people delete rather than obey. What must not drift silently
 * is the code that judges everything else.
 */
export const isPinnedPath = (p) => INSTALLED_TOOLING.includes(p)

/**
 * Templates rendered into the target, as `template path -> installed path`.
 * The canonical set is fixed by `lib.mjs`; this list must cover it, and
 * `missingCanonicalTemplates` below is what proves it does rather than trusting
 * that someone kept two lists in step.
 */
export const TEMPLATE_MAP = {
  /* README.md is NOT canonical, and it is not optional either. The guard
   * controls use it as the known-present in-repo file they test containment
   * against, so an installation without one fails `guards-test` with an ENOENT
   * rather than a verdict — found by running the installed Brain's own gate
   * from a fresh clone, which is the only place it could have been found. */
  'README.md': 'README.md',
  'START_HERE.md': 'START_HERE.md',
  'STATUS.md': 'STATUS.md',
  'TASKS.md': 'TASKS.md',
  'DECISIONS.md': 'DECISIONS.md',
  'SECRETS_POLICY.md': 'SECRETS_POLICY.md',
  'AGENTS.md': 'AGENTS.md',
  'CLAUDE.md': 'CLAUDE.md',
  'PROJECT.yaml': 'PROJECT.yaml',
  'FEATURE_MATRIX.yaml': 'FEATURE_MATRIX.yaml',
  'ACCESS_MAP.yaml': 'ACCESS_MAP.yaml',
  'HARDWARE.yaml': 'HARDWARE.yaml',
  'ARTIFACTS.yaml': 'ARTIFACTS.yaml',
  'SERVICES.yaml': 'SERVICES.yaml',
  'docs/architecture/ARCHITECTURE.md': 'docs/architecture/ARCHITECTURE.md',
  'docs/design/DESIGN_INDEX.md': 'docs/design/DESIGN_INDEX.md',
  'docs/qa/RELEASE_STATE.md': 'docs/qa/RELEASE_STATE.md',
  'docs/history/INDEX.md': 'docs/history/INDEX.md',
  'Makefile': 'Makefile',
  'gitignore': '.gitignore',
}

/** Placeholders every template may use. All are required; none is defaulted. */
export const PLACEHOLDERS = [
  'PROJECT_NAME',
  'PROJECT_ID',
  'ID_PREFIX',
  'PRODUCT_PURPOSE',
  'SOURCE_REPO',
  'SOURCE_COMMIT',
  'INSTALL_DATE',
]

export const PLACEHOLDER_TOKEN = /<<([A-Z0-9_]+)>>/g

/** SHA-256, lowercase hex. The digest a manifest pins each copied file to. */
export const digest = (buf) => createHash('sha256').update(buf).digest('hex')

/**
 * Validate the values an operator supplied.
 *
 * NOTHING IS DEFAULTED. A missing project id is an error rather than a guess,
 * for the same reason `launch-kit` refuses a missing actor: a Brain nobody can
 * attribute to a project is a Brain that will be attached to the wrong one.
 */
export function validateValues(values) {
  const problems = []
  for (const key of PLACEHOLDERS) {
    const v = values?.[key]
    if (v === undefined || v === null || String(v).trim() === '') {
      problems.push(`${key} is required and was not supplied`)
    }
  }
  const prefix = String(values?.ID_PREFIX ?? '')
  if (prefix && !/^[A-Za-z][A-Za-z0-9_]{0,15}$/.test(prefix)) {
    problems.push(
      `ID_PREFIX ${JSON.stringify(prefix)} is not a plain identifier — lib.mjs would silently fall back to "PRJ" and every task id in the rendered Brain would then fail its own validator`,
    )
  }
  const id = String(values?.PROJECT_ID ?? '')
  if (id && !/^[a-z][a-z0-9-]{0,63}$/.test(id)) {
    problems.push(`PROJECT_ID ${JSON.stringify(id)} must be lowercase letters, digits and hyphens`)
  }
  const sha = String(values?.SOURCE_COMMIT ?? '')
  if (sha && !/^[0-9a-f]{40}$/.test(sha)) {
    problems.push(
      `SOURCE_COMMIT ${JSON.stringify(sha.slice(0, 20))} must be a full 40-character commit id — an abbreviated one cannot be resolved back to a unique commit in a repository the reader may not have`,
    )
  }
  return problems
}

/**
 * Fill a template.
 *
 * AN UNKNOWN PLACEHOLDER IS AN ERROR, NOT AN EMPTY STRING. Substituting nothing
 * for `<<TYPOED_NAME>>` produces a document that reads as finished and is
 * missing a fact, which is strictly worse than one that visibly still wears the
 * template — and `check.mjs`'s placeholder sweep would no longer catch it,
 * because the token would be gone.
 */
export function render(template, values) {
  const unknown = new Set()
  const out = String(template).replace(PLACEHOLDER_TOKEN, (match, name) => {
    if (!Object.prototype.hasOwnProperty.call(values, name)) {
      unknown.add(name)
      return match
    }
    return String(values[name])
  })
  if (unknown.size) {
    throw new Error(
      `template uses placeholder(s) the installer cannot fill: ${[...unknown].join(', ')} — add them to PLACEHOLDERS or fix the template`,
    )
  }
  return out
}

/**
 * Which canonical files the template map fails to cover.
 *
 * THIS IS THE CONTROL THAT MATTERS MOST IN THIS MODULE. `check.mjs` step 1
 * FAILS on a missing canonical root file, so a template map that drifts behind
 * `lib.mjs` produces an installation that cannot pass its own gate — and the
 * installer would report success while doing it. Asking `lib.mjs` rather than
 * repeating its list is what keeps the two from disagreeing.
 */
export function missingCanonicalTemplates(canonicalDocs, canonicalYaml, datedDocs) {
  const covered = new Set(Object.values(TEMPLATE_MAP))
  return [...canonicalDocs, ...canonicalYaml, ...datedDocs].filter((f) => !covered.has(f))
}

/**
 * Build the manifest that pins the installation to its source.
 *
 * `files` is `[{ path, bytes }]` — the CONTENT AS INSTALLED, not as read from
 * the source. Those differ the moment a file is rendered rather than copied,
 * and digesting the source would produce a manifest that fails verification on
 * the very tree it describes.
 */
export function buildManifest({ sourceRepo, sourceCommit, installedAt, projectId, files }) {
  const entries = {}
  for (const { path, bytes } of [...files].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    entries[path] = { sha256: digest(bytes), bytes: bytes.length }
  }
  return {
    schema_version: INSTALL_MANIFEST_VERSION,
    generator: 'tools/install/install.mjs',
    generated_note:
      'GENERATED FILE. It pins this installation to the exact Universal Project System commit it came from, and every copied validator file to a SHA-256 digest. Never hand-edit it: the whole value of the digests is that nobody chose them. Re-verify with `make verify-install`.',
    installed_at: installedAt,
    project_id: projectId,
    source_repo: sourceRepo,
    source_commit: sourceCommit,
    portability_note:
      'UPS-D-020: this Brain must run its own validation from a FRESH CLONE of this repository, using only documented dependencies (Node 18+ and git). Nothing here may resolve to the universal-project-system working tree, to a symlink out of this repository, to the machine that generated this installation, or to an unpublished local file. The tooling below is COPIED IN, versioned by source_commit and pinned by digest, which is what makes sharing it permissible at all.',
    files: entries,
  }
}

/**
 * Compare a manifest against what is actually on disk.
 *
 * `actual` is `[{ path, bytes }]`. Three findings, and they are deliberately
 * separate: a file the manifest pins that is GONE, one whose digest DIFFERS,
 * and one present on disk that the manifest does not pin. The third is not
 * pedantry — an unpinned file under `tools/` is either a local patch nobody
 * recorded or a file from a different source commit, and both make
 * `source_commit` a claim the tree does not support.
 */
export function verifyManifest(manifest, actual) {
  const problems = []
  const pinned = manifest?.files
  if (!pinned || typeof pinned !== 'object') {
    return [`${INSTALL_MANIFEST} carries no files map — it cannot pin anything`]
  }
  if (manifest.schema_version !== INSTALL_MANIFEST_VERSION) {
    problems.push(`schema_version must be ${INSTALL_MANIFEST_VERSION} (got ${JSON.stringify(manifest.schema_version ?? null)})`)
  }
  if (!/^[0-9a-f]{40}$/.test(String(manifest.source_commit ?? ''))) {
    problems.push('source_commit is not a full 40-character commit id, so this installation names no traceable source')
  }
  const onDisk = new Map(actual.map((f) => [f.path, f.bytes]))
  for (const [p, rec] of Object.entries(pinned)) {
    if (!onDisk.has(p)) {
      problems.push(`${p}: pinned by the manifest but MISSING from this installation`)
      continue
    }
    const got = digest(onDisk.get(p))
    if (got !== rec?.sha256) {
      problems.push(`${p}: digest differs — pinned ${String(rec?.sha256).slice(0, 12)}, found ${got.slice(0, 12)}`)
    }
  }
  for (const p of onDisk.keys()) {
    if (!Object.prototype.hasOwnProperty.call(pinned, p)) {
      problems.push(`${p}: present in this installation but NOT pinned by the manifest`)
    }
  }
  return problems
}
