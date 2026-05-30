import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EngineKind, FixtureSource, ENGINE_KINDS } from './index';

// Reads the F2 migration and asserts the spec-side enums NEVER drift from the DB
// enums (the F5 red flag: an engine_kind/source with no academy.sim_kind/
// fixture_source value, or vice versa). A new kind = a migration + typegen.
const here = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(
  resolve(here, '../../../supabase/migrations/20260529210643_init_academy.sql'),
  'utf8',
);

function enumValues(typeName: string): string[] {
  const re = new RegExp(`create type academy\\.${typeName}\\s+as enum\\s*\\(([^)]*)\\)`, 'i');
  const m = migration.match(re);
  const body = m?.[1];
  if (!body) throw new Error(`enum academy.${typeName} not found in migration`);
  return [...body.matchAll(/'([^']+)'/g)]
    .map((x) => x[1])
    .filter((v): v is string => Boolean(v))
    .sort();
}

describe('@redex/sim-schemas: engine_kind / source ↔ DB enum parity (no drift)', () => {
  it('EngineKind == academy.sim_kind, exactly 1:1', () => {
    expect([...EngineKind.options].sort()).toEqual(enumValues('sim_kind'));
  });

  it('ENGINE_KINDS export matches the Zod EngineKind enum', () => {
    expect([...ENGINE_KINDS].sort()).toEqual([...EngineKind.options].sort());
  });

  it('FixtureSource == academy.fixture_source, exactly 1:1', () => {
    expect([...FixtureSource.options].sort()).toEqual(enumValues('fixture_source'));
  });
});
