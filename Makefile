# IPTV Network — Project Brain task runner.
#
# There is deliberately no package.json: the Brain tooling has ZERO
# dependencies and needs no install step. `npm run ...` in any tool's output is
# a template's wording, not this project's.
#
# EXACT RUNTIME REQUIREMENTS — the whole list:
#   · Node 18+ on PATH   (ES modules, node:test)
#   · git on PATH        (every SHIPPING script's git use is READ-ONLY.
#                         `guards-test` is the one carve-out: it BUILDS
#                         throwaway git repositories as fixtures, under the
#                         gitignored pack directory, and never runs a mutating
#                         verb against this repository.)
#   · GNU make, only for these shortcuts. Every target is a plain `node` call.
#   · A VERIFICATION-READY CHECKOUT: the objects every reviewed-against header
#     names, enough history to prove their ancestry, and the origin/main
#     remote-tracking ref. A shallow or single-branch clone is not one until a
#     READ-ONLY `git fetch` obtains them.
#
# Nothing in `brain-gate` needs the network, a credential or a database. This is
# the portability contract this Brain was installed under: it validates itself
# from a fresh clone of THIS repository, with no path back to the system it came
# from.

.PHONY: context-check context-checkpoint context-pack context-pack-full context-pack-audit guards-test external-check external-observe external-test verify-install brain-gate help

help:
	@echo "context-check       structure, provenance, secret hygiene, budgets (read-only)"
	@echo "context-checkpoint  runs the check, then writes REPO_STATE.json"
	@echo "                    pass flags after --, e.g. make context-checkpoint -- --adopt"
	@echo "context-pack        writes the derived CORE context pack (gitignored)"
	@echo "context-pack-full   writes the fully inlined variant, for offline hand-off"
	@echo "context-pack-audit  deterministic orientation audit of the CORE pack"
	@echo "guards-test         regression controls for the silent-failure guards"
	@echo "external-test       regression controls for the external-repository classifiers"
	@echo "external-check      classify the governed-repository baseline (OFFLINE, read-only)"
	@echo "external-observe    READ a governed repository's head and record it. NEEDS THE"
	@echo "                    NETWORK and possibly a credential, so it is deliberately NOT"
	@echo "                    part of brain-gate."
	@echo "verify-install      re-check the copied validator against its pinned digests"
	@echo "brain-gate          every deterministic check that needs no credential and no"
	@echo "                    network"

context-check:
	node tools/context/check.mjs

context-checkpoint:
	node tools/context/checkpoint.mjs $(filter-out $@,$(MAKECMDGOALS))

context-pack:
	node tools/context/pack.mjs

context-pack-full:
	node tools/context/pack.mjs --full

context-pack-audit:
	node tools/context/pack-audit.mjs

guards-test:
	node --test tools/context/guards.test.mjs

external-test:
	node --test tools/context/external.test.mjs

external-check:
	node tools/context/external.mjs

# THE ONE TARGET HERE THAT REACHES THE NETWORK, and the reason it is not in
# brain-gate: a gate that sometimes needs a credential is a gate people stop
# running. Read-only against the governed repository.
external-observe:
	node tools/context/observe-external.mjs $(filter-out $@,$(MAKECMDGOALS))

# The portability control. It proves the copied validator is still the one this
# installation was pinned to, which is what makes source_commit a claim the tree
# supports rather than a label.
verify-install:
	node tools/install/verify-manifest.mjs

# The deterministic Project Brain gate.
#
# A GREEN RUN IS A STRUCTURAL RESULT AND NOTHING MORE. It cannot tell whether a
# status, a decision, a task state or a verification claim is honest.
brain-gate:
	@echo "== git diff --check =="
	@git diff --check
	@$(MAKE) --no-print-directory verify-install
	@$(MAKE) --no-print-directory guards-test
	@$(MAKE) --no-print-directory external-test
	@$(MAKE) --no-print-directory context-check
	@$(MAKE) --no-print-directory external-check
	@$(MAKE) --no-print-directory context-pack
	@$(MAKE) --no-print-directory context-pack-audit
	@echo
	@echo "brain-gate: deterministic checks complete."
	@echo "STRUCTURAL ONLY. It says nothing about whether a claim in this Brain is honest."

# Swallow bare flag-like goals so `make context-checkpoint -- --adopt` works.
%:
	@:
