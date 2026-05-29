-- ============================================================================
-- tests/0001_invariants_test.sql
-- Redex Academy — committed invariant tests for the F2 schema.
--
-- Proves the four pinned invariants the build can never weaken (CLAUDE.md §5):
--   TEST 1: an all-2s sign-off finalizes to outcome='pass'.
--   TEST 2: one is_critical_safety line item = 0 forces outcome='fail' AND the
--           row cannot be signed as a pass (the safety veto, non-overridable).
--   TEST 3: an UPDATE to a SIGNED sign-off is REJECTED (immutability); the only
--           legal post-sign transition (signed -> void) is permitted.
--   TEST 4: an RLS cross-tenant SELECT returns ZERO rows (tenant isolation).
--
-- Runner: plain psql (no pgTAP required). Each assertion RAISEs EXCEPTION on
-- failure, which aborts the transaction with a clear message -> CI fails.
-- A pgTAP-style summary is printed at the end. The whole script runs inside a
-- transaction that is ROLLED BACK, so it never persists fixture data.
--
-- IMPORTANT — run as a role that can `SET ROLE authenticated` (TEST 4 switches
-- into the `authenticated` role to exercise RLS, which is FORCEd on every table).
-- The Supabase migration superuser / the postgres role can do this; in CI run
-- this file as the DB owner/superuser. The service_role is NOT used here — it
-- would bypass RLS and defeat the isolation test.
--
-- Run:  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f tests/0001_invariants_test.sql
-- (Assumes 0001_init_academy.sql + 0002_workos_stub.sql have been applied. Safe to run
--  WITH or WITHOUT the S1 seed — all fixtures use __TEST__-scoped keys and ROLLBACK.)
-- ============================================================================

begin;
set local client_min_messages = warning;

-- A tiny assert helper local to this test run.
create or replace function pg_temp.assert(cond boolean, label text)
returns void language plpgsql as $$
begin
  if cond then
    raise notice 'ok  - %', label;
  else
    raise exception 'not ok - %', label using errcode = 'assert_failure';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- Fixtures: two orgs (Redex + a CCS partner), users, a competency, two evaluators.
-- ----------------------------------------------------------------------------
do $$
declare
  v_org_redex  uuid := '00000000-0000-0000-0000-0000000000a1';
  v_org_ccs    uuid := '00000000-0000-0000-0000-0000000000b2';
  v_candidate  uuid := '00000000-0000-0000-0000-0000000000c3';
  v_evaluator  uuid := '00000000-0000-0000-0000-0000000000d4';
  v_comp       uuid := '00000000-0000-0000-0000-0000000000e5';
begin
  insert into academy.orgs (id, name, type) values
    (v_org_redex, '__TEST__ Redex', 'redex'),
    (v_org_ccs,   '__TEST__ CCS Partner', 'ccs_partner');

  insert into academy.users (id, org_id, display_name) values
    (v_candidate, v_org_redex, 'Candidate Tech'),
    (v_evaluator, v_org_redex, 'Evaluator Priya');

  -- Test-scoped fixture keys (prefix __TEST__) so this file runs cleanly whether or
  -- not the S1 seed is present. The seed defines the REAL 'EGRESS.MAGLOCK_FAILSAFE';
  -- the test must not reuse that unique code or it collides on a seeded database.
  insert into academy.competencies (id, code, title, domain, is_safety_critical)
    values (v_comp, '__TEST__.EGRESS.MAGLOCK_FAILSAFE', '[TEST] Mag-lock fail-safe egress', 'AC', true);
end $$;

-- ============================================================================
-- TEST 1 — all-2s sign-off => outcome='pass'
-- ============================================================================
do $$
declare
  v_org_redex uuid := '00000000-0000-0000-0000-0000000000a1';
  v_candidate uuid := '00000000-0000-0000-0000-0000000000c3';
  v_evaluator uuid := '00000000-0000-0000-0000-0000000000d4';
  v_comp      uuid := '00000000-0000-0000-0000-0000000000e5';
  v_signoff   uuid;
  v_outcome   academy.signoff_outcome;
begin
  insert into academy.signoffs (candidate_user_id, evaluator_user_id, competency_id, org_id, status)
    values (v_candidate, v_evaluator, v_comp, v_org_redex, 'draft')
    returning id into v_signoff;

  -- All four dimensions present; every line scores 2 (one safety line included).
  insert into academy.signoff_line_items (signoff_id, dimension, line_item_key, score, is_critical_safety) values
    (v_signoff, 'safety_compliance',          'maglock_failsafe_verified', 2, true),
    (v_signoff, 'safety_compliance',          'rex_wired_correctly',       2, true),
    (v_signoff, 'technical_execution',        'mounting_torque',           2, false),
    (v_signoff, 'verification_documentation', 'photos_captured',           2, false),
    (v_signoff, 'independence_judgment',      'worked_unprompted',         2, false);

  -- Finalize -> the trigger computes outcome.
  update academy.signoffs set status = 'signed' where id = v_signoff;

  select outcome into v_outcome from academy.signoffs where id = v_signoff;
  perform pg_temp.assert(v_outcome = 'pass', 'TEST 1: all-2s sign-off computes outcome=pass');
  perform pg_temp.assert(
    (select signed_at is not null from academy.signoffs where id = v_signoff),
    'TEST 1: signed_at is stamped on finalize');
end $$;

-- ============================================================================
-- TEST 2 — one safety line = 0 => outcome='fail', and cannot be signed as pass
-- ============================================================================
do $$
declare
  v_org_redex uuid := '00000000-0000-0000-0000-0000000000a1';
  v_candidate uuid := '00000000-0000-0000-0000-0000000000c3';
  v_evaluator uuid := '00000000-0000-0000-0000-0000000000d4';
  v_comp      uuid := '00000000-0000-0000-0000-0000000000e5';
  v_signoff   uuid;
  v_outcome   academy.signoff_outcome;
  v_rejected  boolean := false;
begin
  insert into academy.signoffs (candidate_user_id, evaluator_user_id, competency_id, org_id, status)
    values (v_candidate, v_evaluator, v_comp, v_org_redex, 'draft')
    returning id into v_signoff;

  -- Everything is great EXCEPT a single safety line scoring 0.
  insert into academy.signoff_line_items (signoff_id, dimension, line_item_key, score, is_critical_safety) values
    (v_signoff, 'safety_compliance',          'maglock_failsafe_verified', 0, true),   -- the veto
    (v_signoff, 'safety_compliance',          'rex_wired_correctly',       3, true),
    (v_signoff, 'technical_execution',        'mounting_torque',           3, false),
    (v_signoff, 'verification_documentation', 'photos_captured',           3, false),
    (v_signoff, 'independence_judgment',      'worked_unprompted',         3, false);

  -- Attempting to SIGN (assert a pass) must be rejected by the safety-veto trigger.
  begin
    update academy.signoffs set status = 'signed' where id = v_signoff;
  exception when others then
    v_rejected := true;
  end;
  perform pg_temp.assert(v_rejected,
    'TEST 2: signing a sign-off with a safety line = 0 is REJECTED by the veto trigger');

  -- Recording it as a FAIL is allowed, and the computed outcome is fail.
  update academy.signoffs set status = 'failed' where id = v_signoff;
  select outcome into v_outcome from academy.signoffs where id = v_signoff;
  perform pg_temp.assert(v_outcome = 'fail',
    'TEST 2: a single safety 0 forces outcome=fail (non-overridable)');
end $$;

-- ============================================================================
-- TEST 2b — every dimension >=2 but a NON-zero-yet-below-2 dimension fails
--           (proves the "every dimension rollup >= 2" half of the rule)
-- ============================================================================
do $$
declare
  v_org_redex uuid := '00000000-0000-0000-0000-0000000000a1';
  v_candidate uuid := '00000000-0000-0000-0000-0000000000c3';
  v_evaluator uuid := '00000000-0000-0000-0000-0000000000d4';
  v_comp      uuid := '00000000-0000-0000-0000-0000000000e5';
  v_signoff   uuid;
  v_rejected  boolean := false;
begin
  insert into academy.signoffs (candidate_user_id, evaluator_user_id, competency_id, org_id, status)
    values (v_candidate, v_evaluator, v_comp, v_org_redex, 'draft')
    returning id into v_signoff;

  -- No safety zero, but technical_execution rolls up to 1 (< 2) => cannot pass.
  insert into academy.signoff_line_items (signoff_id, dimension, line_item_key, score, is_critical_safety) values
    (v_signoff, 'safety_compliance',          'maglock_failsafe_verified', 2, true),
    (v_signoff, 'technical_execution',        'mounting_torque',           1, false),  -- drags the rollup
    (v_signoff, 'verification_documentation', 'photos_captured',           2, false),
    (v_signoff, 'independence_judgment',      'worked_unprompted',         2, false);

  begin
    update academy.signoffs set status = 'signed' where id = v_signoff;
  exception when others then
    v_rejected := true;
  end;
  perform pg_temp.assert(v_rejected,
    'TEST 2b: a dimension rollup < 2 (no safety zero) still cannot be signed as pass');
end $$;

-- ============================================================================
-- TEST 3 — immutability: UPDATE/DELETE on a signed sign-off is rejected;
--          the signed -> void path IS permitted.
-- ============================================================================
do $$
declare
  v_org_redex uuid := '00000000-0000-0000-0000-0000000000a1';
  v_candidate uuid := '00000000-0000-0000-0000-0000000000c3';
  v_evaluator uuid := '00000000-0000-0000-0000-0000000000d4';
  v_comp      uuid := '00000000-0000-0000-0000-0000000000e5';
  v_signoff   uuid;
  v_rejected  boolean;
  v_status    academy.signoff_status;
