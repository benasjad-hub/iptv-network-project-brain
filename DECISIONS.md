# DECISIONS — IPTV Network

**Reviewed against commit:** `0000000` · **Reviewed:** 2026-09-09 · **Status:** NOT BOOTSTRAPPED

Every `IPTV-D-nnn` recorded below is **OWNER APPROVED and binding**.
Changing one needs a new owner decision, not an agent's judgement. An agent may
*propose* a decision; only the owner may *make* one.

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

**None.** **This section is empty BY CONSTRUCTION.** The installer cannot write
a decision, and an agent may not write one either — a generator or an agent that
could record an owner decision would be a route to a decision nobody made. The
first entry here must come from the owner.

---

# OPEN QUESTIONS

**None recorded.** An open question is **not** a decision and **may not be
answered by an agent**. It is answered by a new `IPTV-D-nnn` recorded
above, at which point this section loses the entry.

---

# SUPERSEDED DECISIONS

**None.** Superseded entries are **kept and marked**, never deleted — a
superseded decision is provenance for why the current one exists.

# NEEDS OWNER CONFIRMATION

**None.** Anything an agent believes without owner approval belongs in
`TASKS.md` → *Inbox / Triage* or in the Open Questions above, never here.
