# Redex Academy — Simulation Spec Contracts

This directory is the **contract-first interface** for Redex Academy's simulation
engines. It fixes the declarative JSON spec that each engine consumes, so:

- **F5 / F5b** build runtimes *against a stable contract* (Inv. 5 — schemas
  published before consumers), and
- **SME content authors** start writing & validating sims **without engineering**
  (ledger §E: *"Authors write specs + choose fixtures; they never write a new
  runtime."*).

Every artifact here is published; nothing is illustrative-only except the one
clearly-marked synthetic fixture. All JSON validates; all schemas are valid **JSON
Schema draft 2020-12**; the Zod mirrors typecheck under `strict` and agree with the
JSON Schemas (a CI cross-check enforces this).

```
sim-contracts/
├── shared/sim-envelope.schema.json     the COMMON envelope every spec embeds
├── schemas/                            one JSON Schema per engine
│   ├── branching.schema.json           #1 branching scenario
│   ├── device-config.schema.json       #2 device-config state machine
│   ├── interaction-2d.schema.json      #5 declarative 2D interaction
│   ├── calculator.schema.json          #6 parametric calculator
│   ├── webgl-install.schema.json       #3 WebGL 3D install   (STUB — expanded F5/M5)
│   └── panel-state.schema.json         #4 virtual IQ panel    (STUB — Phase 2)
├── zod/                                Zod runtime validators (loadSpec uses these)
│   ├── sim-envelope.zod.ts  branching.zod.ts  device-config.zod.ts
│   ├── interaction-2d.zod.ts  calculator.zod.ts  index.ts (validateSpec + registry)
├── examples/                           real worked specs (the authoring reference)
│   ├── ac203-egress-fail.branching.json
│   ├── aero-single-door.device-config.json
│   ├── failsafe-vs-faillocked.interaction-2d.json
│   ├── poe-budget.calculator.json
│   └── fixtures/iq-panel.sample.json   ONE synthetic, sanitized fixture (pipeline contract)
└── README.md
```

## The six engines (ledger §E — authoritative)

The wave3 "4 data shapes" and the experience-design "Forge archetypes" reconcile
into **six** engines. Each is a *declarative JSON spec* validated by a published
JSON Schema **+** Zod, running on one shared framework ("The Forge" is the umbrella
name for engine #3 + that shared framework).

| # | Engine | `engine_kind` | Schema | Built in |
|---|--------|---------------|--------|----------|
| 1 | Branching scenario (judgment / customer / egress-fail) | `branching_scenario` | `branching.schema.json` | **F5** |
| 2 | Device-config state machine (Partner Portal, Mercury, OpenEye, DragonFruit) | `device_config` | `device-config.schema.json` | **F5** |
| 3 | WebGL 3D install (R3F/Three.js; Rapier deferred) | `webgl_install` | `webgl-install.schema.json` *(STUB)* | M5 |
| 4 | Virtual IQ-panel state machine (XState) | `panel_state_machine` | `panel-state.schema.json` *(STUB)* | Phase 2 |
| 5 | Declarative 2D-interaction (drag/label/match/sort/hotspot) | `interaction_2d` | `interaction-2d.schema.json` | **F5b** |
| 6 | Parametric calculator (PPF/DORI, PoE budget, retention, "will it hold") | `calculator` | `calculator.schema.json` | **F5b** |

## `engine_kind` ↔ `academy.sim_kind` enum mapping (reconciled — exact)

`engine_kind` in every spec **MUST** equal a value of the Postgres enum
`academy.sim_kind` defined in `migrations/0001_init_academy.sql` (the column
`academy.sim_definitions.kind`). They are **identical, 1:1** — no renaming, no
superset/subset gap:

| spec `engine_kind` | `academy.sim_kind` value | status |
|--------------------|--------------------------|--------|
| `branching_scenario` | `branching_scenario` | ✅ match |
| `device_config` | `device_config` | ✅ match |
| `webgl_install` | `webgl_install` | ✅ match |
| `panel_state_machine` | `panel_state_machine` | ✅ match |
| `interaction_2d` | `interaction_2d` | ✅ match |
| `calculator` | `calculator` | ✅ match |

The enum is the single source of truth. If a new engine kind is ever needed, it is
a **migration + typegen** (F5b §6), then this enum is updated here — never
hand-drift one side. The shared envelope's `engineKind` `$def` and the Zod
`EngineKind` both list exactly these six.

## The shared envelope (`shared/sim-envelope.schema.json`)

Every engine spec embeds one `envelope` object via `$ref`. It carries the
**cross-cutting contracts** so they behave identically across all six engines and
stay translatable:

1. **Identity + engine kind** — `sim_id` + `spec_version` map to
   `sim_definitions(key, version)`; `engine_kind` pins the runtime;
   `competency_ids` map to `sim_definitions.competency_ids[]`.
2. **i18n string-key layer** — every learner-visible string is an `i18nKey`
   (`sim.<sim_id>.<scope>.<name>`), never raw text. `i18n_string_keys` is the
   translation surface CI checks resolves in every declared locale (EN mandatory,
   ES is the MVP second locale; the safety glossary subset is non-overridable).
3. **xAPI telemetry event contract** (`$defs/xapiTelemetryEvent`) — actor / verb /
   object / result / context, plus **`client_event_uuid`** (the idempotency key,
   ledger §G). It maps onto `academy.sim_telemetry_events`:
   `client_event_uuid → client_event_uuid` (UNIQUE; `/sync` is `ON CONFLICT DO
   NOTHING`), the statement → `payload` jsonb, `verb.id`+`object.id` → `event_type`;
   and `result.extensions[safety_veto_triggered] → sim_attempts.safety_veto_triggered`.
   The shared emitter queues these offline (Dexie) and flushes via F4; the LRS
   bridge is M8. Local `result.success` is advisory — **mastery is server-authoritative
   (Inv. 4 — never fake a pass offline).**
4. **Scoring + safety-veto hook** (`$defs/safetyVetoHook`) — how a sim reports a
   safety-critical failure that **must block a pass**. It is the spec-level mirror
   of the DB trigger `academy.tg_signoff_compute_outcome` (ledger §B / Inv. 1):
   `veto_on_any_safety_failure: true` means a **single** safety-flagged failure
   forces `fail` + `safety_veto_triggered`, non-overridable — exactly as a single
   safety `0` forces fail in the sign-off rubric. `safety_pass_threshold` defaults
   to **0.90** (ledger §C: safety/egress/compliance gate at ≥90%); non-safety
   `pass_threshold` defaults to **0.80**. The shared **Verdict** service reads this
   block so scoring + veto + feedback wording are one implementation.
5. **Colorblind-safe state contract** (`$defs/colorblindSafeState`) — Inv. 7. Every
   state token (`pass`/`fail`/`warn`/`safety_veto`/…) carries a redundant **`shape`**
   (check/cross/triangle/octagon) **+ text `label_i18n`**; `color_role` is advisory.
   State is **never** conveyed by color alone (a grayscale-print or colorblind
   learner reads the same verdict). The calculator meter additionally forces
   `show_numeric_value: true`.

**How the safety-veto + telemetry + colorblind contracts stay uniform:** they live
**only** in the envelope. Engine schemas embed the envelope and add only their own
interaction model (nodes/edges, screens/rules, items, inputs/thresholds). An engine
expresses "this is a safety-critical failure" with a single boolean — `safety_flag`
— on the relevant element (a branching edge, a device assertion rule, a 2D item, a
calculator threshold). The schemas enforce a consistency rule: **a `safety_flag`
element must score into the `safety_compliance` dimension** (and a `safety_flag`
branching edge must be an `is_safety_decision`), so the ≥90% bar and the veto path
engage the same way everywhere. The Verdict service does the rest.

## The worked examples (real AC-/VID content)

These are not toys — they encode real curriculum (Course Bible AC-201/203,
AC-304, VID-202) and are the canonical reference an SME copies from.

- **`ac203-egress-fail.branching.json`** — the AC-203 flagship safety sim. The
  learner commissions a mag-lock egress door (fail-state → REX → fire interface);
  each wrong safety choice is a `safety_flag` edge leading to a **trapped-occupants**
  terminal (`safety_veto: true` → forces fail). Every terminal carries the
  **post-mortem replay** (freeze at the trap, overlay the deciding choice + the
  NFPA 101 §7.2.1.6.2 line, drop back to the deciding node). Three safety lines map
  to `ac.203.releases_on_power_loss / push_to_exit_present_30s / releases_on_fire_alarm`.
- **`failsafe-vs-faillocked.interaction-2d.json`** — the AC-304 decider. A `match`
  item maps **GL1-FSM roll-up → fail-locked**, **1200s scissor-gate mag lock →
  fail-safe**, **man-door → fail-safe**; a `hotspot` makes the learner identify the
  compliant egress man-door. Both items are `safety_flag` (the door's egress role
  decides the fail-state — getting it wrong traps people), so they apply the ≥90%
  bar + veto.
- **`poe-budget.calculator.json`** — the VID-202 "Blow the Budget" power calc.
  `compute_ref: poe_power_budget` references a deterministic, unit-checked formula
  using the **real IEEE wattages**: 802.3af/Type 1 15.4 W PSE / 12.95 W PD; at/Type 2
  30 / 25.5; bt/Type 3 60 / 51; bt/Type 4 90 / 71.3 (the `$computeContract` note pins
  them + a worked example). Pass/warn/fail bands key on headroom; the colorblind-safe
  meter shows the numeric value + shape markers.
- **`aero-single-door.device-config.json`** — a single-door **ADC-AC Aero / Mercury**
  commission. `screens` + `fields` declare the state space; `assertion_rules` check
  the fail-safe egress fail-state (`safety_flag`), REX/DPS terminals not swapped, the
  relay *switches* (not powers) the lock, and the door is verified in the cloud.
  Points at a sanitized fixture (`fixture:adc-aero-x1100-create-customer-v3`).
- **`fixtures/iq-panel.sample.json`** — **SYNTHETIC, sanitized** (`synthetic: true`,
  `sanitized: true`). NOT a real recording — it establishes the fixture_set R2
  manifest contract (ordered screens, image R2 keys, hotspots, field maps) the replay
  engines (#2, #4) consume. `sanitized: true` is the publish gate the DB trigger
  `tg_block_unsanitized_fixture` enforces.

## How F5 / F5b implement runtimes against these schemas

1. **Publish** these JSON Schemas + Zod in `packages/sim-schemas` (this directory is
   the source of truth that package mirrors).
2. The shared framework (`packages/sim-engine`) implements `loadSpec(spec,
   fixtureSet?)`: it calls **`validateSpec(spec)`** (`zod/index.ts`) — which reads
   `envelope.engine_kind`, picks the matching validator, and parses — *before* any
   render. Invalid specs fail with clear errors (the preview/sandbox harness shows
   them to authors).
3. The framework owns the **Verdict service** (reads `envelope.scoring`), the **xAPI
   emitter** (constructs `$defs/xapiTelemetryEvent`, queues offline, flushes via F4),
   the **i18n resolver**, and **colorblind-safe rendering** (reads the state tokens).
   Engines never re-implement these.
4. Each engine runtime interprets only its own model: F5 builds #1 (graph walk) and
   #2 (rules-over-fixture-replay); F5b builds #5 (2D primitives) and #6 (deterministic
   compute over `compute_ref`). #3 and #4 are STUB schemas — they already carry the
   envelope so consumers + the 2D picture-book fallback can target them now; their
   interaction models are **expanded in F5/M5 (3D scene)** and **Phase 2 (XState
   chart)**.

## How SME authors write & validate a spec

1. Copy the closest example from `examples/` and change the content.
2. Replace all display text with `i18nKey`s and add the EN (+ ES) strings to
   `packages/i18n`; list every key in `envelope.i18n_string_keys`.
3. Set `envelope.engine_kind` to the right value (must be one of the six = an
   `academy.sim_kind` value) and list the `competency_ids` graded.
4. Mark safety-critical elements with `safety_flag: true` (and, for branching, the
   choice's `is_safety_decision: true`) and score them into `safety_compliance`.
   Write the `*_feedback_i18n` so it names the real-world consequence + the fix.
5. For replay engines, pick a **sanitized** fixture set (`fixture_set_ref`).
6. Validate: the spec must pass both the JSON Schema (CI / editor `$schema` hint) and
   `validateSpec` in the preview harness before it can be saved to
   `sim_definitions.spec`. No runtime code is written.

> **Human gate:** the engine public API + these JSON Schemas are signed off by a
> human before any consumer (M2/M3/M4/M5/M9/M10) builds against them (ledger §J,
> F5/F5b HUMAN-GATE). This is the program's #2 risk bet.
