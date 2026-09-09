# Verification — a session that had never seen this project, 2026-09-09

**Commit tested:** `0719ad9` of this Brain. The governed repository was at
`5fe707b` observed.

**Date:** 2026-09-09.

## What was done

A separate session was given **one constraint**: it could read files under this
Brain's directory and nothing else. No network, no database, no connector, and
no file from the governed repository. It was asked seven questions a real
session would need answered, and told that "the Brain does not say" was a good
answer rather than a failure.

The questions: what the project is for and its target figure; how many sites,
hosted where, and why that changes how one works; whether a just-pushed fix is
live; what must never be touched and why; why competition measurement no longer
goes through the previous provider; the sharpest current risk; and whether it may
record a new decision.

## What this record proves

**Four of seven were answered cleanly** with citations: the hosting split and its
consequences, the absolute prohibitions, the sharpest risk, and the rule that
only the owner decides. Three were answered **conditionally and honestly** — the
purpose came back `UNKNOWN`, the deploy question could not be settled for a named
site, and the cause behind the old provider's failure was reported as absent
rather than guessed.

**The anti-invention rule held under direct pressure.** The session's own harness
injected the network's instruction file and a memory index that contained the
very facts the Brain was silent about. It answered "the Brain does not say"
anyway, and said so explicitly. That is the behaviour the Brain exists to
produce.

## What it found, and what was changed because of it

**Twelve findings, closed by ten changes.** Two of the twelve were the same
defect seen from two angles - the missing rule of precedence, reported once as a
collision over the living documents and once as a collision over pushing. One,
the rhetorical weight of the "0 FAIL" figure repeated across six files, was not
edited: it is answered by the limits section below, which is the honest place
for it. The ten changes:

| Found | Change |
|---|---|
| `START_HERE.md` sent a new session to redo `IPTV-T-001`, already DONE | Corrected to point at the real blocking task |
| No rule of precedence between the standard's hard rules and an owner decision — the push rule and the living-documents rule both collide | An explicit precedence block naming the two bounded exceptions, and only those |
| The Brain named the hosting split as the costliest trap, then gave no site-to-host map | The 37 sites that do not deploy on push are now named |
| No way to check whether a deploy cron ran | The three log paths, the marker comparison, and the redirect-following caveat |
| A cause, "suspended", asserted without a source | Reduced to the error string that was actually observed |
| A retired service still reachable in code, with no instruction | Now says plainly: do not use it |
| "The measurement chain is working again" claimed more than its evidence | Scoped to the date, with the key's unknown expiry stated |
| `UNKNOWN` used for two different things without distinction | The two senses are now separated and named |
| Revenue used to rank risks while the purpose reads `UNKNOWN` | The implicit goal is named as read off the machinery, and barred from standing in for the owner's answer |
| Four commit ids with no statement of which means what | A table: what each answers, and why none equals HEAD |
| No precedence between the standard's hard rules and an owner decision | An explicit block — which itself was written by an agent, says so, and is routed to `IPTV-T-006` for the owner |

## What this record does NOT prove

- **Not that the Brain is honest.** The session could only check the Brain against
  itself. It had no way to test a claim against the world.
- **Not that a different session behaves the same way.** One run, one model.
- **Not that the repairs are sufficient.** They close the eleven findings of one
  reading. The test is worth repeating after the owner answers `IPTV-Q-001`,
  because the answer changes what a reader is looking for.
- **Not acceptance.** PG-2 is the owner's, and no agent may satisfy it for him.