begin
  -- Create + sign a clean (all-2s) sign-off.
  insert into academy.signoffs (candidate_user_id, evaluator_user_id, competency_id, org_id, status)
    values (v_candidate, v_evaluator, v_comp, v_org_redex, 'draft')
    returning id into v_signoff;
  insert into academy.signoff_line_items (signoff_id, dimension, line_item_key, score, is_critical_safety) values
    (v_signoff, 'safety_compliance',          'maglock_failsafe_verified', 2, true),
    (v_signoff, 'technical_execution',        'mounting_torque',           2, false),
    (v_signoff, 'verification_documentation', 'photos_captured',           2, false),
    (v_signoff, 'independence_judgment',      'worked_unprompted',         2, false);
  update academy.signoffs set status = 'signed' where id = v_signoff;

  -- 3a: a generic UPDATE to a signed row is rejected.
  v_rejected := false;
  begin
    update academy.signoffs set outcome = 'fail' where id = v_signoff;  -- tamper attempt
  exception when others then
    v_rejected := true;
  end;
  perform pg_temp.assert(v_rejected,
    'TEST 3a: a generic UPDATE to a signed sign-off is REJECTED (immutable)');

  -- 3b: editing a line item of a signed sign-off is rejected.
  v_rejected := false;
  begin
    update academy.signoff_line_items set score = 0
      where signoff_id = v_signoff and line_item_key = 'maglock_failsafe_verified';
  exception when others then
    v_rejected := true;
  end;
  perform pg_temp.assert(v_rejected,
    'TEST 3b: editing a line item of a signed sign-off is REJECTED (children frozen)');

  -- 3c: DELETE of a signed sign-off is rejected.
  v_rejected := false;
  begin
    delete from academy.signoffs where id = v_signoff;
  exception when others then
    v_rejected := true;
  end;
  perform pg_temp.assert(v_rejected,
    'TEST 3c: DELETE of a signed sign-off is REJECTED (immutable)');

  -- 3d: the ONE legal post-sign transition (signed -> void with a reason) succeeds.
  update academy.signoffs
    set status = 'void', void_reason = 'superseded by corrected re-evaluation'
    where id = v_signoff;
  select status into v_status from academy.signoffs where id = v_signoff;
  perform pg_temp.assert(v_status = 'void',
    'TEST 3d: the legal signed->void path (with void_reason) is permitted');
end $$;

-- ============================================================================
-- TEST 4 — RLS cross-tenant isolation: a CCS actor sees ZERO Redex rows.
-- ============================================================================
-- We simulate two JWTs by setting request.jwt.claims and switching to the
-- `authenticated` role (RLS is FORCEd, so the role matters). The candidate +
-- evaluator + competency above belong to the Redex org.
do $$
declare
  v_org_redex uuid := '00000000-0000-0000-0000-0000000000a1';
  v_org_ccs   uuid := '00000000-0000-0000-0000-0000000000b2';
  v_candidate uuid := '00000000-0000-0000-0000-0000000000c3';
  v_evaluator uuid := '00000000-0000-0000-0000-0000000000d4';
  v_comp      uuid := '00000000-0000-0000-0000-0000000000e5';
  v_redex_signoff uuid;
  v_visible_to_redex int;
  v_visible_to_ccs   int;
  v_redex_users      int;
  v_ccs_users        int;
begin
  -- Seed a Redex sign-off (as the table owner, RLS not yet in play here).
  insert into academy.signoffs (candidate_user_id, evaluator_user_id, competency_id, org_id, status)
    values (v_candidate, v_evaluator, v_comp, v_org_redex, 'submitted')
    returning id into v_redex_signoff;

  -- --- Act as a Redex MANAGER (should SEE the org's sign-off + users) ---
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_evaluator::text, 'org_id', v_org_redex::text,
                      'roles', json_build_array('manager'))::text,
    true);
  set local role authenticated;

  select count(*) into v_visible_to_redex from academy.signoffs;
  select count(*) into v_redex_users       from academy.users;

  reset role;
  perform pg_temp.assert(v_visible_to_redex >= 1,
    'TEST 4: a Redex manager SEES the Redex org sign-off (positive control)');
  perform pg_temp.assert(v_redex_users >= 1,
    'TEST 4: a Redex manager SEES Redex org users (positive control)');

  -- --- Act as a CCS manager in a DIFFERENT org (should see ZERO Redex rows) ---
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', gen_random_uuid()::text, 'org_id', v_org_ccs::text,
                      'roles', json_build_array('manager','org_admin'))::text,
    true);
  set local role authenticated;

  select count(*) into v_visible_to_ccs from academy.signoffs;       -- all rows are Redex-org
  select count(*) into v_ccs_users      from academy.users;          -- all users are Redex-org

  reset role;
  perform pg_temp.assert(v_visible_to_ccs = 0,
    'TEST 4: a CCS-org actor sees ZERO Redex sign-offs (cross-tenant isolation)');
  perform pg_temp.assert(v_ccs_users = 0,
    'TEST 4: a CCS-org actor sees ZERO Redex users (cross-tenant isolation)');
end $$;

-- ============================================================================
-- TEST 5 — fixture publish gate: a published sim cannot use an unsanitized fixture.
-- ============================================================================
do $$
declare
  v_fixture  uuid;
  v_rejected boolean := false;
begin
  insert into academy.fixture_sets (source, label, version, r2_manifest_key, sanitized)
    values ('adc_portal', 'create-customer', 'v1', 'r2://fixtures/adc/v1.json', false)
    returning id into v_fixture;

  begin
    insert into academy.sim_definitions (key, version, kind, spec, fixture_set_id, status)
      values ('adc.create_customer', 'v1', 'device_config', '{}'::jsonb, v_fixture, 'published');
  exception when others then
    v_rejected := true;
  end;
  perform pg_temp.assert(v_rejected,
    'TEST 5: publishing a sim with an unsanitized fixture is REJECTED (publish gate)');

  -- Sanitizing it then allows publish.
  update academy.fixture_sets set sanitized = true where id = v_fixture;
  insert into academy.sim_definitions (key, version, kind, spec, fixture_set_id, status)
    values ('adc.create_customer', 'v1', 'device_config', '{}'::jsonb, v_fixture, 'published');
  perform pg_temp.assert(true,
    'TEST 5: a sanitized fixture allows the sim to publish');
end $$;

-- ============================================================================
-- TEST 6 — audit_log is append-only (UPDATE/DELETE rejected).
-- ============================================================================
do $$
declare
  v_org_redex uuid := '00000000-0000-0000-0000-0000000000a1';
  v_audit     uuid;
  v_rejected  boolean := false;
begin
  insert into academy.audit_log (org_id, action, target_table, detail)
    values (v_org_redex, 'signoff_signed', 'signoffs', '{"note":"test"}'::jsonb)
    returning id into v_audit;

  begin
    update academy.audit_log set detail = '{}'::jsonb where id = v_audit;
  exception when others then
    v_rejected := true;
  end;
  perform pg_temp.assert(v_rejected, 'TEST 6: UPDATE on audit_log is REJECTED (append-only)');

  v_rejected := false;
  begin
    delete from academy.audit_log where id = v_audit;
  exception when others then
    v_rejected := true;
  end;
  perform pg_temp.assert(v_rejected, 'TEST 6: DELETE on audit_log is REJECTED (append-only)');
end $$;

-- ============================================================================
-- TEST 7 — the prerequisite graph cycle detector works.
-- ============================================================================
do $$
declare
  v_a uuid; v_b uuid; v_c uuid;
begin
  insert into academy.courses (code, title, domain, tier) values
    ('TST-A', 'Test A', 'FND', 'foundations') returning id into v_a;
  insert into academy.courses (code, title, domain, tier) values
    ('TST-B', 'Test B', 'FND', 'foundations') returning id into v_b;
  insert into academy.courses (code, title, domain, tier) values
    ('TST-C', 'Test C', 'FND', 'foundations') returning id into v_c;

  -- Acyclic chain A->B->C : graph is a DAG.
  insert into academy.course_prerequisites (course_id, requires_course_id) values
    (v_b, v_a), (v_c, v_b);
  perform pg_temp.assert(academy.prereq_graph_is_dag(),
    'TEST 7: an acyclic prerequisite chain reports DAG=true');

  -- Introduce a cycle C->A (now A->B->C->A): detector must catch it.
  insert into academy.course_prerequisites (course_id, requires_course_id) values (v_a, v_c);
  perform pg_temp.assert(not academy.prereq_graph_is_dag(),
    'TEST 7: a cycle is detected (DAG=false); CI dag:check would fail');
end $$;

-- ----------------------------------------------------------------------------
-- Summary
-- ----------------------------------------------------------------------------
do $$
begin
  raise notice '------------------------------------------------------------';
  raise notice 'ALL INVARIANT TESTS PASSED (1 pass / 2 safety-veto / 2b dim-rollup /';
  raise notice '  3 immutability+void / 4 RLS cross-tenant / 5 fixture gate /';
  raise notice '  6 audit append-only / 7 DAG cycle detect).';
  raise notice '------------------------------------------------------------';
end $$;

-- Roll everything back: tests never persist fixture data.
rollback;
