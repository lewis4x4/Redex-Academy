#!/usr/bin/env tsx
/**
 * dag:check — assert the course-prerequisite graph is a DAG (no cycles).
 *
 * F1: safe no-op. There is no schema and no `course_prerequisites` data yet, so
 * this exits 0 with a clear "no schema yet" message. F2 rewrites this to call
 * `academy.prereq_graph_is_dag()` against the committed types/DB and exit non-zero
 * on a cycle (see goals/F2_DRY_RUN.md §2–§4).
 */
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = resolve(repoRoot, 'supabase/migrations');

function appliedMigrations(): string[] {
  try {
    return readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
  } catch {
    return [];
  }
}

const migrations = appliedMigrations();
if (migrations.length === 0) {
  console.log(
    '[dag:check] No schema applied yet (pre-F2). Prerequisite-graph DAG check is a no-op.',
  );
  process.exit(0);
}

// Post-F2 the real check lives here. Until F2 wires it, fail loudly rather than
// silently passing once migrations exist — surfacing that the check needs to be
// made real (contract-first; never fake a pass).
console.error(
  '[dag:check] Migrations exist but the real DAG check is not wired yet. ' +
    'F2 must implement academy.prereq_graph_is_dag() invocation here.',
);
process.exit(1);
