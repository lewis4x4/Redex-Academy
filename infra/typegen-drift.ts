#!/usr/bin/env tsx
/**
 * typegen:check — fail if the committed Supabase types differ from a fresh
 * `supabase gen types` run (migration→typegen rule, CLAUDE.md §4).
 *
 * F1: safe no-op while `packages/db-types/database.types.ts` is the F1 placeholder
 * (no schema applied yet). F2 flips this to real + merge-blocking: it regenerates
 * the types and diffs against the committed file (see goals/F2_DRY_RUN.md §4, §6).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const typesPath = resolve(repoRoot, 'packages/db-types/database.types.ts');
const PLACEHOLDER_MARKER = 'PLACEHOLDER — COMMITTED, GENERATED ARTIFACT';

let committed: string;
try {
  committed = readFileSync(typesPath, 'utf8');
} catch {
  console.error(`[typegen:check] Expected committed types at ${typesPath} — not found.`);
  process.exit(1);
}

if (committed.includes(PLACEHOLDER_MARKER)) {
  console.log(
    '[typegen:check] db-types is the F1 placeholder (pre-F2). Typegen-drift check is a no-op.',
  );
  process.exit(0);
}

// Post-F2 the real diff lives here (regenerate with `supabase gen types …
// --schema academy[,workos]` and compare). Surface that it must be wired rather
// than silently passing once the placeholder is gone.
console.error(
  '[typegen:check] Generated types are present but the real drift check is not wired yet. ' +
    'F2 must regenerate via `supabase gen types` and diff against the committed file here.',
);
process.exit(1);
