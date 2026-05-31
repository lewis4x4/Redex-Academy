// deno-lint-ignore-file no-explicit-any
// ============================================================================
// Regression tests for the finalize-signoff IDEMPOTENT branch (handler.ts).
//
// These lock the fix for the adversarial-verification HIGH finding (see
// docs/m6-signoff/ADVERSARIAL_VERIFICATION.md): the idempotent already-signed
// branch must NEVER promote off the request body — a replay of a legitimately
// signed signoff_id with a SWAPPED candidate/competency must be refused, and a
// real replay must promote the STORED subject only. The branch returns before the
// step-4 own-org check, so it is itself the boundary for the replay path.
//
//   deno test --config supabase/functions/deno.json \
//     supabase/functions/finalize-signoff/handler.test.ts
//
// No network / no DB: a table-dispatch mock stands in for admin + the academy
// schema client. We assert both the HTTP result AND that competency_state was (or
// was not) written — i.e. that no arbitrary user is ever promoted.
// ============================================================================
import { assert, assertEquals } from '@std/assert';
import { handleFinalize } from './handler.ts';

const future = '2999-01-01T00:00:00.000Z';
const ORG = 'org-1';
const EVAL = 'eval-1';
const CAND_A = 'cand-A'; // the candidate the stored sign-off was actually about
const COMP_C = 'comp-C';
const COURSE = 'course-1';
const JOB = 'job-1';
const SID = 'sid-1';

const storedSigned = {
  status: 'signed',
  outcome: 'pass',
  evaluator_user_id: EVAL,
  candidate_user_id: CAND_A,
  competency_id: COMP_C,
  org_id: ORG,
};

const caller = { evaluatorId: EVAL, orgId: ORG, roles: ['evaluator'] };
const baseInput = {
  action: 'finalize' as const,
  signoff_id: SID,
  candidate_user_id: CAND_A,
  course_id: COURSE,
  competency_id: COMP_C,
  work_os_job_id: JOB,
  scores: { 'ac203.release_on_power_loss': 2 },
};

interface TableResp {
  maybeSingle?: { data: unknown; error: unknown };
  then?: { data: unknown; error: unknown };
  upsert?: { error: unknown };
  insert?: { error: unknown };
}

/** A chainable mock of admin.schema('academy') that records upsert/insert calls so a
 *  test can assert whether a promotion / audit row was ever written. */
function makeDb(responses: Record<string, TableResp>) {
  const calls: { table: string; op: string; args: unknown[] }[] = [];
  function builder(table: string) {
    const r = responses[table] ?? {};
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      update: (...a: unknown[]) => {
        calls.push({ table, op: 'update', args: a });
        return chain;
      },
      maybeSingle: () => Promise.resolve(r.maybeSingle ?? { data: null, error: null }),
      single: () => Promise.resolve(r.maybeSingle ?? { data: null, error: null }),
      upsert: (...a: unknown[]) => {
        calls.push({ table, op: 'upsert', args: a });
        return Promise.resolve(r.upsert ?? { error: null });
      },
      insert: (...a: unknown[]) => {
        calls.push({ table, op: 'insert', args: a });
        return Promise.resolve(r.insert ?? { error: null });
      },
      // awaiting the builder itself (the authz select-eq-eq) resolves to a list.
      then: (resolve: (v: unknown) => void) => resolve(r.then ?? { data: [], error: null }),
    };
    return chain;
  }
  return { from: builder, calls };
}

const baseTables = (over: Record<string, TableResp> = {}): Record<string, TableResp> => ({
  courses: { maybeSingle: { data: { id: COURSE, domain: 'AC' }, error: null } },
  evaluator_authorizations: {
    then: { data: [{ status: 'authorized', domains: ['AC'], expires_at: future }], error: null },
  },
  signoffs: { maybeSingle: { data: storedSigned, error: null } },
  ...over,
});

function harness(over: Record<string, TableResp> = {}) {
  const db = makeDb(baseTables(over));
  const admin = { schema: () => db };
  return { db, admin };
}

