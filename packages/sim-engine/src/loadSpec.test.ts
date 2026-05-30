import { branchingExample, deviceConfigExample } from '@redex/sim-schemas';
import { describe, expect, it } from 'vitest';
import { loadSpec } from './loadSpec';
import { isValidSpec, previewSpec } from './preview/harness';

describe('loadSpec + preview harness (the public entry)', () => {
  it('validates then dispatches by engine_kind', () => {
    expect(loadSpec(branchingExample).engineKind).toBe('branching_scenario');
    expect(loadSpec(deviceConfigExample).engineKind).toBe('device_config');
  });

  it('throws on an invalid spec (the gate runs before any render)', () => {
    expect(() => loadSpec({ envelope: { engine_kind: 'branching_scenario' } })).toThrow();
    expect(() => loadSpec({ envelope: { engine_kind: 'nope' } })).toThrow(/not a valid/);
  });

  it('throws a clear "no F5 runtime" error for an out-of-scope engine kind', () => {
    const calc = { envelope: { ...branchingExample.envelope, engine_kind: 'calculator' } };
    // routed to calculator validator — which the toy spec fails; but an envelope-valid
    // stub kind reaches the dispatcher's default arm:
    const webgl = {
      envelope: {
        engine_kind: 'webgl_install',
        sim_id: 'x.y',
        spec_version: '1.0.0',
        title_i18n: 'a',
        competency_ids: ['b3e7c2a1-0000-4000-8000-000000000001'],
        scoring: {
          pass_threshold: 0.8,
          safety_pass_threshold: 0.9,
          veto_on_any_safety_failure: true,
        },
      },
    };
    expect(() => loadSpec(webgl)).toThrow(/no F5 runtime/);
    expect(() => loadSpec(calc)).toThrow();
  });

  it('previewSpec returns a typed error (never throws) for an invalid spec', () => {
    const ok = previewSpec(branchingExample);
    expect(ok.ok).toBe(true);
    const bad = previewSpec({ envelope: { engine_kind: 'branching_scenario' } });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.length).toBeGreaterThan(0);
  });

  it('isValidSpec is a cheap boolean gate for authoring (M9)', () => {
    expect(isValidSpec(branchingExample)).toBe(true);
    expect(isValidSpec(deviceConfigExample)).toBe(true);
    expect(isValidSpec({ nope: true })).toBe(false);
  });
});
