// ============================================================================
// issue-badge/rollup.test.ts (Deno) — M7 stackability-rollup integration test.
//
// Drives runRollup() with a faithful in-memory fake of the supabase-js query
// surface (the CI deno job has no PostgREST). Signing is REAL (the proven F6
// signer); only the DATA boundary is faked. Proves the M7 done-criteria:
//   • the field_proven + signed-PASS guards (a badge rides ONLY a real,
//     veto-passed, field_proven sign-off — invariant 1);
//   • the skill badge issues with REAL evidence URLs (signoff_evidence + job)
//     and a signed, VERIFIABLE proof + 12-mo recert (egress);
//   • the tier auto-issues ONLY when all component skills are held (never a
//     tier without its components), and verifies;
//   • revocation flips the status-list bit;
//   • idempotency (re-run does not double-issue).
// Run by the deno-check CI job.
// ============================================================================
import { assert, assertEquals, assertFalse } from '@std/assert';
import { runRollup, runRevoke, type RollupContext } from './handler.ts';
import { verifyCredential, loadSigningKey } from '../_shared/credential-signer.ts';
import { isIndexRevoked } from '../_shared/status-republish.ts';
import { resolveIssuerEndpoints } from '../../../packages/credentials/src/issuer-config.ts';
import { ed25519SecretKeyMultibase } from '../../../packages/credentials/src/multibase.ts';
import { TEST_SEED_BYTES, TEST_ISSUER_DID } from '../../../packages/credentials/src/test-vector-data.ts';

const SEED = new Uint8Array(TEST_SEED_BYTES);
const SECRET = ed25519SecretKeyMultibase(SEED);
const PUB = loadSigningKey(SECRET).publicKey;
const ISSUER = { did: TEST_ISSUER_DID, keyId: 'key-test-0', secretKeyMultibase: SECRET };
const ENDPOINTS = resolveIssuerEndpoints(TEST_ISSUER_DID);
const ORG = 'org-1';
const CANDIDATE = '11111111-1111-1111-1111-111111111111';

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

/** Minimal in-memory fake of the supabase-js `.schema('academy')` query surface. */
class FakeDb {
  tables: Record<string, Row[]>;
  constructor(seed: Record<string, Row[]>) {
    this.tables = seed;
  }
  from(table: string) {
    return new FakeQuery(this, table);
  }
}

class FakeQuery {
  private filters: [string, unknown][] = [];
  private cols = '';
  private orderCol: string | null = null;
  private orderAsc = true;
  private lim: number | null = null;
  private updateRow: Row | null = null;
  constructor(
    private db: FakeDb,
    private table: string,
  ) {}
  select(cols: string) {
    this.cols = cols;
    return this;
  }
  update(row: Row) {
    this.updateRow = row;
    return this;
  }
  eq(c: string, v: unknown) {
    this.filters.push([c, v]);
    return this;
  }
  order(c: string, opts: { ascending: boolean }) {
    this.orderCol = c;
    this.orderAsc = opts.ascending;
    return this;
  }
  limit(n: number) {
    this.lim = n;
    return this;
  }
  private rows(): Row[] {
    let rows = (this.db.tables[this.table] ?? []).filter((r) =>
      this.filters.every(([c, v]) => r[c] === v),
    );
    if (this.orderCol) {
      const col = this.orderCol;
      rows = [...rows].sort((a, b) => (a[col] - b[col]) * (this.orderAsc ? 1 : -1));
    }
    if (this.lim != null) rows = rows.slice(0, this.lim);
    // Resolve a `badge_classes!inner(key, kind)` join on badge_class_id.
    if (this.cols.includes('badge_classes!inner')) {
      const badges = this.db.tables['badge_classes'] ?? [];
      rows = rows.map((r) => ({
        badge_class_id: r.badge_class_id,
        badge_classes: badges.find((b) => b.id === r.badge_class_id) ?? null,
      }));
    }
    return rows;
  }
  maybeSingle() {
    const rows = this.rows();
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }
  insert(row: Row) {
    const t = (this.db.tables[this.table] ??= []);
    if (this.table === 'credential_status_list' && t.some((r) => r.list_index === row.list_index)) {
      return Promise.resolve({ error: { message: 'duplicate list_index' } });
    }
    t.push({ ...row });
    return Promise.resolve({ error: null });
  }
  then(resolve: (v: { data: Row[] | null; error: null }) => void) {
    if (this.updateRow) {
      const matching = (this.db.tables[this.table] ?? []).filter((r) =>
        this.filters.every(([c, v]) => r[c] === v),
      );
      for (const r of matching) Object.assign(r, this.updateRow);
      resolve({ data: null, error: null });
      return;
    }
    resolve({ data: this.rows(), error: null });
  }
}

const COMPS = [
  { id: 'c-aero', code: 'AC.AERO_SINGLE_DOOR' },
  { id: 'c-merc', code: 'AC.MERCURY_WIRING' },
  { id: 'c-mag', code: 'EGRESS.MAGLOCK_FAILSAFE' },
];
const BADGES = [
  { id: 'b-aero', key: 'skill.ac.single_door_aero', kind: 'skill', title: 'Aero', requires: { competency: 'AC.AERO_SINGLE_DOOR' }, recert_months: 24, is_compliance: false },
  { id: 'b-merc', key: 'skill.ac.mercury_wiring', kind: 'skill', title: 'Mercury', requires: { competency: 'AC.MERCURY_WIRING' }, recert_months: 24, is_compliance: false },
  { id: 'b-mag', key: 'skill.ac.maglock_rex_egress', kind: 'skill', title: 'Maglock', requires: { competency: 'EGRESS.MAGLOCK_FAILSAFE', gating: true }, recert_months: 12, is_compliance: true },
  { id: 'b-tier', key: 'tier.ac.certified_technician', kind: 'tier', title: 'Certified Technician — Access Control', requires: { badges: ['skill.ac.single_door_aero', 'skill.ac.mercury_wiring', 'skill.ac.maglock_rex_egress'], auto_issue: 'all_components_field_proven' }, recert_months: 12, is_compliance: true },
];

function seedDb(opts: { fieldProven?: string[]; signoffs?: Row[]; evidence?: Row[]; credentials?: Row[] } = {}): FakeDb {
  return new FakeDb({
    competency_state: (opts.fieldProven ?? []).map((cid) => ({ user_id: CANDIDATE, competency_id: cid, status: 'field_proven', org_id: ORG })),
    signoffs: opts.signoffs ?? [],
    signoff_evidence: opts.evidence ?? [],
    competencies: COMPS,
    badge_classes: BADGES,
    credentials: opts.credentials ?? [],
    credential_status_list: [],
  });
}

function ctx(competencyId: string, signoffId: string): RollupContext {
  return { candidateUserId: CANDIDATE, competencyId, signoffId, orgId: ORG, issuer: ISSUER, endpoints: ENDPOINTS, created: '2026-05-31T00:00:00Z' };
}

const passSignoff = (id: string, competencyId: string) => ({ id, candidate_user_id: CANDIDATE, competency_id: competencyId, status: 'signed', outcome: 'pass', work_os_job_id: 'job-9', org_id: ORG });

// deno-lint-ignore no-explicit-any
const dbOf = (f: FakeDb) => f as any;

Deno.test('rollup REFUSES to issue when the competency is not field_proven (invariant 1)', async () => {
  const db = seedDb({ fieldProven: [], signoffs: [passSignoff('so-1', 'c-mag')] });
  const out = await runRollup(dbOf(db), ctx('c-mag', 'so-1'));
  assertFalse(out.ok);
  if (!out.ok) assertEquals(out.error, 'not_field_proven');
});

