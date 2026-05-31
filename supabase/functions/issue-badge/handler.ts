// ============================================================================
// supabase/functions/issue-badge/handler.ts  (Deno Edge Function) — F6 + M7
//
// The SERVER-ONLY OB 3.0 / W3C VC issuer (CLAUDE.md invariants 1, 2, 3, 7; ledger
// §F/§D). Resolved Deno-vs-Node decision: PATH A — a Deno-compatible eddsa-rdfc-2022
// signer co-located with the Vault-held key (see _shared/credential-signer.ts).
//
// Two actions:
//   • action:'issue-test' (F6) — issue a single explicit test credential.
//   • action:'rollup'     (M7) — the STACKABILITY ROLLUP. On a candidate's
//     field_proven competency (set by M6's finalize-signoff), issue the matching
//     SKILL badge with evidence URLs pointing at the REAL signoff_evidence/job
//     records, then AUTO-ISSUE the tier credential when all its component skill
//     badges are held (ledger §D). Reuses F6's builder/signer — it does NOT
//     re-invent the credential shape (invariant 5).
//
// SERVER-AUTHORITATIVE GUARDS (invariant 1 — a badge may ride ONLY a veto-passed,
// field_proven sign-off): the rollup re-reads competency_state (must be
// 'field_proven') AND the signoff (must be status='signed', outcome='pass', and
// match the candidate+competency) from the DB before issuing. The client's word is
// never trusted. Runs as the SERVICE ROLE → it is THE access-control boundary and
// refuses any non-issuer caller; a learner can never mint a badge (invariant 5).
// The Ed25519 key is read from the function env (Vault), never logged or bundled.
// ============================================================================
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  buildUnsignedCredential,
  signCredential,
  verifyCredential,
  loadSigningKey,
  type AchievementInput,
} from '../_shared/credential-signer.ts';
import {
  DEFAULT_ISSUER_DID,
  resolveIssuerEndpoints,
  type IssuerEndpoints,
} from '../../../packages/credentials/src/issuer-config.ts';
import {
  resolveSkillBadgeForCompetency,
  tiersRequiringSkill,
  shouldAutoIssueTier,
  recertValidUntil,
  type BadgeClass,
} from '../_shared/stackability.ts';
import { signStatusListCredential } from '../_shared/status-republish.ts';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Roles permitted to ISSUE/roll up a credential. Never a learner path (invariant 5).
 *  M7's rollup is invoked server-to-server after M6's finalize flips field_proven. */
export const ISSUER_ROLES = ['org_admin', 'exec', 'support', 'curriculum_admin'] as const;
export function isAuthorizedIssuer(roles: readonly string[]): boolean {
  return roles.some((r) => (ISSUER_ROLES as readonly string[]).includes(r));
}

const achievementSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  criteria: z.object({ narrative: z.string().optional(), id: z.string().optional() }).optional(),
});

/** F6 — explicit single-credential test issuance. */
export const issueTestSchema = z.object({
  action: z.literal('issue-test'),
  recipient_user_id: z.string().uuid(),
  badge_class_id: z.string().uuid(),
  recipient_did: z.string().min(1).optional(),
  achievement: achievementSchema,
  validUntil: z.string().optional(),
  evidence_urls: z.array(z.string().min(1)).max(50).optional(),
});

/** M7 — the stackability rollup off a field_proven competency. */
export const rollupSchema = z.object({
  action: z.literal('rollup'),
  candidate_user_id: z.string().uuid(),
  competency_id: z.string().uuid(),
  signoff_id: z.string().uuid(),
});

/** M7 — revoke a credential + republish the (re-signed) status list. */
export const revokeSchema = z.object({
  action: z.literal('revoke'),
  credential_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
  /** Defaults to 'revoked'; 'recert_required' for the retired-version rule. */
  status: z.enum(['revoked', 'recert_required']).optional(),
});

export const bodySchema = z.discriminatedUnion('action', [issueTestSchema, rollupSchema, revokeSchema]);
export type IssueTestBody = z.infer<typeof issueTestSchema>;
export type RollupBody = z.infer<typeof rollupSchema>;
export type RevokeBody = z.infer<typeof revokeSchema>;

