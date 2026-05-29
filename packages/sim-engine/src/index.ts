// @redex/sim-engine — the Forge runtime + shared Verdict/scoring/safety-veto
// hook, xAPI telemetry emitter, offline cache contract, and i18n string layer
// (CLAUDE.md §6). Built in F5 (framework + engines #1/#2) and F5b (#5/#6).
//
// This stub fixes the Verdict shape (CODING_STANDARDS.md §1) so consumers can
// type against it now. The deterministic scoring + safety-veto computation are
// SERVER-AUTHORITATIVE (CLAUDE.md invariants §5.1 / §5.3 / §5.5) — added in
// F5 / M6 and never computed on the client or offline. AI only *explains* a
// Verdict; it never decides pass/fail.

export type Verdict =
  | { kind: 'pass' }
  | { kind: 'fail'; reasons: string[] }
  | { kind: 'safety_veto'; lineItemKey: string };

/** Marker that the runtime has not been implemented yet (F5/F5b). */
export const FORGE_RUNTIME_READY = false;
