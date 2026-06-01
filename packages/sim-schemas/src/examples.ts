// @redex/sim-schemas/examples — the committed worked-example specs + TOY fixtures
// that must run end-to-end (F5 acceptance). Real AC-slice fixtures are M3/M4/S1;
// these are toy/illustrative and sanitized by construction.
import branchingExample from '../examples/ac203-egress-fail.branching.json';
import deviceConfigExample from '../examples/aero-single-door.device-config.json';
import interaction2dExample from '../examples/door-anatomy.interaction-2d.json';
import calculatorExample from '../examples/maglock-voltage.calculator.json';
import aeroFixture from '../examples/fixtures/aero-single-door.fixture.json';
import iqPanelFixture from '../examples/fixtures/iq-panel.sample.json';
// M2 — the REAL authored AC-slice specs (seeded into academy.sim_definitions).
import ac101AnatomySpec from '../examples/ac-101.anatomy-of-a-door.interaction-2d.json';
import ac102SpecTheDoorSpec from '../examples/ac-102.spec-the-door.interaction-2d.json';
import ac202WillItHoldSpec from '../examples/ac-202.will-it-hold.calculator.json';
// AC-203 (the flagship) — the 4 new embeddable 2D-interaction sims, the device-config
// "virtual door" build, and the re-centered egress branching sim (= branchingExample).
import ac203MagVsStrikeSpec from '../examples/ac-203.mag-vs-strike-pick.interaction-2d.json';
import ac203ArmatureMountSpec from '../examples/ac-203.armature-mount.interaction-2d.json';
import ac203ButtonPlacementSpec from '../examples/ac-203.button-placement.interaction-2d.json';
import ac203FollowThePowerSpec from '../examples/ac-203.follow-the-power.interaction-2d.json';
import ac203VirtualDoorSpec from '../examples/ac-203.virtual-door-maglock.device-config.json';

export {
  branchingExample,
  deviceConfigExample,
  interaction2dExample,
  calculatorExample,
  aeroFixture,
  iqPanelFixture,
  ac101AnatomySpec,
  ac102SpecTheDoorSpec,
  ac202WillItHoldSpec,
  ac203MagVsStrikeSpec,
  ac203ArmatureMountSpec,
  ac203ButtonPlacementSpec,
  ac203FollowThePowerSpec,
  ac203VirtualDoorSpec,
};

/** The real M2 AC-slice specs, keyed by their sim_definitions `key` (= units.content_ref.spec_key). */
export const M2_AC_SPECS = {
  'ac-101/anatomy-of-a-door': ac101AnatomySpec,
  'ac-102/spec-the-door': ac102SpecTheDoorSpec,
  'ac-202/will-it-hold': ac202WillItHoldSpec,
  // AC-203 — the 4 new sims embeddable in lessons via <Sim spec> (interaction_2d only).
  'ac-203/mag-vs-strike-pick': ac203MagVsStrikeSpec,
  'ac-203/armature-mount': ac203ArmatureMountSpec,
  'ac-203/button-placement': ac203ButtonPlacementSpec,
  'ac-203/follow-the-power': ac203FollowThePowerSpec,
} as const;

/**
 * AC-203 unit-level sims rendered by the Forge runtime (NOT embeddable via <Sim>):
 * the device-config "virtual door" build (u3) and the re-centered egress branching
 * scenario (u2 = branchingExample). Keyed by sim_definitions `key`.
 */
export const AC203_UNIT_SIMS = {
  'ac-203/virtual-door-maglock': ac203VirtualDoorSpec,
  'ac-203/egress-compliant': branchingExample,
} as const;

/** Every newly-authored AC-203 sim spec (for validation + i18n-coverage tests). */
export const AC203_NEW_SPECS = [
  ac203MagVsStrikeSpec,
  ac203ArmatureMountSpec,
  ac203ButtonPlacementSpec,
  ac203FollowThePowerSpec,
  ac203VirtualDoorSpec,
] as const;

/** The reference specs the Forge runtime must run end-to-end (F5 #1/#2, F5b #5/#6). */
export const REFERENCE_SPECS = {
  branching: branchingExample,
  device_config: deviceConfigExample,
  interaction_2d: interaction2dExample,
  calculator: calculatorExample,
} as const;
