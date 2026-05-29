/**
 * sim-contracts/zod — barrel export.
 *
 * The runtime (packages/sim-engine `loadSpec`) imports these to validate a sim
 * spec at load against the engine's Zod schema. The JSON Schemas in ../schemas
 * are the published authoring/CI contract; these Zod schemas are the runtime
 * guard and MUST agree with them (CI cross-checks). engine_kind values equal the
 * academy.sim_kind Postgres enum (migrations/0001_init_academy.sql).
 */
export * from "./sim-envelope.zod";
export { BranchingSpec } from "./branching.zod";
export { DeviceConfigSpec } from "./device-config.zod";
export { Interaction2dSpec } from "./interaction-2d.zod";
export { CalculatorSpec, ComputeRef } from "./calculator.zod";

import { z } from "zod";
import { EngineKind } from "./sim-envelope.zod";
import { BranchingSpec } from "./branching.zod";
import { DeviceConfigSpec } from "./device-config.zod";
import { Interaction2dSpec } from "./interaction-2d.zod";
import { CalculatorSpec } from "./calculator.zod";

/**
 * Map an engine_kind to its spec validator. webgl_install (#3) and
 * panel_state_machine (#4) are STUB schemas (expanded in F5/M5 / Phase 2): they
 * validate only the shared envelope here, so the registry returns a permissive
 * guard that checks the envelope is present + well-formed.
 */
const StubEnvelopeOnly = z.object({ envelope: z.object({ engine_kind: EngineKind }).passthrough() }).passthrough();

export const specValidatorByKind = {
  branching_scenario: BranchingSpec,
  device_config: DeviceConfigSpec,
  interaction_2d: Interaction2dSpec,
  calculator: CalculatorSpec,
  webgl_install: StubEnvelopeOnly,
  panel_state_machine: StubEnvelopeOnly,
} as const;

/**
 * Strip top-level `$`-prefixed meta keys ($schema editor hint, $computeContract
 * note) that authors/editors add for tooling but that are not spec data. Engine
 * roots are otherwise strict. (The calculator schema also tolerates
 * $computeContract via passthrough; this keeps all engines uniform at the gate.)
 */
function stripMetaKeys(spec: unknown): unknown {
  if (spec && typeof spec === "object" && !Array.isArray(spec)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(spec as Record<string, unknown>)) {
      if (!k.startsWith("$")) out[k] = v;
    }
    return out;
  }
  return spec;
}

/** Validate an unknown spec by reading its envelope.engine_kind first. */
export function validateSpec(spec: unknown) {
  const clean = stripMetaKeys(spec);
  const kind = (clean as { envelope?: { engine_kind?: string } })?.envelope?.engine_kind;
  const parsed = EngineKind.safeParse(kind);
  if (!parsed.success) {
    throw new Error(
      `spec.envelope.engine_kind is missing or not a valid academy.sim_kind value (got: ${String(kind)})`,
    );
  }
  return specValidatorByKind[parsed.data].parse(clean);
}
