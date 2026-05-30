# F5 — Human Verification Checklist (engine API + JSON-Schema contract sign-off)

> **This is the gate that matters (ledger §J).** F5 is the program's **#2 risk bet**: the
> engine public API + the JSON Schemas are the contract M3/M4/M5/M9/M10 build against. A wrong
> contract here multiplies across every later sim. Adversarial self-verification + green CI are
> **necessary but NOT sufficient** — a human signs this off **before** any consumer builds.
> F5 stays **`pending_human_verification`** (not `done`) until then.

## What to review

- **Engine public API** — `loadSpec(spec, fixtureSet?) → SimInstance` and the `SimInstance`
  surface (see `packages/sim-engine/README.md`). Is this the shape M3/M4/M5/M9/M10 should
  build against? Naming, the Verdict shape, the telemetry/i18n/colorblind contracts.
- **JSON Schemas** — `packages/sim-schemas/schemas/branching.schema.json`,
  `device-config.schema.json`, `fixture-set.schema.json`, and the shared
  `shared/sim-envelope.schema.json`. Correct + complete? The envelope carries the cross-cutting
  contracts (safety-veto, telemetry, colorblind-safe, i18n) so they are uniform across engines.

## Checklist (you, before merge — not agent-self-certified)

- [ ] **Engine API signed off** as the stable consumer contract (the shape is right _before_
      anyone consumes it).
- [ ] **JSON Schemas signed off**: branching, device-config, fixture_set manifest, envelope.
- [ ] **Safety-veto fires for real**: hand-run a safety-flagged failure in _each_ engine
      (branching: choose fail-locked; device-config: set the egress lock fail-locked) and
      confirm it forces `fail` + `safety_veto_triggered` and **cannot be outscored** — and that
      this matches the DB trigger's rule (defense in depth, never simplified).
- [ ] **Both committed examples run** end-to-end (`ac203-egress-fail`, `aero-single-door`),
      emit queued xAPI, and render in **both** rich and 2D fallback with **identical Verdict**.
      (Open `/forge-preview?sim=branching` and `?sim=device-config`, each with `&mode=fallback2d`.)
- [ ] **`engine_kind` matches the enum exactly** — no schema/Zod value that isn't an
      `academy.sim_kind`, and vice versa (a new kind = migration + typegen). Likewise
      fixture `source` ↔ `academy.fixture_source`.
- [ ] **Colorblind-safe / a11y**: every state token has shape + text (not color alone); both
      reference sims pass axe and are keyboard-navigable.
- [ ] **i18n discipline**: all learner-visible strings are `i18nKey`s; EN+ES resolve; the
      safety glossary is non-overridable. (NB: F5 ships **toy** ES translations — real SME
      review of the safety-adjacent strings is M3/M4/S1.)
- [ ] **No LLM call in F5** (AI feedback is M10); **no live device/API** (engine #2 replays a
      sanitized fixture only — `sanitized: true` publish gate).
- [ ] Reviewed the **adversarial-verification report** the ultracode run produced; findings
      addressed.

## Automated status (CI — necessary, NOT sufficient)

- `@redex/sim-schemas` (19 tests): Zod `validateSpec` (valid + invalid + engine_kind drift),
  AJV JSON-Schema validation of both examples + the fixture, the **enum-drift guard** (reads the
  migration: `EngineKind == academy.sim_kind`, `FixtureSource == academy.fixture_source`), and
  the fixture sanitized-gate.
- `@redex/sim-engine` (36 tests): Verdict pass/fail/**veto** (non-overridable), the safe `expr`
  interpreter (rejects non-grammar input — no eval), both reference sims run end-to-end (pass +
  veto paths), telemetry statement shape + `client_event_uuid`, EN+ES i18n coverage, and the
  React renderers (rich + **2D-fallback parity**, colorblind-safe, keyboard).
- `@redex/web` (offline integration): a sim's telemetry **queues into F4's offline Dexie queue**
  keyed by `client_event_uuid`.
- Playwright (`/forge-preview`): both reference sims run, score, and veto in a real browser; 2D
  fallback parity; axe (WCAG 2a/2aa) + keyboard.

None of these substitute for the human sign-off of the API + schemas above.

## Sign-off

| Field       | Value                        |
| ----------- | ---------------------------- |
| Reviewed by | (name)                       |
| Date        | (yyyy-mm-dd)                 |
| Result      | APPROVED / CHANGES REQUESTED |

Notes:
