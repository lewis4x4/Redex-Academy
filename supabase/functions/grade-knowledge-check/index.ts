// ============================================================================
// supabase/functions/grade-knowledge-check/index.ts (Deno Edge Function) — M2
//
// SERVER-AUTHORITATIVE knowledge-check verdict (invariant 2/3, ledger §C/§G). The
// client records its own append-only assessment_responses via /sync and grades
// LOCALLY for instant pass/retry feedback, but the AUTHORITATIVE verdict — and any
// competency_state write — is server-only: end-user roles have no write grant on
// academy.competency_state. This function:
//   1. verifies the caller (their access token → getUser);
//   2. loads the knowledge_check unit + its AUTHORITATIVE assessment_items
//      (service role) scoped by course_version_id (the item_set), excluding
//      open_response (AI-graded, M10);
//   3. loads THIS caller's own assessment_responses for those items and RE-DERIVES
//      the item-level verdict (gradeKnowledgeCheck — the SAME scorer the client
//      mirrors): safety items >= 90%, non-safety >= 80%, latest attempt per item.
//      The client's locally-computed outcome is NEVER trusted;
//   4. ONLY on a true server-side pass, promotes the unit's competency to
//      'in_progress' (service role) — NEVER 'sim_passed' (that remains the Forge
//      sim's authority via finalize-sim-attempt, so a quiz can never falsely open
//      an M1 sim_passed gate), and NEVER downgrades an existing higher status.
//
// DESIGN DECISIONS pinned here (M2 stop-flags, conservative + invariant-safe):
//   • Scope = assessment_items WHERE course_version_id = unit.course_version_id
//     (the item_set spans competencies — e.g. AC-102 OSDP + fail-state items).
//   • A KC pass promotes competency_state to 'in_progress', NOT 'sim_passed'
//     (fails SAFE: under-promote, never over-promote / falsely unlock).
// Offline, the client never calls this (never fake a pass) — it waits for reconnect.
// ============================================================================
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { type GradableItem, gradeKnowledgeCheck, type ItemResponse } from './grade-kc.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const bodySchema = z.object({ unit_id: z.string().uuid() });

function readClaims(token: string): { sub?: string; org_id?: string } {
  const parts = token.split('.');
  if (parts.length !== 3) return {};
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    b64 += '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(b64)) as { sub?: string; org_id?: string };
    return { sub: payload.sub, org_id: payload.org_id };
  } catch {
    return {};
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authz = req.headers.get('authorization') ?? '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
  if (!token) return json({ error: 'unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'misconfigured' }, 500);

  const asCaller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await asCaller.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);
  const userId = userData.user.id; // authoritative caller id
  const { org_id: orgId } = readClaims(token);
  if (!orgId) return json({ error: 'no_org_claim' }, 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);

  // Service role: read the authoritative items + write competency_state (the
  // invariant-3 server-only path). We gate strictly on the verified caller id.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const db = admin.schema('academy');

  const { data: unit, error: unitErr } = await db
    .from('units')
    .select('id, kind, course_version_id, competency_id')
    .eq('id', parsed.data.unit_id)
    .maybeSingle();
  if (unitErr) return json({ error: 'db_error' }, 500);
  if (!unit) return json({ error: 'unit_not_found' }, 404);
  if (unit.kind !== 'knowledge_check') return json({ error: 'not_a_knowledge_check' }, 400);

  // The item_set = every gradable assessment item for this course version (spans
  // competencies). open_response is excluded (M10 AI grading), not auto-graded.
  const { data: itemRows, error: itemErr } = await db
    .from('assessment_items')
    .select('id, kind, is_safety_item, mastery_weight, answer_key')
    .eq('course_version_id', unit.course_version_id)
    .neq('kind', 'open_response');
  if (itemErr) return json({ error: 'db_error' }, 500);
  const items = (itemRows ?? []) as GradableItem[];
  if (items.length === 0) return json({ error: 'no_items' }, 400);

  // THIS caller's own responses for those items (RLS would also scope this, but the
  // service role reads broadly so we filter by the verified user_id explicitly).
  const itemIds = items.map((i) => i.id);
  const { data: respRows, error: respErr } = await db
    .from('assessment_responses')
    .select('assessment_item_id, response, attempt')
    .eq('user_id', userId)
    .in('assessment_item_id', itemIds);
  if (respErr) return json({ error: 'db_error' }, 500);
  const responses = (respRows ?? []) as ItemResponse[];

  // Re-derive the authoritative item-level verdict (never trust the client).
  const verdict = gradeKnowledgeCheck(items, responses);

  const result = {
    passed: verdict.passed,
    safety: verdict.safety,
    non_safety: verdict.nonSafety,
    promoted: null as string | null,
  };

  // Promote ONLY on a true server-side pass — and only ever to 'in_progress'.
  // A knowledge check is a within-course learning step, NOT the Forge sim: it must
  // never write 'sim_passed' (which M1 gating unlocks on) and never downgrade.
  if (verdict.passed && unit.competency_id) {
    const { data: existing } = await db
      .from('competency_state')
      .select('status')
      .eq('user_id', userId)
      .eq('competency_id', unit.competency_id)
      .maybeSingle();
    const higher = existing?.status === 'sim_passed' || existing?.status === 'field_proven';
    if (!higher) {
      const { error: upErr } = await db.from('competency_state').upsert(
        {
          user_id: userId,
          org_id: orgId,
          competency_id: unit.competency_id,
          status: 'in_progress',
          source: 'course',
          last_event_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,competency_id' },
      );
      if (upErr) return json({ error: 'promotion_failed', detail: upErr.message }, 500);
    }
    result.promoted = unit.competency_id;
  }

  return json(result, 200);
});
