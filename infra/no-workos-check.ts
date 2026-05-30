#!/usr/bin/env tsx
/**
 * guard:no-workos (F3, invariant 6 / ledger §A) — the codebase + schema must
 * contain NO `work_os_user_id` column/field and NO `REDEX_WORKOS_*` env usage:
 * there is ONE identity space (academy.users.id = auth.users.id) and the Work OS
 * federation env path was deleted in F1.
 *
 * Doc/comment mentions that ASSERT the absence (e.g. "NO work_os_user_id",
 * "REDEX_WORKOS_* deleted") are allowed; any real, non-negated occurrence in
 * code/schema fails the build.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = [
  'apps',
  'packages',
  'infra',
  'supabase/migrations',
  'supabase/functions',
  'supabase/seed',
  'supabase/tests',
  'workers',
];
const SCAN_FILES = ['.env.example', 'supabase/config.toml'];
const ALLOWED_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.sql', '.example', '.toml', '.json']);
const SKIP = /node_modules|dist|\.turbo|database\.types\.ts|no-workos-check\.ts/;
const NEGATION = /\b(no|not|never|without|absent|deleted?|removed?|zero|forbidden|ban)\b/i;
const PATTERNS = [/work_os_user_id/i, /REDEX_WORKOS_/];

function* walk(dir: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const p = join(dir, entry);
    if (SKIP.test(p)) continue;
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

const targets: string[] = [];
for (const d of SCAN_DIRS) for (const f of walk(resolve(repoRoot, d))) targets.push(f);
for (const f of SCAN_FILES) targets.push(resolve(repoRoot, f));

const violations: string[] = [];
for (const file of targets) {
  if (SKIP.test(file)) continue;
  const ext = extname(file);
  if (ext && !ALLOWED_EXT.has(ext)) continue;
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  text.split('\n').forEach((line, i) => {
    for (const pat of PATTERNS) {
      if (pat.test(line) && !NEGATION.test(line)) {
        violations.push(`${relative(repoRoot, file)}:${i + 1}: ${line.trim().slice(0, 120)}`);
      }
    }
  });
}

if (violations.length > 0) {
  console.error(
    '[no-workos] Forbidden identifier(s) found (ledger §A: one identity space; no Work OS federation):',
  );
  for (const v of violations) console.error('  ' + v);
  process.exit(1);
}
console.log('[no-workos] No work_os_user_id / REDEX_WORKOS_* usage in code or schema. ✓');
process.exit(0);
