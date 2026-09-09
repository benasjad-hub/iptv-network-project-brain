/**
 * Regression controls for the guards that would otherwise fail SILENTLY.
 *
 * A checker that can be wrong quietly is worse than no checker, so each control
 * below asserts BOTH directions: the guard rejects the failure it exists for,
 * AND it does not reject the legitimate shape next to it. A guard that only
 * ever passes is indistinguishable from one that is switched off.
 *
 * Node's built-in test runner; still zero dependencies.
 *   node --test tools/context/guards.test.mjs
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import net from 'node:net'
import { execFileSync, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import {
  ContainmentError,
  FRESHNESS_STATES,
  ROOT,
  SECRET_KEY_RE,
  SECRET_VALUE_PATTERNS,
  UNSET_SHA,
  entryExists,
  existsInRepo,
  isAncestorOfHead,
  isInsideRepo,
  isRegularFile,
  isSymlinkPath,
  read,
  readDirInRepo,
  secretFindingForLine,
  uncontainedPaths,
  writeDestinationProblem,
  LIVE_STATE_SURFACES,
  REPO_STATE_GENERATOR,
  REPO_SYNC_STATES,
  YamlError,
  auditLiveStateWrapper,
  auditRepoState,
  changedSince,
  classifyDrift,
  git,
  isCommit,
  isPromotableSyncState,
  isShaShaped,
  parseYaml,
  reviewedAgainst,
} from './lib.mjs'

/** The real HEAD of this repository — the only sha guaranteed to resolve here. */
const HEAD_SHA = git('rev-parse', 'HEAD')

/* ── The YAML subset: it must fail LOUDLY, never truncate ─────────────────── */

test('parseYaml reads the supported subset', () => {
  const doc = parseYaml(
    [
      'schema_version: 1',
      'name: "quoted value"',
      'flag: false',
      'empty_map: {}',
      'empty_list: []',
      'list:',
      '  - one',
      '  - two',
      'nested:',
      '  inner: value',
      'folded: >-',
      '  a b',
      '  c',
      'literal: |-',
      '  line1',
      '  line2',
    ].join('\n'),
  )
  assert.equal(doc.schema_version, 1)
  assert.equal(doc.name, 'quoted value')
  assert.equal(doc.flag, false)
  assert.deepEqual(doc.empty_map, {})
  assert.deepEqual(doc.empty_list, [])
  assert.deepEqual(doc.list, ['one', 'two'])
  assert.equal(doc.nested.inner, 'value')
  assert.equal(doc.folded, 'a b c')
  assert.equal(doc.literal, 'line1\nline2')
})

test('parseYaml keeps a # that is part of a token, and drops a real comment', () => {
  const doc = parseYaml(['url: https://example.invalid/x#frag', 'other: value # trailing comment', '# whole line'].join('\n'))
  assert.equal(doc.url, 'https://example.invalid/x#frag')
  assert.equal(doc.other, 'value')
})

test('parseYaml THROWS on a map inside a list item instead of truncating', () => {
  /* This is the control that matters most. The naive parser this one descends
   * from stopped early here and returned a PARTIAL document — after which every
   * later check passes by inspecting nothing at all. */
  const text = ['a: 1', 'items:', '  - id: x', '    value: y', 'z: 2'].join('\n')
  assert.throws(() => parseYaml(text), YamlError)
})

test('parseYaml THROWS on a block scalar directly inside a list item', () => {
  const text = ['items:', '  - >-', '    some folded text'].join('\n')
  assert.throws(() => parseYaml(text), YamlError)
})

test('parseYaml THROWS on a tab and on a line with no colon', () => {
  assert.throws(() => parseYaml('a:\n\tb: 1'), YamlError)
  assert.throws(() => parseYaml('a: 1\nnot a mapping line'), YamlError)
})

/* ── reviewed-against extraction ──────────────────────────────────────────── */

test('reviewedAgainst finds the header sha, and returns null when absent', () => {
  assert.equal(reviewedAgainst('**Reviewed against commit:** `0971de3` · x'), '0971de3')
  assert.equal(reviewedAgainst('no header here'), null)
})

/* ── The live-state wrapper ───────────────────────────────────────────────── */

/* The default pointer body is DERIVED from the configured surfaces, never typed
 * out: a control that hardcoded today's list would fail the day a project added
 * a surface, and would then be edited rather than believed. */
const wrapped = (headerBody, pointerBody = LIVE_STATE_SURFACES.join(' ')) =>
  [
    '# A planning document',
    '',
    '<!-- LIVE-STATE-WRAPPER:BEGIN (rule reference) -->',
    headerBody,
    '<!-- LIVE-STATE-POINTER:BEGIN -->',
    pointerBody,
    '<!-- LIVE-STATE-POINTER:END -->',
    '<!-- LIVE-STATE-WRAPPER:END -->',
    '',
    '## Section one',
    '',
    'Body prose may say whatever its dated history says, including in progress.',
  ].join('\n')

test('a correctly wrapped planning doc passes', () => {
  assert.deepEqual(auditLiveStateWrapper(wrapped('DRAFT — PLANNED — NOT IMPLEMENTED.')), [])
})

test('normative contract vocabulary is never forbidden inside the wrapper', () => {
  const ok = wrapped('Status: DRAFT. PROPOSED and PLANNED. NOT IMPLEMENTED. NOT OWNER-ACCEPTED AS FINAL.')
  assert.deepEqual(auditLiveStateWrapper(ok), [])
})

test('the wrapper rejects live task status', () => {
  const problems = auditLiveStateWrapper(wrapped('Phase 1 is in progress right now.'))
  assert.ok(problems.some((p) => p.startsWith('live task status')), problems.join(' | '))
})

test('the wrapper rejects live merge/review state', () => {
  const problems = auditLiveStateWrapper(wrapped('This branch is unmerged.'))
  assert.ok(problems.some((p) => p.startsWith('live merge/review state')), problems.join(' | '))
})

test('the wrapper rejects live implementation status', () => {
  const problems = auditLiveStateWrapper(wrapped('Nothing has been built.'))
  assert.ok(problems.some((p) => p.startsWith('live implementation status')), problems.join(' | '))
})

test('a missing wrapper is a problem, not a pass', () => {
  const problems = auditLiveStateWrapper('# doc\n\n## Section\n\ntext')
  assert.equal(problems.length, 1)
  assert.match(problems[0], /expected exactly one/)
})

test('a pointer that does not name every canonical surface is rejected', () => {
  /* A body that names NO surface, whatever a project's surfaces happen to be —
   * a hardcoded near-miss would pass spuriously in a project configured with
   * exactly that one surface. */
  const problems = auditLiveStateWrapper(wrapped('DRAFT.', '(this pointer deliberately names nothing)'))
  assert.ok(problems.some((p) => p.includes('does not name')), problems.join(' | '))
})

test('semantic header content may not escape below the wrapper', () => {
  const text = [
    '# A planning document',
    '',
    '<!-- LIVE-STATE-WRAPPER:BEGIN (rule reference) -->',
    'DRAFT.',
    '<!-- LIVE-STATE-POINTER:BEGIN -->',
    LIVE_STATE_SURFACES.join(' '),
    '<!-- LIVE-STATE-POINTER:END -->',
    '<!-- LIVE-STATE-WRAPPER:END -->',
    '',
    'Escaped header prose a reader will believe.',
    '',
    '## Section one',
  ].join('\n')
  const problems = auditLiveStateWrapper(text)
  assert.ok(problems.some((p) => p.includes('escapes the wrapper')), problems.join(' | '))
})

test('a horizontal rule and blank lines below the wrapper are allowed', () => {
  const text = [
    '# A planning document',
    '',
    '<!-- LIVE-STATE-WRAPPER:BEGIN (rule reference) -->',
    'DRAFT.',
    '<!-- LIVE-STATE-POINTER:BEGIN -->',
    LIVE_STATE_SURFACES.join(' '),
    '<!-- LIVE-STATE-POINTER:END -->',
    '<!-- LIVE-STATE-WRAPPER:END -->',
    '',
    '---',
    '',
    '## Section one',
  ].join('\n')
  assert.deepEqual(auditLiveStateWrapper(text), [])
})

/* ── Generated-state integrity ────────────────────────────────────────────── */

const goodState = (over = {}) => ({
  schema_version: 1,
  generator: REPO_STATE_GENERATOR,
  generated_at: '2026-08-26T00:00:00.000Z',
  tree_status: 'clean',
  repo_sync_state: 'SYNCED',
  freshness: 'CURRENT',
  head: 'deadbeef',
  code_review_base: 'deadbeef',
  ...over,
})

test('auditRepoState accepts a well-formed state when commits are not checked', () => {
  // head='' switches off the reachability half, isolating the shape checks.
  assert.deepEqual(auditRepoState(goodState(), ''), [])
})

test('auditRepoState rejects a missing or wrong generator stamp', () => {
  assert.ok(auditRepoState(goodState({ generator: undefined }), '').some((p) => p.startsWith('generator')))
  assert.ok(auditRepoState(goodState({ generator: 'my-editor' }), '').some((p) => p.startsWith('generator')))
})

test('auditRepoState rejects a malformed timestamp, tree_status and sync state', () => {
  assert.ok(auditRepoState(goodState({ generated_at: 'yesterday' }), '').some((p) => p.startsWith('generated_at')))
  assert.ok(auditRepoState(goodState({ tree_status: 'probably fine' }), '').some((p) => p.startsWith('tree_status')))
  assert.ok(auditRepoState(goodState({ repo_sync_state: 'FINE' }), '').some((p) => p.startsWith('repo_sync_state')))
})

test('auditRepoState rejects a non-object outright', () => {
  assert.deepEqual(auditRepoState(null, ''), ['not a JSON object'])
  assert.deepEqual(auditRepoState([1, 2], ''), ['not a JSON object'])
})

test('auditRepoState ACCEPTS real reachable commits — the direction that was untested', () => {
  /* The three tests above pass head='' , which switches the reachability half
   * OFF. If isAncestorOfHead regressed to always-false, none of them would
   * notice. This one runs the real check against the real HEAD. */
  assert.ok(HEAD_SHA, 'expected a real HEAD sha in this repository')
  assert.deepEqual(auditRepoState(goodState({ head: HEAD_SHA, code_review_base: HEAD_SHA }), HEAD_SHA), [])
})

test('auditRepoState rejects a freshness value outside the vocabulary', () => {
  assert.deepEqual(auditRepoState(goodState({ freshness: 'PROBABLY FINE' }), '').filter((p) => p.startsWith('freshness')).length, 1)
  for (const f of FRESHNESS_STATES) {
    assert.deepEqual(auditRepoState(goodState({ freshness: f }), ''), [], `${f} must be accepted`)
  }
})

test('auditRepoState rejects a non-hexadecimal commit id as malformed, not merely absent', () => {
  /* The shape, not the reachability, is what would reach a git argument. */
  const problems = auditRepoState(goodState({ code_review_base: '--output=/tmp/x' }), HEAD_SHA)
  assert.ok(
    problems.some((p) => p.includes('is not a hexadecimal commit id')),
    problems.join(' | '),
  )
})

test('auditRepoState flags commits this repository does not contain', () => {
  /* With a real HEAD the reachability half runs. `f`*40 is a well-formed sha
   * that is not a commit here, which is exactly the fabricated-state shape. */
  const problems = auditRepoState(goodState({ head: 'f'.repeat(40), code_review_base: 'f'.repeat(40) }), 'HEAD')
  assert.ok(problems.some((p) => p.includes('is not a commit in this repository')), problems.join(' | '))
})

/* ── The fail-closed promotion rule ───────────────────────────────────────── */

test('only SYNCED is promotable — UNKNOWN and every dirty/divergent state are not', () => {
  assert.equal(isPromotableSyncState('SYNCED'), true)
  for (const s of REPO_SYNC_STATES.filter((x) => x !== 'SYNCED')) {
    assert.equal(isPromotableSyncState(s), false, `${s} must not be promotable`)
  }
  assert.equal(isPromotableSyncState('anything else'), false)
})

/* ── Revision-shape validation: the guard behind "every git call is read-only" ── */

test('isShaShaped accepts only a 7-40 character hex object name', () => {
  assert.equal(isShaShaped('0971de3'), true)
  assert.equal(isShaShaped('a'.repeat(40)), true)
  assert.equal(isShaShaped('abc123'), false, 'too short')
  assert.equal(isShaShaped('a'.repeat(41)), false, 'too long')
  assert.equal(isShaShaped('DEADBEEF'), false, 'uppercase is not the git object-name form')
  assert.equal(isShaShaped('main'), false, 'a branch name is not a sha')
  assert.equal(isShaShaped(''), false)
  assert.equal(isShaShaped(undefined), false)
  /* The shapes that would be read by git as ITS OWN options. This is the case
   * the validation exists for: unvalidated, `--output=…` turned a read-only
   * `git diff` into a command that CREATED A FILE outside the repository. */
  for (const hostile of ['--output=/tmp/pwned', '-o/tmp/pwned', '--exit-code', '..;rm -rf /', 'HEAD~1']) {
    assert.equal(isShaShaped(hostile), false, `${hostile} must never reach a git argument`)
  }
})

test('isCommit refuses a revision git itself would accept, proving the shape gate runs first', () => {
  /* THE CONTROL HAS TO SHOW THE GATE IS LOAD-BEARING, not that `cat-file`
   * happens to reject the same input. Mutation testing found the earlier version
   * of this control green after the shape gate was replaced by a bare
   * `typeof === 'string'`: every value it tried was one git rejected anyway, so
   * the assertion held with no gate at all.
   *
   * So each case below is first PROVED ACCEPTABLE TO GIT, and only then asserted
   * to be refused. `isCommit` returning false for a revision git resolves can
   * only be the shape gate. */
  const gitResolvable = ['HEAD', 'main', HEAD_SHA.toUpperCase()]
  for (const rev of gitResolvable) {
    const resolved = git('rev-parse', '--verify', '--quiet', `${rev}^{commit}`)
    if (!resolved) continue /* `main` may not exist in every checkout */
    assert.equal(isCommit(rev), false, `${rev} resolves to ${resolved} for git, so only the shape gate can refuse it`)
  }
  assert.ok(
    gitResolvable.some((rev) => git('rev-parse', '--verify', '--quiet', `${rev}^{commit}`)),
    'at least one git-resolvable revision must have been exercised, or this control proved nothing',
  )

  assert.equal(isCommit('--output=/tmp/pwned'), false)
  assert.ok(HEAD_SHA && isCommit(HEAD_SHA), 'the real HEAD must still resolve')
})

test('changedSince returns null for an unresolvable base, and a list for a real one', () => {
  /* null and [] must stay distinguishable: [] means "nothing changed", and
   * returning it for a base nobody could resolve is the fail-open this
   * separation exists to prevent. */
  assert.equal(changedSince('--output=/tmp/pwned'), null, 'option-shaped')
  assert.equal(changedSince('f'.repeat(40)), null, 'well-formed but not a commit here')
  assert.equal(changedSince(''), null, 'absent')
  assert.ok(Array.isArray(changedSince(HEAD_SHA)), 'a real commit yields a list')
  assert.deepEqual(changedSince(HEAD_SHA), [], 'HEAD versus HEAD changed nothing')
})

test('classifyDrift reports UNKNOWN — never CURRENT — when the base does not resolve', () => {
  /* The exact fail-open independent review found: a well-formed sha that is not
   * a commit in this repository was reported CURRENT and written into the
   * generated state as truth. */
  const bogus = classifyDrift('a'.repeat(40))
  assert.equal(bogus.freshness, 'UNKNOWN')
  assert.equal(bogus.resolved, false)
  assert.deepEqual(bogus.changed, [])

  const real = classifyDrift(HEAD_SHA)
  assert.equal(real.resolved, true)
  assert.equal(real.freshness, 'CURRENT')
  assert.ok(FRESHNESS_STATES.includes(real.freshness))
})

/* ── Write containment: the guard behind "nothing writes outside the repo" ──── */

test('isInsideRepo accepts repo-relative destinations and refuses every escape', () => {
  assert.equal(isInsideRepo('dist/context/PROJECT_CONTEXT.md'), true)
  assert.equal(isInsideRepo('REPO_STATE.json'), true)
  assert.equal(isInsideRepo('a/../b/pack.md'), true, 'traversal that stays inside is fine')
  /* The reproduced defect: brain.pack_path comes out of PROJECT.yaml, and this
   * value made the pack writer create a directory and an 86 KB file two levels
   * ABOVE the repository root. */
  assert.equal(isInsideRepo('../../OUTSIDE_PACK/LEAK.md'), false)
  assert.equal(isInsideRepo('../sibling.md'), false)
  assert.equal(isInsideRepo('/etc/passwd'), false, 'absolute paths are never inside')
  assert.equal(isInsideRepo('/tmp/x'), false)
  assert.equal(isInsideRepo(''), false)
  assert.equal(isInsideRepo(undefined), false)
  /* THE PREFIX-CONFUSION CASE, which the previous version of this control did
   * not actually exercise: a sibling directory whose name STARTS WITH the
   * repository's own name. Without the path separator in a prefix test,
   * `<root>-evil` looks like it is inside `<root>`. VERIFIED BY MUTATION, and
   * the exact result is worth recording: dropping `+ path.sep` from ONE of the
   * two prefix tests changes nothing, because the other still catches it —
   * dropping it from BOTH makes this assertion, and only this assertion, fail.
   * So the control is not vacuous, and the guard has two independent layers. */
  assert.equal(isInsideRepo(`../${path.basename(ROOT)}-evil/pack.md`), false)
  assert.equal(isInsideRepo(`../${path.basename(ROOT)}x/pack.md`), false)
})