/** Read verified-token claims (payload only; the token is verified by getUser). */
export function readClaims(token: string): { sub?: string; org_id?: string; roles: string[] } {
  const parts = token.split('.');
  if (parts.length !== 3) return { roles: [] };
  try {
    let b64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    b64 += '='.repeat((4 - (b64.length % 4)) % 4);
    const p = JSON.parse(atob(b64)) as { sub?: string; org_id?: string; roles?: string[] };
    return { sub: p.sub, org_id: p.org_id, roles: Array.isArray(p.roles) ? p.roles : [] };
  } catch {
    return { roles: [] };
  }
}

export interface IssuerEnv {
  did: string;
  keyId: string;
  secretKeyMultibase: string;
}

export interface CredentialSpec {
  recipientId?: string;
  achievement: AchievementInput['achievement'];
  evidenceUrls: string[];
  validUntil?: string;
}

/** Build → sign → SELF-VERIFY a credential from a normalized spec. Pure given the
 *  issuer key + ids (unit-testable without a DB). Throws if the fresh proof does
 *  not verify (never persist an unverifiable credential). Reused by F6 + M7. */
export async function buildAndSignCredential(opts: {
  spec: CredentialSpec;
  issuer: IssuerEnv;
  credentialId: string;
  statusListIndex: number;
  created: string;
  endpoints: IssuerEndpoints;
}): Promise<{ credential: Record<string, unknown>; verificationMethod: string }> {
  const verificationMethod = `${opts.issuer.did}#${opts.issuer.keyId}`;
  const { privateKey, publicKey } = loadSigningKey(opts.issuer.secretKeyMultibase);

  const input: AchievementInput = {
    credentialId: opts.credentialId,
    issuer: { id: opts.issuer.did, type: ['Profile'], name: 'Redex Academy' },
    ...(opts.spec.recipientId ? { recipientId: opts.spec.recipientId } : {}),
    achievement: { ...opts.spec.achievement, type: ['Achievement'] },
    validFrom: opts.created,
    ...(opts.spec.validUntil ? { validUntil: opts.spec.validUntil } : {}),
    credentialStatus: {
      id: `${opts.endpoints.statusListUrl}#${opts.statusListIndex}`,
      type: 'BitstringStatusListEntry',
      statusPurpose: 'revocation',
      statusListIndex: String(opts.statusListIndex),
      statusListCredential: opts.endpoints.statusListUrl,
    },
    ...(opts.spec.evidenceUrls.length
      ? { evidence: opts.spec.evidenceUrls.map((id) => ({ id, type: ['Evidence'] })) }
      : {}),
  };

  const unsigned = buildUnsignedCredential(input);
  const credential = await signCredential(unsigned, { privateKey, verificationMethod, created: opts.created });
  if (!(await verifyCredential(credential, publicKey))) {
    throw new Error('self-verification failed — refusing to persist an unverifiable credential');
  }
  return { credential, verificationMethod };
}

/** Allocate the next BitstringStatusList slot (service-role). NOTE: max+1 is not
 *  atomic under concurrent issuance, but `credential_status_list.list_index` is
 *  UNIQUE — a racing collision FAILS the insert (→ retriable), never silently
 *  reuses a slot, so revocation lookups stay correct. */
async function allocateStatusIndex(db: ReturnType<SupabaseClient['schema']>): Promise<number> {
  const { data, error } = await db
    .from('credential_status_list')
    .select('list_index')
    .order('list_index', { ascending: false })
    .limit(1);
  if (error) throw new Error(`status-index allocation failed: ${error.message}`);
  const max = data && data.length > 0 ? Number((data[0] as { list_index: number }).list_index) : -1;
  return max + 1;
}

interface IssueResult {
  credential_id: string;
  badge_class_key?: string;
  hosted_assertion_url: string;
  status_list_index: number;
  credential: Record<string, unknown>;
}

