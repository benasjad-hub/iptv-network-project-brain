# STATUS — IPTV Network

**Reviewed against commit:** `97f1654` · **Reviewed:** 2026-09-09 · **Status:** CURRENT

**What is true right now.** This file is the single source of now-state truth.
Planning documents point at it; they never mirror it.

> ## The state lines. Nothing here outranks them.
>
> - **PROJECT BRAIN: FILLED IN, NOT ACCEPTED.**
> - **THE NETWORK IS LIVE: 78 SITES, 77 SERVING.**
> - **PURPOSE: BRING CLIENTS AND CONVERT THEM IN OUR OWN CHANNELS.**
> - **TWO QUESTIONS STILL OPEN, BOTH THE OWNER'S.**

## 1. In one paragraph

A network of **78 websites** is running, publishing and being measured, every
day, without anyone driving it by hand. **77 of the 78 answer HTTP 200** and all
78 carry published articles — **2 684** in total. Roughly two dozen scheduled
tasks choose keyword targets, write articles, generate images, push URLs to
Google and mail a daily report. **What it is aimed at is now written down.** On 2026-09-13 the owner
stated it: the sites exist to bring prospects in from search and convert them
into paying clients inside a channel he controls, and success at six months is
**30 000 a month across all the sites combined**, by 2027-03-13. He also named
what he refuses — handing a client a degraded service because it is cheap. Those
are `IPTV-D-008`, `IPTV-D-009` and `IPTV-D-010`, and every automated choice this
network makes can now be judged against them.

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

**The measurement chain worked on 2026-09-09, and tomorrow is not established.**
Bright Data has returned `zone_not_found` since 2026-09-01 — that is the error
string observed, and **why** it started is recorded nowhere in this project.
Ten sites were left publishing with no measured target. The Semrush v4 key
supplied on 2026-09-09 replaced it, and seven of those ten now have measured
targets; the three that remain are saturated by sibling sites, which is a
configuration matter. **The claim stops at that date on purpose:** the key is a
trial key the owner rotates, its expiry is not exposed by the API, and the
remaining unit balance cannot be read for this key format. Nothing here
establishes that a measurement made next week will succeed.

## 3. What does NOT exist, stated plainly

- **No recorded currency for the target.** `IPTV-D-009` carries the figure and
  the date. The unit is UNKNOWN, and one word from the owner closes it.
- **No remote for this Brain.** One copy exists, on one machine, with no backup.
  Creating the remote is the owner's act.
- **No owner ratification of the nine engineering rules** running in the network
  today. They are described in `docs/architecture/ARCHITECTURE.md` as what
  exists, and deliberately not in `DECISIONS.md`.
- **No accepted gate.** `docs/qa/RELEASE_STATE.md` records PG-1 satisfied and
  PG-2 — the owner's own acceptance — not satisfied.
- **No vault.** Credentials exist and are read from files; nothing resolves them
  automatically, and no value is recorded anywhere in this Brain.

**Two different things are written `UNKNOWN`, and they are not interchangeable.**
An `UNKNOWN` that says *nobody has stated it* — the purpose, the goal figures —
is closed only by the owner. An `UNKNOWN` that says *this Brain did not measure
it from this repository* — the analytics account, the image generator's account,
the VPS supervising unit — is closed by anyone willing to run one command. Do
not treat the second as permanent, and do not try to close the first yourself.

## 4. Verified state, and how it was verified

`make brain-gate` reports **0 FAIL**. That is a **STRUCTURAL** result about file
shape and internal consistency. It cannot tell whether any claim here is honest.

The one verification record filed is `docs/verification/BRAIN_CONTENT_2026-09-09/`,
and it states its own limits: it establishes that each fact above was read from
the source named beside it on that date. It establishes nothing about tomorrow,
nothing about the sites' content quality, and nothing about revenue.

**Why the risks below are ranked by conversion.** Because the owner said that
is what the network is for (`IPTV-D-008`). Until 2026-09-13 this Brain ranked
them the same way while calling the purpose `UNKNOWN`, which was a tension it
named rather than hid. The tension is closed: the ranking now rests on a stated
decision instead of on a presumption read off the machinery.

**One thing about the target is still not recorded.** `IPTV-D-009` says 30 000 a
month, all sites combined. **Which currency has not been written down**, and this
Brain will not guess it. The figure is binding; the unit reads UNKNOWN until the
owner says the word.

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

- **The conversion channel changed on 2026-09-13, and nothing about it lives in
  this repository.** Every site's call to action now opens the DaoudChat widget.
  Which channel a site uses is a field in ANOTHER product's database
  (`channels.cta_mode`, Supabase `gevvsfsmcnsiwujerjku`), flipped from a
  dashboard. It changes all 78 sites instantly, with no commit and no deploy —
  and nothing in this repository records or guards that switch.
- **65 of the 78 sites still fall back to a single WhatsApp number.** WhatsApp is
  no longer the primary channel, but it is what a visitor reaches when the widget
  fails, and a third number was banned by Meta on 2026-08-08.
- **Copyright notices arrive and can sit unhandled.** A 365-day sweep of the
  seven Search Console mailboxes on 2026-09-21 found **19 notices**. Three had
  been handled. One had not: it targeted the **home page** of `liste-iptv.srl`
  and that page was still served 200 **thirteen days** after the notice. It has
  since been corrected. The gap is structural, not accidental: the mailbox watch
  runs every three hours but **only ever looks at the last 24 hours**, so a
  notice that arrives while the cron is down is never seen again.
