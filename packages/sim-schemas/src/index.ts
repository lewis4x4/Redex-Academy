// @redex/sim-schemas — the PUBLISHED sim-engine spec contracts (F5).
//
// This package is the mirror + published home of the sim-contracts: the shared
// envelope, the per-engine JSON Schemas, and their Zod runtime mirrors. The
// runtime (@redex/sim-engine `loadSpec`) imports `validateSpec` from here to gate
// a spec at load; authoring/CI uses the JSON Schemas. The two MUST agree
// (src/schemas.test.ts cross-checks). engine_kind values are 1:1 with the
// academy.sim_kind Postgres enum — never hand-drift (CLAUDE.md §6, ledger §E).

// Runtime (Zod) contract + validateSpec / specValidatorByKind.
export * from '../zod/index';

// The committed worked-example specs + toy fixtures (the F5 references that run).
export * from './examples';

// The published JSON Schemas (the authoring/CI contract), keyed by short name.
import simEnvelopeSchema from '../shared/sim-envelope.schema.json';
import branchingSchema from '../schemas/branching.schema.json';
import deviceConfigSchema from '../schemas/device-config.schema.json';
import fixtureSetSchema from '../schemas/fixture-set.schema.json';
import interaction2dSchema from '../schemas/interaction-2d.schema.json';
import calculatorSchema from '../schemas/calculator.schema.json';
import webglInstallSchema from '../schemas/webgl-install.schema.json';
import panelStateSchema from '../schemas/panel-state.schema.json';

export const SIM_JSON_SCHEMAS = {
  'sim-envelope': simEnvelopeSchema,
  branching: branchingSchema,
  'device-config': deviceConfigSchema,
  'fixture-set': fixtureSetSchema,
  'interaction-2d': interaction2dSchema,
  calculator: calculatorSchema,
  'webgl-install': webglInstallSchema,
  'panel-state': panelStateSchema,
} as const;

export {
  simEnvelopeSchema,
  branchingSchema,
  deviceConfigSchema,
  fixtureSetSchema,
  interaction2dSchema,
  calculatorSchema,
  webglInstallSchema,
  panelStateSchema,
};

/**
 * The six engine kinds, 1:1 with academy.sim_kind. Exported as a value so a CI
 * test can assert the schema/Zod enum and the DB enum never drift (red flag).
 */
export const ENGINE_KINDS = [
  'branching_scenario',
  'device_config',
  'webgl_install',
  'panel_state_machine',
  'interaction_2d',
  'calculator',
] as const;
