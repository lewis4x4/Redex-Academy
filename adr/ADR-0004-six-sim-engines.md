# ADR-0004 — Six declarative sim engines + a spec-authoring model

**Status:** Accepted

## Context

The curriculum's §0/§7 mandate ("slides-and-quiz is banned"; "real hardware by name"; "branching for judgment") makes **simulations the core product surface** across 77 courses — far too many to hand-code bespoke per sim. Two source taxonomies disagreed: wave3 §5 described **four** sim archetypes/engines ("4 data shapes"), while the experience-design work described "Forge/archetypes." The Wave 4 review reconciled the conflict and found the four-engine list **missed two MVP-critical engine types**: a 2D-interaction engine (drag/label/match/sort/hotspot — needed by AC-101/AC-102 and ~25–30 courses) and a parametric calculator engine (PPF/DORI, PoE power budget, storage-retention "will it hold"). (ledger §E; wave3 §5.)

## Decision

Build **SIX** reusable, declarative engines (this supersedes the wave3 "4 data shapes" and the experience-design "archetypes"):

1. **Branching scenario engine** — judgment / customer / egress-fail decision trees.
2. **Device-config state-machine engine** — Alarm.com Partner Portal, panel programming, OpenEye, DragonFruit static-IP.
3. **WebGL 3D install engine** (R3F/Three.js) — mounting/wiring/egress installs. **Rapier physics deferred from MVP.**
4. **Virtual IQ-panel state machine** (XState) — arming/partitions/delays/chime/faults.
5. **Declarative 2D-interaction engine** — drag/label/match/sort/hotspot. **MVP-critical.**
6. **Parametric calculator engine** — PPF/DORI, PoE power budget, storage-retention math.

**Authoring model:** authors write a **declarative JSON spec** validated by a **published JSON Schema + Zod** (in `packages/sim-schemas`) and choose a **sanitized fixture set** — **they never write a new runtime.** Every engine shares the **xAPI telemetry emitter**, the **scoring / safety-veto Verdict hook**, the **offline cache contract**, the **i18n string layer**, and **colorblind-safe state rendering** (never color alone for pass/fail). "The Forge" is the umbrella name for engine #3 + the shared sim framework. Goal **F5** builds engines #1–#2 + the framework; **F5b** builds engines #5–#6 + their schemas.

## Consequences

- A 77-course catalog (and ongoing platform-change updates) becomes **content work, not code work** — engineering owns *engines, schemas, and the few genuinely novel sims*; Curriculum owns the courses.
- The reusable runtime being genuinely usable by non-engineers is **risk bet #2** — mitigated by proving one device-config sim + one WebGL install sim + the authoring schema/preview harness early, and by *ruthlessly resisting bespoke per-sim code*.
- The engine API + JSON Schemas are a **contract with a human sign-off gate (F5)** before any consumer (M3–M5/M9) builds against them; a missing contract means **STOP and surface**, never invent.
- Deferring Rapier physics keeps the WebGL engine within a **mobile performance budget** (LOD, lazy load, Draco) — these sims must run on a tech's phone.
