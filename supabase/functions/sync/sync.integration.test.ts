// ============================================================================
// supabase/functions/sync/sync.integration.test.ts  (Deno test)
//
// END-TO-END acceptance of the F4_DRY_RUN §4 signals, executed as ONE PIPELINE:
// the REAL /sync decision+write path (validateSyncEvent -> planWrite -> upsert)
// run against a LIVE Postgres. This is stronger than the SQL ON CONFLICT test +
// the pure validator test in isolation — it proves planWrite's output actually
// achieves idempotency / rejection / immutability / LWW on the real F2 schema.
//
// What this does NOT cover (deliberately — it is the [HUMAN-VERIFY]/live gate,
// ledger §J): the HTTP/auth wrapper (getUser + caller-token RLS ownership) and
// the real-hardware airplane-mode run. A Playwright proxy + this test are
// necessary but NOT sufficient; F4 stays pending_human_verification until Brian
// signs docs/F4_HUMAN_VERIFICATION.md.
//
// Run (local):
//   SYNC_TEST_DB_URL=postgresql://postgres@127.0.0.1:5433/redex_f4r \
//   deno test --allow-net --allow-env --config supabase/functions/deno.json \
//     supabase/functions/sync/sync.integration.test.ts
// CI provides SYNC_TEST_DB_URL pointing at the postgres service (migrations applied).
// ============================================================================
import { assertEquals } from '@std/assert';
import { Client } from 'postgres';
import { planWrite, type SyncEvent, validateSyncEvent } from './sync.schema.ts';

const DB_URL = Deno.env.get('SYNC_TEST_DB_URL');

const U = (s: string) => `00000000-0000-0000-0000-${s.padStart(12, '0')}`;
const ev = (over: Partial<SyncEvent> & Pick<SyncEvent, 'table' | 'op'>): SyncEvent => ({
  client_event_uuid: over.client_event_uuid ?? U(Math.abs(hash(JSON.stringify(over))).toString()),
  device_ts: '2026-05-29T00:00:00.000Z',
  payload: {},
  ...over,
});
const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
};

// Mirror of functions/sync/index.ts per-event handling, writing through a direct
// PG client (the live-Supabase RLS/auth layer is the human/live gate, not here).
async function applyBatch(client: Client, events: SyncEvent[]) {
  const accepted: string[] = [];
  const rejected: { uuid: string; reason: string }[] = [];
  for (const event of events) {
    const v = validateSyncEvent(event);
    if (!v.ok || !v.classification) {
      rejected.push({ uuid: event.client_event_uuid, reason: v.reason ?? 'invalid' });
      continue;
    }
    const plan = planWrite(event, v.classification);
    // Each write is independent (the real /sync uses supabase-js autocommit per
    // request). A SAVEPOINT models that inside our one rollback-wrapped txn: a
    // failed write rolls back only itself, not the batch.
    await client.queryArray('savepoint sp');
    try {
      await execUpsert(client, plan);
      await client.queryArray('release savepoint sp');
      accepted.push(event.client_event_uuid);
    } catch (e) {
      await client.queryArray('rollback to savepoint sp');
      rejected.push({ uuid: event.client_event_uuid, reason: 'db_error' });
      if (Deno.env.get('SYNC_TEST_DEBUG')) console.error('db_error:', (e as Error).message);
    }
  }
  return { accepted, rejected };
}

// The same INSERT … ON CONFLICT that supabase-js .upsert(row,{onConflict,
// ignoreDuplicates}) emits — DO NOTHING for append-only, DO UPDATE for upsert.
async function execUpsert(
  client: Client,
  plan: { table: string; row: Record<string, unknown>; onConflict: string; ignoreDuplicates: boolean },
) {
  const cols = Object.keys(plan.row);
  const params = cols.map((_, i) => `$${i + 1}`);
  const values = cols.map((c) => {
    const v = plan.row[c];
    return v !== null && typeof v === 'object' ? JSON.stringify(v) : v; // jsonb via unknown→jsonb cast
  });
  const keyCols = plan.onConflict.split(',').map((s) => s.trim());
  const updatable = cols.filter((c) => !keyCols.includes(c));
  const conflict =
    plan.ignoreDuplicates || updatable.length === 0
      ? `on conflict (${keyCols.join(',')}) do nothing`
      : `on conflict (${keyCols.join(',')}) do update set ${updatable
          .map((c) => `${c}=excluded.${c}`)
          .join(', ')}`;
  const sql = `insert into academy.${plan.table} (${cols.join(',')}) values (${params.join(
    ',',
  )}) ${conflict}`;
  await client.queryArray(sql, values);
}

