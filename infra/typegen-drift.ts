#!/usr/bin/env tsx
/**
 * typegen:check — fail if the committed Supabase types differ from a fresh
 * generation (migration→typegen rule, CLAUDE.md §4).
 *
 * F2 (REAL): regenerates the academy types via the Supabase Management API
 * (`supabase gen types --project-id <ref> --schema academy` — server-side, no
 * Docker) and diffs against the committed file. This is the SAME generator the
 * committed file was produced with, so there is no postgres-meta version skew.
 *
 * Requires SUPABASE_PROJECT_REF + SUPABASE_ACCESS_TOKEN (CI secrets / .env.local).
 * After F2a, add `,workos` to the --schema list (here and in CLAUDE.md §4).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const typesPath = resolve(repoRoot, 'packages/db-types/database.types.ts');
const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!ref || !token) {
  console.error(
    '[typegen:check] SUPABASE_PROJECT_REF + SUPABASE_ACCESS_TOKEN are required ' +
      '(CI secrets / .env.local). They drive `supabase gen types --project-id`.',
  );
  process.exit(2);
}

let committed: string;
try {
  committed = readFileSync(typesPath, 'utf8');
} catch {
  console.error(`[typegen:check] committed types not found at ${typesPath}.`);
  process.exit(1);
}

let fresh: string;
try {
  fresh = execFileSync(
    'supabase',
    ['gen', 'types', 'typescript', '--project-id', ref, '--schema', 'academy'],
    {
      encoding: 'utf8',
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
      maxBuffer: 32 * 1024 * 1024,
      // Run from a clean cwd: the Supabase CLI auto-loads a cwd .env(.local),
      // and a stray/malformed one would abort the (project-id based) generation.
      cwd: tmpdir(),
    },
  );
} catch (err) {
  console.error(
    '[typegen:check] `supabase gen types` failed:',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(2);
}

const norm = (s: string) => s.replace(/\r\n/g, '\n').replace(/\s+$/, '') + '\n';
if (norm(committed) === norm(fresh)) {
  console.log('[typegen:check] committed database.types.ts matches a fresh generation. ✓');
  process.exit(0);
}

console.error(
  '[typegen:check] DRIFT: packages/db-types/database.types.ts differs from a fresh ' +
    '`supabase gen types --schema academy`. Regenerate and commit:\n' +
    '  supabase gen types typescript --project-id $SUPABASE_PROJECT_REF --schema academy ' +
    '> packages/db-types/database.types.ts',
);
process.exit(1);
