#!/usr/bin/env tsx
/**
 * test:rls — RLS cross-tenant negative matrix (CLAUDE.md inv. 3/4).
 *
 * F2 (REAL): runs the committed supabase/tests/0002_rls_negative.sql against
 * SUPABASE_DB_URL — a Redex (org A) manager sees the seeded org-A rows
 * (positive control) and a cross-org (CCS) actor sees ZERO rows in every
 * personal table; anon cannot read personal tables at all. The script seeds in
 * a transaction that is ROLLED BACK.
 */
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('[test:rls] SUPABASE_DB_URL (or DATABASE_URL) is required.');
  process.exit(2);
}

const testFile = resolve(repoRoot, 'supabase/tests/0002_rls_negative.sql');
try {
  execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', testFile], { stdio: 'inherit' });
} catch {
  console.error('[test:rls] RLS negative matrix FAILED (see the failing assertion above). ✗');
  process.exit(1);
}
console.log('[test:rls] cross-org isolation verified — zero rows across personal tables. ✓');
