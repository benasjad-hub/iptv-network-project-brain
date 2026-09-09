# Agents — read this first

**Reviewed against commit:** `32c0e3e` · **Reviewed:** 2026-09-09 · **Status:** CURRENT

**READ `START_HERE.md` FIRST.** It is short and it is the canonical entry point
for **IPTV Network**.

This file exists only to point you there. It deliberately holds no project
history, no architecture and no rules of its own — duplicating them would create
a second source of truth that drifts within a week.

Read order: `START_HERE.md` → `STATUS.md` → `TASKS.md` → `DECISIONS.md` (only
when you need decision context) → one task-specific doc.

Do **not** read `docs/history/` by default.

State lines you must not move: **PROJECT BRAIN: FILLED IN, NOT ACCEPTED** ·
**THE NETWORK IS LIVE: 78 SITES, 77 SERVING** · **PURPOSE: UNKNOWN — THE OWNER
MUST ANSWER**.

Freshness and structure check: `make brain-gate`. Runtime requirements are Node
18+, `git`, and a verification-ready checkout; there is no `package.json` — see
`START_HERE.md` §10.

**Every repository other than this one is READ-ONLY.** The hard rules are
`START_HERE.md` §7 and they live there and only there.
