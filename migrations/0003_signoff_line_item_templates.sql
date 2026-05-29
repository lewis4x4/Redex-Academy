-- ============================================================================
-- 0003_signoff_line_item_templates.sql
-- Redex Academy — sign-off rubric-template table (the §5.4 line-item CATALOG).
--
-- WHY THIS MIGRATION EXISTS (resolves the flagged [SCHEMA GAP], SEED_NOTES §4):
--   The §5.4 sign-off rubric is scored at line-item grain in
--   `academy.signoff_line_items`, whose `signoff_id` is NOT NULL and FKs a LIVE
--   `academy.signoffs` row (+ immutability triggers once signed). That table
--   holds SCORED INSTANCES; it cannot hold the per-course rubric TEMPLATE (the
--   definition of WHICH lines exist and which are critical-safety). S1 therefore
--   stashed the AC-201/202/203 templates as `signoff_rubric_template` JSON on the
--   `signoff_prep` unit `content_ref` — functional, but an architectural smell on
--   the SAFETY-CRITICAL path (the safety-veto rubric is content, not a blob).
--
--   This migration PROMOTES that template to a first-class table,
--   `academy.signoff_line_item_templates`, the CANONICAL single source of truth
--   for the rubric lines. M6 `finalize-signoff` reads THIS table to materialize
--   `academy.signoff_line_items` rows per actual sign-off (one row per template
--   line, preserving `dimension` + `is_critical_safety` so the safety-veto
--   trigger — `tg_signoff_compute_outcome`, 0001 §12a — fires correctly). The
--   S1 seed (0001_mvp_slice_seed.sql) now seeds the rows HERE and the
--   `signoff_prep` `content_ref` is reduced to a short pointer at this table.
--
-- INVARIANTS PRESERVED (CLAUDE.md §5):
--   * This table defines HOW SAFETY IS GRADED → it is CATALOG/definition data,
--     org-agnostic, like the published catalog (courses/competencies). RLS is
--     ENABLE + FORCE with a single SELECT policy for `authenticated` and NO
--     end-user INSERT/UPDATE/DELETE policy — writes are SERVICE-ROLE only
--     (authoring), mirroring `assessment_items` (invariant 3, 0001 §15q/§15-NOTE).
--   * Deny-by-default RLS (invariant 4); `tg_set_updated_at` on update (0001 §1).
--
-- ORDERING (IMPORTANT): apply in the F2 schema step AFTER `0001_init_academy.sql`
--   (it references `academy.courses`, `academy.competencies`, the
--   `academy.signoff_dimension` enum and `academy.tg_set_updated_at()`), and
--   BEFORE the S1 seed (`seed/0001_mvp_slice_seed.sql`, which INSERTs into it).
--   It does not depend on the `workos` schema, so it may run before or after
--   0002_workos_stub.sql; the canonical sequence is 0001 → 0002 → 0003 → S1 seed.
--
-- Idempotent where practical (IF NOT EXISTS / guarded policy) so the file is safe
-- to re-run in a fresh local stack; forward-only in production (never edit a
-- merged migration — add a new one).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. The rubric-template table (the §5.4 line-item CATALOG)
-- ----------------------------------------------------------------------------
-- One row per rubric line per course. `dimension` is one of the four §5.4
-- dimensions (the `academy.signoff_dimension` enum from 0001 §2);
-- `is_critical_safety` marks a safety line (a single 0 on such a line forces the
-- whole sign-off to outcome=fail at materialization time — the safety veto).
-- `line_item_key` is the stable key carried onto each materialized
-- `signoff_line_items.line_item_key` (e.g. "ac203.release_on_power_loss").
-- `unique(course_id, line_item_key)` backs the seed's idempotent ON CONFLICT.
create table if not exists academy.signoff_line_item_templates (
  id                 uuid primary key default gen_random_uuid(),
  course_id          uuid not null references academy.courses(id) on delete cascade,
  competency_id      uuid references academy.competencies(id) on delete set null,
  dimension          academy.signoff_dimension not null,
  line_item_key      text not null,           -- e.g. "ac.203.release_on_power_loss"
  is_critical_safety boolean not null default false,
  ordinal            int not null,
  label              text not null,
  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (course_id, line_item_key)
);
comment on table academy.signoff_line_item_templates is
  'CANONICAL §5.4 sign-off rubric TEMPLATE (the per-course line-item catalog) — single source of truth for WHICH rubric lines a course''s sign-off has and which are critical-safety. M6 finalize-signoff reads this table to materialize academy.signoff_line_items rows per ACTUAL sign-off (one row per template line, preserving dimension + is_critical_safety so the safety-veto trigger fires correctly). Resolves the flagged [SCHEMA GAP] (SEED_NOTES §4): signoff_line_items.signoff_id is NOT NULL (a live sign-off), so it cannot hold templates — these live here instead of on signoff_prep.content_ref. Catalog/definition data: org-agnostic SELECT to authenticated; writes are service-role only (authoring), like assessment_items.';