test('isInsideRepo is not defeated by a symlinked directory component', (t) => {
  /* A symlink is ordinary committable repository content (mode 120000), so this
   * is the same threat surface as a PROJECT.yaml value. Lexical containment
   * passed it while mkdirSync and writeFileSync followed the link straight out
   * of the tree — reproduced before the fix, and asserted here after it.
   *
   * EVERY FIXTURE LIVES UNDER THE GITIGNORED PACK DIRECTORY. An earlier version
   * created its target in the system temp directory and its link at the
   * repository ROOT — which falsified, on every `make brain-gate` run, the
   * tree's own claim that nothing is written outside the repository or beyond
   * the generated pack, and left an untracked unignored symlink behind if the
   * run was killed. A control that breaks the invariant it guards is worse than
   * no control. */
  const sandbox = path.join(ROOT, 'dist', `guard-control-${process.pid}`)
  const target = path.join(sandbox, 'link-target')
  const linkDir = path.join(sandbox, 'linked')
  fs.mkdirSync(target, { recursive: true })
  try {
    fs.symlinkSync(target, linkDir, 'dir')
  } catch {
    t.skip('symlinks not permitted in this environment')
    fs.rmSync(sandbox, { recursive: true, force: true })
    return
  }
  try {
    /* The link resolves back INSIDE the repository, so this asserts the guard
     * follows links at all. The escaping case is covered by the `..` assertions
     * above, which need no filesystem fixture to be true. */
    const rel = path.relative(ROOT, linkDir)
    assert.equal(isInsideRepo(`${rel}/context/PACK.md`), true, 'a link resolving inside is inside')
    assert.equal(isInsideRepo('dist/context/PACK.md'), true)
    /* …and the resolution actually happens: a link whose target escapes must be
     * refused even though its path string is unremarkable. */
    const escaping = path.join(sandbox, 'escaping')
    fs.symlinkSync(path.resolve(ROOT, '..'), escaping, 'dir')
    assert.equal(
      isInsideRepo(`${path.relative(ROOT, escaping)}/PACK.md`),
      false,
      'a link whose target escapes must be refused',
    )
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true })
  }
})

/* ── The refusal that keeps `--adopt` meaning something ─────────────────────── */

test('an absent, empty or malformed code_review_base is not a sha, so it cannot pass', () => {
  /* The checkpoint takes the auto-HEAD path only when there is NO state file.
   * With one present it requires a sha-shaped base, and this is the predicate
   * it requires. The empty string is the case that mattered: it used to be
   * falsy, fall past a truthy-guard, and be treated exactly like `--adopt` —
   * turning a SUBSYSTEM STALE tree into CURRENT with no flag and no annotation. */
  assert.equal(isShaShaped(''), false, 'the empty string must not read as a base')
  assert.equal(isShaShaped(undefined), false, 'an absent base must not read as a base')
  assert.equal(isShaShaped(null), false)
  assert.equal(isShaShaped('   '), false)
  assert.equal(isShaShaped('HEAD'), false)
  assert.ok(HEAD_SHA && isShaShaped(HEAD_SHA), 'a real base must still pass')
})

/* ── The secret sweep: what it catches, and what it deliberately does not ───── */

test('SECRET_KEY_RE sees through a comment, blockquote or ANY list bullet', () => {
  /* A single Markdown character used to hide the key entirely — and the first
   * fix covered only the `-` bullet, leaving `*` and `+` hiding it exactly as
   * before. All three bullets are asserted here for that reason. */
  for (const line of [
    'password: hunter2',
    '# password: hunter2',
    '## password: hunter2',
    '  - password: hunter2',
    '* password: hunter2',
    '+ password: hunter2',
    '  * api_key: abcdef',
    '> password: hunter2',
    '   token: abcdef',
    '- api_key: abcdef',
  ]) {
    assert.ok(SECRET_KEY_RE.test(line), `must match: ${line}`)
  }
})

test('SECRET_KEY_RE does not fire on labels, prose, or emphasis', () => {
  /* `secret_ref` is a LABEL and must pass by construction — the whole
   * reference-never-embed rule depends on it. `**Pass:**` is ordinary prose in
   * an acceptance document: `*` IS in the leading class, but only as a bullet,
   * which the whitespace lookahead requires. A guard that cries wolf on its own
   * documentation is one people learn to skip. */
  for (const line of [
    'secret_ref: NONE_CONFIGURED',
    'secrets_policy: SECRETS_POLICY.md',
    '**Pass:** every question answered correctly',
    'the password: field is a label',
    'Do not print a password.',
  ]) {
    assert.equal(SECRET_KEY_RE.test(line), false, `must NOT match: ${line}`)
  }
})

test('the value patterns are the nine shapes the policy enumerates, and they match', () => {
  assert.equal(SECRET_VALUE_PATTERNS.length, 9)
  const samples = [
    '-----BEGIN RSA PRIVATE KEY-----',
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc',
    'sk-ABCDEFGH1JKLMNOPQRST',
    'sk-proj-AbCdEf0123456789GhIjKl',
    'sk-ant-api03-AbCdEf0123456789',
    'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345',
    'github_pat_ABCDEFGHIJKLMNOPQRSTUV',
    'xoxb-ABCDEFGHIJKLMNO',
    'AKIAABCDEFGHIJKLMNOP',
    'AIzaABCDEFGHIJKLMNOPQRSTUVWXYZ0123456',
    'https://user:secretvalue@example.invalid/x',
  ]
  for (const sample of samples) {
    assert.ok(
      SECRET_VALUE_PATTERNS.some(([re]) => re.test(sample)),
      `no pattern matched a credential shape: ${sample}`,
    )
  }
  /* And the shapes must not fire on the ordinary text sitting beside them in
   * the policy that enumerates them. */
  for (const benign of [
    'sk-…',
    'ghp_…',
    'AKIA…',
    'a URL embedding user:password@',
    'PEM private-key block',
    /* The cost of widening the sk- class to `_-`: an ordinary hyphenated word.
     * The digit lookahead is what keeps this out, and it is a heuristic. */
    'sk-learn-classifier-pipeline',
  ]) {
    assert.ok(
      !SECRET_VALUE_PATTERNS.some(([re]) => re.test(benign)),
      `pattern fired on benign documentation text: ${benign}`,
    )
  }
})

/* ── The per-line sweep decision, which used to be untestable ───────────────── */

test('secretFindingForLine runs BOTH checks on every line, comment or not', () => {
  /* The blind spot this closes: the sweep used to skip every line whose first
   * non-space character was `#`. In YAML that is a comment — but a
   * commented-out token is still a token in the repository, and the value
   * patterns are documented as matching "no matter what key they sit under".
   * A whole round of review passed over it because the logic lived inline in
   * check.mjs where no control could reach it. */
  assert.match(secretFindingForLine('#   api_key: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345') ?? '', /key|GitHub/)
  assert.match(secretFindingForLine('#   aws: AKIAIOSFODNN7EXAMPLE') ?? '', /AWS access key id/)
  assert.match(
    secretFindingForLine('#   db: postgres://admin:s3cr3tvalue@db.example.invalid/x') ?? '',
    /credential-bearing URL/,
  )
  assert.match(secretFindingForLine('# -----BEGIN RSA PRIVATE KEY-----') ?? '', /PEM private key/)
  assert.match(secretFindingForLine('## AKIAIOSFODNN7EXAMPLE heading') ?? '', /AWS access key id/)
})

test('secretFindingForLine allows the no-value placeholders, and never echoes a value', () => {
  for (const line of [
    'secret_ref: NONE_CONFIGURED',
    'password: UNKNOWN',
    'token: none',
    'api_key: null',
    'client_secret: ~',
    "private_key: ''",
  ]) {
    assert.equal(secretFindingForLine(line), null, `must be allowed: ${line}`)
  }
  /* The finding must name the key, never carry the value — a checker that
   * printed the secret to complain about it would be the leak. */
  const finding = secretFindingForLine('password: hunter2SuperSecret')
  assert.equal(finding, 'key "password"')
  assert.ok(!String(finding).includes('hunter2'), 'a finding must never echo the value')
})

test('secretFindingForLine finds nothing in ordinary Brain prose', () => {
  for (const line of [
    '**Pass:** every question answered correctly',
    'Do not print a password.',
    'the password: field is a label',
    '| `login_identity` (only when verified) | `secret_ref` |',
    'PEM private-key block, a JWT, `sk-…`, `ghp_…`, `AKIA…`',
  ]) {
    assert.equal(secretFindingForLine(line), null, `must not fire: ${line}`)
  }
})

/* ── Link discipline on the one destination that was exempted ───────────────── */

test('entryExists sees a DANGLING symlink where existsSync sees nothing', (t) => {
  /* This asymmetry was a fail-open, not a curiosity. `fs.existsSync` follows
   * links, so a dangling `REPO_STATE.json -> ../elsewhere/x.json` read as "no
   * state file": the checkpoint skipped the refusal that keeps `--adopt`
   * meaningful, adopted HEAD on its own authority, and wrote the result outside
   * the repository — three failures from one committable file. */
  const sandbox = path.join(ROOT, 'dist', `guard-link-${process.pid}`)
  fs.mkdirSync(sandbox, { recursive: true })
  const dangling = path.join(sandbox, 'STATE.json')
  try {
    fs.symlinkSync(path.join(sandbox, 'target-that-does-not-exist.json'), dangling)
  } catch {
    t.skip('symlinks not permitted in this environment')
    fs.rmSync(sandbox, { recursive: true, force: true })
    return
  }
  try {
    const rel = path.relative(ROOT, dangling)
    assert.equal(fs.existsSync(dangling), false, 'existsSync follows the link and sees nothing')
    assert.equal(entryExists(rel), true, 'entryExists must see the entry itself')
    assert.equal(isSymlinkPath(rel), true, 'and must recognise it as a link')
    /* A plain file is neither absent nor a link. */
    const plain = path.join(sandbox, 'plain.json')
    fs.writeFileSync(plain, '{}\n')
    const plainRel = path.relative(ROOT, plain)
    assert.equal(entryExists(plainRel), true)
    assert.equal(isSymlinkPath(plainRel), false)
    /* And nothing at all is nothing at all. */
    assert.equal(entryExists(path.join(path.relative(ROOT, sandbox), 'absent.json')), false)
    assert.equal(isSymlinkPath(path.join(path.relative(ROOT, sandbox), 'absent.json')), false)
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true })
  }
})

/* ── Two controls that mutation testing showed were missing ─────────────────── */

test('isShaShaped requires an actual string, not something that stringifies to one', () => {
  /* Mutation testing killed this one first: removing the `typeof` guard left
   * every control passing while `["<40 hex>"]` coerced to a bare sha and was
   * written back into the generated state as an array. */
  const sha = 'a'.repeat(40)
  assert.equal(isShaShaped(sha), true)
  assert.equal(isShaShaped([sha]), false, 'an array must never coerce into a commit id')
  assert.equal(isShaShaped({ toString: () => sha }), false, 'nor an object with a toString')
  assert.equal(isShaShaped(new String(sha)), false, 'nor a String object')
  assert.equal(isShaShaped(0), false)
  assert.equal(isShaShaped(true), false)
})

test('isAncestorOfHead actually tests reachability, not merely commit existence', () => {
  /* The other surviving mutant: replacing this with `true` passed every control,
   * because the only reachability case used a sha that failed `isCommit` first.
   * HEAD's parent is reachable; a real commit that is NOT an ancestor is the
   * case that needs a fixture, so this asserts both ends that exist here. */
  assert.ok(HEAD_SHA, 'expected a real HEAD')
  assert.equal(isAncestorOfHead(HEAD_SHA), true, 'HEAD is reachable from HEAD')
  const parent = git('rev-parse', 'HEAD~1')
  if (parent) assert.equal(isAncestorOfHead(parent), true, "HEAD's parent is reachable")
  /* Well-formed, not a commit here: must be false via the isCommit gate. */
  assert.equal(isAncestorOfHead('f'.repeat(40)), false)
  /* Not sha-shaped at all: must be false without consulting git. */
  assert.equal(isAncestorOfHead('--output=/tmp/x'), false)
})

test('the credential-URL pattern is linear, not quadratic, on a long non-match', () => {
  /* Unbounded quantifiers made this pattern take seconds on one pathological
   * line — enough for a single committed line to stall the gate. */
  const hostile = `http://${'a:'.repeat(40000)}`
  const started = process.hrtime.bigint()
  secretFindingForLine(hostile)
  const ms = Number(process.hrtime.bigint() - started) / 1e6
  assert.ok(ms < 1000, `sweeping an 80k-character non-matching line took ${Math.round(ms)}ms`)
  /* …and it still matches a real one. */
  assert.match(
    secretFindingForLine('url: https://user:s3cr3tvalue@db.example.invalid/x') ?? '',
    /credential-bearing URL/,
  )
})

/* ── Controls mutation testing showed were missing ──────────────────────────── */

test('existsInRepo refuses a path that escapes, even when the target exists', () => {
  /* Mutation: dropping the containment half of existsInRepo survived every
   * control. It is the guard that catches a canonical path pointing outside. */
  assert.equal(existsInRepo('README.md'), true)
  assert.equal(existsInRepo('../'), false, 'the parent directory exists but is outside')
  assert.equal(existsInRepo('/etc'), false, 'an absolute path is never inside')
  assert.equal(existsInRepo('../..'), false)
  assert.equal(existsInRepo('docs/../README.md'), true, 'traversal that stays inside is fine')
})

test('the key half of the sweep fires on a commented line, not just the value half', () => {
  /* Mutation: reinstating the comment exemption on the KEY half survived,
   * because the existing control's assertion was satisfied by the value half
   * alone. This pins the key half on its own — the line carries no credential
   * SHAPE, so only the key rule can find it. */
  assert.equal(secretFindingForLine('# password: hunter2plaintext'), 'key "password"')
  assert.equal(secretFindingForLine('  #   client_secret: someplainvalue'), 'key "client_secret"')
})

test('writeDestinationProblem refuses every destination the scripts must refuse', () => {
  /* These refusals used to live inline in checkpoint.mjs and pack.mjs, where no
   * control could reach them — so the fix for a blocking finding was itself
   * unguarded against regression. Each case below is a write a reviewer
   * actually reproduced. */
  assert.equal(writeDestinationProblem('dist/context/PACK.md'), null, 'an ordinary destination is fine')
  assert.match(writeDestinationProblem('../../OUTSIDE/LEAK.md') ?? '', /outside the repository/)
  assert.match(writeDestinationProblem('/tmp/LEAK.md') ?? '', /outside the repository/)
  assert.match(
    writeDestinationProblem('README.md', { tracked: true }) ?? '',
    /TRACKED file/,
    'a tracked file must never be overwritten by a generated artifact',
  )
  assert.match(
    writeDestinationProblem('dist/context/PACK.md', { ignored: false, requireIgnored: true }) ?? '',
    /not gitignored/,
  )
  assert.equal(
    writeDestinationProblem('dist/context/PACK.md', { ignored: false, requireIgnored: false }),
    null,
    'the ignored test applies only where the caller asks for it',
  )

  const sandbox = path.join(ROOT, 'dist', `guard-dest-${process.pid}`)
  fs.mkdirSync(sandbox, { recursive: true })
  try {
    const dirRel = path.relative(ROOT, sandbox)
    assert.match(writeDestinationProblem(dirRel) ?? '', /is a directory/)

    const file = path.join(sandbox, 'plain.json')
    fs.writeFileSync(file, '{}\n')
    assert.equal(writeDestinationProblem(path.relative(ROOT, file)), null, 'a plain file is writable')

    /* The symlinkSync call is the only thing that may legitimately fail here.
     * Wrapping the ASSERTION in the same try swallowed it: mutating the guard
     * to follow links left the suite green. The flag separates the two. */
    const link = path.join(sandbox, 'link.json')
    let linked = false
    try {
      fs.symlinkSync(file, link)
      linked = true
    } catch {
      /* symlinks unavailable in this environment */
    }
    if (linked) {
      assert.match(
        writeDestinationProblem(path.relative(ROOT, link)) ?? '',
        /is a symlink/,
        'a symlink is refused even when it resolves inside',
      )
    }
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true })
  }
})

/* ── Containment at the read primitive ──────────────────────────────────────── */

test('read and readDirInRepo refuse a path that leaves the repository', () => {
  /* The check lives in the primitive because it was twice a per-call-site rule
   * and twice forgotten: closed in one script, left open in another. */
  assert.ok(read('README.md').length > 0, 'an ordinary read still works')
  assert.throws(() => read('../outside.md'), ContainmentError)
  assert.throws(() => read('/etc/hostname'), ContainmentError)
  assert.throws(() => readDirInRepo('../'), ContainmentError)
  assert.ok(Array.isArray(readDirInRepo('docs')), 'an in-repo directory still enumerates')
  /* The error must name the path and never carry content. */
  try {
    read('/etc/hostname')
    assert.fail('expected a ContainmentError')
  } catch (e) {
    assert.match(e.message, /refusing to read/)
    assert.ok(!e.message.includes('\n'), 'a containment error must not carry file content')
  }
})

