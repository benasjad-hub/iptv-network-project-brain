# AWS durable journal review evidence

This is QA for an isolated Google proposal, not accepted production code.
Use Node with node:sqlite and STUDIO_AWS_OP_CANDIDATE pointing to that proposal root.
All fixtures create private temporary databases and mock page data; no network/auth.
Run: node --test adversarial-reproductions.cjs

Google123: native receipt220.81s,57542chars,denied0. OriginalQA4pass9fail;
independent6 negative cases all failed. Proposal rejected.
Google124: native receipt131.242s,68666chars,denied0. Original19pass0fail.
First6 independent cases passed after including newly required sourceURL in
fixture digest, no assertion changed. Additional4 failed: actual raw source URL
change before claim, actual raw source ETag change before completion, extra asset
fields sanitized rather than rejected, missing AWS source URL/destination allowed.
All10 assertions retained here. No product materialization or service rollout.

Google125:9.256s,empty response,denied1. Rejected; SUCCESS is not code evidence.
Original126 direct code question to teacher account uses same plan/sandbox
permissions. Inspect receipt/code before acceptance; no permission weakening.

Accepted earlier source7cf015e3: readonly AWS witness/owner-CAS receipt,tracked55/0
andactual TS mocked-boundary action3/0,clean production build,notdeployed.
Actual readonly real production SQLite/S3 bytes witness remains separately
qualified; it is not proof a delayed original publication cannot later write.