const count = async (client: Client, sql: string, args: unknown[]) => {
  const r = await client.queryArray<[number]>(sql, args);
  return Number(r.rows[0][0]);
};

const ORG = U('f40001');
const USER = U('f40002');
const COMP = U('f40003');
const COURSE = U('f40004');
const CV = U('f40005');
const SIM = U('f40006');
const AITEM = U('f40007');
const UNIT = U('f40008');
const ENR = U('f40009');

async function seed(client: Client) {
  await client.queryArray(
    `insert into academy.orgs(id,name,type) values($1,'__IT__ org','redex')`,
    [ORG],
  );
  await client.queryArray(
    `insert into academy.users(id,org_id,display_name) values($1,$2,'[IT] tech')`,
    [USER, ORG],
  );
  await client.queryArray(
    `insert into academy.competencies(id,code,title,domain) values($1,'__IT__.C','c','AC')`,
    [COMP],
  );
  await client.queryArray(
    `insert into academy.courses(id,code,title,domain,tier) values($1,'__IT__-C','c','AC','core')`,
    [COURSE],
  );
  await client.queryArray(
    `insert into academy.course_versions(id,course_id,semver,status) values($1,$2,'1.0.0','published')`,
    [CV, COURSE],
  );
  await client.queryArray(
    `insert into academy.sim_definitions(id,key,version,kind,spec,status) values($1,'__IT__.sim','v1','branching_scenario','{}','draft')`,
    [SIM],
  );
  await client.queryArray(
    `insert into academy.assessment_items(id,competency_id,course_version_id,kind,prompt) values($1,$2,$3,'mcq','{}')`,
    [AITEM, COMP, CV],
  );
  await client.queryArray(
    `insert into academy.units(id,course_version_id,ordinal,title,kind) values($1,$2,1,'[IT] unit','lesson')`,
    [UNIT, CV],
  );
  await client.queryArray(
    `insert into academy.enrollments(id,user_id,org_id,course_id,course_version_id) values($1,$2,$3,$4,$5)`,
    [ENR, USER, ORG, COURSE, CV],
  );
}

