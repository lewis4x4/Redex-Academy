// @redex/sim-schemas/examples — the committed worked-example specs + TOY fixtures
// that must run end-to-end (F5 acceptance). Real AC-slice fixtures are M3/M4/S1;
// these are toy/illustrative and sanitized by construction.
import branchingExample from '../examples/ac203-egress-fail.branching.json';
import deviceConfigExample from '../examples/aero-single-door.device-config.json';
import interaction2dExample from '../examples/door-anatomy.interaction-2d.json';
import calculatorExample from '../examples/maglock-voltage.calculator.json';
import aeroFixture from '../examples/fixtures/aero-single-door.fixture.json';
import iqPanelFixture from '../examples/fixtures/iq-panel.sample.json';

export {
  branchingExample,
  deviceConfigExample,
  interaction2dExample,
  calculatorExample,
  aeroFixture,
  iqPanelFixture,
};

/** The reference specs the Forge runtime must run end-to-end (F5 #1/#2, F5b #5/#6). */
export const REFERENCE_SPECS = {
  branching: branchingExample,
  device_config: deviceConfigExample,
  interaction_2d: interaction2dExample,
  calculator: calculatorExample,
} as const;
