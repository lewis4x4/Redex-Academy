-- ============================================================================
-- tests/0003_workos_fk.sql
-- Redex Academy — F2a workos stub: cross-schema FK + RLS isolation (CLAUDE.md inv. 3/6).
--
-- Proves the F2a contract:
--   TEST 1: a signoff with a VALID work_os_job_id inserts (FK satisfied).
--   TEST 2: a signoff with an INVALID work_os_job_id is REJECTED (FK enforced).
--   TEST 3: deleting a workos.jobs row a signoff references is REJECTED (ON DELETE RESTRICT).
--   TEST 4: a cross-org (CCS) actor sees ZERO workos.jobs; same-org sees its jobs (RLS).
--   TEST 5: the cross-schema join academy.signoffs ⋈ workos.jobs is org-isolated under RLS.
--   TEST 6: an end-user (authenticated) cannot INSERT workos.jobs (service-role only).
--
-- Runner: plain psql; assertions RAISE on failure -> CI fails. Runs inside a
-- transaction that is ROLLED BACK. Assumes 0001 + 0003 + 0002 (workos) applied.
-- Run as a role that can SET ROLE authenticated (DB owner/superuser).
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

-- Fixtures: two orgs, a tech + evaluator (org A), a competency, one workos job (org A).
do $$
declare
  v_org_a uuid := '00000000-0000-0000-0000-0000000a0001';
  v_org_b uuid := '00000000-0000-0000-0000-0000000b0002';
  v_cand  uuid := '00000000-0000-0000-0000-0000000c0003';
  v_eval  uuid := '00000000-0000-0000-0000-0000000d0004';
  v_comp  uuid := '00000000-0000-0000-0000-0000000e0005';
  v_job   uuid := '00000000-0000-0000-0000-0000000f0006';
begin
  insert into academy.orgs (id, name, type) values
    (v_org_a, '__TEST__ Redex workos', 'redex'),
    (v_org_b, '__TEST__ CCS workos',   'ccs_partner');
  insert into academy.users (id, org_id, display_name) values
    (v_cand, v_org_a, '[TEST] tech'),
    (v_eval, v_org_a, '[TEST] evaluator');
  insert into academy.competencies (id, code, title, domain, is_safety_critical)
    values (v_comp, '__TEST__.WORKOS.COMP', '[TEST] comp', 'AC', true);
  insert into workos.jobs (id, org_id, tech_user_id, external_ref, status)
    values (v_job, v_org_a, v_cand, '__TEST__-JOB-1', 'completed');
end $$;

-- TEST 1 + 2: FK enforcement (valid inserts, invalid rejected).
do $$
declare
  v_org_a uuid := '00000000-0000-0000-0000-0000000a0001';
  v_cand  uuid := '00000000-0000-0000-0000-0000000c0003';
  v_eval  uuid := '00000000-0000-0000-0000-0000000d0004';
  v_comp  uuid := '00000000-0000-0000-0000-0000000e0005';
  v_job   uuid := '00000000-0000-0000-0000-0000000f0006';
  v_rejected boolean := false;
begin
  -- VALID: references the real job.
  insert into academy.signoffs (candidate_user_id, evaluator_user_id, competency_id, org_id, status, work_os_job_id)
    values (v_cand, v_eval, v_comp, v_org_a, 'draft', v_job);
  perform pg_temp.assert(true, 'TEST 1: signoff with a VALID work_os_job_id inserts (cross-schema FK satisfied)');

  -- INVALID: references a non-existent job -> FK violation.
  begin
    insert into academy.signoffs (candidate_user_id, evaluator_user_id, competency_id, org_id, status, work_os_job_id)
      values (v_cand, v_eval, v_comp, v_org_a, 'draft', gen_random_uuid());
  exception when foreign_key_violation then
    v_rejected := true;
  end;
  perform pg_temp.assert(v_rejected, 'TEST 2: signoff with an INVALID work_os_job_id is REJECTED (FK enforced)');
end $$;

-- TEST 3: ON DELETE RESTRICT — cannot delete a job a signoff references.
do $$
declare
  v_job uuid := '00000000-0000-0000-0000-0000000f0006';
  v_rejected boolean := false;
