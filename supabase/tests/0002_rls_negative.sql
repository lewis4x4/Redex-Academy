-- ============================================================================
-- tests/0002_rls_negative.sql
-- Redex Academy — RLS cross-tenant negative-test matrix (F2, CLAUDE.md inv. 3/4).
--
-- Proves deny-by-default tenant isolation across the PERSONAL/tenant tables:
--   * POSITIVE control: a Redex (org A) manager SEES the seeded org-A rows.
--   * NEGATIVE:         a CCS (org B) manager sees ZERO rows in every one of
--                       those tables (cross-tenant isolation; RLS is FORCEd).
--   * NEGATIVE:         an anon (unauthenticated) actor sees ZERO personal rows.
--
-- Runner: plain psql (no pgTAP). Each assertion RAISEs EXCEPTION on failure,
-- aborting the transaction -> CI fails. Everything runs inside a transaction
-- that is ROLLED BACK, so it never persists fixture data. Fixtures use
-- __TEST__-scoped unique keys so this is safe with or without the S1 seed.
--
-- Run as a role that can `SET ROLE authenticated`/`anon` (the DB owner/superuser);
-- service_role is NOT used here (it bypasses RLS and would defeat the test).
--
-- Run:  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/0002_rls_negative.sql
--       (Assumes 0001_init_academy.sql is applied.)
-- ============================================================================

begin;
set local client_min_messages = notice;

create or replace function pg_temp.assert(cond boolean, label text)
returns void language plpgsql as $$
begin
  if cond then raise notice 'ok  - %', label;
  else raise exception 'not ok - %', label using errcode = 'assert_failure';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- Seed: org A (Redex) owns one row in every tenant table below; org B (CCS) is empty.
-- Catalog tables (courses/units/competencies/…) are intentionally cross-tenant
-- readable and are NOT part of this isolation matrix.
-- ----------------------------------------------------------------------------
do $$
declare
  v_org_a  uuid := '00000000-0000-0000-0000-00000000aaa1';  -- Redex
  v_org_b  uuid := '00000000-0000-0000-0000-00000000bbb2';  -- CCS partner
  v_cand   uuid := '00000000-0000-0000-0000-00000000ccc3';
  v_eval   uuid := '00000000-0000-0000-0000-00000000ddd4';
  v_comp   uuid := '00000000-0000-0000-0000-00000000eee5';
  v_course uuid := '00000000-0000-0000-0000-00000000fff6';
  v_cv     uuid := '00000000-0000-0000-0000-00000000a0a7';
  v_unit   uuid := '00000000-0000-0000-0000-00000000b0b8';
  v_badge  uuid := '00000000-0000-0000-0000-00000000c0c9';
  v_fix    uuid := '00000000-0000-0000-0000-00000000d0d0';
  v_simdef uuid := '00000000-0000-0000-0000-00000000e0e1';
  v_aitem  uuid := '00000000-0000-0000-0000-00000000f0f2';
  v_enr    uuid;
