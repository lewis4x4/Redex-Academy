// @redex/sim-schemas/examples — the committed worked-example specs + TOY fixtures
// that must run end-to-end (F5 acceptance). Real AC-slice fixtures are M3/M4/S1;
// these are toy/illustrative and sanitized by construction.
import branchingExample from '../examples/ac203-egress-fail.branching.json';
import deviceConfigExample from '../examples/aero-single-door.device-config.json';
import aeroFixture from '../examples/fixtures/aero-single-door.fixture.json';
import iqPanelFixture from '../examples/fixtures/iq-panel.sample.json';

export { branchingExample, deviceConfigExample, aeroFixture, iqPanelFixture };

/** The two reference specs F5 must run (branching #1, device-config #2). */
export const REFERENCE_SPECS = {
  branching: branchingExample,
  device_config: deviceConfigExample,
} as const;
