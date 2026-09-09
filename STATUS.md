# STATUS — IPTV Network

**Reviewed against commit:** `602b580` · **Reviewed:** 2026-09-09 · **Status:** CURRENT

**What is true right now.** This file is the single source of now-state truth.
Planning documents point at it; they never mirror it.

> ## The state lines. Nothing here outranks them.
>
> - **PROJECT BRAIN: FILLED IN, NOT ACCEPTED.**
> - **THE NETWORK IS LIVE: 78 SITES, 77 SERVING.**
> - **PURPOSE: UNKNOWN — THE OWNER MUST ANSWER.**

## 1. In one paragraph

A network of **78 websites** is running, publishing and being measured, every
day, without anyone driving it by hand. **77 of the 78 answer HTTP 200** and all
78 carry published articles — **2 684** in total. Roughly two dozen scheduled
tasks choose keyword targets, write articles, generate images, push URLs to
Google and mail a daily report. **What none of it is aimed at is written
nowhere**: no document in this project states what the network is for or what
success would look like. The machinery is measurably working; whether it is
working toward anything cannot be checked. That is `IPTV-Q-001`, and only the
owner can close it.

## 2. What exists, measured

Every figure below was measured on **2026-09-09** against the working tree at
`7774f723`, the Supabase `sites` table, the generated audit
`data/network-audit.json` (06:41 UTC) and the host's own sockets.

| Fact | Value | How it was measured |
|---|---|---|
| Sites | 78 | Supabase `sites`, row count |
| Serving HTTP 200 | 77 | audit, field `http` |
| Unreachable | 1 — `iptvbritish.uk` | audit, `fetch failed`, health 30 |
| Articles live | 2 684, no site at zero | audit, field `articles` |
| Hosting | 41 Vercel · 24 dedicated Cloudflare workers · 7 shared · 6 VPS | audit, field `hosting` |
| Languages | fr 21 · en 19 · de 16 · nl 8 · it 6 · es 5 · da 1 · sv 1 · pl 1 | audit, field `language` |
| Niches | iptv 73 · orthopedic 4 · chaussures 1 | Supabase `sites` |
| Search Console | 7 accounts, all 78 sites mapped | `data/gsc-accounts.json` |
| Scheduled tasks | 26 crontab entries | `crontab -l` on the host |
| Health score | 68 sites at 100, 4 at 99, 5 at 95, 1 at 30 | audit, field `health` |

**The measurement chain is working again.** Bright Data has returned
`zone_not_found` since 2026-09-01, which left ten sites publishing with no
measured target. The Semrush v4 key supplied on 2026-09-09 replaced it; seven of
those ten now have measured targets. The three that remain are saturated by
sibling sites in the same network, which is a configuration problem and not an
API one.

## 3. What does NOT exist, stated plainly

- **No written destination.** `project_purpose` is `UNKNOWN`, and it is UNKNOWN
  because nobody has written it, not because the answer is nothing.
- **No remote for this Brain.** One copy exists, on one machine, with no backup.
  Creating the remote is the owner's act.
- **No owner ratification of the nine engineering rules** running in the network
  today. They are described in `docs/architecture/ARCHITECTURE.md` as what
  exists, and deliberately not in `DECISIONS.md`.
- **No accepted gate.** `docs/qa/RELEASE_STATE.md` records PG-1 satisfied and
  PG-2 — the owner's own acceptance — not satisfied.
- **No vault.** Credentials exist and are read from files; nothing resolves them
  automatically, and no value is recorded anywhere in this Brain.

## 4. Verified state, and how it was verified

`make brain-gate` reports **0 FAIL**. That is a **STRUCTURAL** result about file
shape and internal consistency. It cannot tell whether any claim here is honest.

The one verification record filed is `docs/verification/BRAIN_CONTENT_2026-09-09/`,
and it states its own limits: it establishes that each fact above was read from
the source named beside it on that date. It establishes nothing about tomorrow,
nothing about the sites' content quality, and nothing about revenue.

**Three claims made earlier the same day were wrong and were corrected.** They
are recorded because the corrections are the useful part:

1. A site was reported clean of trademark mentions while 42 were live. The
   measurement fetched a URL without following its redirect and read the empty
   body of a 301.
2. The Semrush key was declared dead in four durable places. It worked. The
   authentication scheme and the endpoint version had both been wrong, and a
   wrong scheme returns the same 401 as a revoked key.
3. A rate limiter was reported as enforcing a ceiling that concurrent requests
   walked straight through.

## 5. What is at risk right now

- **65 of the 78 sites depend on a single WhatsApp number.** WhatsApp is the
  network's only conversion channel, and a third number was banned by Meta on
  2026-08-08. One more ban takes most of the network's revenue path with it.
- **37 sites do not deploy on push.** A change is live in ninety seconds on
  Vercel and up to two hours later everywhere else, and only if the deploy cron
  ran.
- **One unmerged file stops all content production.** The repository index is
  shared with the scheduled tasks; this cost 60 articles over 21 hours on
  2026-09-02.
- **43 sites carry the status `draft` while serving.** Automation reads that
  field. Whatever it is meant to gate, it is not gating it — `IPTV-Q-002`.

## 6. Next

`TASKS.md`. The blocking item is `IPTV-T-002`: three questions only the owner
can answer.
