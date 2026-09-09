/**
 * Regression controls for governed-external-repository freshness.
 *
 * WHY THESE EXIST AS A SUITE. Every function under test is a CLASSIFIER, and a
 * classifier's failure mode is silent: it keeps returning a state, just the
 * wrong one, and the gate keeps exiting 0. The four detections this file is
 * required to prove — drift, a stale observation, a missing repository and a
 * dirty worktree — are each one branch that could rot into `CURRENT` without a
 * single error being thrown anywhere.
 *
 * ZERO DEPENDENCIES, NO FILESYSTEM, NO NETWORK, NO GIT. The classification half
 * was deliberately written as pure functions in `lib.mjs` so these controls can
 * drive every branch directly. A suite that had to build a repository to test a
 * comparison would be slow enough to skip, and skipped controls protect nothing.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_MAX_OBSERVATION_AGE_DAYS,
  EXTERNAL_STATES,
  classifyExternalRepo,
  classifyExternalRows,
  externalSummary,
  isRelianceGrade,
  readBaseline,
  readRegistry,
  REVIEW_BASELINE_GENERATOR,
} from './lib.mjs'

const NOW = new Date('2026-08-30T12:00:00.000Z')
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString()
const SHA_A = 'a'.repeat(40)
const SHA_B = 'b'.repeat(40)

const observed = (over = {}) => ({
  remote: 'https://github.com/example/thing',
  branch: 'main',
  observation: 'OBSERVED',
  observed_at: daysAgo(1),
  observed_head: SHA_A,
  reviewed_sha: SHA_A,
  ...over,
})

const registryOf = (ids, policy = {}) => ({
  repos: Object.fromEntries(ids.map((id) => [id, { id, remote: `https://github.com/example/${id}`, branch: 'main' }])),
  policy: { max_observation_age_days: DEFAULT_MAX_OBSERVATION_AGE_DAYS, ...policy },
  problems: [],
})

const classify = (entry, maxAge = DEFAULT_MAX_OBSERVATION_AGE_DAYS) => classifyExternalRepo(entry, NOW, maxAge)

/* ── The four required detections ─────────────────────────────────────────── */

test('DRIFT is detected: the governed repository moved past the reviewed commit', () => {
  const r = classify(observed({ observed_head: SHA_B, reviewed_sha: SHA_A }))
  assert.equal(r.state, 'DRIFTED')
  assert.match(r.reason, /code moved after the Brain was written against it/)
  assert.equal(isRelianceGrade(r.state), false)
})

test('A STALE observation is detected, and never reported as CURRENT', () => {
  /* The trap this pins: the shas MATCH. Only the age is wrong, so a classifier
   * that compared shas and forgot to look at the clock would answer CURRENT and
   * a reader would trust a record months out of date. */
  const r = classify(observed({ observed_at: daysAgo(45), observed_head: SHA_A, reviewed_sha: SHA_A }))
  assert.equal(r.state, 'STALE_OBSERVATION')
  assert.match(r.reason, /45 days ago/)
})

test('the staleness threshold comes from the registry, not from the classifier', () => {
  const entry = observed({ observed_at: daysAgo(10) })
  assert.equal(classify(entry, 30).state, 'CURRENT')
  assert.equal(classify(entry, 7).state, 'STALE_OBSERVATION')
})

test('a MISSING repository is detected and is fatal', () => {
  const r = classify({ observation: 'MISSING', observed_at: daysAgo(1) })
  assert.equal(r.state, 'MISSING')
  const rows = classifyExternalRows(registryOf(['gone']), { gone: { observation: 'MISSING', observed_at: daysAgo(1) } }, NOW)
  assert.equal(rows[0].fatal, true)
})

test('the observer\'s own note is surfaced rather than replaced by a guess', () => {
  /* The generic wording listed guesses - renamed, deleted, made private - while
   * observation_note already held what the observer actually saw. Against a
   * registered repository whose branch simply did not exist yet, that sent the
   * reader looking for a deleted repository the record already explained. */
  const r = classify({
    observation: 'MISSING',
    observed_at: daysAgo(1),
    observation_note: 'the remote answered, but carries no branch "main"',
  })
  assert.equal(r.state, 'MISSING')
  assert.match(r.reason, /carries no branch "main"/)
  assert.doesNotMatch(r.reason, /renamed, deleted/)

  /* Without a note the guess is still better than silence, so it stays. */
  assert.match(classify({ observation: 'MISSING', observed_at: daysAgo(1) }).reason, /renamed, deleted/)

  /* And an UNREADABLE observation carries its note too - an expired credential
   * and a deleted repository are different problems with different fixes. */
  const u = classify({
    observation: 'UNREADABLE',
    observed_at: daysAgo(1),
    observation_note: 'the remote could not be read (authentication failed)',
  })
  assert.equal(u.state, 'UNKNOWN')
  assert.match(u.reason, /authentication failed/)
})

