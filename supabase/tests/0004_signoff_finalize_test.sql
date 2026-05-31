-- ============================================================================
-- tests/0004_signoff_finalize_test.sql
-- Redex Academy — M6 finalize-signoff DB-layer proof (the three-layer safety veto,
-- layer 1 = the DB trigger; CLAUDE.md invariant 1/2).
--
-- 0001_invariants_test.sql already proves the trigger on SYNTHETIC line items
-- (all-2s pass / one safety-0 rejected / signed-row immutable / signed->void).
-- This file proves the M6-SPECIFIC concern that the trigger fires correctly on
-- rubric MATERIALIZED FROM academy.signoff_line_item_templates (the path
-- finalize-signoff takes): the per-course template's dimension + is_critical_safety
-- are copied 1:1 onto signoff_line_items so the veto cannot silently weaken, PLUS
-- the "a sign-off with NO line items can never pass" branch (not asserted by 0001).
--
-- Runner: plain psql (no pgTAP). Each assertion RAISEs on failure -> CI fails.
-- Everything runs inside a transaction that is ROLLED BACK; fixtures use
-- __TEST__-scoped ids so it is safe with or without the S1 seed (db-invariants
-- applies migrations only, not the seed). It does NOT modify the F2 triggers.
--
-- Run:  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/0004_signoff_finalize_test.sql
--       (Assumes 0001 + 0003 [templates table] + 0002_workos_stub are applied.)
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
-- Fixtures: an org, an AC-domain course + competency, a candidate + an AUTHORIZED
-- evaluator, a Work OS job, and an AC-203-SHAPED rubric template (12 lines, 7 of
-- them is_critical_safety — mirrors the real S1 AC-203 set, incl. a non-critical
-- safety_compliance line is NOT used here; all 7 safety lines ARE critical, like AC-203).
-- ----------------------------------------------------------------------------
do $$
declare
  v_org   uuid := '00000000-0000-0000-0000-0000000d6001'::uuid;
  v_cand  uuid := '00000000-0000-0000-0000-0000000d6002'::uuid;
  v_eval  uuid := '00000000-0000-0000-0000-0000000d6003'::uuid;
  v_comp  uuid := '00000000-0000-0000-0000-0000000d6004'::uuid;
  v_course uuid := '00000000-0000-0000-0000-0000000d6005'::uuid;
  v_job   uuid := '00000000-0000-0000-0000-0000000d6006'::uuid;
begin
  insert into academy.orgs (id, name, type) values (v_org, '__TEST__ M6 org', 'redex');
  insert into academy.users (id, org_id, display_name) values
    (v_cand, v_org, '[TEST] candidate'),
    (v_eval, v_org, '[TEST] evaluator');
  insert into academy.competencies (id, code, title, domain, is_safety_critical)
    values (v_comp, '__TEST__.M6.EGRESS', '[TEST] egress', 'AC', true);
  insert into academy.courses (id, code, title, domain, tier)
    values (v_course, '__TEST__-M6', '[TEST] M6 course', 'AC', 'core');
  insert into academy.evaluator_authorizations (user_id, org_id, domains, status, source)
    values (v_eval, v_org, '{AC}'::academy.domain[], 'authorized', 'founding_bootstrap');
  insert into workos.jobs (id, org_id, external_ref, status) values (v_job, v_org, 'JOB-TEST-M6', 'completed');

  -- AC-203-shaped template: 7 critical-safety + 3 tech + 1 verify + 1 indep = 12.
  insert into academy.signoff_line_item_templates (course_id, competency_id, dimension, line_item_key, is_critical_safety, ordinal, label) values
    (v_course, v_comp, 'safety_compliance',          't.release_on_power_loss',   true,  1, 'releases on power loss'),
    (v_course, v_comp, 'safety_compliance',          't.push_to_exit_30s',        true,  2, 'push-to-exit >=30s'),
    (v_course, v_comp, 'safety_compliance',          't.release_on_fire_alarm',   true,  3, 'releases on fire alarm'),
    (v_course, v_comp, 'safety_compliance',          't.pte_mount',               true,  4, 'push-to-exit mounted 40-48in/5ft'),
    (v_course, v_comp, 'safety_compliance',          't.no_maglock_fire_latch',   true,  5, 'no mag lock defeating latch'),
    (v_course, v_comp, 'safety_compliance',          't.emergency_lighting',      true,  6, 'emergency lighting present'),
    (v_course, v_comp, 'safety_compliance',          't.ahj_confirmed',           true,  7, 'AHJ confirmed'),
    (v_course, v_comp, 'technical_execution',        't.tech.fail_safe_wiring',   false, 8, 'fail-safe wiring'),
    (v_course, v_comp, 'technical_execution',        't.tech.rex_fire_term',      false, 9, 'REX/fire terminated'),
    (v_course, v_comp, 'technical_execution',        't.tech.supply_sized',       false, 10, 'supply/battery sized'),
    (v_course, v_comp, 'verification_documentation', 't.verify.three_modes',      false, 11, 'three release modes logged'),
    (v_course, v_comp, 'independence_judgment',      't.indep.escalate',          false, 12, 'escalated appropriately');
