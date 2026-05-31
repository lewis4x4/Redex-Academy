# D1 — Human Verification Checklist (design system vs the prototype)

> **Non-blocking visual check (de-bottlenecked 2026-05-30).** D1 is the experience-layer contract.
> Merge and downstream `@redex/ui` adoption are cleared by the **automated bar** — no-raw-hex +
> token snapshot, axe a11y (2/2), the Tab-trap / return-focus tests, and e2e. The
> side-by-side-vs-prototype _look_ is a **post-merge polish pass any reviewer can do**; it does
> **not** block the #6 merge or the modules (M1/M2/M6/M7/M11/G1/C1) that build on `@redex/ui`.
> D1 is **`done`** on green CI; any visual divergence found later is a fast-follow fix, not a gate.

## How to review

- **Component gallery:** run the web app and open **`/dev/ui`** — every primitive, every state,
  with a **persona-density toggle** (Field/Marco vs Dense/Priya-Dana) at the top.
- **Re-skinned login:** open **`/`** (logged out) — the dark/red SSO screen (the navy screen is gone).
- **App shell:** the header (brand mark + wordmark + "Mastery, not seat-time" + nav + HUD) wraps every screen.
- Compare side-by-side with **`Redex_Academy_Prototype.html`** (the approved prototype).

## Checklist (post-merge visual polish — any reviewer; NOT a merge blocker)

- [ ] The gallery **looks like the prototype**: near-black canvas, Redex-red `#ED1B24`, the red glow,
      Inter type, the motion feel. (Tokens were extracted verbatim from the prototype.)
- [ ] **Login + app shell are on-brand** and the placeholder navy `#0b3d91` is gone everywhere.
- [ ] **Dark-theme contrast passes AA by eye** on text/controls; the brand focus ring is visible
      under keyboard navigation. (Note: brand-red _text_ uses the brighter `#ff3b43` on dark + the
      selected-chip / verdict states use a red/amber/green **tint + white** treatment so they clear
      WCAG AA — a deliberate, on-brand divergence from the prototype's solid-red-with-white labels,
      which fall just under 4.5:1. Confirm this reads right to you.)
- [ ] **Reduced motion:** with the OS "reduce motion" setting on, the pulses/animations are disabled
      or calmed (every keyframe is gated behind `prefers-reduced-motion`).
- [ ] **No color-only state:** pass/fail/veto/pending and selected/active states all carry shape + text.
- [ ] **Token layer is the single source:** spot-check a few components — no raw hex (the lint rule + the token-snapshot test enforce this; navy is gone).
- [ ] **Persona = density only:** the toggle changes layout density (and the app derives it from the
      `persona` claim) **without** changing any permissions (roles drive the RoleGate, separately).
- [ ] Reviewed the **adversarial-verification report** the ultracode run produced; its findings are addressed.

## Automated status (CI — necessary, NOT sufficient)

- **No raw hex** (Inv. 9): the `no-restricted-syntax` ESLint rule fails any hex outside the token layer;
  a vitest self-test (`packages/ui/src/no-raw-hex.test.ts`) proves it fails a planted violation and
  exempts the token layer. The token-snapshot test (`tokens/tokens.test.ts`) asserts the brand is
  `#ED1B24`, navy is gone, and the TS tokens ↔ `tokens.css` agree.
- **`@redex/ui`**: the full kit + app shell + 8 archetype templates + the gallery — **177 unit tests**,
  typecheck clean.
- **a11y (Playwright + axe, WCAG 2a/2aa)**: the gallery (`/dev/ui`) and the re-skinned login (`/`) are
  axe-clean; keyboard-navigable.
- **e2e**: the gallery renders, the persona-density toggle flips `data-density` (layout only), and the
  login is re-skinned (dark canvas, not white).

The automated bar above is what clears the merge. The human side-by-side is a non-blocking polish pass — nice to do, never a blocker.

## Scope note (what D1 did NOT do)

D1 owns the look/components/shell/templates. It did **not** touch the open F4 (#4) or F5 (#5) branches:
their SyncStatus / Forge / sim renderers adopt `@redex/ui` when **they rebase onto the D1-bearing main**
— that adoption is _their_ merge gate (Inv. 9), not D1's. No feature logic (catalog gating, Constellation
states, sim scoring, sign-off, Proof Points economy, capstone walkthrough) lives in D1 — those are M1/F5/M6/G1/C1.

## Sign-off (optional — post-merge polish record, not a merge gate)

| Field       | Value                        |
| ----------- | ---------------------------- |
| Reviewed by | (name)                       |
| Date        | (yyyy-mm-dd)                 |
| Result      | APPROVED / CHANGES REQUESTED |

Notes:
