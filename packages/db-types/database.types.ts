// =============================================================================
// PLACEHOLDER — COMMITTED, GENERATED ARTIFACT. DO NOT HAND-EDIT. (CLAUDE.md §4)
//
// Goal F2 replaces this file by running, against the applied `academy` schema:
//   supabase gen types typescript --local --schema academy > packages/db-types/database.types.ts
// Goal F2a re-runs it with `--schema academy,workos` once `workos.jobs` exists.
//
// The `typegen-drift` CI check (infra/typegen-drift.ts) is a clean no-op until
// F2 — at F2 it flips to real and fails the build if the committed types differ
// from a fresh `supabase gen types` run.
// =============================================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/**
 * Empty until F2 applies the `academy` schema. Typed as a record of schemas so
 * the workspace compiles and consumers can already write `Database['academy']`
 * shaped code paths without the generator having run.
 */
export type Database = {
  academy: Record<string, never>;
};