end $$;

-- ----------------------------------------------------------------------------
-- DATA INTEGRITY: the materialization source has exactly 7 critical-safety lines
-- of 12 (if a ⚠ flag were dropped from the template, the veto would silently weaken).
-- ----------------------------------------------------------------------------
do $$
declare v_total int; v_safety int;
begin
  select count(*) , count(*) filter (where is_critical_safety)
    into v_total, v_safety
  from academy.signoff_line_item_templates
  where course_id = '00000000-0000-0000-0000-0000000d6005'::uuid;
  perform pg_temp.assert(v_total = 12, format('TEMPLATE: 12 rubric lines for the course (got %s)', v_total));
  perform pg_temp.assert(v_safety = 7, format('TEMPLATE: exactly 7 critical-safety lines (got %s)', v_safety));
end $$;

-- ----------------------------------------------------------------------------
-- TEST A — materialize all template lines @ score 2 -> SIGN -> outcome='pass';
-- the materialized signoff_line_items preserve dimension + is_critical_safety (7 ⚠).
-- ----------------------------------------------------------------------------
do $$
declare
  v_org   uuid := '00000000-0000-0000-0000-0000000d6001'::uuid;
  v_cand  uuid := '00000000-0000-0000-0000-0000000d6002'::uuid;
  v_eval  uuid := '00000000-0000-0000-0000-0000000d6003'::uuid;
  v_comp  uuid := '00000000-0000-0000-0000-0000000d6004'::uuid;
  v_course uuid := '00000000-0000-0000-0000-0000000d6005'::uuid;
  v_job   uuid := '00000000-0000-0000-0000-0000000d6006'::uuid;
  v_signoff uuid;
  v_outcome academy.signoff_outcome;
  v_safety int;
begin
  insert into academy.signoffs (candidate_user_id, evaluator_user_id, competency_id, course_id, work_os_job_id, org_id, status)
    values (v_cand, v_eval, v_comp, v_course, v_job, v_org, 'draft') returning id into v_signoff;

  -- MATERIALIZE: one line per template line, copying dimension + is_critical_safety verbatim (score 2).
  insert into academy.signoff_line_items (signoff_id, dimension, line_item_key, score, is_critical_safety)
    select v_signoff, t.dimension, t.line_item_key, 2, t.is_critical_safety
    from academy.signoff_line_item_templates t
    where t.course_id = v_course;

  select count(*) filter (where is_critical_safety) into v_safety
    from academy.signoff_line_items where signoff_id = v_signoff;
  perform pg_temp.assert(v_safety = 7, format('TEST A: materialized rubric kept all 7 is_critical_safety flags (got %s)', v_safety));

  update academy.signoffs set status = 'signed' where id = v_signoff;
  select outcome into v_outcome from academy.signoffs where id = v_signoff;
  perform pg_temp.assert(v_outcome = 'pass', 'TEST A: all-2s materialized sign-off computes outcome=pass');
  perform pg_temp.assert((select signed_at is not null from academy.signoffs where id = v_signoff), 'TEST A: signed_at stamped on sign');
end $$;

-- ----------------------------------------------------------------------------
-- TEST B — a single critical-safety line scored 0 -> signing is REJECTED by the
-- veto trigger (non-overridable), and the sign-off can only be 'failed'.
-- ----------------------------------------------------------------------------
do $$
declare
  v_org   uuid := '00000000-0000-0000-0000-0000000d6001'::uuid;
  v_cand  uuid := '00000000-0000-0000-0000-0000000d6002'::uuid;
  v_eval  uuid := '00000000-0000-0000-0000-0000000d6003'::uuid;
  v_comp  uuid := '00000000-0000-0000-0000-0000000d6004'::uuid;
  v_course uuid := '00000000-0000-0000-0000-0000000d6005'::uuid;
  v_job   uuid := '00000000-0000-0000-0000-0000000d6006'::uuid;
  v_signoff uuid;
  v_outcome academy.signoff_outcome;
  v_rejected boolean := false;
