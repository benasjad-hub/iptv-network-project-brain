# DECISIONS — IPTV Network

**Reviewed against commit:** `4e2e18b` · **Reviewed:** 2026-09-09 · **Status:** CURRENT

Every `IPTV-D-nnn` recorded below is **OWNER APPROVED and binding**.
Changing one needs a new owner decision, not an agent's judgement. An agent may
*propose* a decision; only the owner may *make* one.

**`IPTV-D-001` to `IPTV-D-007` are sourced to `CLAUDE.md` in
`benasjad-hub/iptv-network`** — the file the owner writes to instruct coding
agents, first committed 2026-06-12 and last amended 2026-06-16.
**`IPTV-D-008` to `IPTV-D-010` are sourced to the owner's own words on
2026-09-13**, answering `IPTV-Q-001` directly. Nothing here is an agent's
inference from the code.

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

## `IPTV-D-008` — The network exists to bring clients and convert them in our own channels (answers `IPTV-Q-001`)

**Provenance:** owner_decision
**Recorded:** 2026-09-13
**Decision:** The 78 sites exist to **attract prospects from search and turn them
into paying clients**, inside a channel the owner controls and places on the site
himself — DaoudChat, WhatsApp, or any other he chooses. The conversation is the
product of the site; traffic that never reaches one has not done its job.
**Reason:** Stated by the owner in his own words on 2026-09-13, answering the
question this Brain had deliberately left `UNKNOWN` since it was written.
**Scope:** This fixes what the network is FOR. It does **not** fix which channel:
the owner names DaoudChat, WhatsApp or any other he decides to put on a site, and
changing channel is a product choice, not a change to this decision. It also does
not authorise adding a channel — `SERVICES.yaml` records what is actually in use.

## `IPTV-D-009` — Success at six months is 30 000 a month, all sites together

**Provenance:** owner_decision
**Recorded:** 2026-09-13
**Decision:** The target is **30 000 per month across all the sites combined**,
reached by **2027-03-13**. Combined, never per site: one site at 20 000 and
seventy-seven at nothing satisfies this decision exactly as well as an even
spread, and no agent may reinterpret it as an average or a per-site quota.
**The unit is not yet recorded.** The owner gave the figure; which currency it is
in has not been written down, and this Brain will not guess it. Until he says the
word, the number is binding and the unit reads UNKNOWN.
**Scope:** This is the measure of success for the network as a whole. It is not a
budget, not a permission to spend, and not a licence to publish faster — the
existing rules on publication pace and automation spacing still hold.

## `IPTV-D-010` — Never hand a client a degraded service to win on price

**Provenance:** owner_decision
**Recorded:** 2026-09-13
**Decision:** The owner **refuses to give a client a weak or overloaded server
because it is cheap**. Price is not the axis this network competes on; what the
client actually receives is.
**Reason:** His own words on 2026-09-13, given as the thing he will not do even
if it brings money.
**Scope:** This binds what is sold and promised. It does not forbid a low price
on a service that genuinely holds up, and it does not set any price — pricing
lives in the `sites` table, which overrides what the code says.

---

# OPEN QUESTIONS

An open question is **not** a decision and **may not be answered by an agent**.
It is answered by a new `IPTV-D-nnn` recorded above, at which point this section
loses the entry.

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
