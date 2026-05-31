// ============================================================================
// supabase/functions/finalize-signoff/handler.ts  (M6) — the TESTABLE logic.
// index.ts is the thin Deno.serve(handleRequest) entrypoint; everything that can
// be unit-tested without binding a server lives here (see handler.test.ts).
//
// The SERVER-AUTHORITATIVE write boundary for the Evaluator field sign-off ("Prove
// one") — the single most liability-critical path. Runs as the SERVICE ROLE (it
// must flip status→signed and write competency_state/audit_log, which no end-user
// role may do), so it BYPASSES RLS and is therefore the access-control boundary:
// it re-checks the caller's role + evaluator authorization ITSELF, never trusting
// the client. Two actions: { action:'finalize' } and { action:'void' }.
//
// THE THREE-LAYER SAFETY VETO (CLAUDE.md invariant 1, ledger §B), non-overridable:
//   1. DB trigger academy.tg_signoff_compute_outcome — the TRUST BOUNDARY (F2; we
//      NEVER modify it). We set status='signed' only when WE computed a pass; the
//      trigger recomputes from the line items and RAISES check_violation on any
//      contradictory signed → we surface the failure, never retry to force a pass.
//   2. THIS function (_shared/rubric.computeSignoffOutcome) — defense in depth.
//   3. The UI (apps/web) — UX only; never the boundary.
//
// Rubric is materialized from the canonical academy.signoff_line_item_templates
// (by course_id), dimension + is_critical_safety TEMPLATE-authoritative — the
// client supplies scores only, so it can neither drop nor unflag a critical-safety
// line. Promotion to competency_state='field_proven' (for the CANDIDATE) happens
// ONLY on a true, signed pass. Immutability + the append-only audit are DB-enforced.
//
// AUTHORIZATION (re-checked here; service_role has no RLS backstop for it): role
// 'evaluator' AND a live academy.evaluator_authorizations row (status='authorized',
// not expired, the course's domain ∈ domains[]) in the caller's org — read from the
// TABLE, never the (stale-until-refresh) JWT claim alone.
//
// Idempotent: the client supplies a stable signoff_id (the offline-draft id); a
// re-run after a network blip does not create a duplicate signed sign-off.
//
// supabase-js has NO multi-statement transaction; writes are ordered
// draft → line_items+evidence → sign → promote → audit so a partial failure is safe
// and re-runnable. (True all-or-nothing would need a SECURITY DEFINER RPC = an F2
// migration, which is out of M6 scope — see docs/m6-signoff/RELEASE_GATES.md.)
//
// Deno: deps resolve via supabase/functions/deno.json. The service-role key lives
// in the function env (Supabase Vault), never a client bundle (invariant 8).
// ============================================================================
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  computeSignoffOutcome,
  materializeLineItems,
  safetyVetoTriggered,
  type TemplateLine,
} from '../_shared/rubric.ts';
import { assertEvaluatorAuthorized } from '../_shared/authz.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const finalizeSchema = z.object({
  action: z.literal('finalize'),
  signoff_id: z.string().uuid(), // client-supplied stable id (idempotent finalize)
  candidate_user_id: z.string().uuid(),
  course_id: z.string().uuid(),
  competency_id: z.string().uuid(),
  work_os_job_id: z.string().uuid(),
  scores: z.record(z.string().min(1), z.number().int().min(0).max(3)),
  evidence: z
    .array(
      z.object({
        kind: z.enum(['photo', 'portal_screenshot', 'workos_doc', 'video', 'signature']),
        work_os_ref: z.string().min(1),
      }),
    )
    .max(50)
    .optional(),
});

export const voidSchema = z.object({
  action: z.literal('void'),
  signoff_id: z.string().uuid(),
  void_reason: z.string().min(3),
  superseded_by: z.string().uuid().optional(),
});

export const bodySchema = z.discriminatedUnion('action', [finalizeSchema, voidSchema]);

/** Read verified-token claims (payload only; the token itself is verified by getUser). */
export function readClaims(token: string): { sub?: string; org_id?: string; roles: string[] } {
  const parts = token.split('.');
  if (parts.length !== 3) return { roles: [] };
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    b64 += '='.repeat((4 - (b64.length % 4)) % 4);
    const p = JSON.parse(atob(b64)) as { sub?: string; org_id?: string; roles?: string[] };
    return { sub: p.sub, org_id: p.org_id, roles: Array.isArray(p.roles) ? p.roles : [] };
  } catch {
    return { roles: [] };
  }
}

/** The HTTP entry: authn (getUser) → claims → service-role client → finalize/void.
 *  index.ts wires this into Deno.serve; kept here so the logic is importable in tests. */
export async function handleRequest(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authzHeader = req.headers.get('authorization') ?? '';
  const token = authzHeader.startsWith('Bearer ') ? authzHeader.slice(7) : '';
  if (!token) return json({ error: 'unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'misconfigured' }, 500);

  // Verify the caller (authn). roles/org_id come from the verified token claims.
  const asCaller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await asCaller.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);
  const evaluatorId = userData.user.id;
  const { org_id: orgId, roles } = readClaims(token);
  if (!orgId) return json({ error: 'no_org_claim' }, 403);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);

  // Service-role client: the only role that may flip status→signed/void + write
  // competency_state. RLS is bypassed by design — this function IS the boundary.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const db = admin.schema('academy');

  if (parsed.data.action === 'void') {
    return await handleVoid(admin, db, { evaluatorId, orgId, roles }, parsed.data);
  }
  return await handleFinalize(admin, db, { evaluatorId, orgId, roles }, parsed.data);
}

export interface Caller {
  evaluatorId: string;
  orgId: string;
  roles: string[];
}
// deno-lint-ignore no-explicit-any
export type AcademyDb = ReturnType<SupabaseClient<any, any, any>['schema']>;

export async function handleFinalize(
  // deno-lint-ignore no-explicit-any
  admin: SupabaseClient<any, any, any>,
  db: AcademyDb,
  caller: Caller,
  input: z.infer<typeof finalizeSchema>,
): Promise<Response> {
  const { evaluatorId, orgId, roles } = caller;

  // 1. Resolve the course + its domain (the authorization domain).
  const { data: course, error: courseErr } = await db
    .from('courses')
    .select('id, domain')
    .eq('id', input.course_id)
    .maybeSingle();
  if (courseErr) return json({ error: 'db_error', detail: 'course' }, 500);
  if (!course) return json({ error: 'course_not_found' }, 404);
  const domain = (course as { domain: string }).domain;

  // 2. AUTHORIZATION — the function re-checks the caller itself (service_role bypasses RLS).
  const authz = await assertEvaluatorAuthorized(admin, { userId: evaluatorId, orgId, domain, roles });
  if (!authz.ok) return json({ error: 'forbidden', reason: authz.reason }, 403);

  // 3. Idempotency: if this signoff id already exists, never re-create it — and NEVER trust
  //    the request body to name the promotion subject. A replay MUST address the SAME
  //    candidate/competency/org as the STORED row; otherwise an authorized evaluator could
  //    replay a single legitimately-signed id with a swapped candidate/competency to promote
  //    an ARBITRARY user to field_proven (the own-org check in step 4 is downstream of here).
  const { data: existing } = await db
    .from('signoffs')
    .select('id, status, outcome, evaluator_user_id, candidate_user_id, competency_id, org_id')
    .eq('id', input.signoff_id)
    .maybeSingle();
  if (existing) {
    const ex = existing as {
      status: string;
      outcome: string | null;
      evaluator_user_id: string;
      candidate_user_id: string;
      competency_id: string | null;
      org_id: string;
    };
    if (ex.evaluator_user_id !== evaluatorId) return json({ error: 'not_your_signoff' }, 403);
    // Bind the replay to the STORED subject. A mismatch is a tampered/confused retry — refuse it.
    if (
      ex.org_id !== orgId ||
      ex.candidate_user_id !== input.candidate_user_id ||
      ex.competency_id !== input.competency_id
    ) {
      return json({ error: 'signoff_mismatch' }, 409);
    }
    if (ex.status === 'signed') {
      // Already finalized as a pass — complete the promotion idempotently, using the STORED
      // subject (trust the row, not the request). If this retry actually completes a promotion
      // the original call failed to finish, repair the audit trail too; a pure replay is a no-op.
      if (ex.competency_id) {
        const prom = await promoteCompetency(db, {
          candidateId: ex.candidate_user_id,
          orgId: ex.org_id,
          competencyId: ex.competency_id,
        });
        if ('error' in prom) {
          return json({ error: 'promotion_failed', detail: prom.error, signoff_id: input.signoff_id }, 500);
        }
        if (prom.changed) {
          await db.from('audit_log').insert([
            { org_id: ex.org_id, actor_user_id: evaluatorId, action: 'signoff_signed', target_table: 'signoffs', target_id: input.signoff_id, detail: { competency_id: ex.competency_id, candidate_user_id: ex.candidate_user_id, recovered: true } },
            { org_id: ex.org_id, actor_user_id: evaluatorId, action: 'competency_promoted', target_table: 'competency_state', target_id: ex.competency_id, detail: { to: 'field_proven', signoff_id: input.signoff_id, candidate_user_id: ex.candidate_user_id, recovered: true } },
          ]);
        }
      }
      return json({ signoff_id: input.signoff_id, status: 'signed', outcome: 'pass', promoted: true, idempotent: true }, 200);
    }
    if (ex.status === 'failed') {
      return json({ signoff_id: input.signoff_id, status: 'failed', outcome: 'fail', promoted: false, idempotent: true }, 200);
    }
    if (ex.status === 'void') return json({ error: 'signoff_voided' }, 409);
    // status is 'draft'/'submitted' (a prior call created the draft but didn't finalize) →
    // fall through and finalize from the (now subject-matched) request.
  }

  // 4. Own-org checks: the candidate + the Work OS job must be in the caller's org.
  const { data: candidate } = await db
    .from('users')
    .select('id, org_id')
    .eq('id', input.candidate_user_id)
    .maybeSingle();
  if (!candidate || (candidate as { org_id: string }).org_id !== orgId) {
    return json({ error: 'candidate_not_in_org' }, 403);
  }
  const { data: jobRow } = await admin
    .schema('workos')
    .from('jobs')
    .select('id, org_id')
    .eq('id', input.work_os_job_id)
    .maybeSingle();
  if (!jobRow || (jobRow as { org_id: string }).org_id !== orgId) {
    return json({ error: 'job_not_in_org' }, 403);
  }

  // 5. Materialize the rubric from the CANONICAL templates (dimension + is_critical_safety
  //    are template-authoritative; the client only supplies scores).
  const { data: templateRows, error: tplErr } = await db
    .from('signoff_line_item_templates')
    .select('line_item_key, dimension, is_critical_safety, ordinal')
    .eq('course_id', input.course_id)
    .order('ordinal', { ascending: true });
  if (tplErr) return json({ error: 'db_error', detail: 'templates' }, 500);
  const templates = (templateRows ?? []) as TemplateLine[];
  const mat = materializeLineItems(templates, input.scores);
  if (!mat.ok) return json({ error: 'rubric_error', reason: mat.reason }, 400);
  const lines = mat.lines;

  // 6. Compute the outcome (defense in depth; the DB trigger re-enforces).
  const outcome = computeSignoffOutcome(lines);
  const vetoed = safetyVetoTriggered(lines);

  // 7. Create the draft sign-off (idempotent on the client id) — line items + evidence
  //    can only be written while the parent is NOT 'signed' (tg_signoff_child_immutable).
  const { error: upErr } = await db.from('signoffs').upsert(
    {
      id: input.signoff_id,
      candidate_user_id: input.candidate_user_id,
      evaluator_user_id: evaluatorId,
      competency_id: input.competency_id,
      course_id: input.course_id,
      work_os_job_id: input.work_os_job_id,
      org_id: orgId,
      status: 'draft',
      created_by: evaluatorId,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (upErr) return json({ error: 'db_error', detail: 'signoff_insert' }, 500);
  const signoffId = input.signoff_id;

  const { error: liErr } = await db.from('signoff_line_items').upsert(
    lines.map((l) => ({
      signoff_id: signoffId,
      dimension: l.dimension,
      line_item_key: l.line_item_key,
      score: l.score,
      is_critical_safety: l.is_critical_safety,
    })),
    { onConflict: 'signoff_id,line_item_key' },
  );
  if (liErr) return json({ error: 'db_error', detail: 'line_items' }, 500);

  // Evidence (optional): a Redex-owned immutable R2 copy key + the Work OS reference.
  if (input.evidence && input.evidence.length > 0) {
    const { error: evErr } = await db.from('signoff_evidence').insert(
      input.evidence.map((e, i) => ({
        signoff_id: signoffId,
        kind: e.kind,
        source: 'workos_job',
        r2_key: `signoffs/${signoffId}/evidence/${i}`,
        work_os_ref: e.work_os_ref,
      })),
    );
    if (evErr) return json({ error: 'db_error', detail: 'evidence' }, 500);
  }

  // 8. Finalize: set status. The DB trigger recomputes + RAISES on a bad 'signed'
  //    (the trust boundary). We set 'signed' only when WE computed 'pass'.
  const targetStatus = outcome === 'pass' ? 'signed' : 'failed';
  const { data: finalized, error: finErr } = await db
    .from('signoffs')
    .update({ status: targetStatus })
    .eq('id', signoffId)
    .select('status, outcome')
    .single();
  if (finErr || !finalized) {
    // The trigger rejected the transition (defense-in-depth disagreement) or a DB
    // error. The draft remains (harmless, un-signed). NEVER report a pass.
    return json({ error: 'finalize_rejected', detail: finErr?.message ?? 'unknown', signoff_id: signoffId }, 409);
  }
  const dbOutcome = (finalized as { outcome: string | null }).outcome;

  // 9. Promote competency ONLY on a true, signed pass (server-only, invariant 3) —
  //    for the CANDIDATE, not the caller. Then append the immutable audit.
  let promoted = false;
  if (targetStatus === 'signed' && dbOutcome === 'pass') {
    const prom = await promoteCompetency(db, {
      candidateId: input.candidate_user_id,
      orgId,
      competencyId: input.competency_id,
    });
    if ('error' in prom) return json({ error: 'promotion_failed', detail: prom.error, signoff_id: signoffId }, 500);
    promoted = true;

    // Append-only audit (DB blocks UPDATE/DELETE). M7 issue-badge later rides this field_proven.
    await db.from('audit_log').insert([
      { org_id: orgId, actor_user_id: evaluatorId, action: 'signoff_signed', target_table: 'signoffs', target_id: signoffId, detail: { competency_id: input.competency_id, work_os_job_id: input.work_os_job_id, candidate_user_id: input.candidate_user_id } },
      { org_id: orgId, actor_user_id: evaluatorId, action: 'competency_promoted', target_table: 'competency_state', target_id: input.competency_id, detail: { to: 'field_proven', signoff_id: signoffId, candidate_user_id: input.candidate_user_id } },
    ]);
  }

  return json(
    { signoff_id: signoffId, status: (finalized as { status: string }).status, outcome: dbOutcome, safety_veto_triggered: vetoed, promoted },
    200,
  );
}

/** Promote the candidate's competency to field_proven (idempotent). Never downgrades.
 *  Returns {error} on failure, else {changed} — changed=false when it was already at the top. */
export async function promoteCompetency(
  db: AcademyDb,
  p: { candidateId: string; orgId: string; competencyId: string },
): Promise<{ error: string } | { changed: boolean }> {
  const { data: cur } = await db
    .from('competency_state')
    .select('status')
    .eq('user_id', p.candidateId)
    .eq('competency_id', p.competencyId)
    .maybeSingle();
  if ((cur as { status?: string } | null)?.status === 'field_proven') return { changed: false }; // already at the top
  const { error } = await db.from('competency_state').upsert(
    {
      user_id: p.candidateId,
      org_id: p.orgId,
      competency_id: p.competencyId,
      status: 'field_proven',
      source: 'course', // no 'signoff' source enum; the sign-off is the course's prove-one
      last_event_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,competency_id' },
  );
  return error ? { error: error.message } : { changed: true };
}

/** The one legal post-sign transition: signed → void (with a void_reason). A correction
 *  is then a NEW finalize. competency demotion / badge revocation on void is M7/recert. */
export async function handleVoid(
  // deno-lint-ignore no-explicit-any
  admin: SupabaseClient<any, any, any>,
  db: AcademyDb,
  caller: Caller,
  input: z.infer<typeof voidSchema>,
): Promise<Response> {
  const { evaluatorId, orgId, roles } = caller;
  const { data: row, error } = await db
    .from('signoffs')
    .select('id, status, evaluator_user_id, org_id, course_id')
    .eq('id', input.signoff_id)
    .maybeSingle();
  if (error) return json({ error: 'db_error', detail: 'signoff' }, 500);
  if (!row) return json({ error: 'signoff_not_found' }, 404);
  const s = row as { status: string; evaluator_user_id: string; org_id: string; course_id: string | null };
  if (s.org_id !== orgId) return json({ error: 'not_in_org' }, 403);
  if (s.evaluator_user_id !== evaluatorId) return json({ error: 'not_your_signoff' }, 403);
  if (s.status !== 'signed') return json({ error: 'only_signed_can_void', status: s.status }, 409);

  // Re-check evaluator authority for the sign-off's domain (same gate as finalize).
  if (s.course_id) {
    const { data: course } = await db.from('courses').select('domain').eq('id', s.course_id).maybeSingle();
    const domain = (course as { domain?: string } | null)?.domain;
    if (domain) {
      const authz = await assertEvaluatorAuthorized(admin, { userId: evaluatorId, orgId, domain, roles });
      if (!authz.ok) return json({ error: 'forbidden', reason: authz.reason }, 403);
    }
  }

  // signed → void: the immutability trigger permits this exact transition (void_reason
  // NOT NULL, every other immutable column unchanged; superseded_by MAY be set).
  const { error: voidErr } = await db
    .from('signoffs')
    .update({ status: 'void', void_reason: input.void_reason, superseded_by: input.superseded_by ?? null })
    .eq('id', input.signoff_id);
  if (voidErr) return json({ error: 'void_rejected', detail: voidErr.message }, 409);

  await db.from('audit_log').insert({
    org_id: orgId,
    actor_user_id: evaluatorId,
    action: 'signoff_voided',
    target_table: 'signoffs',
    target_id: input.signoff_id,
    detail: { void_reason: input.void_reason, superseded_by: input.superseded_by ?? null },
  });

  return json({ signoff_id: input.signoff_id, status: 'void' }, 200);
}
