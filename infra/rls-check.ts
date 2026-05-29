#!/usr/bin/env tsx
/**
 * test:rls — RLS negative / tenant-isolation matrix (a cross-org actor must get
 * ZERO rows; deny-by-default). CLAUDE.md invariant §4.
 *
 * F1: stub no-op (no schema, no policies yet). F2 makes this real and
 * merge-blocking against a live Postgres (see goals/F2_DRY_RUN.md §4 rls-negative).
 */
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function hasMigrations(): boolean {
  try {
    return readdirSync(resolve(repoRoot, 'supabase/migrations')).some((f) => f.endsWith('.sql'));
  } catch {
    return false;
  }
}

if (!hasMigrations()) {
  console.log(
    '[test:rls] No schema/policies applied yet (pre-F2). RLS negative tests are a no-op.',
  );
  process.exit(0);
}

console.error(
  '[test:rls] Schema exists but the RLS negative-test matrix is not wired yet. ' +
    'F2 must implement the cross-org zero-rows assertions against a live Postgres.',
);
process.exit(1);