- **Nobody has yet measured whether the widget converts.** It became the only
  entry point on 78 live sites the day it was switched on. If a conversation
  opens and no one answers, the visitor is lost and no alert fires.
- **37 sites do not deploy on push.** A change is live in ninety seconds on
  Vercel and up to two hours later everywhere else, and only if the deploy cron
  ran.
- **One unmerged file stops all content production.** The repository index is
  shared with the scheduled tasks; this cost 60 articles over 21 hours on
  2026-09-02.
- **43 sites carry the status `draft` while serving.** Automation reads that
  field. Whatever it is meant to gate, it is not gating it — `IPTV-Q-002`.

## 6. Next

`TASKS.md`. `IPTV-T-002` is **two thirds done**: the owner answered what the
network is for. Two questions remain, both his — what the site status `draft` is
meant to gate, and which image generator is intended.

## DaoudStudio — owner work, verified2026-10-12

**Overall readiness: INCOMPLETE.** Owner explicitly authorized this separate
workstation/VPS application and its records. Current evidence is in
[DaoudStudio capture](docs/verification/CAPTURE_2026-10-11_DAOUDSTUDIO.md).
Consolidated acceptance matrix and ordered remaining checks were pushed to
product commit `82d29838`, branch `codex/daoudstudio-dashboard`,
[docs/STUDIO_ACCEPTANCE.md](https://github.com/benasjad-hub/iptv-network/blob/82d29838/docs/STUDIO_ACCEPTANCE.md).
82 deterministic tests and real Google text/image/context acceptance do not
establish complete app-task OAuth integration, Flow generation, site migration
or Mac acceptance. Continue with `IPTV-T-011`; preserve the network state lines.

2026-10-12 update: live Studio web e457c6e9; product docs068d13ae. Ordinary private VPS Chrome Flow login and actual .exe HTTPSrelay launch accepted; visible bendaoud.fst3@gmail.com/PRO/1020credit snapshot.95 cumulative deterministic checks plus original provider acceptance; staged-worker service remainsOFF. Automatic Flow generation/switch and native restart remain pending. Detailed evidence in the capture linked above; governed network state unchanged.

2026-10-12 05:22UTC update: liveStudio1a729fcd,docsfd236c54; stagedGoogleworker ON with real private article→busy-switch→image/context/reopen acceptance. AssistedFlow8sec720p generated;1020→1008credits. Actual exe playback/seek/download exacthash passed, anonymous404. AutomaticFlow task/switch and visual no-pseudo-text quality remain pending.98cumulative checks; full boundaries in capture.


2026-10-12 06:52UTC update: liveStudio2c694541. Actual native app article/page/product/image QA accepted; app-close, graceful Google-worker restart and reopening preserved reviewrevision11/five receipts. PCoff/VPSreboot not verified. Product4eea057c candidate (not deployed) adds draft reference-clone workflow and visible SEO metadata;3clone tests/types and mocked actual UI checks pass. Owner reference ebay.com with design/organization for own content, not marketplace; clone generation/widget/publication not connected. Details and remaining work in capture; overall INCOMPLETE, network state lines unchanged.


2026-10-12 07:43UTC: actual parallel private app requests for goalstream/page andiptvfhd/article reachedreview on separate original Google accounts without output mixing;121.665s/83.529s. Timing/SEO UI accepted in.exe, live e8a7af36. Product23dcee9d temporary random-name candidate tested; full clone/preview and automatic Flow still incomplete.68Node+4provider/types and4clone+mockedform checks passed. Only2AWSprofiles available, owner third-account question pending; detailed boundaries in capture. IPTV-T-011 stays IN PROGRESS.

2026-10-12 15:19UTC update: liveStudio2d3c0f6a/productdocs65e8b24c. Actual EXE article task->private editor/title instantpreview/savev1/appclose-reopen/retry SAMEeditedID accepted; actual same-task Google image imported and rendered. ReadonlySQLite exactSEO/body/publishednull/taskreview5/11unchanged. StrictUIaudit25legacyerrors/no-newdelta, notpass. Nativepage/restore/products/inlineimages, Flowautomatic, fullclonepreview, originalsiteAWS/live, migration/thirdAWS/Mac remain INCOMPLETE; see latest capture.

2026-10-12 15:34UTC: liveStudioac3e5ed4. Actualnativepageimport/edit/instantpreview/save/restorev0asnewv2 accepted;exactSEO/body/history retained andprivate. SourceHome/articleidempotencybeyond100drafts repaired/deployed;7focusedtestspass/typespass. Nativeexisting-sourceUI/publicwebsiteAWSrollbackunverified. IPTV-T-011 remainsINPROGRESS;Flowautomatic/fullclone/migration/Macandotherremainingchecks in latestcapture.

2026-10-12 16:03UTC: productb6e7ee88 candidate Flowpending/recovery protocol tested14/0 with injectedproviders/realSQLite. NOT originalworker deployed or actualvideo automation. Livewebac3e5ed4 unchanged. RealreadonlyFlow selected preset/12creditquote visible; balancehidden/no generation. Exactnext realFlowGUIreceipt/download/ingest andnativeapp acceptance; remaining checklist staysINPROGRESS. See latestcapture/protocolreceipt.

2026-10-12 16:41UTC: c6ac5726 candidate durableFlowledger andactualbyteverifier;7VPSscratchtests+13transportsemantic+14workerchecks pass. OLDassistedMP4 reverifiedexactSHA/full decode,notnewvideo. Liveworker/UIFlowconnectorstillnotenabled. NextrealGUIcontroller/download andnativeappconsigne proof; fullchecklistINPROGRESS. Detailed receipt linked in latestcapture.
