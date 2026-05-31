// ============================================================================
// supabase/functions/finalize-sim-attempt/index.ts  (Deno Edge Function) — M3
//
// SERVER-AUTHORITATIVE mastery promotion for a branching sim attempt (invariant 3
// + ledger §B). The client records its own append-only sim_attempts "Do" result
// via /sync, but COMPETENCY PROMOTION is server-only: end-user roles have no write
// grant on academy.competency_state. This function:
//   1. verifies the caller (their access token → getUser);
//   2. loads the AUTHORITATIVE spec from academy.sim_definitions (service role);
//   3. RE-DERIVES the Verdict server-side from the spec + the recorded choice path
//      (scoreBranching) — the client's posted outcome is NEVER trusted;
//   4. ONLY on a true server-side pass (no safety veto) promotes the caller's
//      competency_state to 'sim_passed' (service role; the §B safety veto means a
//      single wrong life-safety branch can never be promoted — non-overridable).
//
// A wrong life-safety choice ⇒ safety_veto ⇒ NO promotion ⇒ the M1 node stays
// blocked. Offline, the client never calls this (never fake a pass) — promotion
// waits for reconnect. The caller can only ever promote THEIR OWN competency.
//
// RELEASE GATE (ledger §J, docs/m3-ac203/RELEASE_GATES.md): the safety reviewer
// confirms the veto fires on the critical branches on the live stack, and the
// function is deployed with SUPABASE_SERVICE_ROLE_KEY in its env (Vault), before
// the production/field release. Deno: deps resolve via supabase/functions/deno.json.
// ============================================================================
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { type BranchingSpecLike, scoreBranching } from './score.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const bodySchema = z.object({
  sim_definition_id: z.string().uuid(),
  choices: z.array(z.string().min(1)).min(1).max(200),
});

/** Read a verified access token's `org_id` / `sub` custom claims (payload only;
 *  the token itself is verified by getUser — this just reads the claim values). */
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

  // Verify the caller (authn) with an anon client carrying their token.
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

  // Service role: read the authoritative spec + write competency_state (the
  // invariant-3 server-only path). RLS is bypassed BY DESIGN here — promotion is a
  // server-only computation; we gate strictly on the verified caller identity.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const db = admin.schema('academy');

  const { data: simRow, error: simErr } = await db
    .from('sim_definitions')
    .select('id, kind, spec, competency_ids, status')
    .eq('id', parsed.data.sim_definition_id)
    .eq('status', 'published')
    .maybeSingle();
  if (simErr) return json({ error: 'db_error' }, 500);
  if (!simRow) return json({ error: 'sim_not_found' }, 404);
  if (simRow.kind !== 'branching_scenario') return json({ error: 'unsupported_kind' }, 400);

  // Re-derive the Verdict server-side from the authoritative spec + the path.
  let verdict;
  try {
    verdict = scoreBranching(simRow.spec as unknown as BranchingSpecLike, parsed.data.choices);
  } catch (e) {
    return json({ error: 'invalid_path', detail: e instanceof Error ? e.message : 'bad path' }, 400);
  }

  const result = {
    outcome: verdict.outcome,
    kind: verdict.kind,
    safety_veto_triggered: verdict.safety_veto_triggered,
    score: verdict.score,
    safety_score: verdict.safety_score,
    promoted: [] as string[],
  };

  // Promote ONLY on a true, complete, non-vetoed server-side pass.
  if (verdict.complete && verdict.outcome === 'pass' && !verdict.safety_veto_triggered) {
    const competencyIds = (simRow.competency_ids ?? []) as string[];
    const nowIso = new Date().toISOString();
    for (const competencyId of competencyIds) {
      // Don't downgrade an already-field-proven competency to sim_passed.
      const { data: existing } = await db
        .from('competency_state')
        .select('status')
        .eq('user_id', userId)
        .eq('competency_id', competencyId)
        .maybeSingle();
      if (existing?.status === 'field_proven') {
        result.promoted.push(competencyId); // already at/above sim_passed
        continue;
      }
      const { error: upErr } = await db.from('competency_state').upsert(
        {
          user_id: userId,
          org_id: orgId,
          competency_id: competencyId,
          status: 'sim_passed',
          source: 'course', // a sim is part of the course flow (no 'sim' source enum)
          last_event_at: nowIso,
        },
        { onConflict: 'user_id,competency_id' },
      );
      if (upErr) return json({ error: 'promotion_failed', detail: upErr.message }, 500);
      result.promoted.push(competencyId);
    }
  }

  return json(result, 200);
});
