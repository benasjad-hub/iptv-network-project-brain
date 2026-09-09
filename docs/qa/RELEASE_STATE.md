# RELEASE / GATE STATE — IPTV Network

**Reviewed against commit:** `602b580` · **Reviewed:** 2026-09-09 · **Status:** CURRENT

**PUBLISHABLE: the network already is.** 78 sites are live and publishing daily.
What is **not** accepted is this Brain: the owner has not read it and said that
what it records is what he means.

## Gate board

| Gate | Requires | Actor | State |
|---|---|---|---|
| **PG-1** | `IPTV-T-001` | agent | **SATISFIED** 2026-09-09 — structural only |
| **PG-2** | `IPTV-T-002` | owner | **NOT SATISFIED** — the owner has not been asked to accept it |

**PROJECT BRAIN: FILLED IN, NOT ACCEPTED. THE NETWORK IS LIVE: 78 SITES, 77
SERVING. PURPOSE: UNKNOWN — THE OWNER MUST ANSWER.**

**What PG-1 means, and what it does not.** It means the canonical Brain exists,
is filled in, and `make brain-gate` reports **0 FAIL** with every `WARN`
explained rather than silenced. It is a **STRUCTURAL** result about file shape
and internal consistency. **It is not acceptance**, it says nothing about
whether any claim in the Brain is honest, and it promotes nothing. A confident,
well-formed, false statement passes it.

**Why the one remaining WARN is not silenced.** The gate reports **32 pass, 1
warn, 0 fail**. The warning is `repository sync UNKNOWN — no upstream configured
for main`, and it is correct: this repository has no remote, so there is nothing
to compare its history against. That is `IPTV-T-007`, an owner action, and
`UNKNOWN` there never means "probably fine". Silencing it would hide the fact
that this Brain exists in a single copy.

## What blocks the milestone

**Blocking: 1 — 0 agent, 1 owner, 0 external.** The owner answering the three
open questions. Source of truth is `TASKS.md`; `PROJECT.yaml` `release:` is its
derived projection and `context:check` fails if the two disagree.

## Publication state of the network itself

| Question | Answer |
|---|---|
| Is anything built? | **Yes.** 78 sites, 2 684 articles, measured 2026-09-09. |
| Is anything published? | **Yes.** 77 of 78 answer HTTP 200. |
| Is anything deployed? | **Yes**, across four hosting paths that do not deploy alike. |
| Is this Brain's repository pushed? | **No remote exists.** One copy, one machine, no backup — `IPTV-T-007`. |

## The rollback position

For the network: each site's design folder is self-contained and its history is
in `benasjad-hub/iptv-network`, so a bad change is reverted per site. **The
Cloudflare and VPS sites do not roll back on push either** — the revert reaches
them only when their deploy cron runs, up to two hours later.

For this Brain: it holds documentation only. Reverting a commit here changes
what is recorded and nothing that runs.
