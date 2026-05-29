-- ============================================================================
-- 0001_init_academy.sql
-- Redex Academy — core `academy` schema (production-ready, Supabase/PostgreSQL).
--
-- This migration is the CONTRACT every later goal (M1, M2, M6, M7, S1, F2a…)
-- compiles against. It implements the Build Decisions Ledger
-- (`wave4_decisions_ledger.md`) §A,B,C,F,G and wave3 §3 / §3.8 / §7, as
-- corrected by `wave4_review_architecture.md`.
--
-- INVARIANTS REALIZED HERE (CLAUDE.md §5 — never weaken):
--   1. Safety-veto is a cross-row TRIGGER on `signoffs` (not a CHECK).
--   2. Signed sign-offs + their line items are DB-immutable.
--   3. State writes (competency promotion, badge issuance, sign-off finalize,
--      recert) are service-role only — NO write policy for end-user roles.
--   4. Deny-by-default RLS on every table; tenant isolation on org_id JWT claim.
--   5. Append-only event tables carry UNIQUE(client_event_uuid) for idempotent sync.
--   6. fixture_sets.sanitized is a publish gate.
--
-- Identity (LOCKED, greenfield): ONE Supabase project, shared `auth.users`.
--   academy.users.id = auth.users.id. There is NO work_os_user_id column.
--   ONE canonical tenant table: academy.orgs. Both schemas' RLS key on it.
--   Cross-schema FK academy.signoffs.work_os_job_id -> workos.jobs(id) is added
--   in 0002_workos_stub.sql (the workos schema must exist first).
--
-- Idempotent where practical (IF NOT EXISTS) so the file is safe to re-run in
-- a fresh local stack; forward-only in production (never edit a merged migration).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0. Extensions & schema
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";          -- gen_random_uuid()

create schema if not exists academy;
comment on schema academy is
  'Redex Academy domain: competencies, sims, telemetry, field sign-offs, credentials. Shares auth.users with the workos schema; the one canonical tenant table is academy.orgs.';

-- App roles exist in a Supabase project by default (anon, authenticated,
-- service_role). Guard for local/CI stacks that may not have them yet.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

-- Schema usage. RLS still narrows per-table; usage alone exposes nothing.
grant usage on schema academy to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 1. Helper functions (JWT accessors + updated_at)
-- ----------------------------------------------------------------------------
-- Tenant key. Reads the org_id claim minted from academy.orgs (ledger §A).
-- STABLE + SECURITY INVOKER; returns NULL when unauthenticated so deny-by-default
-- policies naturally yield zero rows.
create or replace function academy.current_org_id()
returns uuid
language sql
stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb ->> 'org_id',
    ''
  )::uuid
$$;
comment on function academy.current_org_id() is
  'The caller''s tenant (org) from the JWT org_id claim. NULL when unauthenticated. All tenant-isolation RLS policies key on this.';

create or replace function academy.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub',
    ''
  )::uuid
$$;
comment on function academy.current_user_id() is
  'The caller''s auth.users.id (JWT sub). Equals academy.users.id.';

-- Returns true if the caller holds one of the given role keys (JWT `roles` claim,
-- a JSON array minted at login from academy.user_roles). Used by manager/admin
-- read policies. Roles drive permissions; persona drives UI — never conflate.
create or replace function academy.jwt_has_role(variadic role_keys text[])
returns boolean
language sql
stable
as $$
  select coalesce(
    exists (
      select 1
      from jsonb_array_elements_text(
        coalesce(current_setting('request.jwt.claims', true)::jsonb -> 'roles', '[]'::jsonb)
      ) as r(key)
      where r.key = any(role_keys)
    ),
    false
  )
$$;
comment on function academy.jwt_has_role(text[]) is
  'True if the JWT roles claim contains any of the given role keys. Read policies use this; state-changing writes are NEVER granted to end-user roles (service-role only).';