Deno.test({
  name: 'F4 /sync acceptance pipeline (validate→plan→upsert) against a live DB',
  ignore: !DB_URL,
  async fn(t) {
    const client = new Client(DB_URL);
    await client.connect();
    await client.queryArray('begin');
    try {
      await seed(client);

      // Client generates row ids OFFLINE so the telemetry FK resolves without a
      // server round-trip (the real offline pattern). attemptId links telemetry.
      const attemptId = U('a00001');

      const coreFlow: SyncEvent[] = [
        ev({
          table: 'sim_attempts',
          op: 'append',
          client_event_uuid: U('e00001'),
          payload: { id: attemptId, user_id: USER, org_id: ORG, sim_definition_id: SIM, outcome: 'pass' },
        }),
        ev({
          table: 'sim_telemetry_events',
          op: 'append',
          client_event_uuid: U('e00002'),
          payload: { sim_attempt_id: attemptId, event_type: 'tap' },
        }),
        ev({
          table: 'assessment_responses',
          op: 'append',
          client_event_uuid: U('e00003'),
          payload: { user_id: USER, org_id: ORG, assessment_item_id: AITEM, response: {} },
        }),
      ];

      await t.step('offline core flow + sim → flush reconciles all events', async () => {
        const r = await applyBatch(client, coreFlow);
        assertEquals(r.rejected, []);
        assertEquals(r.accepted.length, 3);
        assertEquals(
          await count(client, 'select count(*) from academy.sim_attempts where id=$1', [attemptId]),
          1,
        );
        assertEquals(
          await count(
            client,
            'select count(*) from academy.sim_telemetry_events where sim_attempt_id=$1',
            [attemptId],
          ),
          1,
        );
        assertEquals(
          await count(client, 'select count(*) from academy.assessment_responses where user_id=$1', [
            USER,
          ]),
          1,
        );
      });

      await t.step('DOUBLE-FLUSH (flaky reconnect) does NOT double-count', async () => {
        await applyBatch(client, coreFlow); // same client_event_uuids, sent again
        assertEquals(
          await count(client, 'select count(*) from academy.sim_attempts where id=$1', [attemptId]),
          1,
        );
        assertEquals(
          await count(
            client,
            'select count(*) from academy.sim_telemetry_events where sim_attempt_id=$1',
            [attemptId],
          ),
          1,
        );
        assertEquals(
          await count(client, 'select count(*) from academy.assessment_responses where user_id=$1', [
            USER,
          ]),
          1,
        );
      });

      await t.step('NEVER fake a pass: /sync rejects a client-set sign-off outcome', async () => {
        const soId = U('b00001');
        const r = await applyBatch(client, [
          ev({
            table: 'signoffs',
            op: 'upsert',
            client_event_uuid: U('e00004'),
            payload: { id: soId, status: 'draft', outcome: 'pass' },
          }),
        ]);
        assertEquals(r.accepted, []);
        assertEquals(r.rejected[0]?.reason, 'server_only_field');
        assertEquals(
          await count(client, 'select count(*) from academy.signoffs where id=$1', [soId]),
          0,
        );
      });

      await t.step('immutable-after-sign: the F2 DB trigger rejects an upsert to a SIGNED row', async () => {
        const signedId = U('b00002');
        await client.queryArray(
          `insert into academy.signoffs(id,candidate_user_id,evaluator_user_id,competency_id,org_id,status) values($1,$2,$2,$3,$4,'draft')`,
          [signedId, USER, COMP, ORG],
        );
        await client.queryArray(
          `insert into academy.signoff_line_items(signoff_id,dimension,line_item_key,score,is_critical_safety) values
             ($1,'safety_compliance','k1',2,true),($1,'technical_execution','k2',2,false),
             ($1,'verification_documentation','k3',2,false),($1,'independence_judgment','k4',2,false)`,
          [signedId],
        );
        await client.queryArray(`update academy.signoffs set status='signed' where id=$1`, [signedId]);

        // A FULL valid draft row (all NOT NULL cols) whose id collides with the
        // signed row → the upsert's ON CONFLICT (id) DO UPDATE fires the F2
        // immutability trigger (not a NOT NULL error). App validation passes
        // (draft status); the DB trigger is the backstop that rejects it.
        const r = await applyBatch(client, [
          ev({
            table: 'signoffs',
            op: 'upsert',
            client_event_uuid: U('e00005'),
            payload: {
              id: signedId,
              candidate_user_id: USER,
              evaluator_user_id: USER,
              competency_id: COMP,
              org_id: ORG,
              status: 'draft',
            },
          }),
        ]);
        assertEquals(r.accepted, []); // rejected by the DB trigger (db_error)
        assertEquals(r.rejected[0]?.reason, 'db_error');
        const stillSigned = await count(
          client,
          `select count(*) from academy.signoffs where id=$1 and status='signed'`,
          [signedId],
        );
        assertEquals(stillSigned, 1);
      });

      await t.step('app layer also rejects a client trying to SIGN via /sync', async () => {
        const r = await applyBatch(client, [
          ev({
            table: 'signoffs',
            op: 'upsert',
            client_event_uuid: U('e00006'),
            payload: { id: U('b00003'), status: 'signed' },
          }),
        ]);
        assertEquals(r.rejected[0]?.reason, 'signed_signoff_edit');
      });

      await t.step('LWW for a draft tick: re-sync updates the one row, no duplicate', async () => {
        const mk = (status: string, uuid: string) =>
          ev({
            table: 'unit_progress',
            op: 'upsert',
            client_event_uuid: uuid,
            payload: { enrollment_id: ENR, unit_id: UNIT, org_id: ORG, status },
          });
        await applyBatch(client, [mk('in_progress', U('e00007'))]);
        await applyBatch(client, [mk('passed', U('e00008'))]); // later writer wins
        assertEquals(
          await count(
            client,
            'select count(*) from academy.unit_progress where enrollment_id=$1 and unit_id=$2',
            [ENR, UNIT],
          ),
          1,
        );
        const r = await client.queryArray<[string]>(
          'select status from academy.unit_progress where enrollment_id=$1 and unit_id=$2',
          [ENR, UNIT],
        );
        assertEquals(r.rows[0][0], 'passed');
      });
    } finally {
      await client.queryArray('rollback');
      await client.end();
    }
  },
});
