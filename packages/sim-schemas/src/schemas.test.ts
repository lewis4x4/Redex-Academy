import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it, beforeAll } from 'vitest';
import { SIM_JSON_SCHEMAS, branchingExample, deviceConfigExample, aeroFixture } from './index';

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
});
