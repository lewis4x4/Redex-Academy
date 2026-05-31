# F5 — Dry-Run: Expected Output & Human-Verify Checklist

A known-good target for your first **ultracode** run. Read this before running `/goal F5`, then check the result against §4–§6. If anything in §6 (Red Flags) appears, reject the run and re-prompt.

- **Goal:** build the **shared sim framework** ("the Forge" umbrella, ledger §E) — the engine public API, the **Verdict service** (scoring + safety-veto hook + feedback wording), the **shared xAPI telemetry emitter** (queued offline, flushed via F4), the i18n string layer, colorblind-safe rendering, the 2D picture-book fallback renderer, and the preview/sandbox harness — plus the **first two declarative engines: #1 branching scenario and #2 device-config state machine**, each with its published **JSON Schema + Zod** spec validated against the committed contracts. This is the program's **#2 risk bet**.
- **Tier:** ultracode (xhigh + dynamic workflow + adversarial verification). **Pair with auto mode.**
- **Depends on:** **F2** merged (`sim_definitions.spec` jsonb, `sim_attempts` incl. `safety_veto_triggered`, `sim_telemetry_events` with `UNIQUE(client_event_uuid)`, `fixture_sets`, generated types). The **sim-contracts** in `sim-contracts/` are the authoritative interface to mirror into `packages/sim-schemas`. F4's offline cache + event-queue contract is consumed (telemetry queues offline).
- **Human gate:** the **engine public API + the JSON Schemas are signed off by a human** before any consumer (M3/M4/M5/M9/M10) builds against them (ledger §J). Adversarial self-verification does NOT substitute.

---

## 1. The `/goal` invocation to give Claude Code
> Run goal F5 per `goals/F5.md`. The spec contracts already exist in `sim-contracts/` — **mirror them into `packages/sim-schemas`, do not redesign them.** The shared envelope is `shared/sim-envelope.schema.json` (+ `zod/sim-envelope.zod.ts`); engine #1 is `schemas/branching.schema.json` (+ `zod/branching.zod.ts`), engine #2 is `schemas/device-config.schema.json` (+ `zod/device-config.zod.ts`); the load-time gate is `validateSpec()` / `specValidatorByKind` in `zod/index.ts`. **`engine_kind` MUST equal an `academy.sim_kind` enum value 1:1** (`branching_scenario`, `device_config`, …) — never drift one side. The **safety-veto hook lives in the envelope** (`$defs/safetyVetoHook`, `veto_on_any_safety_failure: true`) and is the spec-level mirror of the DB trigger `academy.tg_signoff_compute_outcome` — the Verdict service reads it; **never weaken it**. Telemetry events carry **`client_event_uuid`** and queue offline via F4. The worked examples `examples/ac203-egress-fail.branching.json` and `examples/aero-single-door.device-config.json` are the references that must run. Out of scope: engines #5/#6 (**F5b**), engine #4 full build (Phase 2 — stub only), engine #3 WebGL (**M5**), real AC-slice fixtures (**M3/M4/S1** — F5 ships toy fixtures), the LRS bridge (**M8**), AI feedback (**M10** — F5 emits the structured "what was wrong" signal, it does NOT call an LLM), and Rapier physics (deferred).

