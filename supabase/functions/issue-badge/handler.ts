// ============================================================================
// supabase/functions/issue-badge/handler.ts  (Deno Edge Function) — F6
//
// The SERVER-ONLY OB 3.0 / W3C VC issuer (CLAUDE.md invariants 2, 3, 7; ledger §F).
// Resolved Deno-vs-Node decision: PATH A — a Deno-compatible eddsa-rdfc-2022
// signer co-located with the Vault-held key (see _shared/credential-signer.ts +
// ADR-0005). F6 proves the issuer with a TEST credential; M7 reuses this path to
// issue real slice badges from real sign-offs.
//
// Runs as the SERVICE ROLE (it must write academy.credentials +
// credential_status_list, which NO end-user role may do), so it BYPASSES RLS and
// is therefore THE access-control boundary: it re-checks the caller's role here
// and REFUSES any non-issuer. A learner/evaluator can NEVER mint a badge
// (invariant 5) — issuance is not a client-reachable, self-service path.
//
// The Ed25519 private key is read from the function env (Supabase Vault) as a
// secretKeyMultibase and NEVER leaves the server, is never logged, and is never
// in a client bundle (invariant 8). Each credential is self-verified before it
// is persisted — we never store a credential we cannot verify.
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
} from '../../../packages/credentials/src/issuer-config.ts';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Roles permitted to ISSUE a credential. Issuance is never a learner path
 *  (invariant 5). M7 invokes this server-to-server on a real, passing sign-off. */
export const ISSUER_ROLES = ['org_admin', 'exec', 'support', 'curriculum_admin'] as const;
export function isAuthorizedIssuer(roles: readonly string[]): boolean {
  return roles.some((r) => (ISSUER_ROLES as readonly string[]).includes(r));
}

export const bodySchema = z.object({
  recipient_user_id: z.string().uuid(),
  badge_class_id: z.string().uuid(),
  /** The credentialSubject.id (a DID / stable recipient ref). Optional for tests. */
  recipient_did: z.string().min(1).optional(),
  achievement: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    criteria: z.object({ narrative: z.string().optional(), id: z.string().optional() }).optional(),
  }),
  validUntil: z.string().optional(),
  evidence_urls: z.array(z.string().min(1)).max(50).optional(),
});
export type IssueBadgeBody = z.infer<typeof bodySchema>;

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

/** Build → sign → SELF-VERIFY a credential. Pure given the issuer key + ids, so
 *  it is unit-testable (handler.test.ts) without a DB. Throws if the freshly
 *  produced proof does not verify (we never persist an unverifiable credential). */
export async function buildAndSignCredential(opts: {
  body: IssueBadgeBody;
  issuer: IssuerEnv;
  credentialId: string;
  statusListIndex: number;
  created: string;
}): Promise<{
  credential: Record<string, unknown>;
  verificationMethod: string;
}> {
  const ep = resolveIssuerEndpoints(opts.issuer.did);
  const verificationMethod = `${opts.issuer.did}#${opts.issuer.keyId}`;
  const { privateKey, publicKey } = loadSigningKey(opts.issuer.secretKeyMultibase);

  const input: AchievementInput = {
    credentialId: opts.credentialId,
    issuer: { id: opts.issuer.did, type: ['Profile'], name: 'Redex Academy' },
    ...(opts.body.recipient_did ? { recipientId: opts.body.recipient_did } : {}),
    achievement: { ...opts.body.achievement, type: ['Achievement'] },
    validFrom: opts.created,
    ...(opts.body.validUntil ? { validUntil: opts.body.validUntil } : {}),
    credentialStatus: {
      id: `${ep.statusListUrl}#${opts.statusListIndex}`,
      type: 'BitstringStatusListEntry',
      statusPurpose: 'revocation',
      statusListIndex: String(opts.statusListIndex),
      statusListCredential: ep.statusListUrl,
    },
    ...(opts.body.evidence_urls
      ? { evidence: opts.body.evidence_urls.map((id) => ({ id, type: ['Evidence'] })) }
      : {}),
  };

  const unsigned = buildUnsignedCredential(input);
  const credential = await signCredential(unsigned, {
    privateKey,
    verificationMethod,
    created: opts.created,
  });

  // Defense in depth: never persist a credential we cannot verify ourselves.
  if (!(await verifyCredential(credential, publicKey))) {
    throw new Error('self-verification failed — refusing to persist an unverifiable credential');
  }
  return { credential, verificationMethod };
}

/** Allocate the next BitstringStatusList slot (service-role). NOTE: max+1 is not
 *  atomic under concurrent issuance, but `credential_status_list.list_index` is
 *  UNIQUE — a racing collision FAILS the insert (→ 500, retriable), never silently
 *  reuses a slot, so revocation lookups stay correct. M7 (real volume) replaces
 *  this with a DB sequence / SELECT … FOR UPDATE. F6 issues a low-volume test badge. */
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

  // authz — issuance is NOT a self-service learner path (invariant 5).
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

  try {
    const ep = resolveIssuerEndpoints(issuerDid);
    const credentialUuid = crypto.randomUUID();
    const credentialId = `${ep.assertionBaseUrl}/${credentialUuid}`;
    const statusListIndex = await allocateStatusIndex(db);
    const created = new Date().toISOString();

    const { credential, verificationMethod } = await buildAndSignCredential({
      body: parsed.data,
      issuer: { did: issuerDid, keyId, secretKeyMultibase },
      credentialId,
      statusListIndex,
      created,
    });

    const hostedAssertionUrl = credentialId;
    const { proof, ...rest } = credential as { proof: unknown } & Record<string, unknown>;
    void rest;

    const { error: insErr } = await db.from('credentials').insert({
      id: credentialUuid,
      badge_class_id: parsed.data.badge_class_id,
      recipient_user_id: parsed.data.recipient_user_id,
      org_id: orgId,
      status: 'active',
      open_badge_json: credential,
      proof,
      hosted_assertion_url: hostedAssertionUrl,
      status_list_index: statusListIndex,
      evidence_urls: parsed.data.evidence_urls ?? [],
    });
    if (insErr) return json({ error: 'persist_failed', detail: insErr.message }, 500);

    const { error: slErr } = await db
      .from('credential_status_list')
      .insert({ list_index: statusListIndex, credential_id: credentialUuid, revoked: false });
    if (slErr) return json({ error: 'status_list_write_failed', detail: slErr.message }, 500);

    return json({
      credential_id: credentialUuid,
      hosted_assertion_url: hostedAssertionUrl,
      verification_method: verificationMethod,
      status_list_index: statusListIndex,
      credential,
    });
  } catch (err) {
    return json({ error: 'issuance_failed', detail: (err as Error).message }, 500);
  }
}