/** Issue ONE credential for a recipient (build+sign+persist credentials + status row). */
async function issueOneCredential(
  db: ReturnType<SupabaseClient['schema']>,
  opts: {
    badgeClassId: string;
    recipientUserId: string;
    orgId: string;
    spec: CredentialSpec;
    issuer: IssuerEnv;
    endpoints: IssuerEndpoints;
    created: string;
  },
): Promise<IssueResult> {
  const statusListIndex = await allocateStatusIndex(db);
  const credentialUuid = crypto.randomUUID();
  const credentialId = `${opts.endpoints.assertionBaseUrl}/${credentialUuid}`;

  // RESERVE the status-list slot FIRST (credential_id NULL) so the UNIQUE on
  // list_index makes allocation atomic: a concurrent issuance that picked the same
  // max+1 loses HERE (before any credential row is written), so it never leaves an
  // active-but-unlinked credential (the orphan). The credential is persisted only
  // after the slot is secured, then the link is completed.
  const { error: reserveErr } = await db
    .from('credential_status_list')
    .insert({ list_index: statusListIndex, credential_id: null, revoked: false });
  if (reserveErr) throw new Error(`status_index_reservation_failed: ${reserveErr.message}`);

  const { credential } = await buildAndSignCredential({
    spec: opts.spec,
    issuer: opts.issuer,
    credentialId,
    statusListIndex,
    created: opts.created,
    endpoints: opts.endpoints,
  });

  const { proof } = credential as { proof: unknown };
  const { error: insErr } = await db.from('credentials').insert({
    id: credentialUuid,
    badge_class_id: opts.badgeClassId,
    recipient_user_id: opts.recipientUserId,
    org_id: opts.orgId,
    status: 'active',
    open_badge_json: credential,
    proof,
    hosted_assertion_url: credentialId,
    status_list_index: statusListIndex,
    evidence_urls: opts.spec.evidenceUrls,
    ...(opts.spec.validUntil ? { expires_at: opts.spec.validUntil } : {}),
  });
  if (insErr) throw new Error(`persist_failed: ${insErr.message}`);

  // Link the reserved slot to the now-persisted credential.
  const { error: linkErr } = await db
    .from('credential_status_list')
    .update({ credential_id: credentialUuid })
    .eq('list_index', statusListIndex);
  if (linkErr) throw new Error(`status_list_link_failed: ${linkErr.message}`);

  return {
    credential_id: credentialUuid,
    hosted_assertion_url: credentialId,
    status_list_index: statusListIndex,
    credential,
  };
}

/** Build the recipient subject id (a stable URN for the candidate user). */
const recipientUrn = (userId: string): string => `urn:uuid:${userId}`;

/** Build a credential achievement from a badge_class row. */
function achievementForBadge(badge: BadgeClass, ep: IssuerEndpoints): AchievementInput['achievement'] {
  return {
    id: `${ep.origin}/achievements/${badge.key}`,
    type: ['Achievement'],
    name: badge.title,
  };
}

// ── M7 stackability rollup ──────────────────────────────────────────────────

export interface RollupContext {
  candidateUserId: string;
  competencyId: string;
  signoffId: string;
  orgId: string;
  issuer: IssuerEnv;
  endpoints: IssuerEndpoints;
  created: string;
}

export type RollupOutcome =
  | { ok: false; status: number; error: string }
  | { ok: true; issued: IssueResult[]; tier_issued: boolean; skill_badge_key: string };

/**
 * THE M7 rollup. Server-authoritative: re-reads competency_state + the signoff
 * from the DB (never trusts the caller) so a badge can ride ONLY a real,
 * veto-passed, field_proven sign-off (invariant 1). Idempotent: re-running does
 * not double-issue (it returns the already-held credential).
 */
