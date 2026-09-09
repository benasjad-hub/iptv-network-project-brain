# TASKS — IPTV Network

**Reviewed against commit:** `0000000` · **Reviewed:** 2026-09-09 · **Status:** CURRENT

**This file is the single source of task truth.** `PROJECT.yaml` `release:` is a
**derived projection** of it — never a second task list — and `context:check`
FAILS if the projection names a task that is not here.

**Vocabulary.** `actor`: `agent` · `owner` · `external`. `blocking`: whether it
blocks **Phase 0 acceptance**, not "is it important". A task is **DONE** only
with evidence a reader can open; otherwise it is **NEEDS VERIFICATION**.

---

## NOW

### `IPTV-T-001` — Write this Brain's content
**Actor:** agent · **Blocking:** no · **Phase:** Phase 0 · **Status:** DONE

The installer produced a structurally complete Brain with every semantic field
reading `UNKNOWN`. Those fields now carry facts, each one recorded next to the
source it was read from and the date it was read.

**Evidence a reader can open:** `docs/verification/BRAIN_CONTENT_2026-09-09/`,
and `make brain-gate` reporting 0 FAIL. Both are **structural**. Neither
establishes that a claim here is honest, which is why `IPTV-T-005` exists.

**What deliberately stayed UNKNOWN:** the project's purpose and every goal
figure. Nobody has stated them, and a plausible sentence in that field would be
worse than the empty one.

### `IPTV-T-002` — Answer the three open questions
**Actor:** owner · **Blocking:** yes · **Phase:** Phase 0 · **Status:** OPEN

`DECISIONS.md` carries three questions an agent may not answer:

- **`IPTV-Q-001`** — what is the network for, what does success look like in six
  months as a number, and what will you not do to get there. **This is the one
  that matters.** Every automated choice the network makes daily is currently
  optimised against a goal nobody has stated.
- **`IPTV-Q-002`** — what is the site status `draft` meant to gate, given that 43
  sites carry it while serving and publishing.
- **`IPTV-Q-003`** — which image generator is intended: the one the written rule
  names, or the one the code actually runs.

Each answer becomes an `IPTV-D-nnn` in `DECISIONS.md` and the question is removed
from the waiting room.

### `IPTV-T-003` — Give the network a second WhatsApp number it can fall back to
**Actor:** owner · **Blocking:** no · **Phase:** operations · **Status:** OPEN

65 of the 78 sites route their only call to action through one number, and a
third number was banned by Meta on 2026-08-08. A single further ban removes the
conversion path from most of the network. Nothing an agent can do reduces this;
it needs a number the owner controls.

### `IPTV-T-004` — Decide what happens to `iptvbritish.uk`
**Actor:** owner · **Blocking:** no · **Phase:** operations · **Status:** OPEN

The one site of 78 that does not answer. The audit records `fetch failed` and a
health score of 30. The cause reported elsewhere in this project is a registry
deactivation, which an agent cannot confirm and cannot reverse. Either the
domain is recovered, or the site is recorded as retired and stops being counted
as a failure every morning.

---

## LATER — not blocking Phase 0

### `IPTV-T-005` — Have a session that has never seen this project try to use the Brain
**Actor:** agent · **Blocking:** no · **Phase:** Phase 0 acceptance

The only test that matters. Open a session with **no** access to the network
repository's history and **only** this Brain, and ask it: which sites are on the
VPS and why does that matter, why is Bright Data no longer the measurement
source, and what must never be touched. If it answers without searching, the
Brain works. If it invents, the Brain is worse than nothing, because a confident
wrong answer is harder to catch than a missing one.

### `IPTV-T-006` — Ratify or reject the nine engineering rules
**Actor:** owner · **Blocking:** no · **Phase:** operations

`project-memory/05-DECISIONS.md` in the network repository holds nine numbered
rules, written by an agent and running in production. They are recorded in this
Brain as **architecture**, not as decisions. The owner reading them once and
saying which are his turns nine inherited habits into seven or eight rules with
authority behind them. One of them, the WhatsApp list, is already stale.

### `IPTV-T-007` — Give this Brain a remote
**Actor:** owner · **Blocking:** no · **Phase:** operations

One copy exists, on one machine, with no backup. Creating the repository is the
owner's act; an agent may not create a repository on his account.

### `IPTV-T-008` — Bring the network's `STATE.md` back to one page
**Actor:** agent · **Blocking:** no · **Phase:** operations

Its own rule says one page. It stands at roughly 121 pages. It is a shared file
that scheduled tasks append to, so truncating it carelessly is the same class of
conflict that has already stopped content production for 21 hours. It needs a
plan and the owner's agreement, not a quick edit.

---

## INBOX / TRIAGE

**Empty.** No idea is pending triage.

**Routing rule:** idea → here · open question → `DECISIONS.md` Open Questions ·
accepted work → a task above · completed meaningful work → `STATUS.md` **plus
evidence** · owner-approved durable decision → `DECISIONS.md` · commit / test /
build / deployment → generated state **plus evidence** · important operational
action → a `docs/verification/` record.

---

## NOT AUTHORIZED BY ANYTHING ABOVE

Recorded here because the most expensive failure is an agent reading a plan as a
permission slip. None of the following is authorized by this Brain:

- Creating a GitHub Action, webhook, git hook, scheduler, queue or deployment.
- Provisioning or purchasing anything: account, token, vault, VPS, database.
- Writing to **any** repository other than this one.
- Answering an open question, or recording a decision the owner did not make.
- Treating installation as approval of anything.
- Reaching the Supabase project `stefvhralisxnhhdhkvj`, or the volume named
  KODAK, for any reason at all.