test('uncontainedPaths flags a link and an escape, and passes ordinary files', (t) => {
  assert.deepEqual(uncontainedPaths(['README.md', 'docs/architecture/ARCHITECTURE.md']), [])
  assert.deepEqual(uncontainedPaths(['does/not/exist.md']), [], 'absent paths are not the concern here')

  /* THE CONTAINMENT HALF, which had no assertion at all: mutating
   * `!existsInRepo(p)` to `false` left the whole suite green while the designed
   * refusal in all four tools stopped firing and the run degraded to an uncaught
   * ContainmentError. The symlink half below was pinned; this one was not, and
   * "an escape" in this control's own title referred only to the link. */
  assert.deepEqual(uncontainedPaths(['../']), ['../'], 'a path resolving above the root must be flagged')
  assert.deepEqual(uncontainedPaths(['../..']), ['../..'])

  const sandbox = path.join(ROOT, 'dist', `guard-uncontained-${process.pid}`)
  fs.mkdirSync(sandbox, { recursive: true })
  try {
    const inside = path.join(sandbox, 'plain.md')
    fs.writeFileSync(inside, 'x\n')
    assert.deepEqual(uncontainedPaths([path.relative(ROOT, inside)]), [])

    const link = path.join(sandbox, 'link.md')
    let linked = false
    try {
      fs.symlinkSync(inside, link)
      linked = true
    } catch {
      /* symlinks unavailable */
    }
    if (!linked) return t.skip('symlinks not permitted in this environment')
    /* A link is refused even though it resolves INSIDE: a canonical file has no
     * reason to be one, and allowing it would make the rule depend on where the
     * link happens to point today. */
    assert.deepEqual(uncontainedPaths([path.relative(ROOT, link)]), [path.relative(ROOT, link)])

    const escaping = path.join(sandbox, 'escaping.md')
    fs.symlinkSync(path.resolve(ROOT, '..'), path.join(sandbox, 'up'), 'dir')
    const viaDir = path.join(path.relative(ROOT, sandbox), 'up', 'anything.md')
    assert.ok(!existsInRepo(viaDir), 'a directory-component link that escapes must not read as inside')
    void escaping

    /* AN ANCESTOR LINK THAT STAYS INSIDE THE TREE, which is the case the leaf
     * lstat could not see and containment does not refuse. Everything above
     * either resolves OUT of the repository — caught by `existsInRepo` — or is a
     * link at the final component. A directory link pointing at a sibling INSIDE
     * the root passes both, so the "none is a link, at the file or at any
     * directory above it" the callers print was false for exactly this shape.
     * `gitdir -> .git` is the same shape aimed somewhere worth reading. */
    const realdir = path.join(sandbox, 'realdir')
    fs.mkdirSync(realdir, { recursive: true })
    fs.writeFileSync(path.join(realdir, 'plain.md'), 'x\n')
    fs.symlinkSync('realdir', path.join(sandbox, 'aliasdir'), 'dir')
    const viaAlias = path.join(path.relative(ROOT, sandbox), 'aliasdir', 'plain.md')
    assert.ok(existsInRepo(viaAlias), 'the fixture must resolve INSIDE, or the case proves nothing')
    assert.ok(isRegularFile(viaAlias), 'and to a regular file, so only the link rule can flag it')
    assert.equal(isSymlinkPath(viaAlias), false, 'the leaf itself is not a link — that is the whole point')
    assert.deepEqual(uncontainedPaths([viaAlias]), [viaAlias], 'a link at a DIRECTORY component must be flagged')

    /* And the false-refusal direction beside it: `realdir-extra` shares a string
     * prefix with the link's target and is nobody's link. */
    const sibling = path.join(sandbox, 'realdir-extra')
    fs.mkdirSync(sibling, { recursive: true })
    fs.writeFileSync(path.join(sibling, 'plain.md'), 'x\n')
    assert.deepEqual(uncontainedPaths([path.join(path.relative(ROOT, sibling), 'plain.md')]), [])
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true })
  }
})

test('a destination that is neither file nor directory is refused', async (t) => {
  /* Mutation testing showed the !isFile() branch had no control: a FIFO at the
   * destination used to hang the checkpoint indefinitely. A unix socket is the
   * same lstat class and needs no shell. */
  const sandbox = path.join(ROOT, 'dist', `gs-${process.pid}`)
  fs.mkdirSync(sandbox, { recursive: true })
  const sockPath = path.join(sandbox, 's')

  /* A FIFO FIRST, because it is the case the code comment names and because
   * `mkfifo` has no path-length limit. The socket below was the original
   * fixture and skipped on any checkout deep enough to overflow `sun_path` —
   * so on those checkouts the `!isFile()` branch was unexercised and mutating
   * it survived. Two ways in, and a skip only if the platform offers neither. */
  let server = null
  let made = false
  try {
    execFileSync('mkfifo', [sockPath], { stdio: 'ignore' })
    made = fs.existsSync(sockPath)
  } catch {
    made = false
  }

  if (!made) {
    server = net.createServer()
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(sockPath, resolve)
      })
    } catch {
      server.close()
      fs.rmSync(sandbox, { recursive: true, force: true })
      return t.skip('neither mkfifo nor unix sockets are available in this environment')
    }
  }
  /* `listen` RESOLVING IS NOT THE SAME AS A SOCKET EXISTING. A unix socket path
   * longer than sun_path (107 bytes on Linux) is truncated by the kernel: the
   * bind succeeds, `address()` reports the path that was asked for, and no entry
   * appears at it. `writeDestinationProblem` then correctly returns null for a
   * path where nothing is, and this control failed — turning a checkout deep
   * enough to overflow the limit into a red gate with a misleading message. The
   * shortened names above buy headroom; this makes the remaining case a visible
   * skip instead of a false failure. Wrong-direction-safe either way: it never
   * turned a real refusal into a pass. */
  if (!fs.existsSync(sockPath)) {
    server?.close()
    fs.rmSync(sandbox, { recursive: true, force: true })
    return t.skip(`unix socket path exceeds this platform's limit at this checkout depth (${sockPath.length} bytes)`)
  }
  try {
    assert.match(
      writeDestinationProblem(path.relative(ROOT, sockPath)) ?? '',
      /not a regular file/,
      'a socket, FIFO or device must be refused rather than written through',
    )
  } finally {
    server?.close()
    fs.rmSync(sandbox, { recursive: true, force: true })
  }
})

test('the credential-URL shape is case-insensitive, as URI schemes are', () => {
  /* Mutation: removing the `i` flag left the suite green. RFC 3986 makes the
   * scheme case-insensitive, so an uppercase one must not hide a credential. */
  for (const line of [
    'url: https://user:s3cr3tvalue@db.example.invalid/x',
    'url: HTTPS://user:s3cr3tvalue@db.example.invalid/x',
    'url: Postgres://admin:s3cr3tvalue@db.example.invalid/x',
  ]) {
    assert.match(secretFindingForLine(line) ?? '', /credential-bearing URL/, line)
  }
})

test('the sk- shape is linear on a long non-matching line', () => {
  /* The digit lookahead added to stop `sk-learn-…` re-introduced the quadratic
   * class the URL pattern had just been bounded to remove. */
  const hostile = 'sk-'.repeat(40000)
  const started = process.hrtime.bigint()
  secretFindingForLine(hostile)
  const ms = Number(process.hrtime.bigint() - started) / 1e6
  assert.ok(ms < 1000, `sweeping a 120k-character sk- line took ${Math.round(ms)}ms`)
})

test('the JWT shape is linear on a long non-matching line', () => {
  /* The THIRD pattern in this list found to be quadratic, and the reason every
   * quantifier here is now bounded. `eyJ<pad>-` repeated gives one start
   * position per repeat, each scanning to the end of the line for the `.` that
   * never comes: 0.25s / 4.5s / 40s as one committed line grew 48k / 192k /
   * 576k, which stalls the whole gate from a single committed line. */
  const hostile = `# ${('eyJ' + 'A'.repeat(20) + '-').repeat(24000)}`
  const started = process.hrtime.bigint()
  secretFindingForLine(hostile)
  const ms = Number(process.hrtime.bigint() - started) / 1e6
  assert.ok(ms < 1000, `sweeping a ${hostile.length}-character JWT-shaped line took ${Math.round(ms)}ms`)
})

test('EVERY credential shape is linear, not only the three that were measured', () => {
  /* Three separate rounds each found one quadratic pattern, each time only
   * because somebody happened to time that one. This times ALL of them, so the
   * next unbounded quantifier is caught when it lands rather than when it is
   * noticed.
   *
   * An unbounded quantifier is not by itself the defect — `ghp_[A-Za-z0-9]{20,}`
   * ends the pattern, so there is nothing to backtrack into. The defect is
   * quadratic SCANNING, which is a timing property, so timing is what is
   * asserted. The hostile line for each shape is built from that shape's OWN
   * literal prefix, giving one restart position per repeat: the exact input that
   * made the URL, sk- and JWT patterns quadratic. */
  const literalPrefix = (source) => {
    const m = source.replace(/^\\b/, '').match(/^(?:[A-Za-z0-9_ -]|\\-)+/)
    return m ? m[0] : ''
  }
  for (const [re, label] of SECRET_VALUE_PATTERNS) {
    const seed = literalPrefix(re.source) || 'aB3'
    const hostile = `${(seed + 'A'.repeat(16) + '-').repeat(12000)}`
    const started = process.hrtime.bigint()
    re.test(hostile)
    const ms = Number(process.hrtime.bigint() - started) / 1e6
    assert.ok(ms < 1000, `${label} took ${Math.round(ms)}ms on a ${hostile.length}-character line seeded with "${seed}"`)
  }
})

test('a real credential of each shape is still detected after the bounds', () => {
  /* The other direction of the control above: bounding a quantifier must not
   * quietly narrow what the sweep finds. */
  const samples = [
    ['-----BEGIN RSA PRIVATE KEY-----', 'PEM private key'],
    [
      'note: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.dozjgNryP4J3jVmNHl0w5N',
      'JWT',
    ],
    ['note: sk-proj-a1b2c3d4e5f6g7h8i9j0k1l2', 'sk- API key'],
    ['note: AKIAIOSFODNN7EXAMPLE', 'AWS access key id'],
    ['note: https://admin:s3cr3tvalue@db.example.invalid/x', 'credential-bearing URL'],
  ]
  for (const [line, label] of samples) {
    assert.ok(secretFindingForLine(line), `${label} must still be detected: ${line.slice(0, 40)}…`)
  }
  assert.equal(secretFindingForLine('a note about eyJ and sk- and nothing else'), null, 'and prose must stay clean')
})

/* ── Fixtured git repositories ────────────────────────────────────────────────
 *
 * The classifiers below answer questions ABOUT A REPOSITORY, and the repository
 * the suite runs in can only ever be in one state at a time. Independent review
 * showed the consequence: three fail-open mutations of `classifyRepoSync`, one
 * of `classifyDrift`'s SUBSYSTEM STALE branch and one of `auditRepoState`'s
 * reachability call site all left the whole suite green, because no control
 * could reach those branches from this checkout.
 *
 * So each control below builds a REAL git repository as a fixture and imports a
 * copy of `lib.mjs` rooted in it — `ROOT` derives from `import.meta.url`, so a
 * copy two directories down inside the fixture is rooted there and its `git -C`
 * calls run against the fixture, not against this repository.
 *
 * Fixtures live under the gitignored pack directory, like the rest, and are
 * removed when each control finishes. Nothing here writes to this repository or
 * to any ref in it.
 */
const FIXTURE_ROOT = path.join(ROOT, 'dist', `gr-${process.pid}`)

function gitIn(dir) {
  return (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

/** A fixture repository with one commit, and `lib.mjs` rooted inside it. */
async function makeFixtureRepo(name, files = { 'README.md': '# fixture\n' }) {
  const dir = path.join(FIXTURE_ROOT, name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(path.join(dir, 'tools', 'context'), { recursive: true })
  for (const f of ['lib.mjs', 'check.mjs', 'checkpoint.mjs', 'pack.mjs', 'pack-audit.mjs']) {
    fs.copyFileSync(path.join(ROOT, 'tools', 'context', f), path.join(dir, 'tools', 'context', f))
  }
  const g = gitIn(dir)
  g('init', '-q', '-b', 'main')
  g('config', 'user.email', 'guard@example.invalid')
  g('config', 'user.name', 'guard fixture')
  g('config', 'commit.gpgsign', 'false')
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), body)
  }
  g('add', '-A')
  g('commit', '-q', '-m', 'fixture')
  const lib = await import(pathToFileURL(path.join(dir, 'tools', 'context', 'lib.mjs')).href)
  return { dir, g, lib }
}

const dropFixtures = () => {
  fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true })
  /* A traversing `pack_path` under test resolves ABOVE the fixture root, so a
   * run against a broken write gate leaves an artifact `FIXTURE_ROOT` does not
   * cover. It then fails every LATER run whatever is mutated — which reads as a
   * kill and is not one. Independent review hit exactly that and had to redo a
   * mutation pass. Removing it here keeps a mutation result meaningful. */
  fs.rmSync(path.join(ROOT, 'dist', 'ESCAPED'), { recursive: true, force: true })
}

test('classifyRepoSync fails closed to UNKNOWN, and DIRTY outranks a clean comparison', async (t) => {
  /* Every branch here survived mutation to `SYNCED` with the suite green. A
   * classifier that answers SYNCED when it cannot tell is the exact fail-open
   * the promotable-state rule exists to prevent, since only SYNCED promotes. */
  t.after(dropFixtures)

  const { dir, g, lib } = await makeFixtureRepo('sync')

  const noUpstream = lib.classifyRepoSync()
  assert.equal(noUpstream.state, 'UNKNOWN', 'no upstream configured — nothing to compare against')
  assert.match(noUpstream.reason, /no upstream configured/, 'and it must say why, not merely refuse')
  assert.equal(noUpstream.basis, 'none')

  const bare = path.join(FIXTURE_ROOT, 'sync-remote.git')
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare])
  g('remote', 'add', 'origin', bare)
  g('push', '-q', '-u', 'origin', 'main')
  assert.equal(lib.classifyRepoSync().state, 'SYNCED', 'pushed and level with its upstream')
  assert.equal(lib.isPromotableSyncState('SYNCED'), true)

  fs.writeFileSync(path.join(dir, 'README.md'), '# fixture, edited\n')
  assert.equal(lib.classifyRepoSync().state, 'DIRTY', 'an uncommitted change outranks a level history')
  assert.equal(lib.isPromotableSyncState('DIRTY'), false)

  g('checkout', '-q', '--', 'README.md')
  fs.writeFileSync(path.join(dir, 'ahead.md'), 'x\n')
  g('add', '-A')
  g('commit', '-q', '-m', 'ahead')
  assert.equal(lib.classifyRepoSync().state, 'LOCAL_AHEAD', 'committed but unpushed work is invisible to any consumer')

  g('checkout', '-q', '--detach')
  const detached = lib.classifyRepoSync()
  assert.equal(detached.state, 'UNKNOWN', 'a detached HEAD has no branch to compare')
  /* THE REASON, NOT ONLY THE STATE. Deleting the detached-HEAD guard still
   * yields UNKNOWN, because `@{upstream}` fails a moment later and the next
   * guard catches it — so a state-only assertion cannot tell the two apart and
   * the mutation survived. The reason string is what distinguishes them, and a
   * checkout that cannot say WHY it is unclassifiable is one nobody can act on. */
  assert.match(detached.reason, /detached HEAD/, 'and must name the detached HEAD, not the missing upstream')

  /* ONE BRANCH HERE IS NOT EXERCISED, and saying so is better than leaving a
   * reader to assume otherwise: `if (!revIsCommit(upstream))` — a configured
   * upstream whose local ref is missing. Both routes to it (deleting
   * `refs/remotes/origin/main`, and pointing `branch.main.merge` at a branch with
   * no tracking ref) make `git rev-parse @{upstream}` fail outright, so the
   * no-upstream guard above catches them first and this one is defence in depth
   * against a shape git did not produce for any fixture attempted. */
  g('checkout', '-q', 'main')

  for (const state of lib.REPO_SYNC_STATES) assert.equal(typeof state, 'string')
})

test('classifyDrift reports SUBSYSTEM STALE when code moved, not just DOCS-ONLY ADVANCE', async (t) => {
  /* Mutating the freshness ladder so code changes never raise SUBSYSTEM STALE
   * left the suite green: the existing control reaches only UNKNOWN and CURRENT,
   * because this repository's own base rarely sits behind a tools/ change at the
   * moment the suite runs. */
  t.after(dropFixtures)

  const { dir, g, lib } = await makeFixtureRepo('drift')
  const first = g('rev-parse', 'HEAD')

  fs.writeFileSync(path.join(dir, 'NOTES.md'), 'docs only\n')
  g('add', '-A')
  g('commit', '-q', '-m', 'docs')
  assert.equal(lib.classifyDrift(first).freshness, 'DOCS-ONLY ADVANCE', 'docs moved, no code did')

  fs.mkdirSync(path.join(dir, 'tools'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'tools', 'thing.mjs'), 'export const x = 1\n')
  g('add', '-A')
  g('commit', '-q', '-m', 'code')
  /* SELF_REPORTING must stay minimal. Widening it to list the tooling files makes
   * every change under `code_roots` invisible to the drift diff, so freshness
   * reports DOCS-ONLY ADVANCE while the validator itself moved — the same class
   * of fail-open the freshness ladder exists to close, reachable only by editing
   * `lib.mjs`, which is exactly why nothing caught it. */
  assert.deepEqual(lib.SELF_REPORTING, ['REPO_STATE.json'], 'only the file that reports on itself is excluded')

  const stale = lib.classifyDrift(first)
  assert.equal(stale.freshness, 'SUBSYSTEM STALE', 'a change under code_roots must raise SUBSYSTEM STALE')
  assert.ok(stale.code.length > 0, 'and must name the code files that moved')
  assert.equal(lib.classifyDrift(g('rev-parse', 'HEAD')).freshness, 'CURRENT', 'the other direction')
})

