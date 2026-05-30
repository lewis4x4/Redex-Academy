// ============================================================================
// supabase/functions/sync/index.ts  (Deno Edge Function)  — F4
// Idempotent offline reconciliation. Ledger §G + CLAUDE.md inv. 2/4:
//   * append-only events upsert ON CONFLICT (client_event_uuid) DO NOTHING — a
//     double-flush CANNOT double-count;
//   * upsert rows (progress ticks + DRAFT sign-offs) reconcile LWW on their F2
//     NATURAL key (those tables have NO client_event_uuid column);
//   * the client may NEVER set a server-only field (no faked pass) — rejected;
//   * a signed sign-off is immutable (drafts only carry draft/submitted status;
//     the F2 tg_signoff_immutable trigger is the DB backstop).
//
// AUTHZ: writes run as the CALLER (the request's verified access token), so F2's
// RLS is the ownership boundary — a tech can only write their own rows, drafts
// only, and has NO grant/policy on server-only tables. We do NOT use the service
// role here (that would bypass RLS); /sync only does things the client is itself
// allowed to do, so RLS — not re-implemented logic — enforces tenancy/ownership.
//
// Deno runtime: deps resolve through supabase/functions/deno.json's import map to
// npm:/jsr: specifiers ONLY — never a Node-only module. Verified by @redex/sync-core
// unit tests + supabase/tests/sync_idempotency_test.sql + a CI `deno check` (with
// --config deno.json) + the [HUMAN-VERIFY] real-hardware airplane-mode run.
// ============================================================================
import { createClient } from '@supabase/supabase-js';
import { planWrite, syncBatchSchema, validateSyncEvent } from './sync.schema.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authz = req.headers.get('authorization') ?? '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
  if (!token) return json({ error: 'unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return json({ error: 'misconfigured' }, 500);

  // One client, authenticated AS THE CALLER → every write goes through F2 RLS.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const parsed = syncBatchSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);

  const db = supabase.schema('academy');
  const accepted: string[] = [];
  const rejected: { client_event_uuid: string; reason: string }[] = [];

  for (const event of parsed.data.events) {
    const verdict = validateSyncEvent(event);
    if (!verdict.ok || !verdict.classification) {
      rejected.push({ client_event_uuid: event.client_event_uuid, reason: verdict.reason ?? 'invalid' });
      continue;
    }
    const plan = planWrite(event, verdict.classification);
    // RLS (as the caller) enforces ownership, tenancy, and draft-only; a violation
    // surfaces as an error and the event is rejected (never silently applied).
    const { error } = await db
      .from(plan.table)
      .upsert(plan.row, { onConflict: plan.onConflict, ignoreDuplicates: plan.ignoreDuplicates });
    if (error) {
      rejected.push({ client_event_uuid: event.client_event_uuid, reason: 'db_error' });
    } else {
      accepted.push(event.client_event_uuid);
    }
  }

  return json({ accepted, rejected }, 200);
});
