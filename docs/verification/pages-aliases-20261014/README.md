# Pages alias QA — 2026-10-14
Source b3553ce6 exact original Google170/171 output. Root node --test scripts/studio/site-page-catalog*.test.cjs:19PASS. Actual public sitemap snapshot48canonicalwww entries, existing production source not modified by QA.

Browser fixture has ACTUAL StudioSitePageCards/Card/StudioVisualOpen/operation hook; opening/auth/navigation explicitly mocked. Server fixture has ACTUAL asyncSitePagesTab/helper/HOST_TO_SITE; getSite/fetch/card boundary explicitly mocked. These are not authenticatednative/publicwrite acceptance.

Reconstruct ignored .studio-local/pages-ui-qa from browser/ files. Set STUDIO_CATALOG_CANDIDATE to clean source root; STUDIO_QA_ESBUILD to installedesbuildmodule; STUDIO_QA_PANEL_MODULES/NODE_PATH to apps/panel/node_modules. Fixture requires ignored .studio-local/ui-built29-main.css,ui-built29-extra.css from canonicalcompiledCSS and qa-fonts actualInterwoff2. Root component import is used, no oldprivate166candidate required. node build.cjs then node --test browser.qa.cjs:7PASS.

Copy serverbuild/test to .studio-local and node pages-server-build.cjs then node --test pages-server.test.cjs:5PASS. Requires .studio-local/viking-sitemap-20261014.xml copied from root scripts/studio/fixtures/site-catalog-viking-sitemap-20261014.xml. Alltransportboundaries explicitly mocked.

Types: full actual importedTS graph0 inUbuntu with originalsourcecandidate overlays (no TSstubs). Wholeappstaticaudit24preexistingfindings/0changed; notwholeappcomplete. Privatebuild/live status inlatestSTATE/Brain. Owner's unknownnativeAIinputpreserved.
