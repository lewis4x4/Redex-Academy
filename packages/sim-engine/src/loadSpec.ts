/**
 * loadSpec — THE public entry (F5 §1). Validates an unknown spec against the
 * published contract (reads envelope.engine_kind → the Zod validator → parses
 * BEFORE any render), then instantiates the matching engine. Authoring a new sim
 * is writing a spec; no engine consumer ever writes runtime code.
 */
import { type BranchingSpec, type DeviceConfigSpec, validateSpec } from '@redex/sim-schemas';
import type { LoadSpecOptions } from './api';
import { type BranchingInstance, createBranchingSim } from './engines/branching/core';
import { type DeviceConfigInstance, createDeviceConfigSim } from './engines/device-config/core';

export type AnySimInstance = BranchingInstance | DeviceConfigInstance;

export function loadSpec(spec: unknown, opts: LoadSpecOptions = {}): AnySimInstance {
  const parsed = validateSpec(spec) as { envelope: { engine_kind: string } };
  const kind = parsed.envelope.engine_kind;
  switch (kind) {
    case 'branching_scenario':
      return createBranchingSim(parsed as unknown as BranchingSpec, opts);
    case 'device_config':
      return createDeviceConfigSim(parsed as unknown as DeviceConfigSpec, opts);
    default:
      throw new Error(
        `engine '${kind}' has no F5 runtime (branching_scenario + device_config only; ` +
          `#3 webgl_install → M5, #4 panel_state_machine → Phase 2, #5/#6 → F5b)`,
      );
  }
}
