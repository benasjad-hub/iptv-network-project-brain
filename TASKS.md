# TASKS — IPTV Network

**Reviewed against commit:** `0000000` · **Reviewed:** 2026-09-09 · **Status:** NOT BOOTSTRAPPED

**This file is the single source of task truth.** `PROJECT.yaml` `release:` is a
**derived projection** of it — never a second task list — and `context:check`
FAILS if the projection names a task that is not here.

**Vocabulary.** `actor`: `agent` · `owner` · `external`. `blocking`: whether it
blocks **Phase 0 acceptance**, not "is it important". A task is **DONE** only
with evidence a reader can open; otherwise it is **NEEDS VERIFICATION**.

---

## NOW

### `IPTV-T-001` — Write this Brain's content
**Actor:** agent · **Blocking:** yes · **Phase:** Phase 0 · **Status:** OPEN

The installer produced a structurally complete Brain and **deliberately wrote no
project truth into it**. Every semantic field reads `UNKNOWN`. Filling them in
is a human-directed act:

- **`STATUS.md`** — what actually exists, with the scope of the claim stated.
- **`TASKS.md`** — the real work, replacing this task.
- **`DECISIONS.md`** — only decisions the **owner** actually made. An agent may
  propose; only the owner may decide.
- **`FEATURE_MATRIX.yaml`** — feature × surface states, each with an authority.
- **`SERVICES.yaml` / `ACCESS_MAP.yaml`** — what is really registered.
- **`docs/architecture/ARCHITECTURE.md`** — what EXISTS, not what is planned.

**`UNKNOWN` beats guessing.** A field nobody can source stays `UNKNOWN`, and
that is a finished answer, not an unfinished one.

---

## LATER — not blocking Phase 0

**Empty.**

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
