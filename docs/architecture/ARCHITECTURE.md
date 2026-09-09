# ARCHITECTURE — current only — IPTV Network

**Reviewed against commit:** `0000000` · **Reviewed:** 2026-09-09 · **Status:** NOT BOOTSTRAPPED

**This document describes what EXISTS in this tree. Nothing else.** A planned
design belongs in a separate, clearly-labelled draft; the moment a plan is
written here, a reader takes it for a system.

## 1. What exists today

**The Project Brain and its validator, and nothing else has been recorded.**

```
<repository root>
├─ START_HERE.md  STATUS.md  TASKS.md  DECISIONS.md   ← the canonical set
├─ SECRETS_POLICY.md  AGENTS.md  CLAUDE.md
├─ PROJECT.yaml                                       ← facts + brain: config
├─ FEATURE_MATRIX.yaml                                ← feature × surface truth
├─ SERVICES.yaml  ACCESS_MAP.yaml                     ← where things are
├─ HARDWARE.yaml  ARTIFACTS.yaml                      ← kept, empty, on purpose
├─ REPO_STATE.json                                    ← GENERATED ONLY
├─ INSTALL_MANIFEST.json                              ← GENERATED ONLY, §3
├─ Makefile                                           ← the command surface
├─ tools/context/                                     ← the copied validator
└─ docs/  architecture · qa · design · history · verification
```

**The product's own architecture is `UNKNOWN` to this Brain.** That is not a
claim that none exists — it is a claim that none has been recorded here.

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

If this Brain is documentation-only and the product's code lives in **another**
repository, declare it in `EXTERNAL_REPOS.yaml`, record observations into the
generated `REVIEW_BASELINE.json` with `make external-observe`, and let
`make external-check` classify offline whether the record still holds. Both
files are **optional** and are validated only when present.

**No external repository is declared today.**