begin
  insert into academy.orgs (id, name, type) values
    (v_org_a, '__TEST__ Redex RLS', 'redex'),
    (v_org_b, '__TEST__ CCS RLS',   'ccs_partner');

  insert into academy.competencies (id, code, title, domain, is_safety_critical)
    values (v_comp, '__TEST__.RLS.COMP', '[TEST] comp', 'AC', true);
  insert into academy.courses (id, code, title, domain, tier)
    values (v_course, '__TEST__-RLS', '[TEST] course', 'AC', 'core');
  insert into academy.course_versions (id, course_id, semver, status)
    values (v_cv, v_course, '1.0.0', 'published');
  insert into academy.units (id, course_version_id, ordinal, title, kind)
    values (v_unit, v_cv, 1, '[TEST] unit', 'lesson');
  insert into academy.badge_classes (id, key, kind, title)
    values (v_badge, '__TEST__.RLS.BADGE', 'skill', '[TEST] badge');
  insert into academy.fixture_sets (id, source, label, version, r2_manifest_key, sanitized)
    values (v_fix, 'adc_portal', '[TEST] fixture', 'v1', 'r2://t', true);
  insert into academy.sim_definitions (id, key, version, kind, spec, fixture_set_id, status)
    values (v_simdef, '__TEST__.rls.sim', 'v1', 'device_config', '{}'::jsonb, v_fix, 'published');
  insert into academy.assessment_items (id, competency_id, course_version_id, kind, prompt, is_safety_item)
    values (v_aitem, v_comp, v_cv, 'mcq', '{}'::jsonb, true);

  insert into academy.users (id, org_id, display_name) values
    (v_cand, v_org_a, '[TEST] candidate'),
    (v_eval, v_org_a, '[TEST] evaluator');
  insert into academy.evaluator_authorizations (user_id, org_id, source, status)
    values (v_eval, v_org_a, 'founding_bootstrap', 'authorized');
  insert into academy.enrollments (id, user_id, org_id, course_id, course_version_id)
    values (gen_random_uuid(), v_cand, v_org_a, v_course, v_cv) returning id into v_enr;
  insert into academy.unit_progress (enrollment_id, unit_id, org_id, status)
    values (v_enr, v_unit, v_org_a, 'in_progress');
  insert into academy.competency_state (user_id, org_id, competency_id, status, source)
    values (v_cand, v_org_a, v_comp, 'sim_passed', 'course');
  insert into academy.sim_attempts (user_id, org_id, sim_definition_id, outcome, client_event_uuid)
    values (v_cand, v_org_a, v_simdef, 'pass', gen_random_uuid());
  insert into academy.signoffs (candidate_user_id, evaluator_user_id, competency_id, org_id, status)
    values (v_cand, v_eval, v_comp, v_org_a, 'submitted');
  insert into academy.recert_schedules (user_id, org_id, reason, due_at)
    values (v_cand, v_org_a, 'time_based', now() + interval '30 days');
  insert into academy.credentials (badge_class_id, recipient_user_id, org_id)
    values (v_badge, v_cand, v_org_a);
  insert into academy.assessment_responses (user_id, org_id, assessment_item_id, response, client_event_uuid)
    values (v_cand, v_org_a, v_aitem, '{}'::jsonb, gen_random_uuid());
  insert into academy.audit_log (org_id, action, target_table)
    values (v_org_a, 'signoff_signed', 'signoffs');
end $$;

-- ----------------------------------------------------------------------------
-- POSITIVE control: an org-A (Redex) manager SEES org-A rows in every tenant table.
-- ----------------------------------------------------------------------------
do $$
declare
  v_org_a uuid := '00000000-0000-0000-0000-00000000aaa1';
  v_eval  uuid := '00000000-0000-0000-0000-00000000ddd4';
  v_tables text[] := array[
    'users','evaluator_authorizations','enrollments','unit_progress','competency_state',
    'sim_attempts','signoffs','recert_schedules','credentials','assessment_responses','audit_log'];
  t text;
  v_count bigint;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_eval::text, 'org_id', v_org_a::text,
                      'roles', json_build_array('manager','org_admin','exec'))::text, true);
  set local role authenticated;
  foreach t in array v_tables loop
    execute format('select count(*) from academy.%I', t) into v_count;
    perform pg_temp.assert(v_count >= 1,
      format('POSITIVE: org-A manager sees >=1 row in academy.%s (got %s)', t, v_count));
  end loop;
  reset role;
end $$;

-- ----------------------------------------------------------------------------
-- NEGATIVE: an org-B (CCS) manager sees ZERO rows in every tenant table.
-- ----------------------------------------------------------------------------
do $$
declare
  v_org_b uuid := '00000000-0000-0000-0000-00000000bbb2';
  v_tables text[] := array[
    'users','evaluator_authorizations','enrollments','unit_progress','competency_state',
    'sim_attempts','signoffs','recert_schedules','credentials','assessment_responses','audit_log'];
  t text;
  v_count bigint;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid()::text, 'org_id', v_org_b::text,
                      'roles', json_build_array('manager','org_admin','exec','support'))::text, true);
  set local role authenticated;
  foreach t in array v_tables loop
    execute format('select count(*) from academy.%I', t) into v_count;
    perform pg_temp.assert(v_count = 0,
      format('NEGATIVE: cross-org (CCS) actor sees ZERO rows in academy.%s (got %s)', t, v_count));
  end loop;
  reset role;