begin
  insert into academy.signoffs (candidate_user_id, evaluator_user_id, competency_id, course_id, work_os_job_id, org_id, status)
    values (v_cand, v_eval, v_comp, v_course, v_job, v_org, 'draft') returning id into v_signoff;

  -- Everything at 3 EXCEPT one critical-safety line (ahj_confirmed) scored 0 — the veto.
  insert into academy.signoff_line_items (signoff_id, dimension, line_item_key, score, is_critical_safety)
    select v_signoff, t.dimension, t.line_item_key,
           case when t.line_item_key = 't.ahj_confirmed' then 0 else 3 end,
           t.is_critical_safety
    from academy.signoff_line_item_templates t
    where t.course_id = v_course;

  begin
    update academy.signoffs set status = 'signed' where id = v_signoff;
    v_rejected := false;
  exception when check_violation then
    v_rejected := true;
  end;
  perform pg_temp.assert(v_rejected, 'TEST B: signing with one critical-safety line = 0 is REJECTED by the veto (non-overridable)');

  update academy.signoffs set status = 'failed' where id = v_signoff;
  select outcome into v_outcome from academy.signoffs where id = v_signoff;
  perform pg_temp.assert(v_outcome = 'fail', 'TEST B: the safety-0 sign-off computes outcome=fail');
end $$;

-- ----------------------------------------------------------------------------
-- TEST C — a sign-off with NO line items can NEVER pass (the trigger branch not
-- asserted by 0001). Signing an empty rubric is rejected; it can only be 'failed'.
-- ----------------------------------------------------------------------------
do $$
declare
  v_org   uuid := '00000000-0000-0000-0000-0000000d6001'::uuid;
  v_cand  uuid := '00000000-0000-0000-0000-0000000d6002'::uuid;
  v_eval  uuid := '00000000-0000-0000-0000-0000000d6003'::uuid;
  v_comp  uuid := '00000000-0000-0000-0000-0000000d6004'::uuid;
  v_course uuid := '00000000-0000-0000-0000-0000000d6005'::uuid;
  v_job   uuid := '00000000-0000-0000-0000-0000000d6006'::uuid;
  v_signoff uuid;
  v_rejected boolean := false;
begin
  insert into academy.signoffs (candidate_user_id, evaluator_user_id, competency_id, course_id, work_os_job_id, org_id, status)
    values (v_cand, v_eval, v_comp, v_course, v_job, v_org, 'draft') returning id into v_signoff;
  -- no line items inserted.
  begin
    update academy.signoffs set status = 'signed' where id = v_signoff;
    v_rejected := false;
  exception when check_violation then
    v_rejected := true;
  end;
  perform pg_temp.assert(v_rejected, 'TEST C: a sign-off with NO line items cannot be signed as pass (veto)');
end $$;

-- ----------------------------------------------------------------------------
-- TEST D — immutability on the materialized signed sign-off: a late line-item edit
-- is rejected (re-proves invariant 2 on the M6 materialize path).
-- ----------------------------------------------------------------------------
do $$
declare
  v_org   uuid := '00000000-0000-0000-0000-0000000d6001'::uuid;
  v_cand  uuid := '00000000-0000-0000-0000-0000000d6002'::uuid;
  v_eval  uuid := '00000000-0000-0000-0000-0000000d6003'::uuid;
  v_comp  uuid := '00000000-0000-0000-0000-0000000d6004'::uuid;
  v_course uuid := '00000000-0000-0000-0000-0000000d6005'::uuid;
  v_job   uuid := '00000000-0000-0000-0000-0000000d6006'::uuid;
  v_signoff uuid;
  v_rejected boolean := false;
begin
  insert into academy.signoffs (candidate_user_id, evaluator_user_id, competency_id, course_id, work_os_job_id, org_id, status)
    values (v_cand, v_eval, v_comp, v_course, v_job, v_org, 'draft') returning id into v_signoff;
  insert into academy.signoff_line_items (signoff_id, dimension, line_item_key, score, is_critical_safety)
    select v_signoff, t.dimension, t.line_item_key, 2, t.is_critical_safety
    from academy.signoff_line_item_templates t where t.course_id = v_course;
  update academy.signoffs set status = 'signed' where id = v_signoff;

  begin
    update academy.signoff_line_items set score = 0 where signoff_id = v_signoff and line_item_key = 't.ahj_confirmed';
    v_rejected := false;
  exception when check_violation then
    v_rejected := true;
  end;
  perform pg_temp.assert(v_rejected, 'TEST D: editing a line item of a SIGNED sign-off is REJECTED (immutable)');
end $$;

do $$
begin
  raise notice '------------------------------------------------------------';
  raise notice 'M6 FINALIZE-SIGNOFF DB TESTS PASSED (materialize preserves 7 safety flags; veto fires; no-lines cannot pass; signed immutable).';
  raise notice '------------------------------------------------------------';
end $$;

rollback;