## 2. Expected repo changes (the file tree F5 should produce)
```
packages/sim-schemas/                 # = sim-contracts, mirrored + published
  shared/sim-envelope.schema.json     # the shared envelope (engineKind, safetyVetoHook, xapiTelemetryEvent, colorblindSafeState)
  schemas/branching.schema.json       # engine #1 spec (nodes/edges, safety_flag edges, post-mortem replay, verdictRubric)
  schemas/device-config.schema.json   # engine #2 spec (screens/fields/stateSpace, assertion_rules w/ safety_flag, fixtureSetRef)
  schemas/fixture-set.schema.json     # the R2 fixture_set manifest (version, source enum, ordered screens, sanitized:true gate)
  schemas/webgl-install.schema.json   # #3 STUB (envelope only — expanded M5)
  schemas/panel-state.schema.json     # #4 STUB (envelope only — Phase 2)
  zod/  index.ts (validateSpec + specValidatorByKind) sim-envelope.zod.ts branching.zod.ts device-config.zod.ts
packages/sim-engine/                  # the shared framework — built ONCE, used by all engines
  src/api.ts                          # public API: loadSpec(spec, fixtureSet?) → SimInstance; SimInstance exposes
                                      #   Zustand state, interaction primitives, getVerdict(), telemetry subscription, i18n resolver — the consumer contract
  src/verdict/                        # Verdict service: scoring math + safety-veto hook (0 on a safety check ⇒ veto/fail, mirrors DB)
                                      #   + feedback wording (instant/specific/diagnostic — names consequence + fix)
  src/telemetry/                      # shared xAPI emitter (actor/verb/object/result/context + client_event_uuid); queue offline (Dexie) + flush via F4
  src/i18n/                           # all sim strings keyed (EN+ES); safety glossary NON-overridable
  src/colorblind/                     # state = shape + text + color (never color alone); pass/fail/warn/safety_veto tokens
  src/fallback-2d/                    # 2D picture-book renderer primitives (same drag targets + same Verdict/score)
  src/preview/                        # preview/sandbox harness: validateSpec() before load; renders any valid spec (M9 authoring uses it)
  src/engines/branching/             # engine #1 runtime (React tree over the graph) — Verdict+telemetry+i18n+colorblind-safe + 2D layout
  src/engines/device-config/         # engine #2 runtime (rules over a sanitized fixture replay — faithful replica, NEVER a live API)
  src/engines/panel-state.stub.ts    # #4 placeholder export (API surface reserved; Phase 2)
packages/ui/                          # high-contrast schematic primitives shared by the 2D fallback
examples/ (or packages/sim-engine/fixtures/)  # toy fixtures + the two reference specs running end-to-end
e2e/ + tests/                         # see §3
packages/db-types/database.types.ts   # imported (no schema change expected); committed in sync
```
Nothing else. Engines are **declarative-spec interpreters** — authors write specs + pick fixtures, they never write a runtime.

## 3. Commands it should run
```bash
pnpm build                 # turbo build sim-schemas + sim-engine + ui
pnpm typecheck && pnpm lint
pnpm test                  # unit: JSON-Schema/Zod validation (valid + INVALID specs);
                           #   Verdict scoring + safety-veto pass/fail/veto; xAPI statement shape
pnpm test:e2e              # Playwright: reference branching + device-config sims run, score, emit; 2D-fallback parity
pnpm test:a11y             # axe + keyboard path on both reference sims; no color-only state assertion
# offline: telemetry queues offline + reconciles (uses F4's harness)
# validate the committed examples against the published schemas + validateSpec()
node/ts: validateSpec(require('examples/ac203-egress-fail.branching.json'))
node/ts: validateSpec(require('examples/aero-single-door.device-config.json'))
```