test('a DIRTY observed worktree is detected', () => {
  const r = classify(observed({ worktree_status: 'dirty' }))
  assert.equal(r.state, 'DIRTY')
  assert.match(r.reason, /not what is committed/)
})

/* ── Ordering: a worse state must never be reported as a better one ───────── */

test('drift outranks dirtiness when both are true', () => {
  /* Reporting DIRTY here would invite the reader to clean the worktree and
   * believe the record had become reliable, while the documented claims are
   * still written against a commit the repository has moved past. */
  const r = classify(observed({ observed_head: SHA_B, reviewed_sha: SHA_A, worktree_status: 'dirty' }))
  assert.equal(r.state, 'DRIFTED')
})

test('an unreadable observation fails closed to UNKNOWN, never CURRENT', () => {
  const r = classify({ observation: 'UNREADABLE', observed_at: daysAgo(1), reviewed_sha: SHA_A, observed_head: SHA_A })
  assert.equal(r.state, 'UNKNOWN')
  assert.match(r.reason, /not "probably fine"/)
})

test('a malformed sha is UNKNOWN rather than a comparison', () => {
  assert.equal(classify(observed({ observed_head: 'HEAD' })).state, 'UNKNOWN')
  assert.equal(classify(observed({ reviewed_sha: 'latest' })).state, 'UNKNOWN')
})

test('never observed, and observed but never reviewed, are both NO_BASELINE', () => {
  assert.equal(classify(undefined).state, 'NO_BASELINE')
  assert.equal(classify(observed({ reviewed_sha: undefined })).state, 'NO_BASELINE')
})

test('CURRENT requires every condition at once', () => {
  const r = classify(observed())
  assert.equal(r.state, 'CURRENT')
  assert.equal(isRelianceGrade(r.state), true)
})

test('every state the classifier can return is in the declared vocabulary', () => {
  const seen = [
    classify(undefined),
    classify({ observation: 'MISSING', observed_at: daysAgo(1) }),
    classify({ observation: 'UNREADABLE', observed_at: daysAgo(1) }),
    classify(observed({ observed_head: 'nope' })),
    classify(observed({ observed_at: daysAgo(999) })),
    classify(observed({ observed_head: SHA_B })),
    classify(observed({ worktree_status: 'dirty' })),
    classify(observed()),
  ].map((r) => r.state)
  for (const s of seen) assert.ok(EXTERNAL_STATES.includes(s), `${s} is not in EXTERNAL_STATES`)
})

/* ── The registry is committed truth; the baseline may not extend it ──────── */

test('a baseline row for an undeclared repository is UNREGISTERED and fatal', () => {
  const rows = classifyExternalRows(registryOf(['declared']), { declared: observed(), ghost: observed() }, NOW)
  const ghost = rows.find((r) => r.id === 'ghost')
  assert.equal(ghost.state, 'UNREGISTERED')
  assert.equal(ghost.fatal, true)
})

test('a declared repository with no baseline row still appears', () => {
  const rows = classifyExternalRows(registryOf(['a', 'b']), { a: observed() }, NOW)
  assert.deepEqual(rows.map((r) => r.id), ['a', 'b'])
  assert.equal(rows.find((r) => r.id === 'b').state, 'NO_BASELINE')
})

test('rows are ordered deterministically', () => {
  const rows = classifyExternalRows(registryOf(['zeta', 'alpha', 'mid']), {}, NOW)
  assert.deepEqual(rows.map((r) => r.id), ['alpha', 'mid', 'zeta'])
})

/* ── Registry schema refusals ─────────────────────────────────────────────── */

const goodRepo = {
  remote: 'https://github.com/example/platform',
  branch: 'main',
  role: 'product_code',
  governs: 'the product web application',
  authority: 'DECISIONS.md UPS-D-021',
}
const goodRegistry = (over = {}) => ({
  schema_version: 1,
  reviewed_against: '0000000',
  repos: { platform: { ...goodRepo } },
  ...over,
})

test('a well-formed registry parses with no problems', () => {
  const r = readRegistry(goodRegistry())
  assert.deepEqual(r.problems, [])
  assert.equal(r.repos.platform.remote, goodRepo.remote)
  assert.equal(r.policy.max_observation_age_days, DEFAULT_MAX_OBSERVATION_AGE_DAYS)
})

