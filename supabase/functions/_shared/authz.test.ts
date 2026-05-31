// Deno unit test for the evaluator-authorization predicate (no network / no DB).
// finalize-signoff runs as service_role (RLS bypassed) so this gate IS the boundary:
// authorized-in-domain passes; wrong-domain / expired / suspended / non-evaluator refused.
//   deno test --config supabase/functions/deno.json supabase/functions/_shared/authz.test.ts
import { assert, assertEquals } from '@std/assert';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertEvaluatorAuthorized } from './authz.ts';

interface Row {
  status: string;
  domains: string[] | null;
  expires_at: string | null;
}

/** A chainable that mimics admin.schema('academy').from(...).select(...).eq(...).eq(...) → {data,error}. */
function mockAdmin(rows: Row[], error: unknown = null) {
  const chain = {
    schema: () => chain,
    from: () => chain,
    select: () => chain,
    eq: () => chain,
    then: (resolve: (v: { data: Row[]; error: unknown }) => void) => resolve({ data: rows, error }),
  };
  // deno-lint-ignore no-explicit-any
  return chain as unknown as SupabaseClient<any, any, any>;
}

const future = '2999-01-01T00:00:00.000Z';
const past = '2000-01-01T00:00:00.000Z';
const base = { userId: 'u1', orgId: 'o1', roles: ['evaluator'] as string[] };

Deno.test('authorized in-domain (non-expired) → ok', async () => {
  const r = await assertEvaluatorAuthorized(
    mockAdmin([{ status: 'authorized', domains: ['AC', 'SEC'], expires_at: future }]),
    { ...base, domain: 'AC' },
  );
  assertEquals(r.ok, true);
});

Deno.test('authorized but WRONG domain → refused', async () => {
  const r = await assertEvaluatorAuthorized(
    mockAdmin([{ status: 'authorized', domains: ['SEC'], expires_at: future }]),
    { ...base, domain: 'AC' },
  );
  assertEquals(r.ok, false);
  assert(!r.ok && r.reason === 'not_authorized_for_domain');
});

Deno.test('EXPIRED authorization → refused', async () => {
  const r = await assertEvaluatorAuthorized(
    mockAdmin([{ status: 'authorized', domains: ['AC'], expires_at: past }]),
    { ...base, domain: 'AC' },
  );
  assertEquals(r.ok, false);
});

Deno.test('SUSPENDED / provisional (status != authorized) → refused', async () => {
  const r1 = await assertEvaluatorAuthorized(
    mockAdmin([{ status: 'suspended', domains: ['AC'], expires_at: future }]),
    { ...base, domain: 'AC' },
  );
  assertEquals(r1.ok, false);
  const r2 = await assertEvaluatorAuthorized(
    mockAdmin([{ status: 'provisional', domains: ['AC'], expires_at: future }]),
    { ...base, domain: 'AC' },
  );
  assertEquals(r2.ok, false);
});

Deno.test('caller without the evaluator role → refused before any DB read', async () => {
  const r = await assertEvaluatorAuthorized(
    mockAdmin([{ status: 'authorized', domains: ['AC'], expires_at: future }]),
    { userId: 'u1', orgId: 'o1', domain: 'AC', roles: ['learner'] },
  );
  assertEquals(r.ok, false);
  assert(!r.ok && r.reason === 'not_evaluator');
});

Deno.test('no authorization row at all → refused', async () => {
  const r = await assertEvaluatorAuthorized(mockAdmin([]), { ...base, domain: 'AC' });
  assertEquals(r.ok, false);
});

Deno.test('a no-expiry (NULL expires_at) authorized row is live → ok', async () => {
  const r = await assertEvaluatorAuthorized(
    mockAdmin([{ status: 'authorized', domains: ['AC'], expires_at: null }]),
    { ...base, domain: 'AC' },
  );
  assertEquals(r.ok, true);
});
