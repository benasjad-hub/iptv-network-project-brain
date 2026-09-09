# ARCHITECTURE — current only — IPTV Network

**Reviewed against commit:** `602b580` · **Reviewed:** 2026-09-09 · **Status:** CURRENT

**This document describes what EXISTS in this tree. Nothing else.** A planned
design belongs in a separate, clearly-labelled draft; the moment a plan is
written here, a reader takes it for a system.

## 1. What exists today

**This repository holds the Brain and its validator. The product code lives in a
separate repository this Brain governs** (`EXTERNAL_REPOS.yaml`).

```
<repository root>
├─ START_HERE.md  STATUS.md  TASKS.md  DECISIONS.md   ← the canonical set
├─ SECRETS_POLICY.md  AGENTS.md  CLAUDE.md
├─ PROJECT.yaml                                       ← facts + brain: config
├─ FEATURE_MATRIX.yaml                                ← feature × surface truth
├─ SERVICES.yaml  ACCESS_MAP.yaml                     ← where things are
├─ HARDWARE.yaml  ARTIFACTS.yaml
├─ EXTERNAL_REPOS.yaml                                ← the governed repository
├─ REPO_STATE.json  REVIEW_BASELINE.json              ← GENERATED ONLY
├─ INSTALL_MANIFEST.json                              ← GENERATED ONLY, §3
├─ Makefile                                           ← the command surface
├─ tools/context/                                     ← the copied validator
└─ docs/  architecture · qa · design · history · verification
```

### The governed network

`benasjad-hub/iptv-network` is a **multi-tenant Next.js 14 application** (App
Router, pnpm workspace). One folder per site under `apps/sites/designs/<slug>/`,
each self-contained: its own pages, its own content, its own theme, and — by
owner decision `IPTV-D-005` — no user-interface imports from any sibling.

**78 sites, four hosting paths, and they do not deploy the same way.** This is
the single fact most likely to cost a session hours, so it is stated first:

| Path | Sites | How a change reaches the live site |
|---|---|---|
| Vercel | 41 | Automatically, on push to `main` |
| Cloudflare Workers, dedicated | 24 | Only when `scripts/cron-deploy-cf.sh` runs (`15 */2`) |
| Cloudflare Workers, shared cluster | 7 | Same script, same schedule |
| VPS `next start`, port 2052 | 6 | Only when `scripts/cron-deploy-vps.sh` runs (`45 */2`) |

A push that would be live in ninety seconds on Vercel can sit invisible for two
hours on the other 37 sites. An article written to a Cloudflare-hosted site
returns 404 until that deploy runs.

**The content machinery.** Roughly two dozen scheduled tasks run on the VPS. They
choose keyword targets from measured search-engine results, write articles,
generate cover images, push new URLs to Google for crawling, check indexation and
hosting health, and mail the owner a daily report. 2 684 articles were live
across the 78 sites on 2026-09-09, with no site at zero.

### Nine engineering rules that are running, and were never approved

`project-memory/05-DECISIONS.md` in the governed repository records nine numbered
rules, `DEC-0001` through `DEC-0009`. They are **in force in the code today** and
several are hard-won. They are recorded **here**, as architecture, and **not** in
`DECISIONS.md` — an agent wrote them, and only the owner may make a decision.

1. **`DEC-0001` — the Cloudflare build runs in a separate git worktree**
   (`/home/iptv/cf-build`). Building in the main tree overwrites `apps/sites/.next`,
   the directory `next start` serves on the VPS, and the six VPS sites lose their
   styling and then return 500.
2. **`DEC-0002` — Search Console is verified by META tag, never by file.** The
   multi-tenant router intercepts static `.html` at the root, so the verification
   file is never served. One token per domain.
3. **`DEC-0003` — when merging duplicate pages, keep the one URL Inspection shows
   as indexed**, not the most complete one. Twice the shorter page was the only
   one with impressions. An empty impressions report is *not* evidence a page is
   unindexed: a page at position 50 has none.
