# M1b — Constellation gold-standard visualization · §J visual-fidelity gate

**Status: pending release verification** (ledger §J / CLAUDE.md §8.8 — a _release_ gate, **not** a merge blocker). Green CI merges this; a designated qualified reviewer signs the visual fidelity below before the production/field release.

The spec is `Redex_Academy_Prototype.html` → PART 3 (the interactive SVG skill-tree). This rebuild replaces the flat tiered grid with the radial "obsidian-brain": domains as angular sectors, tiers as concentric rings, a bright Mastery core, real prereq edges, the keystone artery, and the boss apex.

## What changed

- **`apps/web/src/catalog/constellationLayout.ts`** (new) — pure, deterministic radial geometry (ported from the prototype): `DOMAIN_ANGLE` sectors, `TIER_RADIUS` rings, 46° sector fan, Mastery-boss → centre apex, cross-domain keystone detection, seeded starfield. No time, no `Math.random` → no render jitter.
- **`apps/web/src/catalog/Constellation.tsx`** (rewrite) — token-backed radial SVG: defs (core-glow + boss gradient), starfield, tier rings + labels, domain sector labels, keystone/active/dim edges, per-state colorblind-safe nodes, boss/gate heavier frame + ⚠, pan/zoom on the viewBox, filter dimming. Accessible `<g role="button">` nodes (keyboard-activatable; aria-labelled).
- **i18n** — added `catalog.state.*`, `catalog.domain.*`, `catalog.legend_title`, `catalog.reset_view` (EN + ES).

## Automated gates (CI — these DO block merge)

- ✅ `typecheck`, `lint` (incl. the **no-raw-hex** invariant — every colour is a token class / CSS var), Prettier, `build`.
- ✅ Unit: `constellationLayout.test.ts` (radial math, apex rule, keystone, determinism) + `Constellation.test.tsx` (data contracts, radial placement, colorblind-safe shape+text, keyboard focus, enroll/locked flow, no-hex markup).
- ✅ Preserves the M1 e2e + a11y contracts: `data-course` / `data-state` / `data-boss`, the enroll side-card, the locked-gate hint. Decorative chrome is `aria-hidden`; visible text uses AA-contrast tokens; animations are `prefers-reduced-motion`-guarded.

## Reviewer visual checklist (vs. the prototype)

- [ ] Six domains read as angular **sectors** (FND top, INT upper-right spine, ADC lower-right, AC bottom, VID lower-left, SEC upper-left).
- [ ] Four tiers read as concentric **rings**, Foundations outer → **Mastery the bright core**; the centre core-glow is present.
- [ ] A Mastery-tier boss (e.g. INT-410) sits at the **dead-centre apex**; other gates wear the heavier amber frame + ⚠.
- [ ] Prereq **edges**: keystone artery animates; an edge from a cleared course lights up; others stay dim.
- [ ] Node states are unmistakable by **shape + glyph** alone (locked padlock / available play / in-progress arc / passed check / mastered check+gold-star) — not colour.
- [ ] Starfield twinkles; pan (drag) + zoom (wheel) + **Reset view** work; domain/persona filters dim the rest.
- [ ] Reads correctly under `prefers-reduced-motion` (animations off, layout intact) and on a phone (mobile-first).

> Note: the seeded MVP slice is small, so the apex/keystone/full-sky richness only fully renders against the complete catalog. The geometry is data-driven and verified by unit tests against representative graphs.