-- updated_at maintenance (invariant: every mutable-by-users table).
create or replace function academy.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Enums (closed, stable sets — ledger §A "Enums for tier, domain, persona,
--    role keys, all status fields, dimension")
-- ----------------------------------------------------------------------------
create type academy.org_type            as enum ('redex', 'ccs_partner');
create type academy.user_status         as enum ('active', 'suspended');
create type academy.persona             as enum ('nova', 'marco', 'priya', 'dana');
create type academy.role_key            as enum (
  'learner', 'evaluator', 'manager', 'author',
  'curriculum_admin', 'org_admin', 'exec', 'support'
);

create type academy.domain              as enum ('FND', 'INT', 'ADC', 'AC', 'VID', 'SEC');
create type academy.tier                as enum ('foundations', 'core', 'advanced', 'mastery');

create type academy.eval_auth_status    as enum ('provisional', 'authorized', 'suspended');
create type academy.eval_auth_source    as enum ('founding_bootstrap', 'int_410');

create type academy.publish_status      as enum ('draft', 'published', 'deprecated', 'retired');
create type academy.prereq_kind         as enum ('hard_gate', 'soft');

create type academy.unit_kind           as enum (
  'lesson', 'sim', 'scenario', 'knowledge_check', 'video', 'checklist', 'signoff_prep'
);

create type academy.enrollment_status   as enum (
  'not_started', 'in_progress', 'completed', 'recert_required', 'waived_rpl'
);
create type academy.enrollment_via      as enum ('self', 'assigned', 'jit_workos', 'rpl');
create type academy.unit_progress_status as enum (
  'locked', 'available', 'in_progress', 'passed', 'failed'
);
create type academy.competency_status   as enum (
  'none', 'in_progress', 'sim_passed', 'field_proven', 'expired'
);
create type academy.competency_source   as enum ('course', 'rpl', 'bootstrap');

-- The SIX engines (ledger §E). Superset of the wave3 "4 shapes".
create type academy.sim_kind            as enum (
  'branching_scenario', 'device_config', 'webgl_install',
  'panel_state_machine', 'interaction_2d', 'calculator'
);
create type academy.fixture_source      as enum ('adc_portal', 'openeye', 'iq_panel', 'mercury', 'dragonfruit');
create type academy.sim_outcome         as enum ('pass', 'fail', 'abandoned');

create type academy.signoff_status      as enum ('draft', 'submitted', 'signed', 'failed', 'void');
create type academy.signoff_outcome     as enum ('pass', 'fail');
-- The four §5.4 rubric dimensions. safety_compliance is the veto dimension.
create type academy.signoff_dimension   as enum (
  'safety_compliance', 'technical_execution',
  'verification_documentation', 'independence_judgment'
);
create type academy.evidence_kind       as enum (
  'photo', 'portal_screenshot', 'workos_doc', 'video', 'signature'
);
create type academy.evidence_source     as enum ('workos_job', 'uploaded');

create type academy.recert_reason       as enum (
  'time_based', 'platform_major', 'evaluator_annual', 'egress_12mo', 'compliance_12mo'
);
create type academy.recert_status       as enum (
  'scheduled', 'notified', 'in_progress', 'completed', 'overdue'
);

create type academy.badge_kind          as enum ('skill', 'tier', 'role', 'evaluator');
create type academy.credential_status   as enum ('active', 'expired', 'revoked', 'recert_required');

create type academy.assessment_kind     as enum (
  'mcq', 'multi_select', 'numeric', 'open_response', 'order', 'hotspot', 'scenario_branch'
);
create type academy.graded_by           as enum ('auto', 'ai', 'sme');

create type academy.audit_action        as enum (
  'credential_issued', 'credential_revoked', 'signoff_signed', 'signoff_voided',
  'recert_triggered', 'evidence_accessed', 'role_changed', 'authorization_changed',
  'competency_promoted', 'ai_graded'
);

-- ----------------------------------------------------------------------------
-- 3. Identity, roles, personas, tenancy (wave3 §3.1, ledger §A)
-- ----------------------------------------------------------------------------

-- THE one canonical tenant table. Both academy and workos RLS key on org_id.
create table academy.orgs (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  type            academy.org_type not null,
  parent_org_id   uuid references academy.orgs(id) on delete restrict,
  locale_default  text not null default 'en',
  settings        jsonb not null default '{}'::jsonb,
  status          academy.user_status not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table academy.orgs is
  'CANONICAL tenant table for the whole DB (ledger §A). Redex + each CCS partner is an org. parent_org_id nests CCS partners under Redex for shared-catalog visibility while isolating their PII. The JWT org_id claim is minted from this table; BOTH academy and workos RLS policies key on it.';

-- Profile row hung off the shared auth.users. id = auth.users.id. NO work_os_user_id.
create table academy.users (
  id              uuid primary key,           -- = auth.users.id (shared identity space)
  org_id          uuid not null references academy.orgs(id) on delete restrict,
  display_name    text,
  email           text,
  locale_pref     text,
  persona         academy.persona,            -- drives UI; NOT permissions
  status          academy.user_status not null default 'active',
  last_active_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table academy.users is
  'Academy profile, one row per human, keyed on auth.users.id (ledger §A: id = auth.users.id; NO work_os_user_id — there is one identity space; join cross-schema on auth.users.id). FK to auth.users is added once Supabase auth schema is present (see note at end of file).';
comment on column academy.users.persona is
  'nova|marco|priya|dana — drives UI/recommendations only. Permissions come from roles, never persona.';

create table academy.roles (
  id    uuid primary key default gen_random_uuid(),
  key   academy.role_key not null unique,
  label text not null
);
comment on table academy.roles is 'RBAC role catalog. A user can hold several roles. Roles drive permissions.';

create table academy.user_roles (
  user_id     uuid not null references academy.users(id) on delete cascade,
  role_id     uuid not null references academy.roles(id) on delete restrict,
  org_id      uuid not null references academy.orgs(id) on delete restrict,  -- roles can be org-scoped
  granted_by  uuid references academy.users(id) on delete set null,
  granted_at  timestamptz not null default now(),
  primary key (user_id, role_id, org_id)
);
comment on table academy.user_roles is 'User <-> role grants (org-scoped). The login flow projects these into the JWT roles claim.';

-- Who may sign off, per domain (wave3 §3.1, §4c bootstrap + INT-410).
create table academy.evaluator_authorizations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references academy.users(id) on delete cascade,
  org_id            uuid not null references academy.orgs(id) on delete restrict,
  domains           academy.domain[] not null default '{}',   -- e.g. {AC,SEC}
  status            academy.eval_auth_status not null default 'provisional',
  source            academy.eval_auth_source not null,
  authorized_by     uuid references academy.users(id) on delete set null,
  last_calibrated_at timestamptz,
  calibration_kappa numeric,                  -- IRR vs gold standard (target >= 0.80)
  expires_at        timestamptz,              -- annual recert
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table academy.evaluator_authorizations is
  'Domain-scoped, time-bounded Evaluator authority. finalize-signoff MUST reject a sign-off when status<>authorized, expires_at<now(), or the competency''s domain is not in domains[] (wave4 §3.7). calibration_kappa target >= 0.80.';

-- ----------------------------------------------------------------------------
-- 4. Catalog: competencies, courses, units, versioning, prerequisites (§3.2)
-- ----------------------------------------------------------------------------

create table academy.competencies (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,    -- DOMAIN.THING, e.g. EGRESS.MAGLOCK_FAILSAFE
  title              text not null,
  domain             academy.domain not null,
  description        text,
  is_safety_critical boolean not null default false,  -- drives badge/recert logic (ledger §C)
  mastery_threshold  numeric not null default 0.80,   -- coarse default; item-level gating is authoritative
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint competencies_threshold_range check (mastery_threshold >= 0 and mastery_threshold <= 1)
);
comment on table academy.competencies is
  'Atomic "can do X" the system grades against. is_safety_critical drives badge/recert logic (ledger §C). The mastery GATE is computed at the assessment-item level (assessment_items.is_safety_item: safety items >=90%, non-safety >=80%); this scalar is a coarse fallback only.';

create table academy.courses (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,    -- canonical ID, e.g. AC-203
  title              text not null,
  domain             academy.domain not null,
  tier               academy.tier not null,
  personas           academy.persona[] not null default '{}',
  active_version_id  uuid,                    -- FK added after course_versions exists
  status             academy.publish_status not null default 'draft',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
comment on table academy.courses is 'Course node in the skill-tree. Canonical ID is `code` (e.g. AC-203). active_version_id points at the published course_version.';

create table academy.course_versions (
  id                uuid primary key default gen_random_uuid(),
  course_id         uuid not null references academy.courses(id) on delete cascade,
  semver            text not null,            -- MAJOR.MINOR.PATCH
  changelog         text,
  platform_manifest jsonb not null default '{}'::jsonb,  -- exact HW/firmware/Portal surfaces taught
  status            academy.publish_status not null default 'draft',
  published_at      timestamptz,
  authored_by       uuid references academy.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (course_id, semver),
  constraint course_versions_semver_fmt check (semver ~ '^[0-9]+\.[0-9]+\.[0-9]+$')
);
comment on table academy.course_versions is
  'SemVer-versioned course content. Published versions are immutable (enforced in the authoring layer); platform_manifest is the structured surface list the recert engine targets on (§8). MAJOR bump => recert event; deprecated stays readable; retired flips badges to recert_required.';

-- Now that course_versions exists, wire courses.active_version_id.
alter table academy.courses
  add constraint courses_active_version_fk
  foreign key (active_version_id) references academy.course_versions(id) on delete set null;

create table academy.units (
  id                uuid primary key default gen_random_uuid(),
  course_version_id uuid not null references academy.course_versions(id) on delete cascade,
  ordinal           int not null,
  title             text not null,
  kind              academy.unit_kind not null,
  content_ref       jsonb not null default '{}'::jsonb,  -- pointer to MDX/JSON + media (R2 keys)
  competency_id     uuid references academy.competencies(id) on delete set null,
  est_minutes       int,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (course_version_id, ordinal)
);
comment on table academy.units is 'Microlearning chunk within a course version. content_ref points at MDX/JSON content + media (R2 keys).';

create table academy.unit_competencies (
  unit_id       uuid not null references academy.units(id) on delete cascade,
  competency_id uuid not null references academy.competencies(id) on delete cascade,
  primary key (unit_id, competency_id)
);
comment on table academy.unit_competencies is 'A unit can map to several competencies (wave3 §7 #7).';

create table academy.course_prerequisites (
  course_id          uuid not null references academy.courses(id) on delete cascade,
  requires_course_id uuid not null references academy.courses(id) on delete cascade,
  kind               academy.prereq_kind not null default 'hard_gate',
  primary key (course_id, requires_course_id),
  constraint course_prereq_no_self_loop check (course_id <> requires_course_id)
);
comment on table academy.course_prerequisites is
  'Skill-tree edges (the curriculum prerequisite graph). MUST remain a DAG — academy.check_prereq_dag() detects cycles for the CI dag:check. Aggregate gates ("Certified Technician — AC") are modeled as credential prereqs, not a single course edge.';

create table academy.course_platform_dependencies (
  course_id    uuid not null references academy.courses(id) on delete cascade,
  platform_key text not null,                 -- e.g. "iq_panel", "adc_portal", "mercury_lp1502"
  min_version  text,
  max_version  text,
  primary key (course_id, platform_key)
);
comment on table academy.course_platform_dependencies is
  'Normalized platform manifest for fast recert targeting: a vendor change on platform_key lists every affected course (§8 triage).';

-- ----------------------------------------------------------------------------
-- 5. Enrollments & progress (§3.3)
-- ----------------------------------------------------------------------------
create table academy.enrollments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references academy.users(id) on delete cascade,
  org_id            uuid not null references academy.orgs(id) on delete restrict,
  course_id         uuid not null references academy.courses(id) on delete restrict,
  course_version_id uuid references academy.course_versions(id) on delete restrict,
  status            academy.enrollment_status not null default 'not_started',
  enrolled_via      academy.enrollment_via not null default 'self',
  started_at        timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table academy.enrollments is 'A user''s enrollment in a course version. status transitions to completed/recert_required are server-authoritative (Edge Function).';

create table academy.unit_progress (
  id                   uuid primary key default gen_random_uuid(),
  enrollment_id        uuid not null references academy.enrollments(id) on delete cascade,
  unit_id              uuid not null references academy.units(id) on delete cascade,
  org_id               uuid not null references academy.orgs(id) on delete restrict,
  status               academy.unit_progress_status not null default 'locked',
  score                numeric,
  attempts             int not null default 0,
  last_attempt_at      timestamptz,
  synced_from_offline  boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (enrollment_id, unit_id)
);
comment on table academy.unit_progress is 'Per-unit progress within an enrollment.';

-- THE spine: authoritative "does this person hold this skill". Server-only writes.
create table academy.competency_state (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references academy.users(id) on delete cascade,
  org_id        uuid not null references academy.orgs(id) on delete restrict,
  competency_id uuid not null references academy.competencies(id) on delete restrict,
  status        academy.competency_status not null default 'none',
  source        academy.competency_source not null default 'course',
  last_event_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, competency_id)
);
comment on table academy.competency_state is
  'The competency spine. A course pass gives sim_passed; promotion to field_proven REQUIRES a finalized Evaluator sign-off (§3.5) and is written ONLY by a service-role Edge Function (invariant 3). No end-user write policy exists.';

-- ----------------------------------------------------------------------------
-- 6. Simulation definitions, fixtures, attempts, telemetry (§3.4, ledger §E,G)
-- ----------------------------------------------------------------------------

-- Sanitized recorded fixtures (§5.4). sanitized=true is the publish gate.
create table academy.fixture_sets (
  id              uuid primary key default gen_random_uuid(),
  source          academy.fixture_source not null,
  label           text not null,
  version         text not null,             -- tied to the platform surface, e.g. "create-customer vNN"
  r2_manifest_key text not null,             -- R2 key for the recorded screenshots + JSON state
  sanitized       boolean not null default false,  -- PUBLISH GATE (invariant 6): must be true to publish
  source_citation text,                      -- datasheet/source ref for accuracy audit (wave4 §3.6c)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table academy.fixture_sets is
  'Sanitized, recorded device fixtures (Partner Portal/OpenEye/IQ-panel/Mercury) replayed by the device-config engine. NEVER a live connection. sanitized=true is the publish gate (invariant 6) enforced by tg_block_unsanitized_fixture on sim_definitions; production customer footage is never a fixture.';
comment on column academy.fixture_sets.sanitized is
  'PUBLISH GATE: a published sim_definition may not reference a fixture unless this is true (no real PII). Enforced by trigger.';

create table academy.sim_definitions (
  id             uuid primary key default gen_random_uuid(),
  key            text not null,
  version        text not null,
  kind           academy.sim_kind not null,            -- one of the SIX engines
  spec           jsonb not null,                       -- declarative spec (validated by JSON Schema + Zod)
  fixture_set_id uuid references academy.fixture_sets(id) on delete restrict,
  competency_ids uuid[] not null default '{}',
  status         academy.publish_status not null default 'draft',
  source_citation text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (key, version)
);
comment on table academy.sim_definitions is
  'Authored, declarative simulation (one of the SIX engines). Authors write spec JSON validated against the engine''s JSON Schema + Zod; they never write a runtime. A published sim may only reference a sanitized fixture (publish-gate trigger).';

create table academy.sim_attempts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references academy.users(id) on delete cascade,
  org_id              uuid not null references academy.orgs(id) on delete restrict,
  sim_definition_id   uuid not null references academy.sim_definitions(id) on delete restrict,
  enrollment_id       uuid references academy.enrollments(id) on delete set null,
  started_at          timestamptz,
  ended_at            timestamptz,
  outcome             academy.sim_outcome,
  score               numeric,
  safety_veto_triggered boolean not null default false,
  device_meta         jsonb not null default '{}'::jsonb,
  offline_origin      boolean not null default false,
  client_event_uuid   uuid not null,         -- idempotency for offline sync (ledger §G)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (client_event_uuid)                 -- /sync ON CONFLICT DO NOTHING
);
comment on table academy.sim_attempts is
  'Compact summary of a sim attempt (the firehose lives in the LRS). UNIQUE(client_event_uuid) makes /sync idempotent (ledger §G). Local scoring is for feedback only; the mastery gate is server-authoritative.';

create table academy.sim_telemetry_events (
  id                uuid primary key default gen_random_uuid(),
  sim_attempt_id    uuid not null references academy.sim_attempts(id) on delete cascade,
  ts                timestamptz not null default now(),
  event_type        text not null,
  payload           jsonb not null default '{}'::jsonb,
  client_event_uuid uuid not null,           -- idempotency for offline sync (ledger §G)
  created_at        timestamptz not null default now(),
  unique (client_event_uuid)                 -- append-only; dedupe on resync
);
comment on table academy.sim_telemetry_events is
  'High-volume per-interaction telemetry summary. Append-only with UNIQUE(client_event_uuid) for idempotent offline flush (ledger §G). The full xAPI firehose goes to the LRS.';

-- ----------------------------------------------------------------------------
-- 7. Field sign-offs & evidence — THE credibility spine (§3.5, ledger §B)
-- ----------------------------------------------------------------------------

create table academy.signoffs (
  id                uuid primary key default gen_random_uuid(),
  candidate_user_id uuid not null references academy.users(id) on delete restrict,
  evaluator_user_id uuid not null references academy.users(id) on delete restrict,
  competency_id     uuid references academy.competencies(id) on delete restrict,
  course_id         uuid references academy.courses(id) on delete restrict,
  work_os_job_id    uuid,                     -- cross-schema FK -> workos.jobs(id) added in 0002
  status            academy.signoff_status not null default 'draft',
  outcome           academy.signoff_outcome, -- computed by the safety-veto trigger on finalize
  signed_at         timestamptz,
  void_reason       text,                     -- the one legal post-sign transition: signed -> void
  superseded_by     uuid references academy.signoffs(id) on delete set null,  -- voiding -> new sign-off
  org_id            uuid not null references academy.orgs(id) on delete restrict,
  created_at        timestamptz not null default now(),
  created_by        uuid references academy.users(id) on delete set null,
  updated_at        timestamptz not null default now()
);
comment on table academy.signoffs is
  'Evaluator field sign-off — the credibility spine. outcome is COMPUTED by tg_signoff_compute_outcome from signoff_line_items (safety veto). Once status=signed the row + its line items are DB-immutable (tg_signoff_immutable); the only legal post-sign change is signed->void with a void_reason + superseded_by, written by the service-role finalize function. work_os_job_id gets a real cross-schema FK in 0002_workos_stub.sql.';
comment on column academy.signoffs.work_os_job_id is
  'The real Work OS job the competency was proven on. Cross-schema FK -> workos.jobs(id) ON DELETE RESTRICT is added in 0002 (the job must survive as long as the sign-off does).';

-- The §5.4 four-dimension, 0-3, safety-veto rubric, at LINE-ITEM grain (ledger §B).
create table academy.signoff_line_items (
  id                uuid primary key default gen_random_uuid(),
  signoff_id        uuid not null references academy.signoffs(id) on delete cascade,
  dimension         academy.signoff_dimension not null,
  line_item_key     text not null,           -- e.g. "ac.203.maglock_failsafe_verified"
  score             int not null,
  is_critical_safety boolean not null default false,
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (signoff_id, line_item_key),
  constraint signoff_line_item_score_range check (score >= 0 and score <= 3)   -- single-row sanity (CHECK)
);
comment on table academy.signoff_line_items is
  'Per-line rubric scores (ledger §B). dimension is one of the four §5.4 dimensions; score 0..3 (CHECK is single-row sanity). is_critical_safety marks a safety line. The CROSS-ROW pass rule (every dimension rollup >=2 AND every safety line >=2; any safety 0 => fail) is enforced by tg_signoff_compute_outcome, a TRIGGER — never a CHECK. Locked once the parent is signed.';
comment on column academy.signoff_line_items.is_critical_safety is
  'A single is_critical_safety line scoring 0 forces the whole sign-off to outcome=fail, non-overridable (safety veto).';

create table academy.signoff_evidence (
  id            uuid primary key default gen_random_uuid(),
  signoff_id    uuid not null references academy.signoffs(id) on delete cascade,
  kind          academy.evidence_kind not null,
  r2_key        text not null,               -- Redex-owned immutable copy in R2
  source        academy.evidence_source not null,
  work_os_ref   text,                        -- back-reference to the Work OS source artifact
  captured_at   timestamptz,
  redacted      boolean not null default false,
  created_at    timestamptz not null default now()
);
comment on table academy.signoff_evidence is
  'Redex-owned immutable evidence copies (photos, portal screenshots, Work OS docs, signatures). Accessed only via short-lived signed URLs minted after re-auth (§10); never returned by a blanket SELECT. Locked once the parent sign-off is signed.';

-- ----------------------------------------------------------------------------
-- 8. Recertification (§3.6)
-- ----------------------------------------------------------------------------
-- (credentials referenced below; created next, FK wired after.)
create table academy.recert_schedules (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references academy.users(id) on delete cascade,
  org_id             uuid not null references academy.orgs(id) on delete restrict,
  credential_id      uuid,                    -- FK -> credentials wired after that table exists
  reason             academy.recert_reason not null,
  due_at             timestamptz not null,
  status             academy.recert_status not null default 'scheduled',
  triggered_by_event jsonb not null default '{}'::jsonb,  -- {course_version_id, platform_key, semver_from->to}
  site_scope         text[] not null default '{}',        -- restrict to techs at affected sites
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
comment on table academy.recert_schedules is
  'Recert cadence rows (Core/Adv 24mo, egress+compliance 12mo, Evaluator annual) OR a MAJOR platform change. site_scope makes recert targeted (don''t recert a Phoenix tech for Maine-only gear). Written by recert-scan (service role).';

-- ----------------------------------------------------------------------------
-- 9. Open Badges 3.0 credentials + status list (§3.7, ledger §F)
-- ----------------------------------------------------------------------------
create table academy.badge_classes (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,
  kind          academy.badge_kind not null,
  title         text not null,
  description   text,
  criteria_url  text,
  image_r2_key  text,
  alignment     jsonb not null default '{}'::jsonb,   -- NICET/ESA alignment refs
  requires      jsonb not null default '{}'::jsonb,   -- competencies/badges that must be held (the stack)
  recert_months int,
  is_compliance boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table academy.badge_classes is
  'Credential definitions (skill -> tier -> role ladder). requires encodes stackability. Tier credentials auto-issue when their component skill badges are all field_proven (ledger §D).';

create table academy.credentials (
  id                  uuid primary key default gen_random_uuid(),
  badge_class_id      uuid not null references academy.badge_classes(id) on delete restrict,
  recipient_user_id   uuid not null references academy.users(id) on delete restrict,
  org_id              uuid not null references academy.orgs(id) on delete restrict,
  status              academy.credential_status not null default 'active',
  issued_at           timestamptz not null default now(),
  expires_at          timestamptz,
  evidence_urls       text[] not null default '{}',         -- OB 3.0 evidence -> signoff_evidence/job records
  open_badge_json     jsonb,                                -- full signed OB 3.0 / W3C VC document
  proof               jsonb,                                -- cryptographic proof (issuer-signed)
  hosted_assertion_url text,                                -- public verifiable URL (served via Worker)
  status_list_index   bigint,                               -- this credential's slot in the status list
  revocation_reason   text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table academy.credentials is
  'Issued OB 3.0 Verifiable Credentials. Signed server-side ONLY (proof suite eddsa-rdfc-2022 / Ed25519, issuer did:web:academy.goredex.com — invariant 7). Issuance/revocation is service-role only; status_list_index links to credential_status_list for hosted revocation (ledger §F).';

-- Now wire recert_schedules.credential_id.
alter table academy.recert_schedules
  add constraint recert_credential_fk
  foreign key (credential_id) references academy.credentials(id) on delete cascade;

-- Hosted revocation status list (BitstringStatusList / StatusList2021), ledger §F.
create table academy.credential_status_list (
  id            uuid primary key default gen_random_uuid(),
  list_index    bigint not null unique,        -- bit position in the published bitstring
  credential_id uuid references academy.credentials(id) on delete set null,
  revoked       boolean not null default false,
  reason        text,
  updated_at    timestamptz not null default now()
);
comment on table academy.credential_status_list is
  'Hosted status-list entries for credential revocation (ledger §F — BitstringStatusList/StatusList2021). The verifier checks the bit at list_index. Flipping revoked=true is the revocation primitive; a badge on a retired course version flips to recert_required here. Service-role only.';

-- ----------------------------------------------------------------------------
-- 10. Assessment items & responses (§3.8, ledger §C,G)
-- ----------------------------------------------------------------------------
create table academy.assessment_items (
  id                uuid primary key default gen_random_uuid(),
  competency_id     uuid not null references academy.competencies(id) on delete restrict,
  course_version_id uuid not null references academy.course_versions(id) on delete cascade,
  kind              academy.assessment_kind not null,
  prompt            jsonb not null,
  options           jsonb,
  answer_key        jsonb,                     -- null for open_response (AI/SME graded)
  is_safety_item    boolean not null default false,   -- ledger §C: safety items gate at >=90%
  difficulty        text,
  locale_variants   jsonb not null default '{}'::jsonb,
  mastery_weight    numeric not null default 1.0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table academy.assessment_items is
  'Assessment items at competency grain. is_safety_item (ledger §C) moves the mastery threshold to the ITEM level: safety items gate at >=90%, non-safety at >=80% (a single per-competency scalar is insufficient). Open responses route to the AI grader with SME spot-check.';
comment on column academy.assessment_items.is_safety_item is
  'ledger §C: items flagged safety gate at >=90% mastery; non-safety items at >=80%. The gate is computed server-side from these flags, not from a single competency scalar.';

create table academy.assessment_responses (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references academy.users(id) on delete cascade,
  org_id             uuid not null references academy.orgs(id) on delete restrict,
  assessment_item_id uuid not null references academy.assessment_items(id) on delete restrict,
  enrollment_id      uuid references academy.enrollments(id) on delete set null,
  response           jsonb not null,
  score              numeric,
  graded_by          academy.graded_by,
  ai_grade_meta      jsonb,
  attempt            int not null default 1,
  ts                 timestamptz not null default now(),
  client_event_uuid  uuid not null,            -- idempotency for offline sync (ledger §G)
  created_at         timestamptz not null default now(),
  unique (client_event_uuid)                   -- /sync ON CONFLICT DO NOTHING
);
comment on table academy.assessment_responses is
  'Learner responses (retry-to-mastery: multiple attempts). UNIQUE(client_event_uuid) for idempotent offline flush (ledger §G). The mastery VERDICT (score vs item-level thresholds) is computed server-side; AI grading never alone issues a safety competency.';

-- ----------------------------------------------------------------------------
-- 11. Append-only audit log (§10) — immutable liability record
-- ----------------------------------------------------------------------------
create table academy.audit_log (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references academy.orgs(id) on delete set null,
  actor_user_id uuid references academy.users(id) on delete set null,
  action      academy.audit_action not null,
  target_table text,
  target_id   uuid,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
comment on table academy.audit_log is
  'APPEND-ONLY, immutable audit trail (§10): credential issue/revoke, sign-off sign/void, recert triggers, evidence access, role/authorization changes, AI grades. tg_audit_append_only blocks UPDATE/DELETE. Written by service-role functions.';

-- ============================================================================
-- 12. TRIGGERS
-- ============================================================================

-- ---- 12a. SAFETY-VETO: compute signoff.outcome from line items (ledger §B) ----
-- This is the single most important rule in the system. It is a CROSS-ROW rule
-- (line items are child rows), so it MUST be a trigger, not a CHECK.
--
-- Pass rule: outcome='pass' ONLY IF
--    (i)  every dimension present rolls up to >= 2  (rollup = MIN score in that dimension), AND
--    (ii) every is_critical_safety line item >= 2.
-- A single 0 on ANY safety line => outcome='fail', non-overridable.
-- A sign-off with NO line items can never pass.
--
-- Defense in depth: the finalize-signoff Edge Function computes outcome too; this
-- trigger is the DB backstop that REJECTS any contradictory write (a tampered or
-- buggy function cannot persist a passing sign-off that violates the rule).
create or replace function academy.tg_signoff_compute_outcome()
returns trigger
language plpgsql
as $$
declare
  v_line_count        int;
  v_has_safety_zero   boolean;
  v_all_safety_ok     boolean;   -- every is_critical_safety line >= 2
  v_all_dims_ok       boolean;   -- every present dimension's MIN score >= 2
  v_computed          academy.signoff_outcome;
begin
  -- Only compute/enforce when the sign-off is being finalized or is already signed.
  -- Drafts/submitted may carry a NULL outcome while editing.
  if new.status not in ('signed', 'failed') then
    return new;
  end if;

  select
    count(*),
    bool_or(li.is_critical_safety and li.score = 0),
    coalesce(bool_and(li.score >= 2) filter (where li.is_critical_safety), true),
    coalesce(bool_and(dim_min >= 2), false)
  into
    v_line_count,
    v_has_safety_zero,
    v_all_safety_ok,
    v_all_dims_ok
  from academy.signoff_line_items li
  cross join lateral (
    select min(li2.score) as dim_min
    from academy.signoff_line_items li2
    where li2.signoff_id = new.id
      and li2.dimension = li.dimension
  ) d
  where li.signoff_id = new.id;

  -- No line items => cannot pass (and cannot be 'signed' as a pass).
  if v_line_count is null or v_line_count = 0 then
    v_all_dims_ok   := false;
    v_all_safety_ok := false;
    v_has_safety_zero := false;
  end if;

  -- Safety veto dominates everything.
  if coalesce(v_has_safety_zero, false) then
    v_computed := 'fail';
  elsif coalesce(v_all_dims_ok, false) and coalesce(v_all_safety_ok, false) then
    v_computed := 'pass';
  else
    v_computed := 'fail';
  end if;

  -- A 'signed' status asserts a passing outcome. If the rubric does not support a
  -- pass, the sign-off cannot be 'signed' — it must be 'failed'. Reject the
  -- contradiction loudly (this is what stops a tampered client/function).
  if new.status = 'signed' and v_computed <> 'pass' then
    raise exception
      'SAFETY VETO: sign-off % cannot be signed as pass — rubric requires every dimension >=2 and every safety line >=2 (a single safety 0 forces fail).',
      new.id
      using errcode = 'check_violation';
  end if;

  -- Force outcome to the computed value; the caller cannot override it.
  new.outcome := v_computed;

  -- Stamp signed_at on the transition into signed.
  if new.status = 'signed' and new.signed_at is null then
    new.signed_at := now();
  end if;

  return new;
end;
$$;
comment on function academy.tg_signoff_compute_outcome() is
  'SAFETY-VETO backstop (CLAUDE.md invariant 1). Computes signoffs.outcome from signoff_line_items on finalize: pass only if every dimension rollup >=2 AND every is_critical_safety line >=2; any safety 0 => fail. Rejects signing a sign-off that the rubric does not support. Cross-row => a trigger, never a CHECK.';

create trigger trg_signoff_compute_outcome
  before insert or update on academy.signoffs
  for each row
  execute function academy.tg_signoff_compute_outcome();

-- A late edit to line items after the parent is signed could change the verdict.
-- The immutability trigger (12b) blocks that at the line-item level; this AFTER
-- trigger additionally re-asserts the parent verdict if line items move while the
-- parent is in a non-signed state (keeps outcome consistent during drafting).
create or replace function academy.tg_signoff_line_touch_parent()
returns trigger
language plpgsql
as $$
declare
  v_signoff_id uuid;
begin
  v_signoff_id := coalesce(new.signoff_id, old.signoff_id);
  -- Bump parent updated_at; the compute trigger re-runs on the next finalize.
  update academy.signoffs
    set updated_at = now()
  where id = v_signoff_id;
  return coalesce(new, old);
end;
$$;

create trigger trg_signoff_line_touch_parent
  after insert or update or delete on academy.signoff_line_items
  for each row
  execute function academy.tg_signoff_line_touch_parent();

-- ---- 12b. IMMUTABILITY: lock signed sign-offs + line items + evidence (inv. 2) ----
-- Once status='signed', the row is frozen. The ONE legal transition is
-- signed -> void (with a void_reason + superseded_by), which the service-role
-- finalize/void function performs. DELETE of a signed sign-off is never allowed.
create or replace function academy.tg_signoff_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'signed' then
      raise exception 'IMMUTABLE: signed sign-off % cannot be deleted (corrections require a new voiding sign-off).', old.id
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- UPDATE: only act if the OLD row was already signed.
  if old.status = 'signed' then
    -- Allow exactly one transition: signed -> void, setting void_reason/superseded_by.
    if new.status = 'void'
       and old.outcome is not distinct from new.outcome
       and old.candidate_user_id = new.candidate_user_id
       and old.evaluator_user_id = new.evaluator_user_id
       and old.competency_id is not distinct from new.competency_id
       and old.course_id is not distinct from new.course_id
       and old.work_os_job_id is not distinct from new.work_os_job_id
       and old.signed_at is not distinct from new.signed_at
       and old.org_id = new.org_id
       and new.void_reason is not null
    then
      return new;  -- the legal void path
    end if;

    raise exception
      'IMMUTABLE: signed sign-off % cannot be modified (only the signed->void path with a void_reason is permitted).', old.id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
comment on function academy.tg_signoff_immutable() is
  'IMMUTABILITY (CLAUDE.md invariant 2). Once status=signed, blocks UPDATE (except the single legal signed->void with a void_reason) and all DELETE. Corrections require a new voiding sign-off.';

create trigger trg_signoff_immutable
  before update or delete on academy.signoffs
  for each row
  execute function academy.tg_signoff_immutable();

-- Lock line items + evidence whose parent sign-off is signed.
create or replace function academy.tg_signoff_child_immutable()
returns trigger
language plpgsql
as $$
declare
  v_signoff_id uuid;
  v_status     academy.signoff_status;
begin
  v_signoff_id := coalesce(new.signoff_id, old.signoff_id);
  select status into v_status from academy.signoffs where id = v_signoff_id;

  if v_status = 'signed' then
    raise exception
      'IMMUTABLE: cannot modify % of signed sign-off % (rubric/evidence are frozen once signed).',
      tg_table_name, v_signoff_id
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;
comment on function academy.tg_signoff_child_immutable() is
  'Blocks INSERT/UPDATE/DELETE on signoff_line_items and signoff_evidence once the parent sign-off is signed (invariant 2 — children are frozen with the parent).';

create trigger trg_signoff_line_items_immutable
  before insert or update or delete on academy.signoff_line_items
  for each row
  execute function academy.tg_signoff_child_immutable();

create trigger trg_signoff_evidence_immutable
  before insert or update or delete on academy.signoff_evidence
  for each row
  execute function academy.tg_signoff_child_immutable();

-- ---- 12c. AUDIT LOG append-only (invariant: immutable liability record) ----
create or replace function academy.tg_audit_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'APPEND-ONLY: academy.audit_log rows cannot be % (the audit trail is immutable).', tg_op
    using errcode = 'check_violation';
  return null;
end;
$$;
comment on function academy.tg_audit_append_only() is 'Blocks UPDATE/DELETE on academy.audit_log — the liability record is append-only (§10).';

create trigger trg_audit_append_only
  before update or delete on academy.audit_log
  for each row
  execute function academy.tg_audit_append_only();

-- ---- 12d. FIXTURE publish gate: a published sim may not use an unsanitized fixture ----
create or replace function academy.tg_block_unsanitized_fixture()
returns trigger
language plpgsql
as $$
declare
  v_sanitized boolean;
begin
  if new.status = 'published' and new.fixture_set_id is not null then
    select sanitized into v_sanitized from academy.fixture_sets where id = new.fixture_set_id;
    if not coalesce(v_sanitized, false) then
      raise exception
        'PUBLISH GATE: sim_definition % cannot be published with an unsanitized fixture set % (fixtures must be sanitized=true — no real PII).',
        new.id, new.fixture_set_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
comment on function academy.tg_block_unsanitized_fixture() is
  'PUBLISH GATE (CLAUDE.md invariant 6): a published sim_definition may not reference a fixture_set unless sanitized=true.';

create trigger trg_sim_def_fixture_gate
  before insert or update on academy.sim_definitions
  for each row
  execute function academy.tg_block_unsanitized_fixture();

-- ---- 12e. updated_at maintenance on every mutable-by-users table ----
do $$
declare
  t text;
  mutable_tables text[] := array[
    'orgs','users','user_roles','evaluator_authorizations','competencies','courses',
    'course_versions','units','enrollments','unit_progress','competency_state',
    'fixture_sets','sim_definitions','sim_attempts','signoffs','signoff_line_items',
    'recert_schedules','badge_classes','credentials','credential_status_list',
    'assessment_items','assessment_responses'
  ];
begin
  foreach t in array mutable_tables loop
    execute format(
      'create trigger trg_set_updated_at before update on academy.%I
         for each row execute function academy.tg_set_updated_at();', t
    );
  end loop;
end $$;

-- ============================================================================
-- 13. check_prereq_dag() — cycle detection for the CI dag:check
-- ============================================================================
-- Returns the rows on any prerequisite cycle (empty result = the graph is a DAG).
-- The CI `pnpm dag:check` fails if this returns any row.
create or replace function academy.check_prereq_dag()
returns table (course_id uuid, requires_course_id uuid, cycle_path uuid[])
language sql
stable
as $$
  with recursive walk as (
    select
      cp.course_id          as origin,
      cp.requires_course_id as node,
      array[cp.course_id, cp.requires_course_id] as path,
      (cp.course_id = cp.requires_course_id)     as is_cycle
    from academy.course_prerequisites cp
    union all
    select
      w.origin,
      cp.requires_course_id,
      w.path || cp.requires_course_id,
      cp.requires_course_id = any(w.path)
    from walk w
    join academy.course_prerequisites cp
      on cp.course_id = w.node
    where not w.is_cycle
      and array_length(w.path, 1) < 1000   -- guard against runaway on a malformed graph
  )
  select distinct w.origin, w.node, w.path
  from walk w
  where w.is_cycle
$$;
comment on function academy.check_prereq_dag() is
  'Cycle detector for course_prerequisites. Returns rows describing any cycle; an EMPTY result means the prerequisite graph is a DAG. The CI dag:check fails if any row is returned (wave3 §3.2 / DoD).';

-- Convenience boolean for tests/CI.
create or replace function academy.prereq_graph_is_dag()
returns boolean
language sql
stable
as $$
  select not exists (select 1 from academy.check_prereq_dag())
$$;
comment on function academy.prereq_graph_is_dag() is 'TRUE when course_prerequisites is acyclic (a DAG).';

-- ============================================================================
-- 14. GRANTS (RLS narrows further; service_role bypasses RLS by design)
-- ============================================================================
-- End-user roles get table-level privileges only where a policy will allow rows;
-- crucially they get NO INSERT/UPDATE/DELETE on the state tables (invariant 3).

-- Read-mostly catalog + personal tables: SELECT to authenticated (RLS scopes rows).
grant select on all tables in schema academy to authenticated;

-- anon may read only the published catalog (policies enforce; grant SELECT, RLS filters).
grant select on
  academy.courses, academy.course_versions, academy.units, academy.unit_competencies,
  academy.competencies, academy.course_prerequisites, academy.course_platform_dependencies,
  academy.sim_definitions, academy.badge_classes
to anon;

-- Learner-owned mutable rows the CLIENT may write directly (NOT state tables):
--   sim attempts/telemetry + assessment responses are append-only learner events,
--   enrollments self-enroll, unit_progress ticks, draft sign-offs + their line items
--   + evidence (DRAFT only — the immutability + safety-veto triggers govern signing).
grant insert on
  academy.sim_attempts, academy.sim_telemetry_events, academy.assessment_responses,
  academy.enrollments, academy.unit_progress,
  academy.signoffs, academy.signoff_line_items, academy.signoff_evidence
to authenticated;
grant update on
  academy.unit_progress, academy.enrollments,
  academy.signoffs, academy.signoff_line_items
to authenticated;

-- service_role: full DML on everything (it bypasses RLS; the Edge Function is the
-- write authority for all server-only state — competency_state, credentials,
-- credential_status_list, recert_schedules, signoff finalize, audit_log).
grant all privileges on all tables in schema academy to service_role;
grant all privileges on all sequences in schema academy to service_role;

-- Default privileges so later objects keep the baseline.
alter default privileges in schema academy grant select on tables to authenticated;
alter default privileges in schema academy grant all on tables to service_role;
alter default privileges in schema academy grant all on sequences to service_role;

-- ============================================================================
-- 15. RLS — ENABLE + FORCE on EVERY table, deny-by-default (invariant 4)
-- ============================================================================
-- Strategy (wave3 §3.8/§7, ledger §A):
--   * Tenant isolation: org_id = academy.current_org_id() on every personal/tenant row.
--   * Published catalog (courses/units/sim_definitions/...) readable cross-tenant.
--   * Learners read own rows; managers/admins read org rows.
--   * STATE-CHANGING writes (competency_state, credentials, credential_status_list,
--     recert_schedules, badge issuance, sign-off FINALIZE) have NO end-user write
--     policy at all — only service_role (which bypasses RLS) writes them.
--   * Deny-by-default: enabling RLS with no matching policy yields zero rows.

do $$
declare
  t text;
  all_tables text[] := array[
    'orgs','users','roles','user_roles','evaluator_authorizations','competencies',
    'courses','course_versions','units','unit_competencies','course_prerequisites',
    'course_platform_dependencies','enrollments','unit_progress','competency_state',
    'fixture_sets','sim_definitions','sim_attempts','sim_telemetry_events',
    'signoffs','signoff_line_items','signoff_evidence','recert_schedules',
    'badge_classes','credentials','credential_status_list','assessment_items',
    'assessment_responses','audit_log'
  ];
begin
  foreach t in array all_tables loop
    execute format('alter table academy.%I enable row level security;', t);
    -- FORCE so the table owner is also subject to RLS (defense in depth);
    -- service_role still bypasses via its BYPASSRLS attribute.
    execute format('alter table academy.%I force row level security;', t);
  end loop;
end $$;

-- ---- 15a. Tenancy: orgs ----
-- A caller sees their own org (and its parent, for shared-catalog nesting).
create policy orgs_select_own on academy.orgs
  for select to authenticated
  using (
    id = academy.current_org_id()
    or id = (select parent_org_id from academy.orgs o2 where o2.id = academy.current_org_id())
  );

-- ---- 15b. users ----
create policy users_select_self on academy.users
  for select to authenticated
  using (id = academy.current_user_id());

create policy users_select_org_managers on academy.users
  for select to authenticated
  using (
    org_id = academy.current_org_id()
    and academy.jwt_has_role('manager','org_admin','curriculum_admin','exec','support')
  );

-- A user may update their OWN mutable profile fields (RLS row scope; column
-- safety — e.g. not letting them change org_id — is enforced by the Edge Function
-- / a future column-grant; no org_id self-move is possible without a write path).
create policy users_update_self on academy.users
  for update to authenticated
  using (id = academy.current_user_id())
  with check (id = academy.current_user_id() and org_id = academy.current_org_id());

-- ---- 15c. roles (global catalog, readable) ----
create policy roles_select_all on academy.roles
  for select to authenticated using (true);

-- ---- 15d. user_roles (self + org managers read; NO end-user write) ----
create policy user_roles_select_self on academy.user_roles
  for select to authenticated
  using (user_id = academy.current_user_id());

create policy user_roles_select_org_admin on academy.user_roles
  for select to authenticated
  using (org_id = academy.current_org_id() and academy.jwt_has_role('org_admin','manager','exec'));

-- ---- 15e. evaluator_authorizations (self + org managers read; service-role write) ----
create policy eval_auth_select_self on academy.evaluator_authorizations
  for select to authenticated
  using (user_id = academy.current_user_id());

create policy eval_auth_select_org on academy.evaluator_authorizations
  for select to authenticated
  using (org_id = academy.current_org_id() and academy.jwt_has_role('manager','org_admin','exec'));

-- ---- 15f. Published catalog: cross-tenant readable (org-agnostic) ----
-- courses / course_versions / units / unit_competencies / competencies /
-- prerequisites / platform deps / sim_definitions / badge_classes.
create policy courses_select_published on academy.courses
  for select to anon, authenticated
  using (status = 'published' or academy.jwt_has_role('author','curriculum_admin','org_admin'));

create policy course_versions_select_published on academy.course_versions
  for select to anon, authenticated
  using (status in ('published','deprecated') or academy.jwt_has_role('author','curriculum_admin','org_admin'));

create policy units_select_published on academy.units
  for select to anon, authenticated
  using (
    exists (
      select 1 from academy.course_versions cv
      where cv.id = units.course_version_id
        and (cv.status in ('published','deprecated') or academy.jwt_has_role('author','curriculum_admin','org_admin'))
    )
  );

create policy unit_competencies_select on academy.unit_competencies
  for select to anon, authenticated using (true);

create policy competencies_select_all on academy.competencies
  for select to anon, authenticated using (true);

create policy course_prereq_select_all on academy.course_prerequisites
  for select to anon, authenticated using (true);

create policy course_platform_deps_select_all on academy.course_platform_dependencies
  for select to anon, authenticated using (true);

create policy sim_definitions_select_published on academy.sim_definitions
  for select to anon, authenticated
  using (status = 'published' or academy.jwt_has_role('author','curriculum_admin'));

create policy badge_classes_select_all on academy.badge_classes
  for select to anon, authenticated using (true);

-- fixture_sets are sensitive (sanitized recordings) — authors/admins only, never anon.
create policy fixture_sets_select_authors on academy.fixture_sets
  for select to authenticated
  using (academy.jwt_has_role('author','curriculum_admin'));

-- ---- 15g. enrollments (own read+write self-enroll; managers read org) ----
create policy enrollments_select_own on academy.enrollments
  for select to authenticated
  using (user_id = academy.current_user_id());

create policy enrollments_select_org_mgr on academy.enrollments
  for select to authenticated
  using (org_id = academy.current_org_id() and academy.jwt_has_role('manager','org_admin','exec'));

create policy enrollments_insert_self on academy.enrollments
  for insert to authenticated
  with check (user_id = academy.current_user_id() and org_id = academy.current_org_id());

create policy enrollments_update_self on academy.enrollments
  for update to authenticated
  using (user_id = academy.current_user_id())
  with check (user_id = academy.current_user_id() and org_id = academy.current_org_id());

-- ---- 15h. unit_progress (own read+write; managers read org) ----
create policy unit_progress_select_own on academy.unit_progress
  for select to authenticated
  using (
    exists (select 1 from academy.enrollments e
            where e.id = unit_progress.enrollment_id and e.user_id = academy.current_user_id())
  );

create policy unit_progress_select_org_mgr on academy.unit_progress
  for select to authenticated
  using (org_id = academy.current_org_id() and academy.jwt_has_role('manager','org_admin','exec'));

create policy unit_progress_insert_own on academy.unit_progress
  for insert to authenticated
  with check (
    org_id = academy.current_org_id()
    and exists (select 1 from academy.enrollments e
                where e.id = unit_progress.enrollment_id and e.user_id = academy.current_user_id())
  );

create policy unit_progress_update_own on academy.unit_progress
  for update to authenticated
  using (
    exists (select 1 from academy.enrollments e
            where e.id = unit_progress.enrollment_id and e.user_id = academy.current_user_id())
  )
  with check (org_id = academy.current_org_id());

-- ---- 15i. competency_state: SERVER-ONLY writes (invariant 3) ----
-- Read own + managers read org. NO insert/update/delete policy => end users cannot write.
create policy competency_state_select_own on academy.competency_state
  for select to authenticated
  using (user_id = academy.current_user_id());

create policy competency_state_select_org_mgr on academy.competency_state
  for select to authenticated
  using (org_id = academy.current_org_id() and academy.jwt_has_role('manager','org_admin','exec'));

-- ---- 15j. sim_attempts / telemetry (own read+append; managers read org) ----
create policy sim_attempts_select_own on academy.sim_attempts
  for select to authenticated
  using (user_id = academy.current_user_id());

create policy sim_attempts_select_org_mgr on academy.sim_attempts
  for select to authenticated
  using (org_id = academy.current_org_id() and academy.jwt_has_role('manager','org_admin','exec'));

create policy sim_attempts_insert_own on academy.sim_attempts
  for insert to authenticated
  with check (user_id = academy.current_user_id() and org_id = academy.current_org_id());

create policy sim_telemetry_select_own on academy.sim_telemetry_events
  for select to authenticated
  using (
    exists (select 1 from academy.sim_attempts a
            where a.id = sim_telemetry_events.sim_attempt_id and a.user_id = academy.current_user_id())
  );

create policy sim_telemetry_insert_own on academy.sim_telemetry_events
  for insert to authenticated
  with check (
    exists (select 1 from academy.sim_attempts a
            where a.id = sim_telemetry_events.sim_attempt_id and a.user_id = academy.current_user_id())
  );

-- ---- 15k. signoffs: candidate + evaluator + managers read; DRAFT writes only ----
-- Reads: the candidate, the signing evaluator, and org managers. Cross-tenant blocked.
create policy signoffs_select_party on academy.signoffs
  for select to authenticated
  using (
    candidate_user_id = academy.current_user_id()
    or evaluator_user_id = academy.current_user_id()
    or (org_id = academy.current_org_id() and academy.jwt_has_role('manager','org_admin','exec'))
  );

-- An authorized evaluator may create a DRAFT/submitted sign-off in their org.
-- Finalizing to 'signed' (and the resulting competency promotion / badge issuance)
-- is done by the service-role finalize-signoff function — the trigger enforces the
-- safety veto regardless. The WITH CHECK forbids a client from inserting a 'signed' row.
create policy signoffs_insert_evaluator on academy.signoffs
  for insert to authenticated
  with check (
    org_id = academy.current_org_id()
    and evaluator_user_id = academy.current_user_id()
    and academy.jwt_has_role('evaluator')
    and status in ('draft','submitted')        -- clients never insert a signed sign-off
  );

-- An evaluator may edit their OWN draft (the immutability trigger blocks any signed row).
create policy signoffs_update_draft_evaluator on academy.signoffs
  for update to authenticated
  using (
    evaluator_user_id = academy.current_user_id()
    and status in ('draft','submitted')
  )
  with check (
    org_id = academy.current_org_id()
    and status in ('draft','submitted','failed')  -- may NOT self-transition to 'signed'
  );

-- ---- 15l. signoff_line_items: draft-time writes by the owning evaluator ----
create policy signoff_line_items_select_party on academy.signoff_line_items
  for select to authenticated
  using (
    exists (
      select 1 from academy.signoffs s
      where s.id = signoff_line_items.signoff_id
        and (
          s.candidate_user_id = academy.current_user_id()
          or s.evaluator_user_id = academy.current_user_id()
          or (s.org_id = academy.current_org_id() and academy.jwt_has_role('manager','org_admin','exec'))
        )
    )
  );

create policy signoff_line_items_write_draft on academy.signoff_line_items
  for insert to authenticated
  with check (
    exists (
      select 1 from academy.signoffs s
      where s.id = signoff_line_items.signoff_id
        and s.evaluator_user_id = academy.current_user_id()
        and s.status in ('draft','submitted')
    )
  );

create policy signoff_line_items_update_draft on academy.signoff_line_items
  for update to authenticated
  using (
    exists (
      select 1 from academy.signoffs s
      where s.id = signoff_line_items.signoff_id
        and s.evaluator_user_id = academy.current_user_id()
        and s.status in ('draft','submitted')
    )
  )
  with check (true);

-- ---- 15m. signoff_evidence: party read; draft-time insert by evaluator ----
create policy signoff_evidence_select_party on academy.signoff_evidence
  for select to authenticated
  using (
    exists (
      select 1 from academy.signoffs s
      where s.id = signoff_evidence.signoff_id
        and (
          s.candidate_user_id = academy.current_user_id()
          or s.evaluator_user_id = academy.current_user_id()
          or (s.org_id = academy.current_org_id() and academy.jwt_has_role('manager','org_admin','exec'))
        )
    )
  );

create policy signoff_evidence_insert_draft on academy.signoff_evidence
  for insert to authenticated
  with check (
    exists (
      select 1 from academy.signoffs s
      where s.id = signoff_evidence.signoff_id
        and s.evaluator_user_id = academy.current_user_id()
        and s.status in ('draft','submitted')
    )
  );

-- ---- 15n. recert_schedules: SERVER-ONLY writes; self + managers read ----
create policy recert_select_own on academy.recert_schedules
  for select to authenticated
  using (user_id = academy.current_user_id());

create policy recert_select_org_mgr on academy.recert_schedules
  for select to authenticated
  using (org_id = academy.current_org_id() and academy.jwt_has_role('manager','org_admin','exec'));

-- ---- 15o. credentials: SERVER-ONLY writes; self + managers read ----
create policy credentials_select_own on academy.credentials
  for select to authenticated
  using (recipient_user_id = academy.current_user_id());

create policy credentials_select_org_mgr on academy.credentials
  for select to authenticated
  using (org_id = academy.current_org_id() and academy.jwt_has_role('manager','org_admin','exec'));

-- ---- 15p. credential_status_list: PUBLIC-readable (verifier checks the list); server writes ----
-- The hosted status list is consumed by external verifiers, so SELECT is open
-- (it contains no PII — just a revoked bit per index). Writes are service-role only.
create policy credential_status_list_select_public on academy.credential_status_list
  for select to anon, authenticated using (true);

-- ---- 15q. assessment_items: published-catalog read; authors write via service role ----
create policy assessment_items_select on academy.assessment_items
  for select to authenticated
  using (
    exists (
      select 1 from academy.course_versions cv
      where cv.id = assessment_items.course_version_id
        and (cv.status in ('published','deprecated') or academy.jwt_has_role('author','curriculum_admin'))
    )
  );

-- ---- 15r. assessment_responses: own read+append; managers read org ----
create policy assessment_responses_select_own on academy.assessment_responses
  for select to authenticated
  using (user_id = academy.current_user_id());

create policy assessment_responses_select_org_mgr on academy.assessment_responses
  for select to authenticated
  using (org_id = academy.current_org_id() and academy.jwt_has_role('manager','org_admin','exec'));

create policy assessment_responses_insert_own on academy.assessment_responses
  for insert to authenticated
  with check (user_id = academy.current_user_id() and org_id = academy.current_org_id());

-- ---- 15s. audit_log: org admins/exec read own org; append-only; server writes ----
create policy audit_log_select_org_admin on academy.audit_log
  for select to authenticated
  using (org_id = academy.current_org_id() and academy.jwt_has_role('org_admin','exec','support'));

-- NOTE: No INSERT/UPDATE/DELETE policies exist for the following — they are
-- SERVICE-ROLE ONLY by design (invariant 3): competency_state, credentials,
-- credential_status_list, recert_schedules, badge_classes (authoring),
-- assessment_items (authoring), evaluator_authorizations, roles, user_roles,
-- fixture_sets, sim_definitions, course catalog writes, and audit_log inserts.
-- The service_role bypasses RLS, so the Edge Functions are the write boundary
-- and perform their own JWT/role authorization before writing.

-- ============================================================================
-- 16. INDEXES (foreign keys + hot query paths)
-- ============================================================================
create index idx_users_org              on academy.users(org_id);
create index idx_user_roles_user        on academy.user_roles(user_id);
create index idx_user_roles_org         on academy.user_roles(org_id);
create index idx_eval_auth_user         on academy.evaluator_authorizations(user_id);
create index idx_eval_auth_org_status   on academy.evaluator_authorizations(org_id, status);

create index idx_courses_domain_status  on academy.courses(domain, status);
create index idx_course_versions_course on academy.course_versions(course_id);
create index idx_units_cv_ordinal       on academy.units(course_version_id, ordinal);
create index idx_unit_comp_comp         on academy.unit_competencies(competency_id);
create index idx_course_prereq_requires on academy.course_prerequisites(requires_course_id);
create index idx_course_plat_deps_key   on academy.course_platform_dependencies(platform_key);

create index idx_enrollments_user       on academy.enrollments(user_id);
create index idx_enrollments_org        on academy.enrollments(org_id);
create index idx_enrollments_course     on academy.enrollments(course_id);
create index idx_unit_progress_enroll   on academy.unit_progress(enrollment_id);
create index idx_unit_progress_org      on academy.unit_progress(org_id);
create index idx_competency_state_user  on academy.competency_state(user_id);
create index idx_competency_state_org   on academy.competency_state(org_id);
create index idx_competency_state_comp  on academy.competency_state(competency_id);

create index idx_sim_def_kind_status    on academy.sim_definitions(kind, status);
create index idx_sim_attempts_user      on academy.sim_attempts(user_id);
create index idx_sim_attempts_org       on academy.sim_attempts(org_id);
create index idx_sim_attempts_def       on academy.sim_attempts(sim_definition_id);
create index idx_sim_telemetry_attempt  on academy.sim_telemetry_events(sim_attempt_id);

create index idx_signoffs_candidate     on academy.signoffs(candidate_user_id);
create index idx_signoffs_evaluator     on academy.signoffs(evaluator_user_id);
create index idx_signoffs_org_status    on academy.signoffs(org_id, status);   -- manager pipeline board
create index idx_signoffs_workos_job    on academy.signoffs(work_os_job_id);   -- cross-schema join
create index idx_signoff_line_signoff   on academy.signoff_line_items(signoff_id);
-- partial index: fast lookup of safety lines (the veto path)
create index idx_signoff_line_safety    on academy.signoff_line_items(signoff_id) where is_critical_safety;
create index idx_signoff_evidence_signoff on academy.signoff_evidence(signoff_id);

create index idx_recert_user            on academy.recert_schedules(user_id);
create index idx_recert_org_status      on academy.recert_schedules(org_id, status);
create index idx_recert_due             on academy.recert_schedules(due_at);

create index idx_credentials_recipient  on academy.credentials(recipient_user_id);
create index idx_credentials_org_status on academy.credentials(org_id, status);
create index idx_credentials_badge      on academy.credentials(badge_class_id);
create index idx_cred_status_credential on academy.credential_status_list(credential_id);

create index idx_assess_items_comp      on academy.assessment_items(competency_id);
create index idx_assess_items_cv        on academy.assessment_items(course_version_id);
-- partial index: safety items (the >=90% gate path)
create index idx_assess_items_safety    on academy.assessment_items(course_version_id) where is_safety_item;
create index idx_assess_resp_user       on academy.assessment_responses(user_id);
create index idx_assess_resp_item       on academy.assessment_responses(assessment_item_id);

create index idx_audit_org_action       on academy.audit_log(org_id, action);
create index idx_audit_target           on academy.audit_log(target_table, target_id);

-- ============================================================================
-- 17. NOTE: FK to auth.users (Supabase) — apply when the auth schema is present
-- ============================================================================
-- In a real Supabase project, auth.users already exists. Wire identity then with:
--
--   alter table academy.users
--     add constraint users_id_authusers_fk
--     foreign key (id) references auth.users(id) on delete cascade;
--
-- This file does NOT create that constraint unconditionally so it can run in a
-- bare local/CI Postgres (CI seeds auth.users separately). The migration that
-- runs against Supabase should include the constraint above (kept here as the
-- documented contract, per ledger §A: academy.users.id = auth.users.id).

commit;
