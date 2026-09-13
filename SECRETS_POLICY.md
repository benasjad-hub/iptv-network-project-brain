# SECRETS POLICY — IPTV Network

**Reviewed against commit:** `dca08da` · **Reviewed:** 2026-09-09 · **Status:** CURRENT — the standard's policy, adopted unchanged

**No credential value may enter this repository.** Not in a file, not in a
commit message, not in a verification record, not in a comment, and not
temporarily.

## The rules

1. **Name, never embed.** A canonical file may record that a key EXISTS, what it
   is for, and where it resolves. It may never carry the value.
2. **`secret_ref` is a label, not a value.** `SERVICES.yaml` records a reference
   under which a secret would resolve in a vault. Until a vault is configured,
   every one reads `NONE_CONFIGURED` or `UNKNOWN`.
3. **Never print a secret**, including when asked directly. Reading one into a
   terminal puts it in scrollback, in a transcript and possibly in a model's
   context.
4. **Do not go looking.** No agent may scan `.env` files, external directories,
   shell history, keychains or another repository for credentials. Finding a
   secret is not this repository's job, and doing it uninvited creates exposure
   rather than reducing it.
5. **A leak is not fixed by deleting the line.** A committed credential is
   compromised the moment it is pushed. Rotate it at the source; then remove it.
6. **The scanner is best-effort and is not a clearance.** `context:check` sweeps
   the canonical set and what the CORE pack inlines, for a fixed list of
   credential shapes and value-bearing keys. It does not scan the whole
   repository, it does not scan history, and a PASS says only that those files
   matched none of those shapes.

## What is registered today

**Nothing.** No vault is chosen or provisioned, no account is registered and no
credential exists for this project as far as this Brain records — see
`SERVICES.yaml` and `ACCESS_MAP.yaml`. That is a claim about the **registry**,
not about the world.

## If you find one

Stop. Do not print it, do not paste it, do not put it in a commit message.
Report that a credential was found, where, and nothing more.