end $$;

-- ----------------------------------------------------------------------------
-- NEGATIVE: an UNAUTHENTICATED (anon) actor cannot read personal data at all.
-- anon holds NO table GRANT on personal tables, so a read is blocked at the
-- grant level (stronger than RLS filtering to zero). Either a permission error
-- OR zero rows is an acceptable "anon sees nothing".
-- ----------------------------------------------------------------------------
do $$
declare
  v_count bigint;
begin
  perform set_config('request.jwt.claims', NULL, true);
  set local role anon;

  begin
    select count(*) into v_count from academy.signoffs;
    perform pg_temp.assert(v_count = 0, 'NEGATIVE: anon sees ZERO sign-offs (RLS)');
  exception when insufficient_privilege then
    perform pg_temp.assert(true, 'NEGATIVE: anon is GRANT-denied on sign-offs (cannot read at all)');
  end;

  begin
    select count(*) into v_count from academy.competency_state;
    perform pg_temp.assert(v_count = 0, 'NEGATIVE: anon sees ZERO competency_state (RLS)');
  exception when insufficient_privilege then
    perform pg_temp.assert(true, 'NEGATIVE: anon is GRANT-denied on competency_state (cannot read at all)');
  end;

  reset role;
end $$;

-- ----------------------------------------------------------------------------
-- NEGATIVE (M3): a learner cannot WRITE a sim_attempt into another org or as
-- another user — the sim_attempts_insert_own WITH CHECK pins user_id =
-- current_user_id() AND org_id = current_org_id(). (The cross-org SELECT
-- isolation for sim_attempts is covered by the matrices above.) POSITIVE control:
-- the learner CAN insert their OWN attempt in their OWN org.
-- ----------------------------------------------------------------------------
do $$
declare
  v_org_a  uuid := '00000000-0000-0000-0000-00000000aaa1'; -- Redex
  v_org_b  uuid := '00000000-0000-0000-0000-00000000bbb2'; -- CCS partner
  v_cand   uuid := '00000000-0000-0000-0000-00000000ccc3'; -- a Redex (org A) learner
  v_simdef uuid := '00000000-0000-0000-0000-00000000e0e1'; -- the __TEST__ published sim
  v_blocked boolean;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_cand::text, 'org_id', v_org_a::text,
                      'roles', json_build_array('learner'))::text, true);
  set local role authenticated;

  -- cross-ORG write → rejected by WITH CHECK (new row violates RLS).
  v_blocked := false;
  begin
    insert into academy.sim_attempts (user_id, org_id, sim_definition_id, outcome, client_event_uuid)
      values (v_cand, v_org_b, v_simdef, 'pass', gen_random_uuid());
  exception when insufficient_privilege then v_blocked := true;
  end;
  perform pg_temp.assert(v_blocked,
    'NEGATIVE: a learner cannot INSERT a sim_attempt into ANOTHER org (RLS WITH CHECK)');

  -- write AS ANOTHER USER → rejected (user_id must equal the caller).
  v_blocked := false;
  begin
    insert into academy.sim_attempts (user_id, org_id, sim_definition_id, outcome, client_event_uuid)
      values (gen_random_uuid(), v_org_a, v_simdef, 'pass', gen_random_uuid());
  exception when insufficient_privilege then v_blocked := true;
  end;
  perform pg_temp.assert(v_blocked,
    'NEGATIVE: a learner cannot INSERT a sim_attempt AS ANOTHER user (RLS WITH CHECK)');

  -- POSITIVE: the learner CAN record their OWN attempt in their OWN org.
  insert into academy.sim_attempts (user_id, org_id, sim_definition_id, outcome, client_event_uuid)
    values (v_cand, v_org_a, v_simdef, 'pass', gen_random_uuid());
  perform pg_temp.assert(true, 'POSITIVE: a learner CAN INSERT their OWN sim_attempt in their OWN org');

  reset role;
end $$;

do $$
begin
  raise notice '------------------------------------------------------------';
  raise notice 'ALL RLS NEGATIVE TESTS PASSED (positive control + cross-org zero + anon zero + sim_attempt write-isolation).';
  raise notice '------------------------------------------------------------';
end $$;

rollback;