test('a credential-bearing or ssh remote is refused', () => {
  /* The first entry MUST carry the userinfo shape — that is the thing being
   * refused, and a control that could not express it would prove nothing. It is
   * written to be unmistakably synthetic so a future credential scanner reading
   * this file finds a self-labelling placeholder rather than a candidate leak. */
  for (const remote of [
    'https://placeholder-user:not-a-real-secret-synthetic-fixture@github.com/example/platform',
    'git@github.com:example/platform.git',
    'ssh://git@github.com/example/platform',
  ]) {
    const r = readRegistry(goodRegistry({ repos: { platform: { ...goodRepo, remote } } }))
    assert.ok(
      r.problems.some((p) => p.includes('remote must be an https URL')),
      `${remote} was accepted`,
    )
  }
})

test('every required registry field is required', () => {
  for (const field of ['remote', 'branch', 'role', 'governs', 'authority']) {
    const repo = { ...goodRepo }
    delete repo[field]
    const r = readRegistry(goodRegistry({ repos: { platform: repo } }))
    assert.ok(r.problems.some((p) => p.includes(field)), `missing ${field} was accepted`)
  }
})

test('an id that disagrees with its key is refused', () => {
  const r = readRegistry(goodRegistry({ repos: { platform: { ...goodRepo, id: 'something-else' } } }))
  assert.ok(r.problems.some((p) => p.includes('id field says')))
})

test('a non-positive observation age policy is refused rather than coerced', () => {
  for (const bad of [0, -1, 'thirty']) {
    const r = readRegistry(goodRegistry({ policy: { max_observation_age_days: bad } }))
    assert.ok(r.problems.some((p) => p.includes('max_observation_age_days')), `${bad} was accepted`)
  }
})

/* ── Baseline integrity ───────────────────────────────────────────────────── */

const goodBaseline = (over = {}) => ({
  schema_version: 1,
  generator: REVIEW_BASELINE_GENERATOR,
  generated_at: daysAgo(1),
  repos: { platform: observed() },
  ...over,
})

test('a generated baseline reads clean', () => {
  const b = readBaseline(goodBaseline())
  assert.deepEqual(b.problems, [])
  assert.equal(b.entries.platform.observed_head, SHA_A)
})

test('a hand-written baseline is detected by its missing generator stamp', () => {
  const b = readBaseline(goodBaseline({ generator: undefined }))
  assert.ok(b.problems.some((p) => p.includes('generated record carries')))
})

test('an absent baseline is not a problem — it means never observed', () => {
  for (const empty of [null, undefined]) {
    const b = readBaseline(empty)
    assert.deepEqual(b.problems, [])
    assert.deepEqual(b.entries, {})
    assert.equal(b.generated, false)
  }
})

test('a baseline whose entire content is null does not read as generated', () => {
  /* The exact shape that defeated an earlier version of `auditRepoState`:
   * `JSON.parse("null")` is a successful parse, and a truthiness test on the
   * result skips every later check. */
  const b = readBaseline(null)
  assert.equal(b.generated, false)
})

test('an unknown observation vocabulary value is refused', () => {
  const b = readBaseline(goodBaseline({ repos: { platform: observed({ observation: 'FINE' }) } }))
  assert.ok(b.problems.some((p) => p.includes('observation "FINE"')))
})

test('a malformed observed_at is refused', () => {
  const b = readBaseline(goodBaseline({ repos: { platform: observed({ observed_at: 'yesterday' }) } }))
  assert.ok(b.problems.some((p) => p.includes('observed_at')))
})

/* ── The rolled-up verdict ────────────────────────────────────────────────── */

test('summary verdicts: CURRENT, NEEDS ATTENTION, UNKNOWN, NONE DECLARED', () => {
  const current = classifyExternalRows(registryOf(['a']), { a: observed() }, NOW)
  assert.equal(externalSummary(current).verdict, 'CURRENT')

  const drifted = classifyExternalRows(registryOf(['a']), { a: observed({ observed_head: SHA_B }) }, NOW)
  assert.equal(externalSummary(drifted).verdict, 'NEEDS ATTENTION')

  const missing = classifyExternalRows(registryOf(['a']), { a: { observation: 'MISSING', observed_at: daysAgo(1) } }, NOW)
  assert.equal(externalSummary(missing).verdict, 'UNKNOWN')

  assert.equal(externalSummary([]).verdict, 'NONE DECLARED')
})

test('one fatal row outranks any number of passing ones', () => {
  const rows = classifyExternalRows(
    registryOf(['ok1', 'ok2', 'gone']),
    { ok1: observed(), ok2: observed(), gone: { observation: 'MISSING', observed_at: daysAgo(1) } },
    NOW,
  )
  const s = externalSummary(rows)
  assert.equal(s.pass, 2)
  assert.equal(s.fail, 1)
  assert.equal(s.verdict, 'UNKNOWN')
})
