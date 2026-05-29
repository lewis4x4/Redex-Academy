# F5b — Engines #5 (2D-Interaction) & #6 (Calculator) + JSON Schemas

- **Effort tier:** ultracode
- **Phase:** 0 (Foundation)
- **HUMAN-GATE:** engine API additions + JSON Schemas signed off before consumers (M2/M9) build against them (ledger §J).

## Objective
Build the two MVP-critical engines the slice can't run without: **#5 declarative 2D-interaction** (drag/label/match/sort/hotspot — AC-101 "Anatomy of a Door", AC-102 "Spec the Door", ~25–30 courses) and **#6 parametric calculator** (PoE budget, "will it hold" voltage-drop, PPF/DORI, storage-retention — AC-202). Each with a published JSON Schema + Zod, on the F5 shared framework.

## Depends on
- **F5** (the shared framework: engine public API, Verdict service + safety-veto hook, xAPI emitter, offline cache contract, i18n layer, colorblind-safe rendering, 2D primitives, preview harness).

## Consumes (contracts)
- F5's `packages/sim-engine` API + Verdict service; `packages/sim-schemas` conventions; `packages/i18n`; `packages/ui` 2D primitives.
- `academy.sim_definitions`/`sim_attempts`/`sim_telemetry_events` (F2).

## Tasks (ordered)
### Engine #5 — Declarative 2D-interaction
1. Author the **2D-interaction JSON Schema + Zod** in `packages/sim-schemas`. Support the interaction kinds the slice needs: **drag-label** (place labels onto regions of a diagram — AC-101 anatomy-of-a-door), **match/spec** (match items across columns: credential ↔ reader-protocol ↔ lock-family ↔ fail-state — AC-102 "Spec the Door"), **sort/order** (order the access-event sequence — AC-101), and **hotspot** (tap the correct region — e.g., "tap the side that must always allow free egress"). Schema fields: a `background` (image R2 key or schematic), `targets`/`regions`, `items`, the `correctMapping`, per-item **`feedback`** (one-line "why that's wrong"), per-item §5.4 dimension tag + optional `safety_flag` (AC-102 fail-safe/fail-locked items are safety-adjacent → ≥90% per ledger §C), and i18n keys throughout.
2. Build the **2D-interaction engine** runtime on the F5 framework: render the schematic + interactive primitives (drag, match, sort, hotspot), evaluate via the **shared Verdict service** (so scoring/feedback/veto wording is identical to other engines), emit xAPI, queue offline. High-contrast, gloved/one-handed-friendly, keyboard-navigable, colorblind-safe.

### Engine #6 — Parametric calculator
3. Author the **calculator JSON Schema + Zod**: declarative `inputs` (typed, with units, ranges, defaults), `formula`/`computeRef` (named deterministic computations: **PoE power-budget**, **voltage-drop / "will it hold"** for a mag-lock home-run, **PPF/DORI** pixel-density, **storage-retention**), `thresholds` (pass/warn/fail bands), per-threshold §5.4 dimension tag + optional `safety_flag`, and a **visual meter** spec (a budget meter "you can blow"; e.g., AC-202 shows a mag lock chattering when the run is under-spec). All formulas are **deterministic and unit-checked**; no LLM in the compute path.
4. Build the **calculator engine** runtime: render inputs + the live meter, run the deterministic computation, evaluate thresholds via the Verdict service, emit xAPI. Colorblind-safe meter (shape + numeric value + color, never color alone).

### Shared
5. Extend the F5 preview harness to render both new engine kinds; validate specs against schema + Zod before load.
6. Register both new `sim_definition.kind` values (`two_d_interaction`, `calculator`) consistently with F2's enum (if the enum must change, that is a migration + typegen — surface it; do not hand-edit types).

## Done-criteria (testable)
- `packages/sim-schemas` publishes the **2D-interaction** and **calculator** JSON Schemas + Zod; invalid specs fail with clear errors.
- A **reference 2D-interaction sim** (toy drag-label + a match + a hotspot) and a **reference calculator sim** (a PoE-budget or voltage-drop toy) run end-to-end in the preview harness, score via Verdict, and emit queued xAPI.
- **Safety-adjacent threshold test:** a calculator/2D spec with a `safety_flag` routes through the safety-veto behavior and applies the ≥90% bar on safety items (ledger §C).
- **Determinism test:** the calculator computations are pure — same inputs → same output, unit-checked, no network/LLM call.
- a11y: both engines keyboard-navigable, colorblind-safe (no color-only state), WCAG AA.
- `[HUMAN-VERIFY]` schema + API additions reviewed before M2/M9 consume them.

## Out of scope
- AC-slice content authoring (M2 authors the real AC-101/102/202 specs; F5b ships toy fixtures).
- 3D/WebGL (M5), branching/device-config (F5), virtual IQ panel (Phase 2).
- AI elaboration of feedback (M10).

## Invariants in play
- Inv. 1 (safety-veto via shared Verdict; ≥90% safety-item bar per ledger §C).
- Inv. 4 (offline telemetry keyed on `client_event_uuid`).
- Inv. 5 (contract-first — schemas before consumers; reuse F5's framework, do not fork the Verdict service).
- Inv. 7 (colorblind-safe; keyboard-navigable; WCAG AA).

## Tests required
- **Unit:** schema/Zod validation; Verdict scoring for 2D mappings; deterministic calculator computations + threshold banding; safety-flag veto.
- **e2e (Playwright):** reference 2D + calculator sims run, score, emit.
- **a11y:** axe + keyboard path on both reference sims.
- **offline:** telemetry queues + reconciles.