export async function runRollup(
  db: ReturnType<SupabaseClient['schema']>,
  ctx: RollupContext,
): Promise<RollupOutcome> {
  // 1. GUARD: the competency must actually be field_proven for this candidate.
  const { data: stateRow, error: stateErr } = await db
    .from('competency_state')
    .select('status, org_id')
    .eq('user_id', ctx.candidateUserId)
    .eq('competency_id', ctx.competencyId)
    .maybeSingle();
  if (stateErr) return { ok: false, status: 500, error: `state_read_error: ${stateErr.message}` };
  if (!stateRow || (stateRow as { status: string }).status !== 'field_proven') {
    return { ok: false, status: 409, error: 'not_field_proven' };
  }

  // 2. GUARD: the sign-off must be a real signed PASS for this candidate+competency.
  const { data: signoff, error: soErr } = await db
    .from('signoffs')
    .select('id, candidate_user_id, competency_id, status, outcome, work_os_job_id, org_id')
    .eq('id', ctx.signoffId)
    .maybeSingle();
  if (soErr) return { ok: false, status: 500, error: `signoff_read_error: ${soErr.message}` };
  const so = signoff as
    | { candidate_user_id: string; competency_id: string; status: string; outcome: string | null; work_os_job_id: string | null; org_id: string }
    | null;
  if (
    !so ||
    so.candidate_user_id !== ctx.candidateUserId ||
    so.competency_id !== ctx.competencyId ||
    so.status !== 'signed' ||
    so.outcome !== 'pass'
  ) {
    return { ok: false, status: 409, error: 'signoff_not_a_signed_pass_for_candidate' };
  }

  // GUARD: tenant isolation (invariant 4). The credential is tagged with the
  // caller's org; refuse if the field_proven state OR the proving sign-off belong
  // to a DIFFERENT org than the caller — an issuer in org A may not mint a badge
  // off org B's sign-off (the service role bypasses RLS, so we check explicitly).
  if ((stateRow as { org_id: string }).org_id !== ctx.orgId || so.org_id !== ctx.orgId) {
    return { ok: false, status: 403, error: 'cross_org_refused' };
  }

  // 3. Resolve the competency code for the resolver.
  const { data: comp, error: compErr } = await db
    .from('competencies')
    .select('code')
    .eq('id', ctx.competencyId)
    .maybeSingle();
  if (compErr || !comp) return { ok: false, status: 500, error: 'competency_read_error' };
  const competencyCode = (comp as { code: string }).code;

  // 4. Load the badge catalog (S1's badge_classes) + resolve the skill badge.
  const { data: badgeRows, error: bcErr } = await db
    .from('badge_classes')
    .select('id, key, kind, title, requires, recert_months, is_compliance');
  if (bcErr || !badgeRows) return { ok: false, status: 500, error: 'badge_classes_read_error' };
  const badges = badgeRows as BadgeClass[];
  const skill = resolveSkillBadgeForCompetency(badges, competencyCode);
  if (!skill) return { ok: false, status: 422, error: 'no_skill_badge_for_competency' };

  // 5. Gather REAL evidence URLs from the proving sign-off (signoff_evidence + job).
  const { data: evRows } = await db
    .from('signoff_evidence')
    .select('id')
    .eq('signoff_id', ctx.signoffId);
  const evidenceUrls = [
    ...((evRows ?? []) as { id: string }[]).map(
      (e) => `${ctx.endpoints.origin}/evidence/${ctx.signoffId}/${e.id}`,
    ),
    ...(so.work_os_job_id ? [`${ctx.endpoints.origin}/workos/jobs/${so.work_os_job_id}`] : []),
  ];

  const issued: IssueResult[] = [];

  // 6. Issue the SKILL badge (idempotent — skip if already actively held).
  const { data: heldSkill } = await db
    .from('credentials')
    .select('id')
    .eq('recipient_user_id', ctx.candidateUserId)
    .eq('badge_class_id', skill.id)
    .eq('status', 'active')
    .limit(1);
  if (!heldSkill || heldSkill.length === 0) {
    const res = await issueOneCredential(db, {
      badgeClassId: skill.id,
      recipientUserId: ctx.candidateUserId,
      orgId: ctx.orgId,
      spec: {
        recipientId: recipientUrn(ctx.candidateUserId),
        achievement: achievementForBadge(skill, ctx.endpoints),
        evidenceUrls,
        validUntil: recertValidUntil(skill.recert_months, ctx.created),
      },
      issuer: ctx.issuer,
      endpoints: ctx.endpoints,
      created: ctx.created,
    });
    issued.push({ ...res, badge_class_key: skill.key });
  }

  // 7. TIER auto-issue: a tier rides ONLY when ALL its component skill badges are
  //    held (ledger §D; never a tier without its components — the M7 red flag).
  let tierIssued = false;
  const { data: heldRows } = await db
    .from('credentials')
    .select('badge_class_id, badge_classes!inner(key, kind)')
    .eq('recipient_user_id', ctx.candidateUserId)
    .eq('status', 'active');
  const heldKeys = new Set<string>(
    ((heldRows ?? []) as { badge_classes: { key: string; kind: string } | { key: string; kind: string }[] }[])
      .flatMap((r) => (Array.isArray(r.badge_classes) ? r.badge_classes : [r.badge_classes]))
      .filter((b) => b && b.kind === 'skill')
      .map((b) => b.key),
  );
  heldKeys.add(skill.key); // include the just-issued skill

  for (const tier of tiersRequiringSkill(badges, skill.key)) {
    if (!shouldAutoIssueTier(tier, heldKeys)) continue;
    const { data: heldTier } = await db
      .from('credentials')
      .select('id')
      .eq('recipient_user_id', ctx.candidateUserId)
      .eq('badge_class_id', tier.id)
      .eq('status', 'active')
      .limit(1);
    if (heldTier && heldTier.length > 0) continue; // already held — idempotent
    const res = await issueOneCredential(db, {
      badgeClassId: tier.id,
      recipientUserId: ctx.candidateUserId,
      orgId: ctx.orgId,
      spec: {
        recipientId: recipientUrn(ctx.candidateUserId),
        achievement: achievementForBadge(tier, ctx.endpoints),
        evidenceUrls, // provenance back to the proving sign-off(s)
        validUntil: recertValidUntil(tier.recert_months, ctx.created),
      },
      issuer: ctx.issuer,
      endpoints: ctx.endpoints,
      created: ctx.created,
    });
    issued.push({ ...res, badge_class_key: tier.key });
    tierIssued = true;
  }

  return { ok: true, issued, tier_issued: tierIssued, skill_badge_key: skill.key };
}