test('a base that is a real commit but unreachable from HEAD is UNKNOWN, never CURRENT', async (t) => {
  /* `git diff base..HEAD` compares TREES. A commit on an abandoned line of
   * history whose tree matches HEAD's yields an empty diff, and the freshness
   * ladder read that as CURRENT — for a base this tree never advanced from. The
   * fixture makes the trees identical on purpose: that is the sharp case, and
   * the one a reachability test is the only thing that catches. */
  t.after(dropFixtures)

  const { g, lib } = await makeFixtureRepo('reach')
  const head = g('rev-parse', 'HEAD')
  const side = g('commit-tree', `${head}^{tree}`, '-p', head, '-m', 'side')

  assert.ok(lib.isCommit(side), 'the side commit is a real commit in this repository')
  assert.equal(lib.isAncestorOfHead(side), false, 'and HEAD cannot reach it')
  assert.equal(
    g('diff', '--name-only', `${side}..${head}`, '--'),
    '',
    'its tree is identical to HEAD, so a tree diff reports nothing changed',
  )

  assert.equal(lib.changedSince(side), null, 'so changedSince must refuse rather than return []')
  const drift = lib.classifyDrift(side)
  assert.equal(drift.freshness, 'UNKNOWN')
  assert.equal(drift.resolved, false)

  /* And the audit's reachability call site, which mutation showed unexercised. */
  const problems = lib.auditRepoState(
    { generator: lib.REPO_STATE_GENERATOR, head, code_review_base: side },
    head,
  )
  assert.ok(
    problems.some((p) => /not reachable from HEAD/.test(p)),
    `auditRepoState must report the unreachable base; got ${JSON.stringify(problems)}`,
  )
  /* The other direction, scoped to the property under test: a minimal object is
   * missing plenty of other fields, and asserting an EMPTY problem list would be
   * asserting the whole audit rather than its reachability call site. */
  assert.equal(
    lib
      .auditRepoState({ generator: lib.REPO_STATE_GENERATOR, head, code_review_base: head }, head)
      .some((p) => /not reachable from HEAD/.test(p)),
    false,
    'and must not report a reachable base as unreachable',
  )
})

test('deleting the tracked state file is a DELETION, not a first run', async (t) => {
  /* Absence alone reached the auto-adopt path, so `rm REPO_STATE.json` moved
   * code_review_base to HEAD with no flag — a lower-friction route to the
   * fabricated audit than hand-writing the file. */
  t.after(dropFixtures)

  const { dir, g, lib } = await makeFixtureRepo('deleted', {
    'README.md': '# fixture\n',
    'REPO_STATE.json': '{"code_review_base": "0000000"}\n',
  })

  assert.equal(lib.isInHeadCommit('REPO_STATE.json'), true, 'HEAD carries it')
  assert.equal(lib.isInHeadCommit('never-committed.json'), false, 'and says so when it does not')

  fs.rmSync(path.join(dir, 'REPO_STATE.json'))
  assert.equal(lib.entryExists('REPO_STATE.json'), false, 'gone from the tree')
  assert.equal(lib.isInHeadCommit('REPO_STATE.json'), true, 'but still in the commit — a deletion, not a first run')

  /* The call site, not only the primitive: mutation testing has repeatedly shown
   * a pinned primitive says nothing about whether anything calls it. */
  let code = 0
  let stderr = ''
  try {
    execFileSync(process.execPath, [path.join(dir, 'tools', 'context', 'checkpoint.mjs')], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    code = e.status
    stderr = String(e.stderr ?? '')
  }
  assert.equal(code, 1, 'the checkpoint must refuse')
  assert.match(stderr, /DELETION, not a first run/, `got: ${stderr.slice(0, 300)}`)
  assert.equal(fs.existsSync(path.join(dir, 'REPO_STATE.json')), false, 'and must not have written one')

  g('status', '--porcelain')
})

/* ── `context:check`'s own call sites ─────────────────────────────────────────
 *
 * Until these existed, NOT ONE guard inside `check.mjs` had a regression
 * control. The fixture machinery above copied the script in but never ran it,
 * and `make brain-gate` only ever runs it against this repository's own valid
 * state — which cannot tell a working guard from a disabled one. Independent
 * review made the consequence concrete: six separate mutations of `check.mjs`
 * call sites left the whole suite green, including switching the SECRET SWEEP
 * and the GENERATED-STATE AUDIT off entirely.
 *
 * `guards.test.mjs` had already written the rule these close — "a pinned
 * primitive says nothing about whether anything calls it" — and applied it to
 * `checkpoint.mjs` alone.
 *
 * Each control below runs the real script in a fixture repository and asserts on
 * the DESIGNED OUTPUT: the exact line a reader would act on. A fixture is not a
 * complete Brain, so other checks fail alongside; every assertion is therefore
 * scoped to its own message, and each asserts BOTH directions — the message
 * appears when the defect is planted, and is absent when it is not.
 */

/** Run the fixture's own `check.mjs` and return its exit code and output. */
function runCheck(dir) {
  try {
    const out = execFileSync(process.execPath, [path.join(dir, 'tools', 'context', 'check.mjs')], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? -1, out: `${String(e.stdout ?? '')}${String(e.stderr ?? '')}` }
  }
}

test('check.mjs aborts on a canonical path that leaves the repository, and leaks nothing', async (t) => {
  t.after(dropFixtures)
  const { dir } = await makeFixtureRepo('abort', { 'README.md': '# fixture\n', 'STATUS.md': '# status\n' })

  const clean = runCheck(dir)
  assert.doesNotMatch(clean.out, /do not resolve to a plain file/, 'no refusal before anything is planted')
  assert.match(
    clean.out,
    /every one of the \d+ paths this run guards resolves inside this repository, none is reached through a link at ANY component, and each is the kind of entry it is read as/,
  )

  /* A canary OUTSIDE the fixture. If any of it reaches the output, the refusal
   * did not happen and this control is reporting the wrong thing. */
  const outside = path.join(FIXTURE_ROOT, 'outside')
  fs.mkdirSync(outside, { recursive: true })
  fs.writeFileSync(path.join(outside, 'SECRET.md'), 'CANARY_OUTSIDE_9f3a\npassword: hunter2CanaryValue\n')
  fs.rmSync(path.join(dir, 'STATUS.md'))
  fs.symlinkSync(path.join(outside, 'SECRET.md'), path.join(dir, 'STATUS.md'))

  const linked = runCheck(dir)
  assert.equal(linked.code, 1, 'a link at a canonical path must abort')
  assert.match(linked.out, /do not resolve to a plain file inside this repository: STATUS\.md/)
  assert.match(linked.out, /Aborting before anything reads through it/)
  assert.doesNotMatch(linked.out, /CANARY_OUTSIDE_9f3a|hunter2CanaryValue/, 'and must echo nothing it refused to read')
  assert.doesNotMatch(linked.out, /ContainmentError/, 'the designed refusal, not an uncaught throw')

  fs.rmSync(path.join(dir, 'STATUS.md'))
  fs.writeFileSync(path.join(dir, 'STATUS.md'), '# status\n')

  /* ONE PATH FROM EVERY SET `willRead` UNIONS, which is the whole reason the
   * guarded set is "every path this run reads" rather than the canonical list.
   * A control that only ever planted its link at a `CANONICAL_DOCS` path let
   * every narrowing of the union survive — dropping `CANONICAL_YAML` and
   * `DATED_DOCS`, dropping `README.md` and `Makefile`, dropping the evidence
   * records — each of which is a shape this list has actually had. */
  for (const rel of [
    'README.md' /* neither canonical nor dated */,
    'AGENTS.md' /* CANONICAL_DOCS only — STATUS.md above is also a DATED_DOC */,
    'PROJECT.yaml' /* CANONICAL_YAML */,
    path.join('docs', 'architecture', 'ARCHITECTURE.md') /* DATED_DOCS only */,
    path.join('docs', 'verification', 'A_2026-01-01', 'README.md') /* an evidence record */,
    path.join('dist', 'context', 'PROJECT_CONTEXT.md') /* the generated pack, read for its size */,
  ]) {
    const at = path.join(dir, rel)
    fs.mkdirSync(path.dirname(at), { recursive: true })
    fs.rmSync(at, { force: true })
    fs.symlinkSync(path.join(outside, 'SECRET.md'), at)
    const r = runCheck(dir)
    assert.equal(r.code, 1, `${rel}: a link at a read path must abort even though it is not canonical`)
    assert.match(r.out, /do not resolve to a plain file inside this repository/, rel)
    assert.doesNotMatch(r.out, /CANARY_OUTSIDE_9f3a|hunter2CanaryValue/, `${rel}: nothing outside is echoed`)
    assert.doesNotMatch(r.out, /ContainmentError/, `${rel}: the designed refusal`)
    fs.rmSync(at)
  }
})

test('check.mjs guards the PROJECT.yaml-supplied read paths, not only the canonical set', async (t) => {
  /* The gap independent review named (F-41): `live_state_docs` and the `size_limits`
   * keys are configured path values that later steps read, and both were outside
   * the guarded set — so a traversing value produced a stack trace and no report
   * rather than this refusal. */
  t.after(dropFixtures)
  const { dir } = await makeFixtureRepo('cfgpaths', { 'README.md': '# fixture\n' })
  const outside = path.join(FIXTURE_ROOT, 'outside2')
  fs.mkdirSync(outside, { recursive: true })
  fs.writeFileSync(path.join(outside, 'SECRET.md'), 'CANARY_CFG_7c1b\n')

  for (const [key, body] of [
    ['live_state_docs', 'brain:\n  live_state_docs:\n    - ../outside2/SECRET.md\n'],
    ['size_limits', 'brain:\n  size_limits:\n    ../outside2/SECRET.md: 10\n'],
  ]) {
    fs.writeFileSync(path.join(dir, 'PROJECT.yaml'), body)
    const r = runCheck(dir)
    assert.equal(r.code, 1, `${key}: a traversing value must abort`)
    assert.match(r.out, /do not resolve to a plain file inside this repository/, `${key}: the designed refusal`)
    assert.doesNotMatch(r.out, /ContainmentError/, `${key}: not an uncaught throw`)
    assert.doesNotMatch(r.out, /CANARY_CFG_7c1b/, `${key}: nothing outside the repository is echoed`)
  }
})

test('check.mjs FAILS a generated state that does not look generated', async (t) => {
  t.after(dropFixtures)
  const { dir, g } = await makeFixtureRepo('genstate', { 'README.md': '# fixture\n' })
  const head = g('rev-parse', 'HEAD')
  const good = {
    generator: REPO_STATE_GENERATOR,
    schema_version: 1,
    generated_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    head,
    code_review_base: head,
    tree_status: 'clean',
    repo_sync_state: 'UNKNOWN',
    freshness: 'CURRENT',
  }
  const stateAt = path.join(dir, 'REPO_STATE.json')

  fs.writeFileSync(stateAt, `${JSON.stringify(good, null, 2)}\n`)
  assert.doesNotMatch(runCheck(dir).out, /does not look generated/, 'a well-formed state must not be flagged')

  fs.writeFileSync(stateAt, `${JSON.stringify({ ...good, generator: 'my-editor' }, null, 2)}\n`)
  const forged = runCheck(dir)
  assert.match(forged.out, /does not look generated/, 'a foreign generator stamp must FAIL')
  assert.equal(forged.code, 1)

  fs.writeFileSync(stateAt, `${JSON.stringify({ ...good, tree_status: 'probably fine' }, null, 2)}\n`)
  assert.match(runCheck(dir).out, /tree_status "probably fine" is not clean\|dirty/, 'and so must a malformed field')
})

test('check.mjs FAILS, and reports UNKNOWN, for a base HEAD cannot reach', async (t) => {
  t.after(dropFixtures)
  const { dir, g } = await makeFixtureRepo('checkreach', { 'README.md': '# fixture\n' })
  const head = g('rev-parse', 'HEAD')
  const side = g('commit-tree', `${head}^{tree}`, '-p', head, '-m', 'side')
  const state = (base) =>
    `${JSON.stringify(
      {
        generator: REPO_STATE_GENERATOR,
        schema_version: 1,
        generated_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
        head,
        code_review_base: base,
        tree_status: 'clean',
        repo_sync_state: 'UNKNOWN',
        freshness: 'CURRENT',
      },
      null,
      2,
    )}\n`

  fs.writeFileSync(path.join(dir, 'REPO_STATE.json'), state(head))
  assert.match(runCheck(dir).out, /FRESHNESS: CURRENT/, 'a reachable base is answerable')

  fs.writeFileSync(path.join(dir, 'REPO_STATE.json'), state(side))
  const unreachable = runCheck(dir)
  assert.match(unreachable.out, /FRESHNESS: UNKNOWN/, 'an unreachable base is not CURRENT')
  /* AS A FAIL, not merely as text that appears somewhere. Downgrading this
   * `fail()` to a `warn()` survived an assertion on the message alone, because
   * the generated-state audit fails independently and the run still exits 1. */
  assert.match(unreachable.out, /^FAIL {2}freshness UNKNOWN — code_review_base .* is not a commit reachable from HEAD/m)
  assert.match(unreachable.out, /^FAIL {2}.*not reachable from HEAD/m, 'and the audit reports it too')
  assert.match(unreachable.out, /^FAIL — /m, 'the overall verdict is FAIL')
  assert.equal(unreachable.code, 1)
})

test('check.mjs FAILS on a credential planted in a canonical file', async (t) => {
  /* Mutating the sweep's call site to `null` left the suite green while two real
   * credential shapes sat in a canonical file and the run reported 0 FAIL. */
  t.after(dropFixtures)
  const { dir } = await makeFixtureRepo('sweep', { 'README.md': '# fixture\n', 'STATUS.md': '# status\n' })

  assert.doesNotMatch(runCheck(dir).out, /possible secret/, 'a clean canonical file must not be flagged')

  fs.writeFileSync(
    path.join(dir, 'STATUS.md'),
    '# status\n\naws: AKIAIOSFODNN7EXAMPLE\nurl: https://admin:s3cr3tvalue@db.example.invalid/x\n',
  )
  const swept = runCheck(dir)
  /* ANCHORED ON SEVERITY, not on the message alone. Matching the text only left
   * `fail(` -> `warn(` at the sweep's call site alive: the run reported the same
   * sentence as a WARN, exited 0, `make brain-gate` went green, and the planted
   * credential reached the generated pack. `assert.equal(swept.code, 1)` below
   * does NOT catch it either — this fixture is a deliberately incomplete Brain,
   * so the run already exits 1 for unrelated reasons and the exit code cannot
   * separate the one machine-enforced clause of SECRETS_POLICY.md from that
   * clause switched off. The `^FAIL {2}` anchor is what kills the mutant. */
  assert.match(swept.out, /^FAIL {2}possible secret VALUE in a scanned file/m)
  assert.match(swept.out, /^FAIL — /m, 'and the overall verdict is FAIL, not WARN')
  assert.match(swept.out, /AWS access key id/)
  assert.match(swept.out, /credential-bearing URL/)
  assert.doesNotMatch(swept.out, /AKIAIOSFODNN7EXAMPLE|s3cr3tvalue/, 'the report names the shape, never the value')
  assert.equal(swept.code, 1)

  /* THE KEY HALF, AT THIS CALL SITE. Everything above plants a VALUE shape, so
   * `secretFindingForLine(line, { keyRule: false })` survived here with the
   * suite green — half of the one machine-enforced clause of SECRETS_POLICY.md
   * switched off by one token, the PASS line still claiming value-bearing keys
   * were scanned for, and the credential reaching the generated pack.
   * `SECRET_KEY_RE` is unit-tested in isolation; that says nothing about whether
   * this run applies it. */
  fs.writeFileSync(path.join(dir, 'STATUS.md'), '# status\n\npassword: hunter2CorrectHorse\n')
  const keyed = runCheck(dir)
  assert.match(keyed.out, /^FAIL {2}possible secret VALUE in a scanned file.*key "password"/m)
  assert.doesNotMatch(keyed.out, /hunter2CorrectHorse/, 'the report names the key, never the value')
})

test('the secret sweep covers what the CORE pack inlines, not only the canonical set', async (t) => {
  /* `brain.pack_extra_core_sections` is committable content naming any path in
   * the tree, and `pack.mjs` inlines each one verbatim. With the sweep scoped to
   * the canonical set, a section outside it carried credential shapes into the
   * generated pack while `context:check` printed PASS and the gate exited 0. */
  t.after(dropFixtures)
  const { dir } = await makeFixtureRepo('extrasweep', { 'README.md': '# fixture\n' })

  fs.mkdirSync(path.join(dir, 'docs/notes'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'docs/notes/OPS.md'), '# ops\n\naws: AKIAIOSFODNN7EXAMPLE\n')

  /* Not declared as a pack section yet: the same file, unswept, must pass — so
   * a green result below cannot come from the sweep flagging it for some other
   * reason. This is the accept direction the scope rule needs beside it. */
  fs.writeFileSync(path.join(dir, 'PROJECT.yaml'), 'brain:\n  pack_extra_core_sections: []\n')
  assert.doesNotMatch(
    runCheck(dir).out,
    /possible secret VALUE/,
    'a file the pack does not inline is outside the declared scope',
  )

  fs.writeFileSync(
    path.join(dir, 'PROJECT.yaml'),
    'brain:\n  pack_extra_core_sections:\n    - "OPS NOTES|docs/notes/OPS.md"\n',
  )
  const out = runCheck(dir)
  assert.match(out.out, /^FAIL {2}possible secret VALUE/m, 'once inlined, it is swept')
  assert.match(out.out, /docs\/notes\/OPS\.md/, 'and the report names it')
  assert.doesNotMatch(out.out, /AKIAIOSFODNN7EXAMPLE/, 'the report names the shape, never the value')
})

test('the evidence DIRECTORY itself is guarded, not only the records under it', async (t) => {
  /* `uncontainedDirs` and the whole `willEnumerate` half of step 0 shipped with
   * no control: mutating it to `return []`, or dropping it from the call site,
   * left the suite green while a symlinked evidence directory produced a run
   * reporting `PASS … none is a link` and `verification evidence: 0 record(s)`.
   * The nearby symlinked-RECORD control is satisfied through `evidenceRecords`
   * and `uncontainedPaths`, and never plants a link AT `docs/verification`.
   *
   * ASSERT THE REFUSAL, NOT ONE TERM: `isSymlinkPath` and `!isDirectoryPath` are
   * mutually redundant at this call site, so a control pinning either alone is
   * killed by neither the noop mutant nor the dropped call site. */
  t.after(dropFixtures)
  const { dir } = await makeFixtureRepo('evdir', { 'README.md': '# fixture\n' })
  const evDir = path.join(dir, 'docs', 'verification')
  fs.mkdirSync(path.join(dir, '_evidence', 'FAKE_2026-01-01'), { recursive: true })
  fs.writeFileSync(path.join(dir, '_evidence', 'FAKE_2026-01-01', 'README.md'), '# fake\n')
  fs.mkdirSync(path.dirname(evDir), { recursive: true })

  for (const [label, target] of [
    ['inside', path.join(dir, '_evidence')],
    ['outside', path.join(FIXTURE_ROOT, 'outside-evidence')],
  ]) {
    fs.mkdirSync(path.join(FIXTURE_ROOT, 'outside-evidence'), { recursive: true })
    fs.rmSync(evDir, { recursive: true, force: true })
    fs.symlinkSync(target, evDir)
    const r = runCheck(dir)
    assert.equal(r.code, 1, `${label}: a symlinked evidence directory must abort`)
    assert.match(
      r.out,
      /do not resolve to a plain file inside this repository: .*docs\/verification/,
      `${label}: the designed refusal, naming the directory`,
    )
    assert.doesNotMatch(r.out, /verification evidence: \d+ record/, `${label}: no step ran past the abort`)
  }

  /* A NON-DIRECTORY there, which is what makes `!isDirectoryPath` reachable. The
   * enumeration used to run before the gate, so this threw an uncaught ENOTDIR
   * with no refusal and no verdict lines. */
  fs.rmSync(evDir, { recursive: true, force: true })
  fs.writeFileSync(evDir, 'not a directory\n')
  const asFile = runCheck(dir)
  assert.equal(asFile.code, 1, 'a regular file at the evidence directory must abort')
  assert.match(asFile.out, /do not resolve to a plain file inside this repository: .*docs\/verification/)
  assert.doesNotMatch(asFile.out, /ENOTDIR/, 'the designed refusal, not an uncaught throw')
})

test('a configured pack section may not name, or RESOLVE TO, a credential file or anything under .git/', async (t) => {
  /* Containment is the wrong test: both are INSIDE the repository, so every
   * containment rule permits them — and `pack.mjs` inlines a section verbatim.
   * `.env` and `.git/config` were both inlined into the generated pack, which
   * falsified SECRETS_POLICY.md §1 rule 7 on two of its four clauses.
   *
   * THE NORMALISED FORMS ARE HERE FOR A SECOND DEFECT, not for completeness. The
   * refusal was anchored on the raw configured string, so `.GIT/config` (every
   * case-insensitive filesystem, macOS included), `.git./config` and
   * `deploy.key ` / `.env ` (NTFS, SMB) named the very files it refuses and were
   * accepted, opened and inlined. On Linux each is a DISTINCT path, which is why
   * the fixture below creates them for real and asserts on the pack: the
   * assertion would otherwise pass because nothing was there to inline. */
  t.after(dropFixtures)
  const { dir } = await makeFixtureRepo('credsection', {
    'README.md': '# fixture\n',
    /* The pack writer refuses a destination that is not gitignored, so without
     * this the pack is never written and the assertion below passes vacuously. */
    '.gitignore': 'dist/\n.env\n',
  })
  const LEAK = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\n'
  const GITLIKE = '[core]\n\trepositoryformatversion = 0\n'
  /* Every marker any refused file carries, in one place: the credential value,
   * the git-config shape, and the canary planted in the fixture's real `.git`
   * below. Asserted against both the tools' output and the written packs. */
  const LEAKED = /AKIAIOSFODNN7EXAMPLE|repositoryformatversion|GITDIRCANARY-8f31c2/
  fs.writeFileSync(path.join(dir, '.env'), LEAK)

  /* Real files at the normalised-away shapes, so "nothing inlined" is a claim
   * about the guard rather than about an absent file. `.GIT` and `.git.` are
   * ordinary directories on Linux and are NOT this fixture's git directory. */
  fs.writeFileSync(path.join(dir, 'deploy.key'), LEAK)
  fs.writeFileSync(path.join(dir, 'deploy.key '), LEAK)
  fs.writeFileSync(path.join(dir, '.env '), LEAK)
  for (const d of ['.GIT', '.git.']) {
    fs.mkdirSync(path.join(dir, d), { recursive: true })
    fs.writeFileSync(path.join(dir, d, 'config'), GITLIKE)
  }

  /* ── The RESOLVED-PATH half ────────────────────────────────────────────────
   *
   * Every shape above is caught by reading the CONFIGURED STRING per component.
   * A directory symlink defeats that entirely, and it is committable content:
   * `gitdir -> .git` plus a section of `gitdir/config` has no `.git` component
   * to find — case-folding, trailing-dot normalisation and the backslash split
   * all answer "clean" — while the file `pack.mjs` opens is `.git/config`.
   * Containment does not catch it either: the target is INSIDE the repository.
   *
   * The canary goes into THIS FIXTURE'S OWN `.git/config`, as a git comment, so
   * the assertion is about the guard and not about an empty file. Neither this
   * repository nor any real credential file is ever a payload here — the leak
   * markers below are the fixture's own planted strings. */
  const CANARY = 'GITDIRCANARY-8f31c2'
  fs.appendFileSync(path.join(dir, '.git', 'config'), `\n# ${CANARY}\n`)
  let linked = false
  try {
    fs.symlinkSync('.git', path.join(dir, 'gitdir'), 'dir')
    /* And the credential clause re-asked of the real location: a LEAF link is
     * the same hole one component further down. */
    fs.symlinkSync('deploy.key', path.join(dir, 'notes.md'))
    linked = true
  } catch {
    /* symlinks unavailable */
  }

  /* PREFIX CONFUSION, in the false-refusal direction. `.git-evil` shares a
   * string prefix with `.git` and is an ordinary directory that this repository
   * may legitimately carry. A containment test written as
   * `real.startsWith(realGit)` refuses it, so this file's ACCEPTANCE below is
   * what pins the comparison to a component boundary. Its content is innocuous
   * on purpose: it really is inlined. */
  fs.mkdirSync(path.join(dir, '.git-evil'), { recursive: true })
  fs.writeFileSync(path.join(dir, '.git-evil', 'notes.md'), '# notes\n\nnothing secret here\n')

  const bads = [
    /* The shapes the original defect covered. */
    '.env',
    'deploy.key',
    '.git/config',
    /* Case-folded `.git`: same file wherever the filesystem folds case. */
    '.GIT/config',
    '.Git/config',
    /* Trailing dot and trailing space, on the component and on the basename. */
    '.git./config',
    'deploy.key.',
    '.env.',
    /* Quoted so the YAML subset preserves the trailing space rather than
     * trimming it — the whole point of the case. */
    '"deploy.key "',
    '".env "',
    /* Backslash separator, which the component split accepts on both keys. */
    '.git\\\\config',
    /* The resolved-path cases. Skipped rather than silently dropped where the
     * environment cannot create a symlink, so a green run never reads as
     * coverage this platform did not actually get. */
    ...(linked ? ['gitdir/config', 'notes.md'] : []),
  ]
  if (!linked) t.diagnostic('symlinks not permitted here: the resolved-path cases did not run')

  for (const key of ['pack_extra_core_sections', 'pack_extra_full_sections']) {
    for (const bad of bads) {
      /* An already-quoted entry carries its own quotes; a bare one gets them. */
      const entry = bad.startsWith('"') ? `"X|${bad.slice(1)}` : `"X|${bad}"`
      fs.writeFileSync(path.join(dir, 'PROJECT.yaml'), `brain:\n  ${key}:\n    - ${entry}\n`)
      const r = runCheck(dir)
      assert.match(r.out, /may not name/, `${key} ${bad}: refused where the sections are parsed`)
      assert.doesNotMatch(r.out, LEAKED, `${key} ${bad}: the refusal carries no content`)

      /* ASSERT ON THE PACK FILE, not on the writer's console output — the console
       * would never carry an inlined credential, so asserting there passes
       * vacuously whether the guard works or not. Both profiles are written,
       * because the FULL key is only observable in the FULL one. */
      const packAt = path.join(dir, 'dist', 'context', 'PROJECT_CONTEXT.md')
      const fullAt = path.join(dir, 'dist', 'context', 'PROJECT_CONTEXT_FULL.md')
      fs.rmSync(path.join(dir, 'dist'), { recursive: true, force: true })
      const rp = runPack(dir)
      const rf = runPack(dir, ['--full'])
      const packed = fs.existsSync(packAt) ? fs.readFileSync(packAt, 'utf8') : ''
      const full = fs.existsSync(fullAt) ? fs.readFileSync(fullAt, 'utf8') : ''
      assert.ok(packed.length, `${key} ${bad}: the pack must still be written`)
      assert.ok(full.length, `${key} ${bad}: the FULL pack must still be written`)
      assert.doesNotMatch(packed, LEAKED, `${key} ${bad}: nothing inlined into CORE`)
      assert.doesNotMatch(full, LEAKED, `${key} ${bad}: nothing inlined into FULL`)
      /* The WRITER's own console too. `pack.mjs` refuses at the same parse, so
       * nothing it prints may carry the value either — the refusal has to be
       * content-free wherever it surfaces, not only in the checker. */
      assert.doesNotMatch(rp.out, LEAKED, `${key} ${bad}: the CORE writer prints no content`)
      assert.doesNotMatch(rf.out, LEAKED, `${key} ${bad}: the FULL writer prints no content`)
    }

    /* THE ACCEPT DIRECTION, beside every refusal above: a legitimate path on the
     * same key must still become a section. Without it the whole block is
     * satisfied by a filter that rejects everything. */
    fs.mkdirSync(path.join(dir, 'docs', 'notes'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'docs/notes/OPS.md'), '# ops\n\nnothing secret here\n')
    fs.writeFileSync(path.join(dir, 'PROJECT.yaml'), `brain:\n  ${key}:\n    - "OPS NOTES|docs/notes/OPS.md"\n`)
    assert.doesNotMatch(runCheck(dir).out, /may not name/, `${key}: an ordinary path is not refused`)

    /* AND THE PREFIX-CONFUSION ACCEPT, which is what keeps the `.git`
     * containment test component-aware rather than a string prefix. Without it
     * the resolved-path rule is satisfied by refusing every path that merely
     * starts with the same characters. */
    fs.writeFileSync(path.join(dir, 'PROJECT.yaml'), `brain:\n  ${key}:\n    - "EVIL NOTES|.git-evil/notes.md"\n`)
    assert.doesNotMatch(
      runCheck(dir).out,
      /may not name/,
      `${key}: .git-evil is not this repository's .git directory`,
    )

    /* A malformed entry is REPORTED rather than silently dropped — dropping it
     * produced a later refusal that named no path at all. */
    fs.writeFileSync(path.join(dir, 'PROJECT.yaml'), `brain:\n  ${key}:\n    - "no-pipe-here"\n`)
    assert.match(runCheck(dir).out, /is not "Title\|path"/, `${key}: a malformed entry names itself`)
  }
})

test('a configured pack section path is guarded by step 0, not only swept', async (t) => {
  /* The sweep half of the extra-sections fix had a control; the step-0 half did
   * not, and dropping `EXTRA_CORE_SECTION_PATHS` from `willRead` reinstates the
   * indefinite hang the entry-kind rule was written to remove. A directory is
   * used rather than a FIFO so the control is portable. */
  t.after(dropFixtures)
  const { dir } = await makeFixtureRepo('extraguard', { 'README.md': '# fixture\n' })
  fs.mkdirSync(path.join(dir, 'docs', 'notes', 'DIR.md'), { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'PROJECT.yaml'),
    'brain:\n  pack_extra_core_sections:\n    - "NOTES|docs/notes/DIR.md"\n',
  )
  const r = runCheck(dir)
  assert.equal(r.code, 1, 'a directory at a configured pack-section path must abort')
  assert.match(r.out, /do not resolve to a plain file inside this repository: .*docs\/notes\/DIR\.md/)
  assert.doesNotMatch(r.out, /EISDIR|ENOTDIR/, 'the designed refusal, not an uncaught throw')
})

test('a non-regular file at a read path is refused, not followed into a hang', async (t) => {
  /* Both shapes defeated the designed step-0 abort, each in its own way, while
   * every caller's refusal said "plain file" and none verified it. A FIFO made
   * `readFileSync` block forever, so the run produced NO output and no refusal.
   * A DIRECTORY threw an uncaught EISDIR from the reading step. `checkpoint.mjs`
   * refused a non-regular WRITE destination all along; the read side did not. */
  t.after(dropFixtures)
  const { dir } = await makeFixtureRepo('nonregular', { 'README.md': '# fixture\n', 'STATUS.md': '# status\n' })

  fs.rmSync(path.join(dir, 'STATUS.md'))
  fs.mkdirSync(path.join(dir, 'STATUS.md'))
  fs.writeFileSync(path.join(dir, 'STATUS.md', 'x.txt'), 'x\n')
  const asDir = runCheck(dir)
  assert.equal(asDir.code, 1, 'a directory at a canonical path must abort')
  assert.match(asDir.out, /do not resolve to a plain file inside this repository/, 'the designed refusal')
  assert.match(asDir.out, /STATUS\.md/, 'and it names the path')
  assert.doesNotMatch(asDir.out, /EISDIR/, 'not an uncaught throw from the reading step')
  fs.rmSync(path.join(dir, 'STATUS.md'), { recursive: true })

  let fifo = false
  try {
    execFileSync('mkfifo', [path.join(dir, 'STATUS.md')], { stdio: 'ignore' })
    fifo = true
  } catch {
    /* No mkfifo on this platform; the directory case above still pins the rule. */
  }
  if (fifo) {
    /* `runCheck` would block forever against the old code, so this asserts on a
     * bounded run: the refusal must arrive, rather than the run producing
     * nothing at all. A gate that hangs reports nothing, which is worse than a
     * gate that fails. */
    const r = spawnSync(process.execPath, [path.join(dir, 'tools', 'context', 'check.mjs')], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 20000,
    })
    assert.notEqual(r.signal, 'SIGTERM', 'the run must terminate rather than block on the FIFO')
    assert.match(`${r.stdout}`, /do not resolve to a plain file inside this repository/, 'the designed refusal')
  }
})

test('checkpoint refuses a state file whose content is the literal null, by asking whether one exists', async (t) => {
  /* `entryExists(REPO_STATE)` -> `prior !== null` at the unusable-base refusal
   * survived mutation: it reintroduces exactly the historical shape the comment
   * above that refusal says was found and closed, and produces an uncaught
   * TypeError at the base selection instead of this clean refusal. */
  t.after(dropFixtures)
  const { dir } = await makeFixtureRepo('nullstate', { 'README.md': '# fixture\n' })
  fs.writeFileSync(path.join(dir, 'REPO_STATE.json'), 'null\n')

  const r = runCheckpoint(dir)
  assert.equal(r.code, 1, 'a null state file must refuse')
  assert.match(r.out, /is not a commit id/, 'the designed refusal, naming the unusable base')
  assert.doesNotMatch(r.out, /TypeError/, 'not an uncaught throw')
  assert.doesNotMatch(r.out, /ADOPTED to HEAD/, 'and nothing was adopted')
})

test('promotable_snapshot_source is false when the checker failed or the base is unresolvable', async (t) => {
  /* The `checkOk` and `drift.resolved` terms both survived being dropped: the
   * field was written true beside the run's own `context:check reported FAIL`.
   * Nothing consumes it today, which makes it latent rather than harmless — a
   * precondition field that lies is worse than one nobody reads. */
  t.after(dropFixtures)
  const { dir, g } = await makeFixtureRepo('promotable', { 'README.md': '# fixture\n' })
  const bare = path.join(FIXTURE_ROOT, 'promotable-remote.git')
  const gb = gitIn(FIXTURE_ROOT)
  gb('init', '-q', '--bare', bare)
  g('remote', 'add', 'origin', bare)
  g('push', '-q', '-u', 'origin', 'main')

  runCheckpoint(dir)
  const state = JSON.parse(fs.readFileSync(path.join(dir, 'REPO_STATE.json'), 'utf8'))
  assert.equal(state.repo_sync_state, 'SYNCED', 'the fixture must be SYNCED, or this control proves nothing')
  assert.equal(
    state.promotable_snapshot_source,
    false,
    'SYNCED and clean is not enough: this fixture is an incomplete Brain, so context:check FAILS',
  )
})

test('an absolute path is refused even when it points inside the repository', async (t) => {
  /* Dropping the `path.isAbsolute` refusal in `isInsideRepo` left the suite
   * green. Nothing escaped — the lexical test still caught paths outside — but
   * an absolute path INSIDE was newly accepted, and `writeDestinationProblem`
   * resolves while the write joins, so the pack landed at one path while the
   * refusal reported another. */
  t.after(dropFixtures)
  const { lib } = await makeFixtureRepo('abspath', { 'README.md': '# fixture\n' })
  assert.equal(lib.isInsideRepo(path.join(lib.ROOT, 'README.md')), false, 'absolute-inside is still refused')
  assert.equal(lib.isInsideRepo('/etc/hosts'), false, 'absolute-outside too')
  assert.equal(lib.isInsideRepo('README.md'), true, 'and the relative form is accepted')
})

test('the JWT bounds are where the comment says they are', () => {
  /* The bounds narrow detection, so where they sit is a disclosed fact rather
   * than an implementation detail — and an undisclosed re-tightening would
   * quietly shrink the sweep. A benign key name is used so only the VALUE
   * pattern can fire; `secretFindingForLine` would otherwise report the key. */
  /* The bounds count the characters AFTER the literal `eyJ`, not the whole
   * segment — the first draft of this control asserted the latter and failed,
   * which is the argument for pinning the boundary rather than describing it. */
  const jwt = (afterEyJ, payloadLen) => `note: eyJ${'A'.repeat(afterEyJ)}.${'B'.repeat(payloadLen)}.sig`

  assert.ok(secretFindingForLine(jwt(512, 2048)), '512 after eyJ, and a 2048 payload, are matched')
  assert.equal(secretFindingForLine(jwt(513, 2048)), null, '513 after eyJ is beyond the bound')
  assert.equal(secretFindingForLine(jwt(512, 2049)), null, 'a payload of 2049 is beyond the bound')
  assert.ok(secretFindingForLine(jwt(40, 120)), 'and an ordinary-sized token is well inside it')
})

test('classifyRepoSync refuses when there is no repository at all', async (t) => {
  /* `!head` — the first fail-open branch, and one no fixture reached: mutating
   * it to SYNCED left the suite green, and SYNCED is the one state that
   * promotes. A plain directory with lib.mjs in it is not a git repository, so
   * every git call returns nothing. */
  t.after(dropFixtures)
  const dir = path.join(FIXTURE_ROOT, 'nogit')
  fs.mkdirSync(path.join(dir, 'tools', 'context'), { recursive: true })
  fs.copyFileSync(path.join(ROOT, 'tools', 'context', 'lib.mjs'), path.join(dir, 'tools', 'context', 'lib.mjs'))
  /* A bare directory is not enough: it sits under this repository, so `git -C`
   * walks up and finds THIS one. An unreadable `.git` makes every git call fail
   * where the fixture stands, which is the state the branch is written for. */
  fs.writeFileSync(path.join(dir, '.git'), 'not a gitfile\n')
  const lib = await import(pathToFileURL(path.join(dir, 'tools', 'context', 'lib.mjs')).href)

  const state = lib.classifyRepoSync()
  assert.equal(state.state, 'UNKNOWN', 'no repository is not "probably fine"')
  assert.match(state.reason, /not a git repository/)
  assert.equal(lib.isPromotableSyncState(state.state), false)
  assert.equal(lib.classifyDrift('a'.repeat(40)).freshness, 'UNKNOWN', 'and freshness is unanswerable too')
})

test('check.mjs FAILS a reviewed-against header HEAD cannot reach', async (t) => {
  /* Step 4b asked only whether the object EXISTS while `changedSince` had been
   * tightened to require reachability — so a header pinned to a real commit on
   * an abandoned line PASSED here and was reported unreachable by the
   * checkpoint, in the same tree. Reverting it to existence left the suite
   * green, because nothing ran this step at all. */
  t.after(dropFixtures)
  const { dir, g } = await makeFixtureRepo('header', { 'README.md': '# fixture\n' })
  const head = g('rev-parse', 'HEAD')
  const side = g('commit-tree', `${head}^{tree}`, '-p', head, '-m', 'side')
  const header = (sha) => `# Status\n\n**Reviewed against commit:** \`${sha}\` · **Reviewed:** 2026-01-01\n`

  fs.writeFileSync(path.join(dir, 'STATUS.md'), header(head))
  assert.doesNotMatch(runCheck(dir).out, /not reachable from HEAD in this repository/, 'a reachable header passes')

  fs.writeFileSync(path.join(dir, 'STATUS.md'), header(side))
  const r = runCheck(dir)
  assert.match(r.out, /reviewed-against commit is not reachable from HEAD in this repository: STATUS\.md/)
  assert.equal(r.code, 1)
})

test('a hostile brain.id_prefix is refused, not compiled', async (t) => {
  /* `id_prefix` is interpolated into `new RegExp`. `"["` threw an uncaught
   * SyntaxError at module import — every tool down, no report — and `".*"` made
   * every id check match anything, which is a guard switched off by
   * configuration rather than by code. */
  t.after(dropFixtures)
  const { dir } = await makeFixtureRepo('idprefix', { 'README.md': '# fixture\n' })

  for (const hostile of ['"["', '".*"', '"(a"', '"^"']) {
    fs.writeFileSync(path.join(dir, 'PROJECT.yaml'), `brain:\n  id_prefix: ${hostile}\n`)
    const r = runCheck(dir)
    assert.doesNotMatch(r.out, /SyntaxError|Invalid regular expression/, `${hostile}: must not reach a regex compiler`)
    assert.match(r.out, /brain\.id_prefix .* is not a plain identifier/, `${hostile}: and must be reported`)
  }

  /* THE SAME RULE FOR `pack_path`, which is a path rather than a pattern but
   * reaches `path.*` and `String.prototype.replace` just as unforgivingly. A
   * NUMBER there produced an uncaught `TypeError [ERR_INVALID_ARG_TYPE]` in
   * `check.mjs` rather than a report — fail-closed, but a run that dies has told
   * the reader nothing. The coercion that fixed it had no control of its own. */
  for (const hostile of ['123', 'true', '[]', '{}']) {
    fs.writeFileSync(path.join(dir, 'PROJECT.yaml'), `brain:\n  pack_path: ${hostile}\n`)
    const r = runCheck(dir)
    assert.doesNotMatch(r.out, /TypeError|ERR_INVALID_ARG_TYPE/, `pack_path: ${hostile} must not throw`)
    assert.match(r.out, /STRUCTURAL RESULT ONLY/, `pack_path: ${hostile}: the run must still produce its report`)
  }

  fs.writeFileSync(path.join(dir, 'PROJECT.yaml'), 'brain:\n  id_prefix: "ACME"\n')
  assert.doesNotMatch(runCheck(dir).out, /is not a plain identifier/, 'an ordinary prefix is accepted')
})

/** Run the fixture's own `pack.mjs` and return its exit code and output. */
function runPack(dir, args = []) {
  try {
    const out = execFileSync(process.execPath, [path.join(dir, 'tools', 'context', 'pack.mjs'), ...args], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? -1, out: `${String(e.stdout ?? '')}${String(e.stderr ?? '')}` }
  }
}

