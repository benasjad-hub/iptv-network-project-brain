# IPTV Network — instructions for coding agents

**Reviewed against commit:** `97f1654` · **Reviewed:** 2026-09-09 · **Status:** CURRENT

**READ `START_HERE.md` FIRST.** Everything you need to orient — what this is,
branch, verified state, frozen areas, do-not-touch rules, next task — is there,
and it is the canonical copy.

Do not rely on this file for project rules; it is a pointer, not a duplicate.

- Now-state: `STATUS.md`
- Active work: `TASKS.md`
- Approved durable decisions: `DECISIONS.md`
- Read order and the agent handoff contract: `START_HERE.md` §9 and §12
- Hard do-not-touch rules: `START_HERE.md` §7

Do **not** read `docs/history/` by default.

State lines you must not move: **PROJECT BRAIN: FILLED IN, NOT ACCEPTED** ·
**THE NETWORK IS LIVE: 78 SITES, 77 SERVING** · **PURPOSE: BRING CLIENTS AND
CONVERT THEM IN OUR OWN CHANNELS** · **TWO QUESTIONS STILL OPEN, BOTH THE
OWNER'S**.

Freshness and structure check: `make brain-gate`. Runtime requirements are Node
18+, `git`, and a verification-ready checkout; there is no `package.json` in
this repository — see `START_HERE.md` §10.

**Every repository other than this one is READ-ONLY.**

<!--
This file is deliberately a near-duplicate of AGENTS.md. Different tools look
for different filenames (CLAUDE.md, AGENTS.md, .cursorrules, …). Keep every one
of them a POINTER. The moment one of them starts carrying rules of its own, you
have two sources of truth and they will disagree within a week.
-->
