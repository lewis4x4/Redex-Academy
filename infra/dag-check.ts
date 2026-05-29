#!/usr/bin/env tsx
/**
 * dag:check — assert academy.course_prerequisites is a DAG (no cycles).
 *
 * F2 (REAL): connects to SUPABASE_DB_URL (or DATABASE_URL) and calls
 * academy.prereq_graph_is_dag(); exits non-zero on a cycle so the broken
 * ADC-201-class prerequisite bug is un-shippable (wave3 §3.2). Run after the
 * migration is applied (local stack / CI postgres service).
 */
import { execFileSync } from 'node:child_process';

const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('[dag:check] SUPABASE_DB_URL (or DATABASE_URL) is required to run the DAG check.');
  process.exit(2);
}

let result: string;
try {
  result = execFileSync('psql', [dbUrl, '-tAqc', 'select academy.prereq_graph_is_dag();'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
} catch (err) {
  console.error(
    '[dag:check] query failed (is the academy schema applied?):',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(2);
}

if (result === 't') {
  console.log('[dag:check] academy.course_prerequisites is acyclic (DAG). ✓');
  process.exit(0);
}

console.error(
  '[dag:check] CYCLE DETECTED in course_prerequisites — academy.check_prereq_dag() returned rows. ✗',
);
process.exit(1);