export type RevokeOutcome =
  | { ok: false; status: number; error: string }
  | { ok: true; revoked_index: number; status_list_credential: Record<string, unknown> };

/**
 * Revoke a credential + REPUBLISH the status list so the change reaches verifiers
 * (the M7 revocation-propagation requirement): flip credentials.status +
 * credential_status_list.revoked, then rebuild the BitstringStatusList from the
 * CURRENT revoked set and re-sign it (server-only). Tenant-guarded. Returns the
 * re-signed list; publishing it to the status-list Worker's KV is the deploy step.
 */
export async function runRevoke(
  db: ReturnType<SupabaseClient['schema']>,
  ctx: {
    credentialId: string;
    orgId: string;
    reason?: string;
    newStatus: 'revoked' | 'recert_required';
    issuer: IssuerEnv;
    endpoints: IssuerEndpoints;
    created: string;
  },
): Promise<RevokeOutcome> {
  const { data: cred, error: cErr } = await db
    .from('credentials')
    .select('id, org_id, status_list_index')
    .eq('id', ctx.credentialId)
    .maybeSingle();
  if (cErr) return { ok: false, status: 500, error: `credential_read_error: ${cErr.message}` };
  const c = cred as { org_id: string; status_list_index: number | null } | null;
  if (!c) return { ok: false, status: 404, error: 'credential_not_found' };
  if (c.org_id !== ctx.orgId) return { ok: false, status: 403, error: 'cross_org_refused' };
  if (c.status_list_index == null) {
    return { ok: false, status: 409, error: 'credential_has_no_status_index' };
  }

  const { error: upErr } = await db
    .from('credentials')
    .update({ status: ctx.newStatus, ...(ctx.reason ? { revocation_reason: ctx.reason } : {}) })
    .eq('id', ctx.credentialId);
  if (upErr) return { ok: false, status: 500, error: `status_flip_failed: ${upErr.message}` };

  const { error: slErr } = await db
    .from('credential_status_list')
    .update({ revoked: true, ...(ctx.reason ? { reason: ctx.reason } : {}) })
    .eq('credential_id', ctx.credentialId);
  if (slErr) return { ok: false, status: 500, error: `status_list_flip_failed: ${slErr.message}` };

  // Rebuild the published list from the CURRENT revoked set and re-sign it.
  const { data: revokedRows, error: rErr } = await db
    .from('credential_status_list')
    .select('list_index')
    .eq('revoked', true);
  if (rErr) return { ok: false, status: 500, error: `revoked_set_read_error: ${rErr.message}` };
  const revokedIndices = ((revokedRows ?? []) as { list_index: number }[]).map((r) =>
    Number(r.list_index),
  );
  const statusListCredential = await signStatusListCredential(revokedIndices, {
    issuer: ctx.issuer,
    endpoints: ctx.endpoints,
    created: ctx.created,
  });

  return {
    ok: true,
    revoked_index: Number(c.status_list_index),
    status_list_credential: statusListCredential,
  };
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authzHeader = req.headers.get('authorization') ?? '';
  const token = authzHeader.startsWith('Bearer ') ? authzHeader.slice(7) : '';
  if (!token) return json({ error: 'unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const secretKeyMultibase = Deno.env.get('OB_ISSUER_PRIVATE_KEY');
  const issuerDid = Deno.env.get('OB_ISSUER_DID') ?? DEFAULT_ISSUER_DID;
  const keyId = Deno.env.get('OB_ISSUER_KEY_ID') ?? 'key-2026-05';
  if (!supabaseUrl || !anonKey || !serviceKey || !secretKeyMultibase) {
    return json({ error: 'misconfigured' }, 500);
  }

  // authn — verify the caller.
  const asCaller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await asCaller.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);
  const { org_id: orgId, roles } = readClaims(token);
  if (!orgId) return json({ error: 'no_org_claim' }, 403);

  // authz — issuance/rollup is NOT a self-service learner path (invariant 5).
  if (!isAuthorizedIssuer(roles)) return json({ error: 'not_authorized_to_issue' }, 403);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const db = admin.schema('academy');
  const issuer: IssuerEnv = { did: issuerDid, keyId, secretKeyMultibase };
  const endpoints = resolveIssuerEndpoints(issuerDid);
  const created = new Date().toISOString();

  try {
    if (parsed.data.action === 'revoke') {
      const outcome = await runRevoke(db, {
        credentialId: parsed.data.credential_id,
        orgId,
        ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
        newStatus: parsed.data.status ?? 'revoked',
        issuer,
        endpoints,
        created,
      });
      if (!outcome.ok) return json({ error: outcome.error }, outcome.status);
      return json({
        revoked_index: outcome.revoked_index,
        status_list_url: endpoints.statusListUrl,
        status_list_credential: outcome.status_list_credential,
      });
    }

    if (parsed.data.action === 'rollup') {
      const outcome = await runRollup(db, {
        candidateUserId: parsed.data.candidate_user_id,
        competencyId: parsed.data.competency_id,
        signoffId: parsed.data.signoff_id,
        orgId,
        issuer,
        endpoints,
        created,
      });
      if (!outcome.ok) return json({ error: outcome.error }, outcome.status);
      return json({
        skill_badge_key: outcome.skill_badge_key,
        tier_issued: outcome.tier_issued,
        issued: outcome.issued.map((r) => ({
          credential_id: r.credential_id,
          badge_class_key: r.badge_class_key,
          hosted_assertion_url: r.hosted_assertion_url,
          status_list_index: r.status_list_index,
        })),
      });
    }

    // F6 — explicit single test credential.
    const body = parsed.data;
    const res = await issueOneCredential(db, {
      badgeClassId: body.badge_class_id,
      recipientUserId: body.recipient_user_id,
      orgId,
      spec: {
        ...(body.recipient_did ? { recipientId: body.recipient_did } : {}),
        achievement: { ...body.achievement, type: ['Achievement'] },
        evidenceUrls: body.evidence_urls ?? [],
        ...(body.validUntil ? { validUntil: body.validUntil } : {}),
      },
      issuer,
      endpoints,
      created,
    });
    return json({
      credential_id: res.credential_id,
      hosted_assertion_url: res.hosted_assertion_url,
      status_list_index: res.status_list_index,
      credential: res.credential,
    });
  } catch (err) {
    return json({ error: 'issuance_failed', detail: (err as Error).message }, 500);
  }
}