begin
  begin
    delete from workos.jobs where id = v_job;   -- still referenced by the TEST-1 signoff
  exception when foreign_key_violation then
    v_rejected := true;
  end;
  perform pg_temp.assert(v_rejected,
    'TEST 3: deleting a referenced workos.jobs row is REJECTED (ON DELETE RESTRICT keeps the proven job alive)');
end $$;

-- TEST 4: workos.jobs RLS — same-org sees its jobs; cross-org sees zero.
do $$
declare
  v_org_a uuid := '00000000-0000-0000-0000-0000000a0001';
  v_org_b uuid := '00000000-0000-0000-0000-0000000b0002';
  v_cand  uuid := '00000000-0000-0000-0000-0000000c0003';
  v_n bigint;
begin
  -- org-A manager (positive control)
  perform set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid()::text, 'org_id', v_org_a::text,
                      'roles', json_build_array('manager'))::text, true);
  set local role authenticated;
  select count(*) into v_n from workos.jobs;
  reset role;
  perform pg_temp.assert(v_n >= 1, 'TEST 4: org-A manager SEES the org-A workos job (positive control)');

  -- org-A tech (the assigned tech sees their own job)
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_cand::text, 'org_id', v_org_a::text,
                      'roles', json_build_array('learner'))::text, true);
  set local role authenticated;
  select count(*) into v_n from workos.jobs;
  reset role;
  perform pg_temp.assert(v_n >= 1, 'TEST 4: the assigned tech SEES their own workos job');

  -- org-B manager (cross-tenant -> zero)
  perform set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid()::text, 'org_id', v_org_b::text,
                      'roles', json_build_array('manager','org_admin'))::text, true);
  set local role authenticated;
  select count(*) into v_n from workos.jobs;
  reset role;
  perform pg_temp.assert(v_n = 0, 'TEST 4: cross-org (CCS) actor sees ZERO workos jobs (tenant isolation)');
end $$;

-- TEST 5: cross-schema join isolation (academy.signoffs ⋈ workos.jobs).
do $$
declare
  v_org_a uuid := '00000000-0000-0000-0000-0000000a0001';
  v_org_b uuid := '00000000-0000-0000-0000-0000000b0002';
  v_n bigint;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid()::text, 'org_id', v_org_a::text,
                      'roles', json_build_array('manager','exec'))::text, true);
  set local role authenticated;
  select count(*) into v_n
    from academy.signoffs s join workos.jobs j on j.id = s.work_os_job_id;
  reset role;
  perform pg_temp.assert(v_n >= 1, 'TEST 5: org-A manager sees the signoff⋈job cross-schema join row');

  perform set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid()::text, 'org_id', v_org_b::text,
                      'roles', json_build_array('manager','exec'))::text, true);
  set local role authenticated;
  select count(*) into v_n
    from academy.signoffs s join workos.jobs j on j.id = s.work_os_job_id;
  reset role;
  perform pg_temp.assert(v_n = 0, 'TEST 5: cross-org actor sees ZERO from the signoff⋈job join');
end $$;

-- TEST 6: end-user (authenticated) cannot INSERT workos.jobs (service-role only).
do $$
declare
  v_org_a uuid := '00000000-0000-0000-0000-0000000a0001';
  v_blocked boolean := false;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid()::text, 'org_id', v_org_a::text,
                      'roles', json_build_array('manager','org_admin'))::text, true);
  set local role authenticated;
  begin
    insert into workos.jobs (org_id, status) values (v_org_a, 'scheduled');
    -- if we got here, the write was NOT blocked -> fail the test below
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  reset role;
  perform pg_temp.assert(v_blocked,
    'TEST 6: an end-user role cannot INSERT workos.jobs (no grant/policy -> service-role only)');
end $$;

do $$
begin
  raise notice '------------------------------------------------------------';
  raise notice 'ALL WORKOS F2a TESTS PASSED (FK valid/invalid / ON DELETE RESTRICT /';
  raise notice '  workos RLS cross-org / cross-schema join isolation / service-role-only writes).';
  raise notice '------------------------------------------------------------';
end $$;

rollback;
