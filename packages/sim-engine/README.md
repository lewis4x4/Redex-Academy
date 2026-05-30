# @redex/sim-engine — the Forge (engine API consumer contract)

The shared simulation runtime + engines **#1 branching scenario** and **#2 device-config
state machine**. Authors write a declarative **spec** (validated by `@redex/sim-schemas`)
and pick a sanitized **fixture** — they never write a runtime. This file is the **stable
consumer contract** M3/M4/M5/M9/M10 build against (signed off at the F5 `[HUMAN-VERIFY]`
gate — the program's #2 risk bet; a wrong contract here multiplies across every later sim).

## The one entry point

```ts
import { loadSpec, type AnySimInstance } from '@redex/sim-engine';

const sim = loadSpec(spec, opts); // validates spec → engine_kind → SimInstance
```

`loadSpec(spec, opts?)` reads `spec.envelope.engine_kind`, validates against the published
Zod/JSON-Schema contract **before** any render, and returns the matching engine instance.
An invalid spec throws (use `previewSpec`/`isValidSpec` for a non-throwing authoring gate).

`opts: LoadSpecOptions` — `{ locale?, fixture?, telemetrySink?, actor?, context?, genUuid?, now? }`.
`telemetrySink` is where xAPI goes; in the app it is **F4's offline Dexie queue** (default:
in-memory). `genUuid`/`now` are injectable for deterministic tests.

## SimInstance (the surface every engine exposes)

| Member | Meaning |
|---|---|
| `engineKind` / `simId` / `envelope` | identity (`engineKind` is 1:1 with `academy.sim_kind`) |
| `store` | a **vanilla Zustand** store — `useStore(instance.store, sel)` in React |
| `getVerdict()` | the **shared** Verdict (scoring + safety-veto) — never per-engine |
| `isComplete()` | terminal/finalized reached |
| `t(key)` | i18n resolve (EN+ES; the safety glossary is non-overridable) |
| `onTelemetry(cb)` | subscribe to emitted xAPI statements |
| `reset()` | restart the attempt |

**Engine #1 (branching)** adds: `currentNode()`, `choices()`, `choose(edgeId)`.
**Engine #2 (device-config)** adds: `spec`, `setField(id, value)`, `navigate(screenId)`,
`submit()`, `screenImageKey(screenId)`.

## Verdict (mirrors the DB safety rule)

```ts
{ kind: 'pass'|'fail'|'safety_veto', outcome: 'pass'|'fail',
  safety_veto_triggered: boolean,  // → sim_attempts.safety_veto_triggered
  score: { scaled, raw, max }, safety_score, failed: RubricResult[],
  veto_feedback_i18n?, state: ColorblindSafeState }
```

A single **safety-flagged** failure (a wrong safety branch / failed safety assertion) forces
`outcome:'fail'` + `safety_veto_triggered:true`, **non-overridable** — it cannot be outscored.
This is the spec-level mirror of `academy.tg_signoff_compute_outcome` (invariant 1) and lives
in **one** service (`computeVerdict`), so all engines score identically. The local Verdict is
advisory; authoritative mastery is server-side (invariant 4 — never fake a pass offline).

## Telemetry, rendering, fallback

- **xAPI emitter**: every interaction emits an envelope `xapiTelemetryEvent` with a
  `client_event_uuid` (the F4 idempotency key); queued offline, flushed via /sync (LRS = M8).
- **Colorblind-safe**: state is shape + text + color (never color alone) via `StateBadge`.
- **2D fallback** (`mode="fallback2d"`) is a **first-class** path: it drives the same instance,
  so its Verdict/score is identical to the rich renderer by construction.
- **Preview**: `previewSpec(spec)` validates-then-loads (the M9 authoring sandbox).

## Authoring a new sim

Write a spec (`envelope` + the engine's shape), pick a sanitized fixture for replay engines,
and `loadSpec` it. **No runtime code.** A new `engine_kind` is a **migration + typegen** to
`academy.sim_kind` — never a hand-edit (the schema/Zod enum is asserted 1:1 with the DB).

Out of scope (here): engines #3 (M5), #4 full (Phase 2 — stub only), #5/#6 (F5b); real
AC-slice fixtures (M3/M4/S1); the LRS bridge (M8); AI feedback (M10 — F5 only emits the
structured "what was wrong" signal, it never calls an LLM).