4. **`DEC-0004` — a fixed list of WhatsApp numbers, never an invented one.** A
   plausible number, correct country code and correct format, was once deployed
   to production. It did not exist. **This rule as written is now stale** — it
   still lists `12252179633`, which Meta banned on 2026-08-08.
5. **`DEC-0005` — no language switcher on a monolingual site.**
6. **`DEC-0006` — a scheduled task merges, and never rebases.** The content agent
   writes continuously to `iptv-network/docs/JOURNAL.md`; a conflicted rebase leaves the
   repository half-rebased *for every other task*. One unmerged file blocks all
   commits — this cost 60 articles over 21 hours on 2026-09-02.
7. **`DEC-0007` — images from OpenAI's cheapest tier.** Contradicted by the code
   that actually runs; see `IPTV-Q-003`.
8. **`DEC-0008` — internal backlink waves are paused** since 2026-08-06.
9. **`DEC-0009` — keyword measurement goes through the Semrush v4 API**, endpoint
   v2, header `Apikey` and never `Bearer`. Its own lesson is the valuable part:
   **a 401 does not establish that a key is dead**, because a wrong authentication
   scheme and a wrong endpoint version return the same 401 as a revoked key.

**The product's internal architecture beyond this is `UNKNOWN` to this Brain.**
That is not a claim that none exists — it is a claim that none has been recorded
here, and recording it is later work.

## 2. The command surface

Every target is a plain `node` call; `make` is a convenience, not a dependency.

| Target | What it does | Writes |
|---|---|---|
| `context-check` | Read-only structural validation of the whole Brain | nothing |
| `context-checkpoint` | Runs the check, then writes the generated state | `REPO_STATE.json` |
| `context-pack` / `-full` | Generates the layered orientation pack | `dist/` (gitignored) |
| `context-pack-audit` | Containment audit of the CORE pack | nothing |
| `guards-test` · `external-test` | Regression controls | temporary fixtures under the gitignored pack directory |
| `external-check` | **Offline** classification of the governed-repository baseline | nothing |
| `external-observe` | **Reaches the network.** Reads a governed repository's head | `REVIEW_BASELINE.json` |
| `verify-install` | Re-checks the copied validator against its pinned digests | nothing |
| `brain-gate` | Every deterministic check that needs no credential and no network | `dist/`, plus guard fixtures |

**`external-observe` is deliberately NOT in `brain-gate`** — it is the one
target that reaches the network and may need a credential, and the gate's
categorical is worth more than the convenience of folding it in.

## 3. Portability, and why the validator is a copy

This Brain runs its own validation **from a fresh clone of this repository**,
using only Node 18+ and `git`. Nothing resolves to the system it was installed
from, to a symlink out of this repository, to the machine that generated the
installation, or to an unpublished local file.

That is why `tools/` is a **copy** rather than a reference — and why the copy is
pinned. `INSTALL_MANIFEST.json` records the source repository, the exact source
commit and a SHA-256 digest per copied file; `make verify-install` re-checks
every one. Versioned, pinned, documented and integrity-verifiable is the
condition under which sharing runtime code is permitted at all.

## 4. Governed external code repositories

This Brain is documentation-only and the product's code lives in **another**
repository. It is declared in `EXTERNAL_REPOS.yaml`, observed into the generated
`REVIEW_BASELINE.json` by `make external-observe`, and classified offline by
`make external-check`.

**One governed repository is declared:** `benasjad-hub/iptv-network`, branch
`main`, reviewed and observed at `5fe707b` on 2026-09-09. The observation policy
is **7 days** rather than the 30-day default, because that repository receives
automated commits several times a day and a month-old observation would describe
a tree that no longer exists.

**A caveat a reader is entitled to.** The facts in this Brain were verified
against the **local working tree** at `7774f723`, which stood three commits ahead
of the observed remote head. Those three commits publish articles on three sites
and touch no service, no host and no rule recorded here, so the record holds at
both commits. Reading the remote required configuring `credential.helper store`
locally in this repository — the same helper the governed repository already
uses, on the same machine and account. This repository has **no** git remote, so
nothing can be pushed from it.