test('pack.mjs refuses every write destination that is not a gitignored plain file inside the repository', async (t) => {
  /* `pack.mjs` IS THE SCRIPT THAT WRITES AT A CONFIGURED PATH — it is the only
   * place in this tooling that calls `mkdirSync` on a directory it derives from
   * `PROJECT.yaml` — and it had no control of any kind. `writeDestinationProblem`
   * was well pinned, and by this file's own rule that says nothing about whether
   * anything calls it: changing one token, `if (destinationProblem)` to
   * `if (false)`, wrote 95 kB and a new directory two levels ABOVE the repository
   * root, exit 0, with the whole suite green. The five `check.mjs` controls above
   * closed this hole in the script that reads; this closes it in the one that
   * writes. */
  t.after(dropFixtures)
  const { dir, g } = await makeFixtureRepo('pack', {
    'README.md': '# fixture\n',
    'STATUS.md': '# status\n',
    '.gitignore': 'dist/\n',
  })
  /* AFTER the fixture commit, so it is untracked AND unignored — the third
   * refusal. Committed with the others it would be TRACKED and would exercise
   * the previous case twice while leaving this one unexercised. */
  fs.writeFileSync(path.join(dir, 'notes.md'), 'untracked but not ignored\n')
  fs.writeFileSync(path.join(dir, '.env'), 'SECRET=value\n')
  fs.mkdirSync(path.join(dir, 'dist'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'dist', 'deploy.key'), 'a key nobody meant to lose\n')
  const setPackPath = (v) => fs.writeFileSync(path.join(dir, 'PROJECT.yaml'), `brain:\n  pack_path: ${v}\n`)
  const outsideAt = path.join(FIXTURE_ROOT, 'ESCAPED', 'LEAK.md')

  setPackPath('dist/context/PACK.md')
  const ok = runPack(dir)
  assert.equal(ok.code, 0, `an ordinary gitignored destination must be written: ${ok.out}`)
  assert.ok(fs.existsSync(path.join(dir, 'dist', 'context', 'PACK.md')), 'and the pack must actually appear')

  for (const [value, expected] of [
    ['../../ESCAPED/LEAK.md', /resolves outside the repository/],
    ['dist/../../ESCAPED/LEAK.md', /resolves outside the repository/],
    ['/tmp/ABS_LEAK.md', /resolves outside the repository/],
    ['README.md', /is a TRACKED file/],
    ['notes.md', /is not gitignored/],
    /* Gitignored and untracked, so every other rule allows them — and
     * `.gitignore` lists these shapes precisely because one might hold a
     * credential. The writer used to overwrite them in silence. */
    ['.env', /credential-shaped filename/],
    ['dist/deploy.key', /credential-shaped filename/],
    ['dist/server.pem', /credential-shaped filename/],
    /* Trailing space and dot, which the first version of this refusal let
     * through: distinct files on Linux, so nothing was destroyed here — but on a
     * filesystem that normalises them they ARE the credential file, and a rule
     * that holds only on the reviewer's filesystem is not a rule. */
    ['"dist/deploy.key "', /credential-shaped filename/],
    ['"dist/deploy.key."', /credential-shaped filename/],
    /* And case, for the same reason: on APFS or NTFS `dist/DEPLOY.KEY` IS
     * `dist/deploy.key`. Dropping the pattern's `i` flag survived without
     * these. */
    ['dist/DEPLOY.KEY', /credential-shaped filename/],
    ['.ENV', /credential-shaped filename/],
  ]) {
    setPackPath(value)
    const r = runPack(dir)
    assert.equal(r.code, 1, `${value}: must be refused`)
    assert.match(r.out, /pack: refusing to write/, value)
    assert.match(r.out, expected, value)
  }
  assert.equal(fs.existsSync(outsideAt), false, 'and nothing may be created outside the repository')
  assert.equal(fs.existsSync(path.join(FIXTURE_ROOT, '..', 'ESCAPED')), false)
  assert.equal(fs.readFileSync(path.join(dir, 'README.md'), 'utf8'), '# fixture\n', 'a tracked file is untouched')
  assert.equal(fs.readFileSync(path.join(dir, 'notes.md'), 'utf8'), 'untracked but not ignored\n')
  assert.equal(fs.readFileSync(path.join(dir, '.env'), 'utf8'), 'SECRET=value\n', 'and a credential file survives')
  assert.equal(fs.readFileSync(path.join(dir, 'dist', 'deploy.key'), 'utf8'), 'a key nobody meant to lose\n')

  /* THE CORE/FULL SPLIT, which collapsing survived: `--full` inlines the three
   * unbounded files the CORE pack only indexes, so writing it to the CORE path
   * silently replaces a bounded artifact with an unbounded one under a name
   * every consumer reads as CORE. */
  setPackPath('dist/context/PACK.md')
  assert.equal(runPack(dir).code, 0)
  assert.equal(runPack(dir, ['--full']).code, 0)
  const corePath = path.join(dir, 'dist', 'context', 'PACK.md')
  const fullPath = path.join(dir, 'dist', 'context', 'PACK_FULL.md')
  assert.ok(fs.existsSync(fullPath), '--full must write its own path, not the CORE one')
  const core = fs.readFileSync(corePath, 'utf8')
  const full = fs.readFileSync(fullPath, 'utf8')
  assert.match(core, /^# CORE CONTEXT PACK/, 'and each must say which it is')
  assert.match(full, /^# FULL CONTEXT PACK/)
  assert.notEqual(core, full)

  /* The `pack_path`-without-`.md` branch of the same split, which dropping the
   * fallback survived: the two packs would then share one path. */
  setPackPath('dist/context/PACK')
  assert.equal(runPack(dir).code, 0)
  assert.equal(runPack(dir, ['--full']).code, 0)
  assert.ok(fs.existsSync(path.join(dir, 'dist', 'context', 'PACK')), 'CORE keeps the configured name')
  assert.ok(fs.existsSync(path.join(dir, 'dist', 'context', 'PACK_FULL.md')), 'and FULL still gets its own')
  assert.match(fs.readFileSync(path.join(dir, 'dist', 'context', 'PACK'), 'utf8'), /^# CORE CONTEXT PACK/)

  g('status', '--porcelain')
})

test('pack.mjs refuses to READ through a link, so out-of-repository text cannot reach the pack', async (t) => {
  /* The other half, and the one that actually leaked once: a committed symlink at
   * a canonical path copied out-of-repository content — an AWS key id among
   * it — into the generated pack while the script exited 0. */
  t.after(dropFixtures)
  const { dir } = await makeFixtureRepo('packread', {
    'README.md': '# fixture\n',
    'STATUS.md': '# status\n',
    '.gitignore': 'dist/\n',
    'PROJECT.yaml': 'brain:\n  pack_path: dist/context/PACK.md\n',
  })
  const outside = path.join(FIXTURE_ROOT, 'outside3')
  fs.mkdirSync(outside, { recursive: true })
  fs.writeFileSync(path.join(outside, 'SECRET.md'), 'CANARY_PACK_4d2e\naws: AKIAIOSFODNN7EXAMPLE\n')

  assert.equal(runPack(dir).code, 0, 'baseline writes')

  /* ONE PATH FROM EVERY SET `pack.mjs` READS, for the same reason `check.mjs`'s
   * control does: planting the link only at a CORE section let a narrowing of
   * `willRead` to `CORE_SECTIONS` survive, and a link at `DECISIONS.md` then
   * died in an uncaught ContainmentError instead of the designed message. */
  for (const rel of [
    'STATUS.md' /* a CORE section */,
    'DECISIONS.md' /* FULL_EXTRA_SECTIONS only */,
    'PROJECT.yaml' /* reachable three ways: its own gate, willRead, and a FULL section */,
  ]) {
    const at = path.join(dir, rel)
    const original = fs.existsSync(at) ? fs.readFileSync(at, 'utf8') : null
    fs.rmSync(at, { force: true })
    fs.symlinkSync(path.join(outside, 'SECRET.md'), at)

    const r = runPack(dir)
    assert.equal(r.code, 1, `${rel}: a link at a read path must refuse`)
    assert.match(r.out, /pack: refusing to read/, rel)
    assert.doesNotMatch(r.out, /CANARY_PACK_4d2e|AKIAIOSFODNN7EXAMPLE/, `${rel}: echoes nothing it refused`)
    assert.doesNotMatch(r.out, /ContainmentError/, `${rel}: the designed refusal, not an uncaught throw`)
    const written = fs.readFileSync(path.join(dir, 'dist', 'context', 'PACK.md'), 'utf8')
    assert.doesNotMatch(written, /CANARY_PACK_4d2e|AKIAIOSFODNN7EXAMPLE/, `${rel}: nor leaves it in the pack`)

    fs.rmSync(at)
    if (original !== null) fs.writeFileSync(at, original)
  }
})

test('check.mjs aborts on a symlinked evidence DIRECTORY, rather than skipping it', async (t) => {
  /* The enumeration that finds evidence records tests `isDirectory() ||
   * isSymbolicLink()`; dropping the second half turned the designed refusal into
   * a silent skip — the run printed `PASS verification evidence: 1 record(s)`
   * and never mentioned the link. Nothing is read out of the tree either way,
   * because step 15 skips a non-directory entry; what is lost is the refusal
   * itself, and a guard that quietly declines to look is the shape this whole
   * file exists to catch. */
  t.after(dropFixtures)
  const { dir } = await makeFixtureRepo('evdir', { 'README.md': '# fixture\n' })
  const outside = path.join(FIXTURE_ROOT, 'outside5')
  fs.mkdirSync(outside, { recursive: true })
  fs.writeFileSync(path.join(outside, 'README.md'), '# a record that is not in this repository\n')

  const evidenceDir = path.join(dir, 'docs', 'verification')
  fs.mkdirSync(path.join(evidenceDir, 'REAL_2026-01-01'), { recursive: true })
  fs.writeFileSync(
    path.join(evidenceDir, 'REAL_2026-01-01', 'README.md'),
    '# A record\n\nCommit: 0000000\nDate: 2026-01-01\n\n## Limits\n\nIt proves very little.\n',
  )
  assert.doesNotMatch(runCheck(dir).out, /do not resolve to a plain file/, 'an ordinary record directory is fine')

  fs.symlinkSync(outside, path.join(evidenceDir, 'LINKED_2026-01-02'))
  const r = runCheck(dir)
  assert.equal(r.code, 1, 'a linked evidence directory must abort')
  assert.match(r.out, /do not resolve to a plain file inside this repository: .*LINKED_2026-01-02/)
  assert.doesNotMatch(r.out, /ContainmentError/)
  fs.rmSync(path.join(evidenceDir, 'LINKED_2026-01-02'))

  /* AND THE CHECK ITSELF, which could be switched off entirely with the suite
   * green. A record that names no commit proves nothing about any tree, and one
   * that states no limits is read as proving everything — which is how a narrow
   * test becomes a broad claim three files later. Both are what this step is
   * for, and neither was asserted. */
  const recordAt = path.join(evidenceDir, 'REAL_2026-01-01', 'README.md')
  const full = fs.readFileSync(recordAt, 'utf8')

  fs.writeFileSync(recordAt, full.replace('Commit: 0000000\n', ''))
  assert.match(runCheck(dir).out, /^FAIL {2}verification evidence: .*records no commit SHA/m, 'must name a commit')

  fs.writeFileSync(recordAt, full.replace(/## Limits[\s\S]*$/, ''))
  assert.match(runCheck(dir).out, /^FAIL {2}verification evidence: .*states no limits/m, 'and its own limits')

  fs.writeFileSync(recordAt, full.replace('Date: 2026-01-01\n', ''))
  assert.match(runCheck(dir).out, /^FAIL {2}verification evidence: .*records no ISO date/m, 'and a date')

  fs.rmSync(recordAt)
  assert.match(runCheck(dir).out, /^FAIL {2}verification evidence: .*no README\.md/m, 'a directory alone is not evidence')

  fs.writeFileSync(recordAt, full)
  assert.doesNotMatch(runCheck(dir).out, /^FAIL {2}verification evidence/m, 'and a complete record passes')
})

test('the credential KEY rule is case-insensitive, as YAML and Markdown keys are', () => {
  /* The analogous property for the credential-URL shape is pinned; this one was
   * not, so removing the `i` flag from `SECRET_KEY_RE` left the suite green
   * while `Password:` and `API_KEY:` escaped the key half of the sweep. */
  for (const line of ['Password: hunter2value', 'API_KEY: abc123def456', 'Secret: somevalue', 'TOKEN: abc123def456']) {
    assert.ok(secretFindingForLine(line), line)
  }
  assert.equal(secretFindingForLine('Passphrase note: see the policy'), null, 'and ordinary prose stays clean')
})

test('auditRepoState rejects a state file with the wrong schema_version', () => {
  /* Unpinned: `if (state.schema_version !== 1)` could be switched off entirely
   * with the suite green, and the version field is how a future format change
   * would be told apart from a hand-written file. */
  const base = { generator: REPO_STATE_GENERATOR, schema_version: 1, head: HEAD_SHA, code_review_base: HEAD_SHA }
  const has = (state) => auditRepoState(state, HEAD_SHA).some((p) => /schema_version/.test(p))
  assert.equal(has(base), false, 'the current version is accepted')
  for (const v of [2, 0, '1', null, undefined]) {
    assert.equal(has({ ...base, schema_version: v }), true, `schema_version ${JSON.stringify(v)} must be reported`)
  }
})

test('check.mjs FAILS on the remaining structural checks nothing else exercised', async (t) => {
  /* `check.mjs` call sites that survived mutation: the placeholder sweep, the
   * missing-root-file check, the live-state rule, both evidence-path checks and
   * the canonical-YAML parse failure. Each is asserted BOTH ways in one fixture
   * pass.
   *
   * THE COMMENT USED TO NAME THE EVIDENCE-PATH CHECKS THAT THE BODY DID NOT
   * ASSERT, and both survived mutation while it claimed otherwise. A comment
   * asserting a control that is not there is worse than no comment: it is the
   * only thing a reader has to go on, and it was wrong. */
  t.after(dropFixtures)
  const { dir } = await makeFixtureRepo('structural', {
    'README.md': '# fixture\n',
    'STATUS.md': '# status\n',
  })

  /* The missing-root-file check: a fixture is missing almost all of them. */
  assert.match(runCheck(dir).out, /^FAIL {2}missing canonical root files: .*START_HERE\.md/m)

  /* The placeholder sweep. */
  assert.doesNotMatch(runCheck(dir).out, /NOT BOOTSTRAPPED/, 'a filled file is not flagged')
  fs.writeFileSync(path.join(dir, 'STATUS.md'), '# status\n\nowner: <<OWNER_NAME>>\n')
  assert.match(runCheck(dir).out, /^FAIL {2}NOT BOOTSTRAPPED — unfilled placeholder tokens remain in: STATUS\.md \(1\)/m)
  fs.writeFileSync(path.join(dir, 'STATUS.md'), '# status\n')

  /* The live-state rule, driven by a declared planning document. */
  const wrapperDoc = (headerBody) =>
    [
      '# A planning document',
      '',
      '<!-- LIVE-STATE-WRAPPER:BEGIN (rule reference) -->',
      headerBody,
      '<!-- LIVE-STATE-POINTER:BEGIN -->',
      LIVE_STATE_SURFACES.join(' '),
      '<!-- LIVE-STATE-POINTER:END -->',
      '<!-- LIVE-STATE-WRAPPER:END -->',
      '',
      '## Section one',
    ].join('\n')
  fs.writeFileSync(path.join(dir, 'PROJECT.yaml'), 'brain:\n  live_state_docs:\n    - PLAN.md\n')
  fs.writeFileSync(path.join(dir, 'PLAN.md'), wrapperDoc('DRAFT — PLANNED — NOT IMPLEMENTED.'))
  assert.doesNotMatch(runCheck(dir).out, /^FAIL {2}live-state rule/m, 'a correctly wrapped plan passes')
  fs.writeFileSync(path.join(dir, 'PLAN.md'), wrapperDoc('Phase 1 is in progress right now.'))
  assert.match(runCheck(dir).out, /^FAIL {2}live-state rule: PLAN\.md: live task status/m)
  fs.rmSync(path.join(dir, 'PLAN.md'))
  fs.rmSync(path.join(dir, 'PROJECT.yaml'))

  /* The canonical-YAML parse failure. A parser that read "something else" would
   * report PASS on a file it had misread, which is the whole reason the subset
   * throws; the FAIL it produces was unasserted. */
  fs.writeFileSync(path.join(dir, 'SERVICES.yaml'), 'items:\n  - id: x\n    value: y\nz: 2\n')
  assert.match(runCheck(dir).out, /^FAIL {2}SERVICES\.yaml does not parse/m)
  fs.rmSync(path.join(dir, 'SERVICES.yaml'))

  /* BOTH evidence-path checks — the feature matrix's and the release ledger's.
   * A verification claim pointing at a file nobody can open is the shape this
   * Brain exists to stop, and neither call site was asserted. */
  const matrix = (evidence) =>
    `surfaces:\n  - project_brain\nfeatures:\n  a_feature:\n    phase: phase_0\n    authority: code_verified\n    evidence: ${evidence}\n    project_brain: exists\n`
  fs.writeFileSync(path.join(dir, 'FEATURE_MATRIX.yaml'), matrix('README.md'))
  assert.doesNotMatch(runCheck(dir).out, /evidence path does not exist/, 'a real evidence path passes')
  fs.writeFileSync(path.join(dir, 'FEATURE_MATRIX.yaml'), matrix('docs/verification/NOPE/README.md'))
  assert.match(runCheck(dir).out, /^FAIL {2}.*a_feature: evidence path does not exist: docs\/verification\/NOPE/m)
  fs.rmSync(path.join(dir, 'FEATURE_MATRIX.yaml'))

  const ledger = (evidence) =>
    `release:\n  tasks:\n    PRJ-T-001:\n      actor: agent\n      phase: now\n      blocking: false\n      evidence: ${evidence}\n`
  fs.writeFileSync(path.join(dir, 'PROJECT.yaml'), ledger('README.md'))
  assert.doesNotMatch(runCheck(dir).out, /evidence path does not exist/, 'a real ledger evidence path passes')
  fs.writeFileSync(path.join(dir, 'PROJECT.yaml'), ledger('docs/verification/ALSO_NOPE/README.md'))
  assert.match(runCheck(dir).out, /^FAIL {2}.*PRJ-T-001: evidence path does not exist: docs\/verification\/ALSO_NOPE/m)
})

test('check.mjs FAILS a generated state that is null, or a dangling link', async (t) => {
  /* TWO DOCUMENTED FAIL-OPENS, both found by earlier review, both unpinned — so
   * re-introducing either flipped exit 1 back to exit 0 with the suite green.
   * `if (repoStateParsed)` guards the case where the whole state file is the
   * literal `null`, which parses fine and is falsy; `entryExists` guards the
   * dangling symlink, which `existsSync` reports as "nothing here". */
  t.after(dropFixtures)
  const { dir } = await makeFixtureRepo('statefailopen', { 'README.md': '# fixture\n' })
  const stateAt = path.join(dir, 'REPO_STATE.json')

  fs.writeFileSync(stateAt, 'null\n')
  const nullState = runCheck(dir)
  assert.match(nullState.out, /^FAIL {2}REPO_STATE\.json does not look generated/m, 'a null state file is not a pass')
  assert.equal(nullState.code, 1)

  fs.rmSync(stateAt)
  fs.symlinkSync(path.join(FIXTURE_ROOT, 'nowhere.json'), stateAt)
  const dangling = runCheck(dir)
  assert.match(dangling.out, /do not resolve to a plain file inside this repository: REPO_STATE\.json/, 'a dangling link is an entry')
  assert.equal(dangling.code, 1)
})

/** Run the fixture's own `checkpoint.mjs` and return its exit code and output. */
function runCheckpoint(dir, args = []) {
  try {
    const out = execFileSync(process.execPath, [path.join(dir, 'tools', 'context', 'checkpoint.mjs'), ...args], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 20_000,
    })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? -1, out: `${String(e.stdout ?? '')}${String(e.stderr ?? '')}` }
  }
}

test('checkpoint.mjs refuses every unusable write destination and unusable prior base', async (t) => {
  /* THE SAME GAP ROUND 10 BLOCKED ON FOR `pack.mjs`, one script over. Only the
   * DELETION check here had a control, so every other refusal in this script
   * could be switched off with the suite green — including the one whose own
   * comment says a FIFO "would hang or corrupt the write", which independent
   * review confirmed by hanging the run to a timeout. */
  t.after(dropFixtures)
  const { dir } = await makeFixtureRepo('ckpt', { 'README.md': '# fixture\n' })
  const stateAt = path.join(dir, 'REPO_STATE.json')

  /* EQUIVALENT MUTANTS, RECORDED SO THE NEXT REVIEWER NEED NOT RE-DERIVE THEM.
   * Each of these survives the suite because a pinned guard refuses the only
   * input that would distinguish it; each is the correct question at its line
   * and stays, as defence in depth:
   *
   *   · `entryExists` → `exists` at the checkpoint's prior-parse and
   *     base-selection lines — a DANGLING state-file link is refused earlier, by
   *     the read-containment gate and by `writeDestinationProblem`.
   *   · `entryExists` → `exists` at `check.mjs`'s state-file read — step 0's
   *     abort refuses the same input, and the `statefailopen` control pins it.
   *   · dropping `&& !isSymlinkPath(evidenceDir)` from the evidence enumeration —
   *     `existsInRepo` carries containment, and the directory is itself in
   *     `willEnumerate`, where `uncontainedDirs` refuses a link at it. (It was
   *     in `willRead` when this note was written; the guarded set is split now,
   *     and the reason moved with it.)
   *   · dropping the `loadBrainConfig` containment pre-check on `PROJECT.yaml` —
   *     `read()` refuses and the catch falls back to defaults, so no
   *     out-of-repository config is ever honoured. */
  const first = runCheckpoint(dir)
  assert.equal(first.code, 0, `a first run must write: ${first.out}`)
  assert.match(first.out, /ADOPTED to HEAD/, 'and must say so, because adopting is what --adopt asserts')
  assert.ok(fs.existsSync(stateAt))

  /* An unusable base in an EXISTING state file must never be silently replaced. */
  for (const base of ['', 'null', '"--output=/tmp/x"', '[]']) {
    fs.writeFileSync(stateAt, `{"code_review_base": ${base === '' ? '""' : base}}\n`)
    const r = runCheckpoint(dir)
    assert.equal(r.code, 1, `base ${base}: must refuse`)
    assert.match(r.out, /is not a commit id/, `base ${base}`)
    assert.match(r.out, /--adopt asserts that a human re-audited/, `base ${base}`)
  }

  /* The write destination: symlink, directory and FIFO. The FIFO case is the one
   * that hangs rather than fails if the refusal is removed, so the timeout on
   * `runCheckpoint` is load-bearing, not decoration. */
  fs.rmSync(stateAt)
  fs.symlinkSync(path.join(FIXTURE_ROOT, 'nowhere.json'), stateAt)
  assert.match(runCheckpoint(dir).out, /refusing to (write|read)/, 'a dangling link is refused')
  fs.rmSync(stateAt)

  /* EITHER refusal is correct here, and which one fires is not this control's
   * business. The read-containment gate now refuses a non-regular entry too, and
   * it runs first, so a directory at the state file is refused before the write
   * guard sees it. `writeDestinationProblem`'s own directory branch stays pinned
   * directly, beside the other destinations it refuses. */
  fs.mkdirSync(stateAt)
  assert.match(
    runCheckpoint(dir).out,
    /is a directory, not a file|do not resolve to a plain file inside this repository/,
    'a directory at the state file is refused',
  )
  fs.rmdirSync(stateAt)

  let fifo = false
  try {
    execFileSync('mkfifo', [stateAt], { stdio: 'ignore' })
    fifo = fs.existsSync(stateAt)
  } catch {
    fifo = false
  }
  if (fifo) {
    const r = runCheckpoint(dir)
    assert.equal(r.code, 1, 'a FIFO must be refused, not written through — and must not hang')
    assert.match(
      r.out,
      /is not a regular file|do not resolve to a plain file inside this repository/,
      'refused by whichever gate sees it first; both are correct and neither may hang',
    )
    fs.rmSync(stateAt)
  }
})

test('checkpoint.mjs records the audited base it was given, not HEAD', async (t) => {
  /* The sharpest unpinned line in the script: writing `g.head` instead of `base`
   * silently moved `code_review_base` to HEAD while the console still printed
   * the OLD value and omitted the ADOPTED annotation — a fabricated audit with a
   * lying receipt, and the whole suite green. */
  t.after(dropFixtures)
  const { dir, g, lib } = await makeFixtureRepo('ckptbase', { 'README.md': '# fixture\n' })
  const stateAt = path.join(dir, 'REPO_STATE.json')
  assert.equal(runCheckpoint(dir).code, 0)
  const firstHead = g('rev-parse', 'HEAD')

  fs.writeFileSync(path.join(dir, 'NOTES.md'), 'moved on\n')
  g('add', '-A')
  g('commit', '-q', '-m', 'advance')
  const newHead = g('rev-parse', 'HEAD')
  assert.notEqual(firstHead, newHead)

  const kept = runCheckpoint(dir)
  assert.equal(kept.code, 0, kept.out)
  const state = JSON.parse(fs.readFileSync(stateAt, 'utf8'))
  assert.equal(state.code_review_base, firstHead, 'the audited base must survive a commit that did not re-audit')
  assert.equal(state.head, newHead, 'while head follows the tree')
  assert.doesNotMatch(kept.out, /ADOPTED to HEAD/, 'and a run that did not adopt must not say it did')
  assert.match(kept.out, new RegExp(`code_review_base ${firstHead.slice(0, 7)}`), 'the receipt names what was written')

  /* AND THE FRESHNESS FIELD MUST BE COMPUTED, not asserted. Hard-coding it to
   * CURRENT survived every other assertion here: the base was right, the head
   * was right, and the one field a reader consults to decide whether to trust
   * the Brain said the opposite of the tree. */
  assert.equal(state.freshness, 'DOCS-ONLY ADVANCE', 'a docs-only commit since the base')
  assert.equal(state.promotable_snapshot_source, false, 'nothing with an UNKNOWN sync state promotes')
  assert.equal(state.repo_sync_state, 'UNKNOWN', 'the fixture has no upstream, and the field must say so')
  assert.equal(state.generator, REPO_STATE_GENERATOR, 'the stamp names the generator that wrote it')
  assert.equal(state.schema_version, 1)
  /* The fields outside the round-11 list, so "every field it writes" is true
   * rather than nearly true. `changed_since_base` fails open to a NUMBER when
   * the base is unresolvable, where `UNKNOWN` belongs. */
  assert.equal(state.branch, g('rev-parse', '--abbrev-ref', 'HEAD'))
  assert.equal(typeof state.changed_since_base, 'number', 'a resolvable base yields a count')
  assert.ok(Array.isArray(state.warnings))
  assert.ok(state.warnings.some((w) => /repository sync is UNKNOWN/.test(w)), 'and the warnings are real')

  /* `branch` must be READ, not assumed. Hard-coding `'main'` survived a fixture
   * that happened to be on `main`, which is what every fixture here starts on. */
  g('checkout', '-q', '-b', 'a-branch-that-is-not-main')
  assert.equal(runCheckpoint(dir).code, 0)
  assert.equal(JSON.parse(fs.readFileSync(stateAt, 'utf8')).branch, 'a-branch-that-is-not-main')
  g('checkout', '-q', 'main')
  assert.equal(runCheckpoint(dir).code, 0)

  /* And `changed_since_base` must fail closed to the STRING `UNKNOWN` when the
   * base does not resolve. Writing the count regardless survived an assertion
   * that only checked the resolvable direction — `0` where `UNKNOWN` belongs
   * reads as "nothing moved", which is the fail-open this whole field exists to
   * avoid. A well-formed sha that is no commit gets past the shape gate and
   * reaches the classifier, which is the only way to exercise this. */
  fs.writeFileSync(stateAt, `{"code_review_base": "${'a'.repeat(40)}"}\n`)
  assert.equal(runCheckpoint(dir).code, 0)
  const unresolved = JSON.parse(fs.readFileSync(stateAt, 'utf8'))
  assert.equal(unresolved.freshness, 'UNKNOWN')
  assert.equal(unresolved.changed_since_base, 'UNKNOWN', 'not a count, and not 0')
  assert.equal(unresolved.code_changed_since_base, 'UNKNOWN')
  /* The FIXTURE's audit, not this repository's: `auditRepoState` resolves commits
   * against the tree its module is rooted in, and the fixture's commits do not
   * exist here. Using the wrong one reports both shas as absent — which is the
   * audit working, on the wrong repository. */
  assert.deepEqual(lib.auditRepoState(state, state.head), [], 'and the whole audit passes on what it just wrote')

  /* BOTH DIRECTIONS OF `tree_status`, which hard-coding `clean` survived: a
   * checkpoint taken mid-edit describes a tree no commit holds, and this field
   * is the only warning a later reader gets. `gitState()` is taken BEFORE the
   * write, so a run on a committed tree reads clean even though it is about to
   * modify the state file. */
  assert.equal(state.tree_status, 'clean', 'the advance commit staged everything, including the state file')
  fs.writeFileSync(path.join(dir, 'UNCOMMITTED.md'), 'mid-edit\n')
  assert.equal(runCheckpoint(dir).code, 0)
  assert.equal(JSON.parse(fs.readFileSync(stateAt, 'utf8')).tree_status, 'dirty', 'an uncommitted file must show')
  fs.rmSync(path.join(dir, 'UNCOMMITTED.md'))
  g('checkout', '-q', '--', '.')
  assert.equal(runCheckpoint(dir).code, 0)
  assert.equal(JSON.parse(fs.readFileSync(stateAt, 'utf8')).tree_status, 'clean', 'and clear again once it is gone')
  fs.mkdirSync(path.join(dir, 'tools'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'tools', 'thing.mjs'), 'export const x = 1\n')
  g('add', '-A')
  g('commit', '-q', '-m', 'code moved')
  assert.equal(runCheckpoint(dir).code, 0)
  const moved = JSON.parse(fs.readFileSync(stateAt, 'utf8'))
  assert.equal(moved.code_review_base, firstHead, 'still the audited base, three commits later')
  assert.equal(
    moved.freshness,
    'SUBSYSTEM STALE',
    'code moved since the audited base, and the generated state must say so',
  )

  const adopted = runCheckpoint(dir, ['--adopt'])
  assert.equal(adopted.code, 0, adopted.out)
  assert.match(adopted.out, /ADOPTED to HEAD/, '--adopt says so')
  const finalHead = g('rev-parse', 'HEAD')
  assert.equal(JSON.parse(fs.readFileSync(stateAt, 'utf8')).code_review_base, finalHead)
})

test('checkpoint.mjs and pack-audit.mjs refuse to read through a link', async (t) => {
  /* Both scripts are standalone targets that never run `check.mjs`, so each
   * carries its own containment gate — and neither gate had a control. Removing
   * either left the suite green while the run followed a link out of the tree
   * (`read()` still refuses, so nothing leaks; the designed message does not
   * appear and the run dies in a stack trace instead). */
  t.after(dropFixtures)
  const { dir } = await makeFixtureRepo('standalone', {
    'README.md': '# fixture\n',
    'STATUS.md': '# status\n',
    'DECISIONS.md': '# Decisions\n',
    '.gitignore': 'dist/\n',
    'PROJECT.yaml': 'brain:\n  pack_path: dist/context/PACK.md\n',
  })
  const outside = path.join(FIXTURE_ROOT, 'outside4')
  fs.mkdirSync(outside, { recursive: true })
  fs.writeFileSync(path.join(outside, 'SECRET.md'), 'CANARY_STANDALONE_8b7c\naws: AKIAIOSFODNN7EXAMPLE\n')

  /* checkpoint reads every dated doc for its reviewed-against header. */
  fs.rmSync(path.join(dir, 'STATUS.md'))
  fs.symlinkSync(path.join(outside, 'SECRET.md'), path.join(dir, 'STATUS.md'))
  const ck = runCheckpoint(dir)
  assert.equal(ck.code, 1, 'the checkpoint must refuse')
  assert.match(ck.out, /checkpoint: refusing to read/)
  assert.doesNotMatch(ck.out, /CANARY_STANDALONE_8b7c|AKIAIOSFODNN7EXAMPLE/)
  assert.doesNotMatch(ck.out, /ContainmentError/, 'the designed refusal, not an uncaught throw')
  assert.equal(fs.existsSync(path.join(dir, 'REPO_STATE.json')), false, 'and must write nothing')
  fs.rmSync(path.join(dir, 'STATUS.md'))
  fs.writeFileSync(path.join(dir, 'STATUS.md'), '# status\n')

  /* pack-audit derives its expectations from DECISIONS.md and the matrix. */
  assert.equal(runPack(dir).code, 0, 'a pack must exist for the audit to read')
  fs.rmSync(path.join(dir, 'DECISIONS.md'))
  fs.symlinkSync(path.join(outside, 'SECRET.md'), path.join(dir, 'DECISIONS.md'))
  let auditOut = ''
  let auditCode = 0
  try {
    auditOut = execFileSync(process.execPath, [path.join(dir, 'tools', 'context', 'pack-audit.mjs')], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    auditCode = e.status ?? -1
    auditOut = `${String(e.stdout ?? '')}${String(e.stderr ?? '')}`
  }
  assert.equal(auditCode, 1, 'the audit must refuse')
  assert.match(auditOut, /do not resolve to a plain file inside this repository/)
  assert.doesNotMatch(auditOut, /CANARY_STANDALONE_8b7c|AKIAIOSFODNN7EXAMPLE/)
  assert.doesNotMatch(auditOut, /ContainmentError/)
})

test('pack-audit.mjs exits non-zero when an orientation fact is missing', async (t) => {
  /* It had no control at all, and `process.exit(failed ? 1 : 0)` → `exit(0)`
   * survived: the audit would print FAIL per check and `make brain-gate` would
   * still go green, which is the one thing an exit code is for. */
  t.after(dropFixtures)
  /* A fuller fixture than the others, because this audit derives its generic
   * expectations from DECISIONS.md, FEATURE_MATRIX.yaml and PROJECT.yaml — so
   * without them it FAILS for reasons that have nothing to do with the property
   * under test, and the control could only ever assert one direction. */
  const { dir } = await makeFixtureRepo('audit', {
    'README.md': '# fixture\n',
    'START_HERE.md': '# start\n',
    '.gitignore': 'dist/\n',
    'SECRETS_POLICY.md': '# Secrets\n\nNo credential value is committed; a service carries a `secret_ref` and never a value.\n',
    'DECISIONS.md': [
      '# Decisions',
      '',
      '## Active decisions',
      '',
      '### `PRJ-D-001` — a binding decision',
      '',
      'provenance: owner_decision',
      '',
      '## Open questions',
      '',
      '### `PRJ-Q-001` — an open question',
      '',
      'Unanswered.',
    ].join('\n'),
    'FEATURE_MATRIX.yaml':
      'surfaces:\n  - project_brain\nfeatures:\n  a_feature:\n    phase: phase_0\n    authority: code_verified\n    project_brain: exists\n',
  })
  const project = (phrases) =>
    `project_id: FIXTURE\nbrain:\n  pack_path: dist/context/PACK.md\n  pack_audit_required_phrases:\n${phrases
      .map((p) => `    - "${p}"`)
      .join('\n')}\n`
  const runAudit = () => {
    try {
      return { code: 0, out: execFileSync(process.execPath, [path.join(dir, 'tools', 'context', 'pack-audit.mjs')], {
        cwd: dir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }) }
    } catch (e) {
      return { code: e.status ?? -1, out: `${String(e.stdout ?? '')}${String(e.stderr ?? '')}` }
    }
  }

  fs.writeFileSync(path.join(dir, 'PROJECT.yaml'), project(['GENERATED FILE']))
  const missingPack = runAudit()
  assert.equal(missingPack.code, 1, 'no pack at all must be an error, not a pass')
  assert.match(missingPack.out, /does not exist inside this repository/)

  assert.equal(runPack(dir).code, 0, 'generate the pack the audit reads')
  const present = runAudit()
  assert.equal(present.code, 0, `a phrase the pack carries must pass: ${present.out}`)

  fs.writeFileSync(path.join(dir, 'PROJECT.yaml'), project(['A PHRASE THIS BRAIN DOES NOT CONTAIN ANYWHERE']))
  const failing = runAudit()
  assert.equal(failing.code, 1, 'a missing orientation fact must exit non-zero, or the gate goes green on a failure')
  assert.match(failing.out, /^FAIL {2}declared orientation fact is recoverable/m)
  assert.match(failing.out, /^FAIL — /m)
})

test('check.mjs FAILS a canonical YAML pinned to an unreachable commit, like a Markdown header', async (t) => {
  /* Step 4c asked EXISTENCE while step 4b asked REACHABILITY — the same question
   * with two answers in one tree, and `ARCHITECTURE.md` states the reachability
   * rule categorically for both. Neither the asymmetry nor the check itself had
   * a control: disabling step 4c outright also left the suite green. */
  t.after(dropFixtures)
  const { dir, g } = await makeFixtureRepo('yamlprov', { 'README.md': '# fixture\n' })
  const head = g('rev-parse', 'HEAD')
  const side = g('commit-tree', `${head}^{tree}`, '-p', head, '-m', 'side')

  fs.writeFileSync(path.join(dir, 'SERVICES.yaml'), `reviewed_against: "${head}"\nservices: {}\n`)
  assert.doesNotMatch(runCheck(dir).out, /canonical YAML provenance/, 'a reachable commit passes')

  fs.writeFileSync(path.join(dir, 'SERVICES.yaml'), `reviewed_against: "${side}"\nservices: {}\n`)
  const r = runCheck(dir)
  assert.match(r.out, /^FAIL {2}canonical YAML provenance: SERVICES\.yaml -> .* is not a commit reachable from HEAD/m)
  assert.equal(r.code, 1)

  fs.writeFileSync(path.join(dir, 'SERVICES.yaml'), 'reviewed_against: "abcdef0"\nservices: {}\n')
  assert.match(runCheck(dir).out, /^FAIL {2}canonical YAML provenance/m, 'and so does a shape that is no commit')

  /* The sentinel is exempt on purpose: it says "never reviewed", honestly. */
  fs.writeFileSync(path.join(dir, 'SERVICES.yaml'), `reviewed_against: "${UNSET_SHA}"\nservices: {}\n`)
  assert.doesNotMatch(runCheck(dir).out, /canonical YAML provenance/, 'the unset sentinel is not a failure')

  /* And the ABSENT case, which the present-but-unreachable cases above do not
   * reach: a canonical YAML carrying no provenance at all is the one that says
   * nothing rather than something false, and it was unasserted. */
  fs.writeFileSync(path.join(dir, 'SERVICES.yaml'), 'services: {}\n')
  assert.match(runCheck(dir).out, /^FAIL {2}canonical YAML provenance: SERVICES\.yaml has no reviewed_against/m)
})

test('pack-audit.mjs actually inspects the pack, rather than asserting it passed', async (t) => {
  /* Its exit code and both gates were pinned; the PREDICATES they gate were not.
   * `has()` → `true` and `section()` → the whole pack each made all eight generic
   * containment checks vacuous with the suite green — an audit that reports PASS
   * without reading anything is the exact shape this whole file exists to catch. */
  t.after(dropFixtures)
  const { dir } = await makeFixtureRepo('auditpred', {
    'README.md': '# fixture\n',
    'START_HERE.md': '# start\n',
    '.gitignore': 'dist/\n',
    'PROJECT.yaml': 'project_id: FIXTURE\nbrain:\n  pack_path: dist/context/PACK.md\n',
    'DECISIONS.md': '# Decisions\n\n## Active decisions\n\n### `PRJ-D-001` — one\n\nprovenance: owner_decision\n',
    'FEATURE_MATRIX.yaml':
      'surfaces:\n  - project_brain\nfeatures:\n  a_feature:\n    phase: phase_0\n    authority: code_verified\n    project_brain: exists\n',
  })
  const runAudit = () => {
    try {
      return { code: 0, out: execFileSync(process.execPath, [path.join(dir, 'tools', 'context', 'pack-audit.mjs')], {
        cwd: dir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }) }
    } catch (e) {
      return { code: e.status ?? -1, out: `${String(e.stdout ?? '')}${String(e.stderr ?? '')}` }
    }
  }

  assert.equal(runPack(dir).code, 0)
  const clean = runAudit()
  assert.match(clean.out, /^PASS {2}every binding decision id appears in the decisions index/m)
  assert.match(clean.out, /^PASS {2}the pack declares itself derived and non-authoritative/m)

  /* SECTION-SCOPING, which truncation alone does not pin. `section()` returning
   * the whole pack survived a control that only ever emptied the pack: with
   * nothing in it, both the shipped code and the mutant find nothing. The sharp
   * input keeps the decision id in the pack and RENAMES the index heading — the
   * shipped code then reports the id missing FROM THE INDEX, and the mutant
   * reports it present because it is somewhere in the file. An audit that
   * accepts "somewhere in the pack" for "recoverable from the index" is telling
   * a fresh session it can find something by a route that does not exist. */
  const packAt = path.join(dir, 'dist', 'context', 'PACK.md')
  const generated = fs.readFileSync(packAt, 'utf8')
  assert.match(generated, /^## DECISIONS INDEX — canonical source: `DECISIONS\.md`$/m, 'the heading to rename')
  fs.writeFileSync(
    packAt,
    generated.replace(
      '## DECISIONS INDEX — canonical source: `DECISIONS.md`',
      '## SOMETHING ELSE ENTIRELY — canonical source: `DECISIONS.md`',
    ),
  )
  const renamed = runAudit()
  assert.match(renamed.out, /^FAIL {2}every binding decision id appears in the decisions index/m)
  assert.match(renamed.out, /PRJ-D-001/, 'and names the id it could not find under that heading')
  assert.equal(renamed.code, 1)

  /* Truncate the pack to its header. Every generic check must now FAIL — under a
   * vacuous predicate they would all still pass. */
  fs.writeFileSync(packAt, '# CORE CONTEXT PACK — Fixture\n')
  const gutted = runAudit()
  assert.equal(gutted.code, 1)
  for (const name of [
    'project identity is recoverable',
    'every binding decision id appears in the decisions index',
    'every feature row appears with a state',
    'the pack declares itself derived and non-authoritative',
    'the pack declares that an index is not the source',
    'history is declared excluded by construction',
    'the secrets rule travels with the pack',
  ]) {
    assert.match(gutted.out, new RegExp(`^FAIL {2}${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm'), name)
  }
})

test('check.mjs FAILS when an answered question still reads as open', async (t) => {
  /* The two halves of step 13b, neither of which had a control: an id may not be
   * both answered by a decision and listed in the waiting room, and no canonical
   * file may say in the present tense that an answered id "stays open". Both
   * statements look authoritative and one of them is false — which is the whole
   * failure this Brain is built around — and the step could be switched off with
   * the suite green. */
  t.after(dropFixtures)
  const { dir } = await makeFixtureRepo('answered', { 'README.md': '# fixture\n', 'STATUS.md': '# status\n' })

  const decisions = (openSection) =>
    [
      '# Decisions',
      '',
      '## Active decisions',
      '',
      '### `PRJ-D-001` — a decision that answers PRJ-Q-001',
      '',
      'provenance: owner_decision',
      '',
      '## Open questions',
      '',
      openSection,
    ].join('\n')

  fs.writeFileSync(path.join(dir, 'DECISIONS.md'), decisions('### `PRJ-Q-002` — a genuinely open one\n\nUnanswered.\n'))
  assert.doesNotMatch(runCheck(dir).out, /answered question/, 'an answered id absent from the waiting room is fine')

  /* Structural half: answered AND still in the waiting room. */
  fs.writeFileSync(
    path.join(dir, 'DECISIONS.md'),
    decisions('### `PRJ-Q-001` — still sitting here\n\nUnanswered.\n'),
  )
  assert.match(
    runCheck(dir).out,
    /^FAIL {2}answered question.*PRJ-Q-001: answered by a decision AND still listed as an open question/m,
  )

  /* Prose half: a canonical file asserting, in the present tense, that it is open. */
  fs.writeFileSync(path.join(dir, 'DECISIONS.md'), decisions('### `PRJ-Q-002` — a genuinely open one\n\nUnanswered.\n'))
  fs.writeFileSync(path.join(dir, 'STATUS.md'), '# status\n\nPRJ-Q-001 remains open pending the owner.\n')
  assert.match(runCheck(dir).out, /^FAIL {2}answered question.*STATUS\.md:3 says PRJ-Q-001 is open/m)

  /* And the deliberate exemption: time-scoped history must still pass, or every
   * record of what was once true becomes a failure. */
  /* "was open" alone never matches the open-claim vocabulary, so it exercises
   * nothing — the first draft of this control used it and the exemption survived
   * being deleted. "was still open" DOES match, and is then exempted by the
   * past-tense test, which is the branch that needed pinning. */
  fs.writeFileSync(path.join(dir, 'STATUS.md'), '# status\n\nPRJ-Q-001 was still open when this was recorded.\n')
  assert.doesNotMatch(runCheck(dir).out, /answered question/, 'past tense is history, not a contradiction')

  fs.writeFileSync(path.join(dir, 'STATUS.md'), '# status\n\nPRJ-Q-001 is still open.\n')
  assert.match(runCheck(dir).out, /^FAIL {2}answered question.*says PRJ-Q-001 is open/m, 'present tense is not')

  /* THE BACKTICKED TITLE, which is how the id is actually written everywhere
   * else in a real DECISIONS.md. `plain()` does not strip backticks, so a
   * pattern requiring the bare id registered NOTHING for `answers \`PRJ-Q-001\``
   * — and a detector that matches nothing prints the same PASS line as one that
   * matches correctly, so neither half of this step could fire. Pinned in both
   * directions: the contradiction must be FOUND when the title is backticked,
   * which is the case the un-tolerant pattern missed. */
  const backticked = [
    '# Decisions',
    '',
    '## Active decisions',
    '',
    '### `PRJ-D-001` — a decision that answers `PRJ-Q-001`',
    '',
    'provenance: owner_decision',
    '',
    '## Open questions',
    '',
    '### `PRJ-Q-001` — still sitting here',
    '',
    'Unanswered.',
  ].join('\n')
  fs.writeFileSync(path.join(dir, 'DECISIONS.md'), backticked)
  fs.writeFileSync(path.join(dir, 'STATUS.md'), '# status\n')
  assert.match(
    runCheck(dir).out,
    /^FAIL {2}answered question.*PRJ-Q-001: answered by a decision AND still listed as an open question/m,
    'a backticked question id in the title must register as answered',
  )
})
