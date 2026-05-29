-- ============================================================================
-- 0002_workos_stub.sql
-- Redex Academy — `workos` schema STUB + the cross-schema FK.
--
-- Goal F2a (ledger §H): stand up a minimal `workos` schema so that
-- academy.signoffs / recert / dashboards can JOIN to real Work OS jobs with
-- referential integrity, BEFORE M6 wires the evaluator sign-off flow.
--
-- This is a STUB: just enough of `workos.jobs` (and a tenant-linking column)
-- for the cross-schema FK and the dashboard joins. When the full Work OS is
-- migrated/consolidated into this database, that work REPLACES this stub's
-- table body (the FK + grants contract stays the same).
--
-- Identity/tenancy (LOCKED, ledger §A): there is ONE canonical tenant table,
-- academy.orgs. The workos schema does NOT define its own org table — it
-- references academy.orgs so both schemas' RLS key on the SAME org_id claim.
-- Shared auth.users is the one identity space; workos.jobs.tech_user_id is an
-- auth.users.id (= academy.users.id).
--
-- Must run AFTER 0001_init_academy.sql (it references academy.orgs and adds the
-- FK target for academy.signoffs.work_os_job_id).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0. Schema + grants
-- ----------------------------------------------------------------------------
create schema if not exists workos;
comment on schema workos is
  'Redex Work OS (field system of record): jobs, photos, signatures, site inventory. STUB here (F2a) — minimal jobs table for the cross-schema FK + dashboard joins. Shares auth.users and the canonical academy.orgs tenant table with the academy schema (ledger §A).';

grant usage on schema workos to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 1. Enum + the minimal jobs table
-- ----------------------------------------------------------------------------
create type workos.job_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled');

create table workos.jobs (
  id            uuid primary key default gen_random_uuid(),
  -- Canonical tenant link: references the ONE org table (academy.orgs), so
  -- workos RLS keys on the same JWT org_id claim as academy (ledger §A).
  org_id        uuid not null references academy.orgs(id) on delete restrict,
  -- The tech the job is assigned to. = auth.users.id (= academy.users.id);
  -- the FK to auth.users is added in the Supabase-targeted migration (see note).
  tech_user_id  uuid,
  -- Site this job was performed at (drives site-scoped recert targeting, §8).
  site_id       uuid,
  external_ref  text,                      -- Work OS human-facing job number
  status        workos.job_status not null default 'scheduled',
  scheduled_at  timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table workos.jobs is
  'STUB of the Work OS job record (F2a). academy.signoffs.work_os_job_id references this (ON DELETE RESTRICT — a job must survive as long as the credential proven on it). org_id references the canonical academy.orgs. Replaced by the full Work OS migration later; the FK + grants contract is stable.';
comment on column workos.jobs.tech_user_id is
  'auth.users.id of the assigned tech (= academy.users.id). The canonical Academy<->Work OS join key is auth.users.id (ledger §A).';

create index idx_workos_jobs_org    on workos.jobs(org_id);
create index idx_workos_jobs_tech   on workos.jobs(tech_user_id);
create index idx_workos_jobs_site   on workos.jobs(site_id);
create index idx_workos_jobs_status on workos.jobs(org_id, status);

-- updated_at maintenance (reuse the academy helper — one identity space, one DB).
create trigger trg_workos_jobs_updated_at
  before update on workos.jobs
  for each row
  execute function academy.tg_set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. THE cross-schema FK (ledger §A / wave4 §1.5)
--    academy.signoffs.work_os_job_id -> workos.jobs(id)
-- ----------------------------------------------------------------------------
-- ON DELETE RESTRICT: you must NEVER silently lose the job a credential was
-- proven on (sign-off immutability, §3.5, demands the job survive too).
-- The referencing role needs USAGE on workos (granted above) + the FK target;
-- service_role performs the writes.
alter table academy.signoffs
  add constraint signoffs_work_os_job_fk
  foreign key (work_os_job_id) references workos.jobs(id) on delete restrict;

comment on constraint signoffs_work_os_job_fk on academy.signoffs is
  'Cross-schema FK (ledger §A): the sign-off''s real Work OS job. ON DELETE RESTRICT keeps the job alive as long as the (immutable) sign-off references it.';

-- ----------------------------------------------------------------------------
-- 3. RLS on the workos stub — same tenant-isolation contract as academy
-- ----------------------------------------------------------------------------
alter table workos.jobs enable row level security;
alter table workos.jobs force row level security;

-- Grants: SELECT to authenticated (RLS scopes rows); full DML to service_role.
grant select on workos.jobs to authenticated;
grant all privileges on all tables in schema workos to service_role;
grant all privileges on all sequences in schema workos to service_role;
alter default privileges in schema workos grant select on tables to authenticated;
alter default privileges in schema workos grant all on tables to service_role;
alter default privileges in schema workos grant all on sequences to service_role;

-- Tenant isolation on the SAME org_id claim (academy.current_org_id) — a CCS
-- actor sees only their org's jobs; the assigned tech sees their own.
create policy workos_jobs_select_tenant on workos.jobs
  for select to authenticated
  using (
    org_id = academy.current_org_id()
    and (
      tech_user_id = academy.current_user_id()
      or academy.jwt_has_role('manager','org_admin','exec','support')
    )
  );

-- Writes to Work OS jobs are owned by the Work OS app / service role — no
-- end-user write policy here (this Academy build never creates production jobs).

-- ----------------------------------------------------------------------------
-- 4. PostgREST exposed-schema + search_path NOTES (apply in Supabase config)
-- ----------------------------------------------------------------------------
-- PostgREST only exposes schemas listed in db.schemas. Add academy + workos so
-- the client/Edge REST calls resolve (otherwise they 404). In supabase/config.toml:
--
--   [api]
--   schemas = ["public", "academy", "workos", "graphql_public"]
--   extra_search_path = ["public", "academy", "workos"]
--
-- (or the dashboard: Project Settings -> API -> Exposed schemas / Extra search path.)
--
-- Per-role search_path (so unqualified names resolve correctly; migrations ALWAYS
-- schema-qualify — never rely on the session default):
--
--   alter role authenticated set search_path = academy, workos, public;
--   alter role anon          set search_path = academy, public;
--   -- service-role functions that touch both schemas:
--   alter role service_role  set search_path = academy, workos, public;
--
-- (Run these against the Supabase project; they are environment config, not part
-- of the forward-only migration body, so they are documented here rather than
-- executed — running ALTER ROLE on a bare CI Postgres may not match Supabase's
-- managed roles.)

commit;
