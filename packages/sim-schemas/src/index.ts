// @redex/sim-schemas — JSON Schema + Zod validators for the SIX sim-engine
// declarative specs (CLAUDE.md §6). Authors write specs validated here; they
// never write a runtime. Populated by F5 (engines #1–#2) and F5b (engines #5–#6).
//
// Stub: the engine ids are fixed by the ledger (§E) so consumers can reference
// them before the schemas exist. STOP and surface (do not invent) a schema that
// a goal needs but that has not been authored yet (contract-first, GOALS_INDEX §5).

export const SIM_ENGINE_IDS = [
  'branching', // #1 judgment / customer / egress-fail decision trees
  'device-config', // #2 Partner Portal / panel / OpenEye / DragonFruit static-IP
  'webgl-install', // #3 R3F/Three.js mounting/wiring/egress installs
  'iq-panel', // #4 XState arming/partitions/delays/chime/faults
  'interaction-2d', // #5 drag/label/match/sort/hotspot (MVP-critical)
  'calculator', // #6 PPF/DORI, PoE budget, retention math, "will it hold"
] as const;

export type SimEngineId = (typeof SIM_ENGINE_IDS)[number];