const upsertsTo = (db: { calls: { table: string; op: string; args: unknown[] }[] }, t: string) =>
  db.calls.filter((c) => c.table === t && c.op === 'upsert');

// ---------------------------------------------------------------------------
// THE HIGH FINDING: a swapped-candidate replay must be refused, no promotion.
// ---------------------------------------------------------------------------
Deno.test('replay of a signed sign-off with a SWAPPED candidate is refused (no arbitrary promotion)', async () => {
  const { db, admin } = harness({ competency_state: { maybeSingle: { data: null, error: null } } });
  const res = await handleFinalize(admin as any, db as any, caller, {
    ...baseInput,
    candidate_user_id: 'cand-B-attacker', // a DIFFERENT user than the stored row
  } as any);
  assertEquals(res.status, 409);
  assertEquals((await res.json()).error, 'signoff_mismatch');
  // The crux: the attacker's candidate was NEVER promoted.
  assertEquals(upsertsTo(db, 'competency_state').length, 0);
});

Deno.test('replay with a SWAPPED competency is refused (no arbitrary competency promotion)', async () => {
  const { db, admin } = harness({ competency_state: { maybeSingle: { data: null, error: null } } });
  const res = await handleFinalize(admin as any, db as any, caller, {
    ...baseInput,
    competency_id: 'comp-OTHER',
  } as any);
  assertEquals(res.status, 409);
  assertEquals((await res.json()).error, 'signoff_mismatch');
  assertEquals(upsertsTo(db, 'competency_state').length, 0);
});

// ---------------------------------------------------------------------------
// The legitimate idempotent paths still behave correctly.
// ---------------------------------------------------------------------------
Deno.test('a matching replay completes promotion of the STORED candidate (recovery) + repairs audit', async () => {
  // competency not yet field_proven → promoteCompetency upserts (changed=true).
  const { db, admin } = harness({ competency_state: { maybeSingle: { data: null, error: null } } });
  const res = await handleFinalize(admin as any, db as any, caller, { ...baseInput } as any);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.promoted, true);
  assertEquals(body.idempotent, true);
  const ups = upsertsTo(db, 'competency_state');
  assertEquals(ups.length, 1);
  // Promotion subject is taken from the STORED row, never the request.
  assertEquals((ups[0].args[0] as { user_id: string }).user_id, CAND_A);
  assertEquals((ups[0].args[0] as { competency_id: string }).competency_id, COMP_C);
  // The recovery retry repairs the audit trail (the original call failed before auditing).
  assert(db.calls.some((c) => c.table === 'audit_log' && c.op === 'insert'));
});

Deno.test('a pure replay (already field_proven) is a no-op: no re-upsert, no duplicate audit', async () => {
  const { db, admin } = harness({
    competency_state: { maybeSingle: { data: { status: 'field_proven' }, error: null } },
  });
  const res = await handleFinalize(admin as any, db as any, caller, { ...baseInput } as any);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.promoted, true);
  assertEquals(upsertsTo(db, 'competency_state').length, 0); // never downgrades / re-writes
  assertEquals(db.calls.filter((c) => c.table === 'audit_log').length, 0); // no duplicate audit
});

Deno.test('replay by a DIFFERENT evaluator is refused (not_your_signoff) before any promotion', async () => {
  const { db, admin } = harness();
  const res = await handleFinalize(
    admin as any,
    db as any,
    { ...caller, evaluatorId: 'eval-2-other' },
    { ...baseInput } as any,
  );
  assertEquals(res.status, 403);
  assertEquals((await res.json()).error, 'not_your_signoff');
  assertEquals(upsertsTo(db, 'competency_state').length, 0);
});

Deno.test('replay of a FAILED sign-off returns the failed outcome and never promotes', async () => {
  const { db, admin } = harness({
    signoffs: { maybeSingle: { data: { ...storedSigned, status: 'failed', outcome: 'fail' }, error: null } },
  });
  const res = await handleFinalize(admin as any, db as any, caller, { ...baseInput } as any);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.outcome, 'fail');
  assertEquals(body.promoted, false);
  assertEquals(upsertsTo(db, 'competency_state').length, 0);
});
