import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it, beforeAll } from 'vitest';
import {
  SIM_JSON_SCHEMAS,
  branchingExample,
  calculatorExample,
  deviceConfigExample,
  interaction2dExample,
  aeroFixture,
} from './index';

// One Ajv with every schema registered by $id so cross-file $refs (engine → the
// shared envelope) resolve. ajv-formats covers uuid/uri/date-time.
let ajv: Ajv2020;
beforeAll(() => {
  ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  for (const schema of Object.values(SIM_JSON_SCHEMAS)) ajv.addSchema(schema);
});

const getValidator = (id: string) => {
  const v = ajv.getSchema(id);
  if (!v) throw new Error(`schema not registered: ${id}`);
  return v;
};

describe('@redex/sim-schemas: published JSON Schemas (AJV authoring/CI contract)', () => {
  it('every published JSON Schema compiles', () => {
    for (const schema of Object.values(SIM_JSON_SCHEMAS)) {
      expect(() => ajv.compile(schema)).not.toThrow();
    }
  });

  it('the branching reference spec validates against branching.schema.json', () => {
    const validate = getValidator(
      'https://academy.goredex.com/sim-contracts/schemas/branching.schema.json',
    );
    const ok = validate(branchingExample);
    expect(validate.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });

  it('the device-config reference spec validates against device-config.schema.json', () => {
    const validate = getValidator(
      'https://academy.goredex.com/sim-contracts/schemas/device-config.schema.json',
    );
    const ok = validate(deviceConfigExample);
    expect(validate.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });

  it('the toy aero fixture validates against fixture-set.schema.json', () => {
    const validate = getValidator(
      'https://academy.goredex.com/sim-contracts/schemas/fixture-set.schema.json',
    );
    const ok = validate(aeroFixture);
    expect(validate.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });

  it('an invalid branching spec FAILS JSON-Schema validation (a terminal missing outcome)', () => {
    const validate = getValidator(
      'https://academy.goredex.com/sim-contracts/schemas/branching.schema.json',
    );
    const bad = JSON.parse(JSON.stringify(branchingExample));
    delete bad.nodes.pass.outcome;
    expect(validate(bad)).toBe(false);
    expect((validate.errors ?? []).length).toBeGreaterThan(0);
  });

  it('the JSON Schema also rejects a safety_flag edge with no verdict (parity with Zod)', () => {
    const validate = getValidator(
      'https://academy.goredex.com/sim-contracts/schemas/branching.schema.json',
    );
    const exploit = JSON.parse(JSON.stringify(branchingExample));
    delete exploit.nodes.failstate.choices[1].verdict; // faillocked is the safety_flag edge
    expect(validate(exploit)).toBe(false);
  });

  // ── F5b engines #5/#6 ──────────────────────────────────────────────────────
  it('the interaction-2d + calculator reference specs validate against their schemas', () => {
    const i2d = getValidator(
      'https://academy.goredex.com/sim-contracts/schemas/interaction-2d.schema.json',
    );
    expect(i2d(interaction2dExample), JSON.stringify(i2d.errors)).toBe(true);
    const calc = getValidator(
      'https://academy.goredex.com/sim-contracts/schemas/calculator.schema.json',
    );
    expect(calc(calculatorExample), JSON.stringify(calc.errors)).toBe(true);
  });

  it('the JSON Schema rejects a calculator safety_flag warn band (veto-bypass parity with Zod)', () => {
    const validate = getValidator(
      'https://academy.goredex.com/sim-contracts/schemas/calculator.schema.json',
    );
    const exploit = JSON.parse(JSON.stringify(calculatorExample));
    // demoting the safety threshold to an advisory warn band would drop it from
    // scoring and bypass the non-overridable veto — the schema must reject it.
    exploit.thresholds.find((t: { safety_flag?: boolean }) => t.safety_flag).band = 'warn';
    expect(validate(exploit)).toBe(false);
  });
});
