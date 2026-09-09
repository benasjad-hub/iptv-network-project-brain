# IPTV Network

**UNKNOWN — a renseigner par le proprietaire**

> **PROJECT BRAIN: INSTALLED, NOT FILLED IN**
> **PHASE 0: NOT STARTED**

**→ Read [`START_HERE.md`](START_HERE.md) before touching anything.** It is the
canonical entry point; this file is a pointer and carries no rules of its own.

## What is here today

A **Project Brain** — the canonical documented truth for `iptv-network` — and
the zero-dependency tooling that validates it, installed from
`benasjad-hub/iptv-network` at `044ea1f8fc452c3d8856d38cfc14ea50f3fb0b9c` on 2026-09-09.

**The Brain's content has not been written yet.** Every semantic field reads
`UNKNOWN` because nobody has asserted anything, not because the answer is
nothing. Filling it in is `IPTV-T-001` in [`TASKS.md`](TASKS.md).

## Running the checks

```
make brain-gate       # every deterministic check: integrity, guards, structure, pack
make verify-install   # re-check the copied validator against its pinned digests
make context-check    # the read-only structural check on its own
make help             # the authoritative list of targets
```

**Runtime requirements, in full: Node 18+ and `git` on `PATH`, in a
verification-ready checkout.** The checks need no network, no credential, no
database and no install step, and there is deliberately no `package.json`. This
Brain validates itself from a fresh clone of **this** repository, with no path
back to the system it was installed from.

**A green run is a STRUCTURAL result.** It cannot tell whether a status, a
decision or a verification claim is honest.

## Orientation map

| Question | File |
|---|---|
| What is this, and what may I not do? | `START_HERE.md` |
| What is true right now? | `STATUS.md` |
| What is being worked on, and what blocks it? | `TASKS.md` |
| What did the owner decide, and what is still open? | `DECISIONS.md` |
| What exists per feature, per surface? | `FEATURE_MATRIX.yaml` |
| What has actually been verified? | `docs/verification/` |
| What is this installation pinned to? | `INSTALL_MANIFEST.json` |

## Boundaries

- **Every repository other than this one is READ-ONLY** unless the owner has
  authorized otherwise for this occurrence.
- **No credential value may enter this repository** — `SECRETS_POLICY.md`.
- **Implementation is not approval**, and **`UNKNOWN` beats guessing.**