Deno.test('rollup REFUSES when the sign-off is not a signed PASS for the candidate', async () => {
  const db = seedDb({
    fieldProven: ['c-mag'],
    signoffs: [{ ...passSignoff('so-1', 'c-mag'), outcome: 'fail' }],
  });
  const out = await runRollup(dbOf(db), ctx('c-mag', 'so-1'));
  assertFalse(out.ok);
  if (!out.ok) assertEquals(out.error, 'signoff_not_a_signed_pass_for_candidate');
});

Deno.test('rollup issues the skill badge with REAL evidence URLs + a verifiable signed proof + 12-mo recert', async () => {
  const db = seedDb({
    fieldProven: ['c-mag'],
    signoffs: [passSignoff('so-1', 'c-mag')],
    evidence: [{ id: 'ev-a', signoff_id: 'so-1' }, { id: 'ev-b', signoff_id: 'so-1' }],
  });
  const out = await runRollup(dbOf(db), ctx('c-mag', 'so-1'));
  assert(out.ok);
  if (!out.ok) return;
  assertEquals(out.skill_badge_key, 'skill.ac.maglock_rex_egress');
  assertEquals(out.tier_issued, false); // only 1 of 3 skills held

  const cred = db.tables['credentials'][0]!;
  assertEquals(cred.status, 'active');
  assertEquals(cred.badge_class_id, 'b-mag');
  // evidence URLs point at the REAL signoff_evidence rows + the work_os job — not placeholders
  assertEquals(cred.evidence_urls, [
    `${ENDPOINTS.origin}/evidence/so-1/ev-a`,
    `${ENDPOINTS.origin}/evidence/so-1/ev-b`,
    `${ENDPOINTS.origin}/workos/jobs/job-9`,
  ]);
  // 12-month egress recert encoded on the credential
  assertEquals(cred.expires_at, '2027-05-31T00:00:00Z');
  // the signed credential VERIFIES (real eddsa-rdfc-2022 proof, not a decorative image)
  assert(await verifyCredential(cred.open_badge_json, PUB));
  // a status-list slot was allocated + linked
  assertEquals(db.tables['credential_status_list'].length, 1);
});

Deno.test('rollup AUTO-ISSUES the tier only when all 3 component skills are held — and it verifies', async () => {
  // candidate already holds Aero + Mercury skill credentials; now proves the maglock egress skill.
  const db = seedDb({
    fieldProven: ['c-aero', 'c-merc', 'c-mag'],
    signoffs: [passSignoff('so-3', 'c-mag')],
    evidence: [{ id: 'ev-1', signoff_id: 'so-3' }],
    credentials: [
      { id: 'cr-aero', recipient_user_id: CANDIDATE, badge_class_id: 'b-aero', status: 'active' },
      { id: 'cr-merc', recipient_user_id: CANDIDATE, badge_class_id: 'b-merc', status: 'active' },
    ],
  });
  const out = await runRollup(dbOf(db), ctx('c-mag', 'so-3'));
  assert(out.ok);
  if (!out.ok) return;
  assertEquals(out.tier_issued, true);
  const issuedKeys = out.issued.map((i) => i.badge_class_key).sort();
  assertEquals(issuedKeys, ['skill.ac.maglock_rex_egress', 'tier.ac.certified_technician']);

  const tierCred = db.tables['credentials'].find((c) => c.badge_class_id === 'b-tier')!;
  assert(tierCred, 'tier credential persisted');
  assertEquals(tierCred.status, 'active');
  assert(await verifyCredential(tierCred.open_badge_json, PUB)); // tier verifies too
});

