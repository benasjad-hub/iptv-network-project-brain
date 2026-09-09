# DECISIONS — IPTV Network

**Reviewed against commit:** `0000000` · **Reviewed:** 2026-09-09 · **Status:** CURRENT

Every `IPTV-D-nnn` recorded below is **OWNER APPROVED and binding**.
Changing one needs a new owner decision, not an agent's judgement. An agent may
*propose* a decision; only the owner may *make* one.

**Every decision below is sourced to `CLAUDE.md` in `benasjad-hub/iptv-network`** —
the file the owner writes to instruct coding agents, first committed 2026-06-12
and last amended 2026-06-16. Nothing here is an agent's inference from the code.

**What is deliberately NOT here.** The network's own repository carries nine
numbered rules in `project-memory/05-DECISIONS.md`. They are sound engineering
rules, several of them hard-won, and they are running in production today — but
they were written by an *agent*, not approved by the owner. Recording them here
would manufacture decisions nobody made. They are described as **what exists**
in `docs/architecture/ARCHITECTURE.md`, and `TASKS.md` carries one item asking
the owner to ratify or reject them as a set.

## How to read an entry

| Field | Meaning |
|---|---|
| **Provenance** | How the claim came to be believed. `owner_decision` = the owner decided it; a rule, not an observation. |
| **Decision** | The binding rule. This is the part that outranks everything else. |
| **Reason** | Why. Not binding on its own. |
| **Scope** | What it does *not* cover — usually the more useful half. |
| **Recorded** | The date the owner approved it. |

**Provenance vocabulary:** `owner_determination` · `owner_decision` ·
`hardware_verified` · `code_verified` · `inference` · `external`.

---

# ACTIVE DECISIONS

## `IPTV-D-001` — The living documents are part of finishing a task, never a separate errand

**Provenance:** owner_decision
**Recorded:** 2026-06-12
**Decision:** Five documents in the network repository are updated as part of
completing **any** task, without being asked. `iptv-network/docs/JOURNAL.md` gets an
append-only entry after every commit, deploy or significant action, with the
date, the hour, the commit id and the files. `iptv-network/docs/SOLUTIONS.md` gets an
append-only entry for every problem: symptom, root cause, fix, lesson.
`iptv-network/docs/STATE.md` is overwritten to reflect the current state and the exact next
step. `iptv-network/docs/PLAYBOOK.md` receives the **reusable rule** extracted from every
owner choice or correction — rules, not stories. `iptv-network/docs/PIPELINE.md` carries the
stage-by-stage pipeline, S0 through S9, and no stage is skipped.
**Reason:** The stated goal is that `PLAYBOOK.md` alone should let any agent
build the next site with near-zero questions.
**Scope:** This governs the *network* repository's documents. This Brain is a
different surface with its own rules, and it does not replace them.

## `IPTV-D-002` — The volume named KODAK is never touched

**Provenance:** owner_decision
**Recorded:** 2026-06-12
**Decision:** No read, no write, no listing, nothing.
**Scope:** Absolute. There is no task that justifies an exception.

## `IPTV-D-003` — One Supabase project belongs to this network, and one is forbidden

**Provenance:** owner_decision
**Recorded:** 2026-06-12
**Decision:** This project's database is the Supabase project `iptv-network`,
reference `xqgrfntyhizrdomxqgxv`. The project `stefvhralisxnhhdhkvj`
(iptv-center) belongs to a **different production application** and is out of
bounds — **read-only calls included**.
**Reason:** A read against the wrong production database is still a read against
someone else's production database.
**Scope:** The forbidden project is out of bounds whatever the task. Note that a
Supabase connector may only show one organisation at a time, so seeing a project
listed is not evidence it is this project's.

## `IPTV-D-004` — A migration waits for the owner's answer

**Provenance:** owner_decision
**Recorded:** 2026-06-12
**Decision:** Before applying any database migration, show the **full** statement
and wait for the owner's explicit agreement.
**Scope:** Applying is gated. Writing the statement, and reading the schema to
write it, are not.

## `IPTV-D-005` — Design folders share no user-interface code

