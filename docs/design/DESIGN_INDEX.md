# DESIGN INDEX — IPTV Network

**Reviewed against commit:** `4e2e18b` · **Reviewed:** 2026-09-09 · **Status:** CURRENT

**One approved design reference exists**, and it is the only one. Any mockup
that exists outside this repository is **REFERENCE ONLY, never specification** —
a design becomes authoritative by being recorded here and approved, not by
existing somewhere.

## The approved reference: the cieloflux v2 look

**Authority:** the network repository's `iptv-network/docs/PLAYBOOK.md`, section
"design-quality bar — APPROVED reference", recorded 2026-06-22. That file is
where the owner's choices and corrections are extracted as reusable rules, which
is what makes this citable rather than an agent's taste.

**How it came to be approved:** two earlier directions — a flat warm-dark pass
and a light pass — were both rejected. What follows is what was accepted after
them.

- **Cinematic dark.** A deep near-black canvas, crisp white type, and **one**
  vivid accent. A real full-bleed hero of at least 92 percent of viewport height
  with a gradient scrim, and a header that starts transparent and turns to
  glass. Bold modern display face, generous spacing, large headings.
- **Motion is GSAP with ScrollTrigger**, not framer-motion. Transform and
  opacity only, so layout never shifts; fully off under reduced-motion; the
  server-rendered content is never hard-hidden by CSS, so a page without
  JavaScript still reads.
- **Reuse the structure, never the skin.** A new build starts from the cieloflux
  v2 component structure, but **every site keeps a unique palette and a unique
  font pairing** and stays self-contained. Sharing a skin across sites would
  leave a common footprint across the network, which is the thing to avoid.
- **Correct but flat reads as unfinished.** A design is judged on hero impact,
  type scale, spacing and motion — not on building cleanly and being on-brand.

**Scope.** This is the quality bar for a new build or a redesign. It does not
authorise touching an existing site's design, and it never overrides the rule
that design folders share no user-interface code (`IPTV-D-005`).
