# HISTORY — IPTV Network

**Reviewed against commit:** `86e8a31` · **Reviewed:** 2026-09-09 · **Status:** CURRENT

**Empty in this repository.** No superseded plan, report or decision has been
filed here yet.

**Do not read this directory by default.** It is not onboarding. It holds
material that was once current and is now superseded — kept because a superseded
plan is provenance for why the current one exists, and separated because reading
it as current is how an agent revives an abandoned design.

## Where the network's own history actually lives

The governed repository carries a large historical record. **It is not copied
here, and copying it would be a mistake**: roughly 5.3 million characters, about
six times what one session can read. It is listed so a session knows it exists
and can open the one file it needs.

| File in `benasjad-hub/iptv-network` | Size | What it is |
|---|---|---|
| `iptv-network/docs/JOURNAL.md` | ~4.4 MB, 64 244 lines | Append-only, dated. Every commit, deploy and significant action since 2026-06-12. |
| `iptv-network/docs/SOLUTIONS.md` | ~299 kB, 2 562 lines | Append-only. Per problem: symptom, root cause, fix, lesson. |
| `iptv-network/docs/STATE.md` | ~364 kB, 1 941 lines | Meant to be the current state on one page. It is roughly 121 pages — `IPTV-T-008`. |
| `iptv-network/docs/PLAYBOOK.md` | ~225 kB, 1 252 lines | The reusable rules extracted from the owner's choices and corrections. |
| `iptv-network/docs/PIPELINE.md` | ~7 kB, 112 lines | The stage-by-stage site pipeline, S0 to S9. |
| `project-memory/05-DECISIONS.md` | ~8 kB | The nine agent-written engineering rules. Recorded in this Brain as architecture, not as decisions. |
| `iptv-network/docs/HANDOFF-live-browser-daoud-ops.md` | ~16 kB | The shared browser and the root operations gateway, written for a model that has never seen the machine. Not history: it describes what runs today. |

**How to use them.** Do not read them front to back. Search them for the term
you need, and prefer this Brain's canonical files for anything they both cover —
this Brain states its sources and its limits, and those files do not.
