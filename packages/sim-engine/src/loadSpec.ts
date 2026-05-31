/**
 * loadSpec — THE public entry (F5 §1). Validates an unknown spec against the
 * published contract (reads envelope.engine_kind → the Zod validator → parses
 * BEFORE any render), then instantiates the matching engine. Authoring a new sim
 * is writing a spec; no engine consumer ever writes runtime code.
 */
import {
  type BranchingSpec,
  type CalculatorSpec,
  type DeviceConfigSpec,
  type Interaction2dSpec,
  validateSpec,
} from '@redex/sim-schemas';
import type { LoadSpecOptions } from './api';
import { type BranchingInstance, createBranchingSim } from './engines/branching/core';
import { type DeviceConfigInstance, createDeviceConfigSim } from './engines/device-config/core';
import { type Interaction2dInstance, createInteraction2dSim } from './engines/interaction-2d/core';
import { type CalculatorInstance, createCalculatorSim } from './engines/calculator/core';

export type AnySimInstance =
  | BranchingInstance
  | DeviceConfigInstance
  | Interaction2dInstance
  | CalculatorInstance;

export function loadSpec(spec: unknown, opts: LoadSpecOptions = {}): AnySimInstance {
  const parsed = validateSpec(spec) as { envelope: { engine_kind: string } };
  const kind = parsed.envelope.engine_kind;
  switch (kind) {
    case 'branching_scenario':
      return createBranchingSim(parsed as unknown as BranchingSpec, opts);
    case 'device_config':
      return createDeviceConfigSim(parsed as unknown as DeviceConfigSpec, opts);
    case 'interaction_2d':
      return createInteraction2dSim(parsed as unknown as Interaction2dSpec, opts);
    case 'calculator':
      return createCalculatorSim(parsed as unknown as CalculatorSpec, opts);
    default:
      throw new Error(
        `engine '${kind}' has no F5 runtime (branching_scenario, device_config, ` +
          `interaction_2d, calculator; #3 webgl_install → M5, #4 panel_state_machine → Phase 2)`,
      );
  }
}
