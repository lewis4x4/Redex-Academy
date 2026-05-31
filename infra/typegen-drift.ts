#!/usr/bin/env tsx
/**
 * typegen:check — fail if the committed Supabase types differ from a fresh
 * generation off the MIGRATIONS (migration→typegen rule, CLAUDE.md §4).
 *
 * SOURCE OF TRUTH = supabase/migrations/*, NOT the live remote project.
 * It regenerates the academy,workos types with `supabase gen types --db-url`
 * against a Postgres built purely from the committed migrations (the
 * typegen-drift CI job applies supabase/migrations/* to a bare `postgres:16`
 * service — the SAME bare-PG pattern as db-invariants / rls / dag), then diffs
 * against the committed file.
 *
 * Why a migrations db, not `--project-id <ref>`: the old check read the LIVE
 * project, so a schema-ADDING PR could only go green AFTER its migration was
 * applied to prod — i.e. it coupled "open a PR" to "deploy to production".
 * Sourcing from migrations decouples them: a PR is green once its migration +
 * regenerated types are committed together, with prod untouched. It still
 * catches stale types — if a migration changes and the committed types aren't
 * regenerated, the fresh gen diverges and this exits non-zero (the CI job proves
 * both directions).
 *
 * Requires SUPABASE_DB_URL (or DATABASE_URL) → a migrations-applied Postgres.
 * No SUPABASE_ACCESS_TOKEN / PROJECT_REF and no network to the Management API.
 * (`supabase gen types --db-url` introspects via a local postgres-meta container,
 * so a Docker daemon must be available — it is on the CI runner.)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { argv } from 'node:process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const typesPath = resolve(repoRoot, 'packages/db-types/database.types.ts');

/**
 * Canonicalize generated types for a SCHEMA-only comparison.
 *
 * Beyond CRLF/trailing-whitespace, this strips the `__InternalSupabase` hint
 * block. Its sole content is `PostgrestVersion`, which reflects the PostgREST
 * SERVER version (the committed file carries prod's "14.5"; a bare migrations
 * Postgres has no PostgREST, so the fresh gen reports none) — it is NOT derived
 * from the academy/workos schema. Ignoring it lets the SAME committed types
 * validate against the migrations regardless of where they were generated, and
 * cannot mask any real schema drift (the block has no table/column/enum content).
 */
export function canonicalize(src: string): string {
  return (
    src
      .replace(/\r\n/g, '\n')
      // a newline, optional leading // comment lines, then the __InternalSupabase
      // object up to its first closing brace (its only field is PostgrestVersion).
      .replace(/\n(?:[ \t]*\/\/[^\n]*\n)*[ \t]*__InternalSupabase:\s*\{[\s\S]*?\n[ \t]*\}\n/, '\n')
      .replace(/[ \t]+$/gm, '')
      .replace(/\s+$/, '') + '\n'
  );
}

/** Pure drift verdict — exported so the CI negative control / tests can exercise it. */
export function hasDrift(committed: string, fresh: string): boolean {
  return canonicalize(committed) !== canonicalize(fresh);
}

function main(): never {
  const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(
      '[typegen:check] SUPABASE_DB_URL (or DATABASE_URL) is required — point it at a ' +
        'Postgres with supabase/migrations/* applied (CI applies them to a bare postgres:16).',
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
      ['gen', 'types', 'typescript', '--db-url', dbUrl, '--schema', 'academy,workos'],
      {
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
        // Run from a clean cwd: `--db-url` is self-contained, and a stray
        // supabase/config.toml (or .env) in the project dir would otherwise be
        // auto-loaded and can abort generation. No SUPABASE_ACCESS_TOKEN needed.
        cwd: tmpdir(),
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
  } catch (err) {
    console.error(
      '[typegen:check] `supabase gen types --db-url` failed — is SUPABASE_DB_URL a reachable ' +
        'Postgres with the migrations applied, and is the Docker daemon up?\n',
      err instanceof Error ? err.message : String(err),
    );
    process.exit(2);
  }

  if (!hasDrift(committed, fresh)) {
    console.log(
      '[typegen:check] committed database.types.ts matches a fresh generation off the migrations. ✓',
    );
    process.exit(0);
  }

  console.error(
    '[typegen:check] DRIFT: packages/db-types/database.types.ts differs from a fresh\n' +
      '`supabase gen types --db-url … --schema academy,workos` (built from supabase/migrations/*).\n' +
      'Regenerate from the migrations and commit both together — apply the migrations to a\n' +
      'local Postgres, then:\n' +
      '  supabase gen types typescript --db-url "$SUPABASE_DB_URL" --schema academy,workos > packages/db-types/database.types.ts',
  );
  process.exit(1);
}

// Run only as a CLI entry (`tsx infra/typegen-drift.ts`); stay a no-op side-effect
// when imported (so the canonicalize/hasDrift helpers are testable in isolation).
const thisFile = fileURLToPath(import.meta.url);
const invoked = argv[1] ? resolve(argv[1]) : '';
if (invoked === thisFile) main();
