# Verification — this Brain's content, 2026-09-09

**Commit tested:** `5fe707b` of `benasjad-hub/iptv-network`, the head observed
and recorded in `REVIEW_BASELINE.json`. The facts were read from the local
working tree at `7774f723`, three commits ahead; those three commits publish
articles on three sites and touch no service, host or rule recorded here.

**Date:** 2026-09-09.

## What was done

Every semantic field written into this Brain was read from a named source on
this date, and the source is recorded beside the fact in the file that carries
it. Six sources were used, and no seventh:

| Source | What was taken from it |
|---|---|
| Supabase `sites` (project `xqgrfntyhizrdomxqgxv`) | site count, status split, niches, WhatsApp distribution |
| `data/network-audit.json`, generated 06:41 UTC | hosting split, HTTP status, health, languages, article counts |
| `data/gsc-accounts.json` | the seven Search Console accounts and the 78-site mapping |
| the host itself — `hostname`, `nproc`, `free`, `df`, `ss`, `crontab -l` | every figure in `HARDWARE.yaml` and the scheduled-task count |
| `git remote -v`, `git ls-remote`, `git rev-parse` | remotes, branch, the unpushed gap |
| the network repository's `CLAUDE.md` | the seven owner decisions, and only those |

## What this record proves

That each fact was read from the source named beside it, on this date.

## What this record does NOT prove — read this half

- **Nothing about tomorrow.** The network commits several times a day. A figure
  here describes 2026-09-09 and stops there.
- **Nothing about honesty.** `make brain-gate` reporting 0 FAIL is a claim about
  file shape and internal consistency. A confident, well-formed, false statement
  passes it.
- **Nothing about quality or revenue.** No article was read for quality, no
  ranking was checked, no money was measured.
- **Nothing about the sites' internals.** The product's architecture below the
  hosting layer was not read and is recorded as `UNKNOWN`.
- **Nothing about services marked `unverified_from_this_repo`.** For PostHog and
  the image generator's account, the existence of a variable name was observed.
  No live call was made, so "it works today" is not established.