**Provenance:** owner_decision
**Recorded:** 2026-06-12
**Decision:** Each design folder stays self-contained. No shared component
imports between one design folder and another.
**Reason:** 78 sites that import from one another become 78 sites that break
together.
**Scope:** User-interface code between design folders. Shared *scripts* and
*libraries* outside the design folders are not covered by this.

## `IPTV-D-006` — Only the autopilot machine pushes, and every push is reported

**Provenance:** owner_decision
**Recorded:** 2026-06-16
**Decision:** Pushing to `origin` is allowed **from the autopilot VPS**, the host
whose public IPv4 is `187.124.40.74`, and from nowhere else. After every push,
report exactly what was pushed: branch, commit ids, files. A **large or risky**
change — a broad refactor, a history rewrite, a deletion, a force push — is
**never** pushed without asking first. The owner's own machine stays pull-only.
Committing locally is always fine, on any host.
**Scope:** This governs `git push` on the network repository. It grants nothing
about any other repository, and it is not a general authorisation to act.

## `IPTV-D-007` — GoalStream is written in French only

**Provenance:** owner_decision
**Recorded:** 2026-06-12
**Decision:** Every user-facing string on GoalStream is French.
**Scope:** That one site.

---

# OPEN QUESTIONS

An open question is **not** a decision and **may not be answered by an agent**.
It is answered by a new `IPTV-D-nnn` recorded above, at which point this section
loses the entry.

## `IPTV-Q-001` — What is this network for, and what would success look like?

**Provenance:** owner_determination — required
**Raised:** 2026-09-09
**Question:** `PROJECT.yaml` records `project_purpose` as UNKNOWN, and it is
UNKNOWN because **the destination is written nowhere**. The network repository
holds roughly 5.3 million characters of history, rules and state — about six
times what a single session can read — and none of it says what the network is
*for*, what success looks like in numbers six months out, or what the owner
refuses to do to get there.
**Why it blocks more than it looks like it blocks.** Every automated choice this
network makes daily — which keyword to target, which article to write, which
site to feed — is currently optimised against a goal nobody has stated. The
machinery is measurably working; whether it is working *toward anything* cannot
be checked.
**What answering it needs:** three answers from the owner, in his own words —
what the network is for, what success looks like in six months as a number, and
what he will not do.

## `IPTV-Q-002` — What does `draft` mean for a site that is already serving?

**Provenance:** owner_determination — required
**Raised:** 2026-09-09
**Question:** The `sites` table records 35 rows as `live` and **43 as `draft`**.
Measured the same day, **77 of the 78 sites answer HTTP 200**, all 78 are mapped
to a Search Console account, and all 78 carry published articles — 2 684 in
total, none at zero. So `draft` does not mean "not serving", and no document
records what it does mean.
**Why it matters:** automation reads this field. A routine that skips `draft`
sites is skipping 43 live sites; one that ignores the field is publishing to
sites the owner may consider unfinished. Both are running today.
**What answering it needs:** the owner states what `draft` is meant to gate, or
the field is retired.

## `IPTV-Q-003` — Which image generator is the intended one?

**Provenance:** owner_determination — required
**Raised:** 2026-09-09
**Question:** Two records in this project contradict each other. The written
rule of 2026-08-07 says article and banner images use OpenAI's cheapest tier,
`gpt-image-1-mini`, and attributes that to an explicit cost instruction from the
owner. The code that actually runs every day at 06:40 —
`scripts/generate-missing-covers.ts` through `scripts/lib/cover.ts` — generates
covers with **Cloudflare Flux**, and a separate note records a two-image
Higgsfield budget per site with no gpt-image at all.
**What is measured, and what is not.** That Cloudflare Flux is what runs is
`code_verified` — the import chain was read on 2026-09-09. Which of the two the
owner *wants* is not knowable from any file.
**What answering it needs:** the owner names the intended generator; the losing
record is then marked superseded rather than deleted.

---

# SUPERSEDED DECISIONS

**None.** No owner decision recorded here has been replaced. Superseded entries
are **kept and marked**, never deleted — a superseded decision is provenance for
why the current one exists.

# NEEDS OWNER CONFIRMATION

**None.** Anything an agent believes without owner approval belongs in
`TASKS.md` → *Inbox / Triage* or in the Open Questions above, never here. The
nine agent-written rules in the network repository are routed exactly that way.