Deno.test('revoke flips status + REPUBLISHES a re-signed list whose bit a verifier reads', async () => {
  const db = seedDb({
    fieldProven: ['c-mag'],
    signoffs: [passSignoff('so-1', 'c-mag')],
    evidence: [{ id: 'ev-a', signoff_id: 'so-1' }],
  });
  const issued = await runRollup(dbOf(db), ctx('c-mag', 'so-1'));
  assert(issued.ok);
  if (!issued.ok) return;
  const credId = db.tables['credentials'][0]!.id as string;
  const idx = db.tables['credentials'][0]!.status_list_index as number;

  const out = await runRevoke(dbOf(db), {
    credentialId: credId,
    orgId: ORG,
    reason: 'gear retired',
    newStatus: 'revoked',
    issuer: ISSUER,
    endpoints: ENDPOINTS,
    created: '2026-06-01T00:00:00Z',
  });
  assert(out.ok);
  if (!out.ok) return;

  // DB flipped
  assertEquals(db.tables['credentials'][0]!.status, 'revoked');
  assertEquals(db.tables['credentials'][0]!.revocation_reason, 'gear retired');
  assertEquals(
    db.tables['credential_status_list'].find((r) => r.credential_id === credId)!.revoked,
    true,
  );

  // the re-signed status list VERIFIES and its bit at the revoked index is SET,
  // while an unrelated index stays clear → revocation reaches a verifier.
  assert(await verifyCredential(out.status_list_credential, PUB));
  const encodedList = (out.status_list_credential.credentialSubject as { encodedList: string })
    .encodedList;
  assertEquals(await isIndexRevoked(encodedList, idx), true);
  assertEquals(await isIndexRevoked(encodedList, idx + 5), false);
});

Deno.test('revoke is tenant-guarded (cross-org refused) and 404s an unknown credential', async () => {
  const db = seedDb({
    fieldProven: ['c-mag'],
    signoffs: [passSignoff('so-1', 'c-mag')],
    evidence: [{ id: 'ev-a', signoff_id: 'so-1' }],
  });
  await runRollup(dbOf(db), ctx('c-mag', 'so-1'));
  const credId = db.tables['credentials'][0]!.id as string;

  const wrongOrg = await runRevoke(dbOf(db), {
    credentialId: credId,
    orgId: 'org-OTHER',
    newStatus: 'revoked',
    issuer: ISSUER,
    endpoints: ENDPOINTS,
    created: '2026-06-01T00:00:00Z',
  });
  assertFalse(wrongOrg.ok);
  if (!wrongOrg.ok) assertEquals(wrongOrg.error, 'cross_org_refused');

  const missing = await runRevoke(dbOf(db), {
    credentialId: '99999999-9999-9999-9999-999999999999',
    orgId: ORG,
    newStatus: 'revoked',
    issuer: ISSUER,
    endpoints: ENDPOINTS,
    created: '2026-06-01T00:00:00Z',
  });
  assertFalse(missing.ok);
  if (!missing.ok) assertEquals(missing.error, 'credential_not_found');
});

Deno.test('rollup REFUSES cross-org (signoff/state org != caller org)', async () => {
  const db = seedDb({
    fieldProven: ['c-mag'],
    signoffs: [passSignoff('so-1', 'c-mag')],
    evidence: [{ id: 'ev-a', signoff_id: 'so-1' }],
  });
  // caller is in a DIFFERENT org than the field_proven state / sign-off (both ORG).
  const out = await runRollup(dbOf(db), { ...ctx('c-mag', 'so-1'), orgId: 'org-OTHER' });
  assertFalse(out.ok);
  if (!out.ok) assertEquals(out.error, 'cross_org_refused');
});

Deno.test('rollup is idempotent — re-running does not double-issue the skill', async () => {
  const db = seedDb({
    fieldProven: ['c-mag'],
    signoffs: [passSignoff('so-1', 'c-mag')],
    evidence: [{ id: 'ev-a', signoff_id: 'so-1' }],
  });
  await runRollup(dbOf(db), ctx('c-mag', 'so-1'));
  const afterFirst = db.tables['credentials'].length;
  const out2 = await runRollup(dbOf(db), ctx('c-mag', 'so-1'));
  assert(out2.ok);
  assertEquals(db.tables['credentials'].length, afterFirst); // no duplicate
});
