# D1 — Human Verification Checklist (design system vs the prototype)

> **The gate that matters (ledger §J).** D1 is the experience-layer contract: the gallery +
> re-skinned login/shell are reviewed against the approved prototype **before any module builds
> on `@redex/ui`** (it gates M1, M2, M6, M7, M11, G1, C1). Green CI + the adversarial report are
> **necessary but NOT sufficient** — a human compares the rendered system to the prototype look.
> D1 stays **`pending_human_verification`** (not `done`) until this is signed.

## How to review

- **Component gallery:** run the web app and open **`/dev/ui`** — every primitive, every state,
  with a **persona-density toggle** (Field/Marco vs Dense/Priya-Dana) at the top.
- **Re-skinned login:** open **`/`** (logged out) — the dark/red SSO screen (the navy screen is gone).
- **App shell:** the header (brand mark + wordmark + "Mastery, not seat-time" + nav + HUD) wraps every screen.
- Compare side-by-side with **`Redex_Academy_Prototype.html`** (the approved prototype).

## Checklist (you, before merge — not agent-self-certified)

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

None of these substitute for the human side-by-side vs the prototype above.

## Scope note (what D1 did NOT do)

D1 owns the look/components/shell/templates. It did **not** touch the open F4 (#4) or F5 (#5) branches:
their SyncStatus / Forge / sim renderers adopt `@redex/ui` when **they rebase onto the D1-bearing main**
— that adoption is _their_ merge gate (Inv. 9), not D1's. No feature logic (catalog gating, Constellation
states, sim scoring, sign-off, Proof Points economy, capstone walkthrough) lives in D1 — those are M1/F5/M6/G1/C1.

## Sign-off

| Field       | Value                        |
| ----------- | ---------------------------- |
| Reviewed by | (name)                       |
| Date        | (yyyy-mm-dd)                 |
| Result      | APPROVED / CHANGES REQUESTED |

Notes:
