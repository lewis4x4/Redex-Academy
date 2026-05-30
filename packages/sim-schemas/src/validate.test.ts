import { describe, expect, it } from 'vitest';
import { branchingExample, deviceConfigExample } from './examples';
import { validateSpec, specValidatorByKind } from '../zod/index';

describe('@redex/sim-schemas: validateSpec (Zod runtime gate)', () => {
  it('accepts the branching reference spec and routes it to the branching validator', () => {
    const parsed = validateSpec(branchingExample) as { envelope: { engine_kind: string } };
    expect(parsed.envelope.engine_kind).toBe('branching_scenario');
  });

  it('accepts the device-config reference spec', () => {
    const parsed = validateSpec(deviceConfigExample) as { envelope: { engine_kind: string } };
    expect(parsed.envelope.engine_kind).toBe('device_config');
  });

  it('rejects a spec whose engine_kind is not an academy.sim_kind value', () => {
    const bad = { envelope: { ...branchingExample.envelope, engine_kind: 'totally_made_up' } };
    expect(() => validateSpec(bad)).toThrow(/engine_kind is missing or not a valid/);
  });

  it('rejects engine_kind drift — a branching graph claiming engine_kind device_config', () => {
    const drift = {
      ...branchingExample,
      envelope: { ...branchingExample.envelope, engine_kind: 'device_config' },
    };
    // routes to the device_config validator, which has no nodes/screens → fails
    expect(() => validateSpec(drift)).toThrow();
  });

  it('rejects a structurally invalid branching spec with a clear error (missing start)', () => {
    const noStart = { ...branchingExample, start: 'does_not_exist' };
    expect(() => validateSpec(noStart)).toThrow(/start/);
  });

  it('rejects a branching spec with a dangling edge target', () => {
    const dangling = JSON.parse(JSON.stringify(branchingExample));
    dangling.nodes.failstate.choices[0].to = 'nowhere';
    expect(() => validateSpec(dangling)).toThrow(/missing node/);
  });

  it('REJECTS a safety_flag edge with NO verdict mapping (closes the veto-bypass hole)', () => {
    const exploit = JSON.parse(JSON.stringify(branchingExample));
    delete exploit.nodes.failstate.choices[1].verdict; // faillocked is the safety_flag edge
    expect(() => validateSpec(exploit)).toThrow(/safety_compliance|verdict/);
  });

  it('REJECTS a safety_flag edge whose verdict.dimension is not safety_compliance', () => {
    const exploit = JSON.parse(JSON.stringify(branchingExample));
    exploit.nodes.failstate.choices[1].verdict.dimension = 'technical_execution';
    expect(() => validateSpec(exploit)).toThrow(/safety_compliance|verdict/);
  });

  it('REJECTS a safety_flag edge with a non-negative score_delta (the wrong choice must lose points)', () => {
    const exploit = JSON.parse(JSON.stringify(branchingExample));
    exploit.nodes.failstate.choices[1].score_delta = 0;
    expect(() => validateSpec(exploit)).toThrow(/score_delta/);
  });

  it('the #3/#4 stubs validate envelope-only (permissive guard, expanded later)', () => {
    const webgl = { envelope: { engine_kind: 'webgl_install', anything: 'goes' } };
    const panel = { envelope: { engine_kind: 'panel_state_machine' } };
    expect(() => specValidatorByKind.webgl_install.parse(webgl)).not.toThrow();
    expect(() => specValidatorByKind.panel_state_machine.parse(panel)).not.toThrow();
  });
});