comment on column academy.signoff_line_item_templates.dimension is
  'One of the four §5.4 dimensions (safety_compliance is the veto dimension). Copied verbatim onto the materialized signoff_line_items.dimension.';
comment on column academy.signoff_line_item_templates.is_critical_safety is
  'Marks a critical-safety line. Copied onto signoff_line_items.is_critical_safety; a single such line scoring 0 forces the whole sign-off to outcome=fail, non-overridable (the safety veto — 0001 tg_signoff_compute_outcome). If this flag is dropped, the veto silently weakens.';
comment on column academy.signoff_line_item_templates.line_item_key is
  'Stable rubric-line key (e.g. "ac203.release_on_power_loss"), unique per course; carried onto signoff_line_items.line_item_key when materialized.';
comment on column academy.signoff_line_item_templates.ordinal is
  'Display/score order of the line within the course''s rubric.';

-- ----------------------------------------------------------------------------
-- 2. updated_at maintenance (invariant: every mutable-by-build/authoring table)
-- ----------------------------------------------------------------------------
-- Reuses academy.tg_set_updated_at() from 0001 §1 (same convention as every
-- other mutable table — 0001 §12e).
create trigger trg_set_updated_at
  before update on academy.signoff_line_item_templates
  for each row execute function academy.tg_set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. GRANTS (RLS narrows further; service_role bypasses RLS by design)
-- ----------------------------------------------------------------------------
-- Read to authenticated (catalog-like); NO INSERT/UPDATE/DELETE for end users —
-- these define how SAFETY is graded, so they are authored by the service role
-- only (mirrors assessment_items / catalog authoring, 0001 §14/§15-NOTE).
grant select on academy.signoff_line_item_templates to authenticated;
grant all privileges on academy.signoff_line_item_templates to service_role;

-- ----------------------------------------------------------------------------
-- 4. RLS — ENABLE + FORCE, deny-by-default (invariant 4)
-- ----------------------------------------------------------------------------
-- FORCE so the table owner is also subject to RLS (defense in depth);
-- service_role still bypasses via its BYPASSRLS attribute. Same enable/force
-- pattern as 0001 §15.
alter table academy.signoff_line_item_templates enable row level security;
alter table academy.signoff_line_item_templates force row level security;

-- Catalog-like SELECT: readable by any authenticated caller, org-agnostic (the
-- rubric definition is not tenant-scoped — exactly like the published catalog /
-- competencies). NO write policy exists => end users cannot INSERT/UPDATE/DELETE;
-- only the service role (which bypasses RLS) authors these rows.
create policy signoff_line_item_templates_select_authn on academy.signoff_line_item_templates
  for select to authenticated using (true);

-- ----------------------------------------------------------------------------
-- 5. INDEXES (FK + hot query paths)
-- ----------------------------------------------------------------------------
-- M6 fetches a course's full rubric (by course_id), and the safety-veto path
-- groups by dimension — index both. (unique(course_id, line_item_key) already
-- gives a course_id-leading index, but an explicit course_id index keeps parity
-- with 0001's FK-index convention and is used for the plain by-course fetch.)
create index if not exists idx_signoff_li_templates_course
  on academy.signoff_line_item_templates(course_id);
create index if not exists idx_signoff_li_templates_course_dim
  on academy.signoff_line_item_templates(course_id, dimension);
-- partial index: fast lookup of the critical-safety template lines (the veto set)
create index if not exists idx_signoff_li_templates_safety
  on academy.signoff_line_item_templates(course_id) where is_critical_safety;

commit;