## 4. Expected RESULT signals (acceptance evidence)
- `packages/sim-schemas` publishes the **branching**, **device-config**, and **fixture_set manifest** JSON Schemas + Zod; **invalid specs fail validation with clear errors** (the preview harness surfaces them).
- The **engine public API** (`loadSpec → SimInstance` with state/primitives/`getVerdict()`/telemetry/i18n) + **Verdict** + **xAPI emitter** + **offline cache** + **i18n** + **colorblind-safe rendering** all exist in `packages/sim-engine` and are **documented as the consumer contract**.
- **`engine_kind` ↔ `academy.sim_kind` is exact 1:1** — the envelope's `engineKind` enum and the Zod `EngineKind` list **only** the six (`branching_scenario`, `device_config`, `webgl_install`, `panel_state_machine`, `interaction_2d`, `calculator`); `validateSpec()` reads `envelope.engine_kind`, picks the validator from `specValidatorByKind`, and parses **before** any render.
- **Verdict / safety-veto tests:** a spec with a **safety-flagged** wrong branch/assertion triggers a **veto → `fail`** and sets `sim_attempts.safety_veto_triggered = true` (via `result.extensions[...safety_veto_triggered]`); pass/fail/veto paths all covered. This mirrors "a single safety `0` ⇒ fail" in the DB — `veto_on_any_safety_failure: true`, non-overridable.
- The two **reference sims run end-to-end** in the preview harness: `ac203-egress-fail.branching.json` (mag-lock egress → REX → fire interface; wrong safety choices are `safety_flag` edges to a **trapped-occupants** terminal with the **post-mortem replay** overlaying the NFPA 101 §7.2.1.6.2 line) and `aero-single-door.device-config.json` (ADC-AC Aero/Mercury commission; `assertion_rules` check fail-safe egress, REX/DPS not swapped, relay switches not powers, cloud-verified; points at sanitized `fixture:adc-aero-x1100-create-customer-v3`).
- Both render in **rich AND 2D fallback** modes, and the **2D fallback produces the same Verdict/score** as the rich renderer for the same input.
- **Telemetry carries `client_event_uuid`** and **queues offline** (verified with F4's harness); the emitter constructs `$defs/xapiTelemetryEvent` statements (LRS bridge is M8 — F5 only emits + queues).
- The **#4 (panel_state_machine) placeholder export** exists (API surface reserved); `validateSpec` returns the permissive envelope-only guard for #3/#4 stubs.

## 5. HUMAN-VERIFY checklist (a qualified reviewer, before release — not agent-self-certified)
- [ ] **Engine public API reviewed & signed off** as the stable consumer contract — `loadSpec(spec, fixtureSet?) → SimInstance` and the `SimInstance` surface are what M3/M4/M5/M9/M10 will build against; the shape is right *before* anyone consumes it (ledger §J — this is the #2 risk bet).
- [ ] **JSON Schemas reviewed & signed off:** branching, device-config, and the fixture_set manifest are correct and complete; the **shared envelope** carries the cross-cutting contracts (safety-veto, telemetry, colorblind-safe, i18n) so they're uniform across engines.
- [ ] **Safety-veto fires for real:** hand-run a safety-flagged failure in each engine and confirm it forces `fail` + `safety_veto_triggered` and **cannot be outscored** — and that this matches the DB trigger's rule (defense in depth, never simplified).
- [ ] **The two committed examples run** (`ac203-egress-fail`, `aero-single-door`) end-to-end, emit queued xAPI, and render in **both** rich and 2D fallback with **identical Verdict/score**.
- [ ] **`engine_kind` matches the enum exactly** — no value exists in a schema/Zod that isn't an `academy.sim_kind`, and vice versa (any new kind = a migration + typegen, not a hand-edit).
- [ ] **Colorblind-safe / a11y:** every state token has shape + text (not color alone); both reference sims pass axe and are keyboard-navigable.
- [ ] **i18n discipline:** all learner-visible strings are `i18nKey`s; EN+ES resolve; the **safety glossary is non-overridable**.
- [ ] **No LLM call in F5** (the AI feedback elaboration is M10 — F5 only exposes the structured "what was wrong" signal); **no live device/API** (engine #2 replays a sanitized fixture only).
- [ ] Reviewed the **adversarial-verification report** the ultracode run produced; its findings are addressed.

## 6. RED FLAGS — reject the run if you see any of these
- The agent **redesigned the spec schemas** (renamed fields, changed the envelope, added/removed engine kinds) instead of mirroring `sim-contracts/` — these are a published contract (Inv. 5).
- **`engine_kind` drift:** a schema/Zod value that is **not** an `academy.sim_kind` enum value (or an enum value with no schema), instead of the exact 1:1 list — silently breaks `sim_definitions.kind` and `validateSpec`'s registry.
- The **safety-veto reimplemented per-engine** or weakened (e.g. made outscoreable, or `veto_on_any_safety_failure` defaulted to false for safety-gated content) instead of read from the **shared envelope hook** by the single Verdict service — it must mirror the DB trigger.
- **Verdict/scoring logic duplicated** inside the branching and device-config engines instead of one shared service — divergent verdicts across engines.
- Telemetry emitted **without `client_event_uuid`**, or not queued offline / not flushable via F4 — breaks idempotent sync (Inv. 4).
- The **2D fallback treated as a degraded mode** that produces a different score, instead of a first-class path with identical Verdict.
- State conveyed by **color alone** (no shape + text); or sims not keyboard-navigable (Inv. 7 / WCAG AA).
- The device-config engine hits a **live API** or an **unsanitized fixture** instead of a faithful **sanitized recorded replica** (`sanitized: true` publish gate — Inv. 6).
- F5 **calls an LLM** (that's M10) or tries to build engine #5/#6 (F5b), #3 WebGL (M5), or full #4 (Phase 2) — scope creep.
- `database.types.ts` hand-edited / not committed; or any real secret value written into a file.

## 7. Definition of Done (the merge gate)
All §4 signals present · all §5 human checks ticked · the **engine API + JSON Schemas signed off** before any consumer builds (ledger §J) · invalid-spec rejection proven · Verdict safety-veto pass/fail/veto tests green · both reference sims run with rich+2D parity · telemetry queues offline (F4 harness) · `typecheck`/`lint`/`build`/`test`/`test:e2e`/`test:a11y` green · types committed · `GOALS_INDEX` status for F5 → done. F5 gates **M3/M4/M5/M10**; F5b (engines #5/#6) builds on this framework next.

---
*Known nit to enforce during the run: F5 ships **toy fixtures only** — the real AC-slice content/fixtures are M3/M4/S1. The committed `examples/` specs encode real curriculum but the engine framework, not the slice content, is what F5 delivers. #3 and #4 are STUB schemas (envelope-only) so consumers + the 2D fallback can target them now; their interaction models expand in M5 / Phase 2.*
