-- ============================================================================
-- tests/sync_idempotency_test.sql  (F4)
-- Proves the DB-level guarantees the /sync Edge Function relies on (ledger §G,
-- CLAUDE.md inv. 2/4):
--   TEST 1-3: a DOUBLE-FLUSH (same client_event_uuid inserted twice) with
--             ON CONFLICT (client_event_uuid) DO NOTHING does NOT double-count
--             on sim_attempts / sim_telemetry_events / assessment_responses.
--   TEST 4:   an end-user (authenticated) CANNOT insert competency_state (no
--             write policy) — a faked pass is impossible offline/client-side.
--   TEST 5:   a late edit to a SIGNED sign-off is rejected by the F2 trigger
--             (immutable-after-sign holds even if /sync app code were bypassed).
--   TEST 6-7: the UPSERT path (unit_progress + a DRAFT line item) carries NO
--             client_event_uuid and conflict-targets the NATURAL key, so a
--             re-sync UPDATES the one row (last-writer-wins) — never duplicates.
--   TEST 8:   the id-keyed draft tables (signoffs / signoff_evidence) are
--             idempotent on a STABLE client-supplied id (PK default is random,
--             so the client MUST send the id; sync-core rejects it otherwise).
--
-- Runner: plain psql; assertions RAISE on failure -> CI fails. Runs inside a
-- ROLLED-BACK transaction. Assumes 0001 (+0003/0002) applied. Does NOT touch the
-- auth schema (F3-independent). Run as a role that can SET ROLE authenticated.
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

do $$
declare
  v_org   uuid := '00000000-0000-0000-0000-000000f40001';
  v_user  uuid := '00000000-0000-0000-0000-000000f40002';
  v_comp  uuid := '00000000-0000-0000-0000-000000f40003';
  v_course uuid := '00000000-0000-0000-0000-000000f40004';
  v_cv    uuid := '00000000-0000-0000-0000-000000f40005';
  v_sim   uuid := '00000000-0000-0000-0000-000000f40006';
  v_aitem uuid := '00000000-0000-0000-0000-000000f40007';
begin
  insert into academy.orgs (id, name, type) values (v_org, '__TEST__ F4 org', 'redex');
  insert into academy.users (id, org_id, display_name) values (v_user, v_org, '[TEST] tech');
  insert into academy.competencies (id, code, title, domain) values (v_comp, '__TEST__.F4.COMP', 'c', 'AC');
  insert into academy.courses (id, code, title, domain, tier) values (v_course, '__TEST__-F4', 'c', 'AC', 'core');
  insert into academy.course_versions (id, course_id, semver, status) values (v_cv, v_course, '1.0.0', 'published');
  insert into academy.sim_definitions (id, key, version, kind, spec, status) values (v_sim, '__TEST__.f4.sim', 'v1', 'branching_scenario', '{}'::jsonb, 'draft');
  insert into academy.assessment_items (id, competency_id, course_version_id, kind, prompt) values (v_aitem, v_comp, v_cv, 'mcq', '{}'::jsonb);
end $$;

-- TEST 1 — sim_attempts double-flush is idempotent.
do $$
declare
  v_org  uuid := '00000000-0000-0000-0000-000000f40001';
  v_user uuid := '00000000-0000-0000-0000-000000f40002';
  v_sim  uuid := '00000000-0000-0000-0000-000000f40006';
  v_uuid uuid := '00000000-0000-0000-0000-0000000a0001';
  v_n int;
begin
  insert into academy.sim_attempts (user_id, org_id, sim_definition_id, outcome, client_event_uuid)
    values (v_user, v_org, v_sim, 'pass', v_uuid) on conflict (client_event_uuid) do nothing;
  -- second flush of the SAME event (flaky reconnect / background sync fired twice)
  insert into academy.sim_attempts (user_id, org_id, sim_definition_id, outcome, client_event_uuid)
    values (v_user, v_org, v_sim, 'pass', v_uuid) on conflict (client_event_uuid) do nothing;
  select count(*) into v_n from academy.sim_attempts where client_event_uuid = v_uuid;
  perform pg_temp.assert(v_n = 1, 'TEST 1: double-flush of a sim_attempt yields ONE row (no double-count)');
end $$;

-- TEST 2 — sim_telemetry_events double-flush is idempotent.
do $$
declare
  v_org  uuid := '00000000-0000-0000-0000-000000f40001';
  v_user uuid := '00000000-0000-0000-0000-000000f40002';
  v_sim  uuid := '00000000-0000-0000-0000-000000f40006';
  v_att  uuid;
  v_uuid uuid := '00000000-0000-0000-0000-0000000b0002';
  v_n int;
begin
  insert into academy.sim_attempts (user_id, org_id, sim_definition_id, client_event_uuid)
    values (v_user, v_org, v_sim, '00000000-0000-0000-0000-0000000b0001') returning id into v_att;
  insert into academy.sim_telemetry_events (sim_attempt_id, event_type, client_event_uuid)
    values (v_att, 'tap', v_uuid) on conflict (client_event_uuid) do nothing;
  insert into academy.sim_telemetry_events (sim_attempt_id, event_type, client_event_uuid)
    values (v_att, 'tap', v_uuid) on conflict (client_event_uuid) do nothing;
  select count(*) into v_n from academy.sim_telemetry_events where client_event_uuid = v_uuid;
  perform pg_temp.assert(v_n = 1, 'TEST 2: double-flush of telemetry yields ONE row (no double-count)');
end $$;

-- TEST 3 — assessment_responses double-flush is idempotent.
do $$
declare
  v_org   uuid := '00000000-0000-0000-0000-000000f40001';
  v_user  uuid := '00000000-0000-0000-0000-000000f40002';
  v_aitem uuid := '00000000-0000-0000-0000-000000f40007';
  v_uuid  uuid := '00000000-0000-0000-0000-0000000c0001';
  v_n int;
begin
  insert into academy.assessment_responses (user_id, org_id, assessment_item_id, response, client_event_uuid)
    values (v_user, v_org, v_aitem, '{}'::jsonb, v_uuid) on conflict (client_event_uuid) do nothing;
  insert into academy.assessment_responses (user_id, org_id, assessment_item_id, response, client_event_uuid)
    values (v_user, v_org, v_aitem, '{}'::jsonb, v_uuid) on conflict (client_event_uuid) do nothing;
  select count(*) into v_n from academy.assessment_responses where client_event_uuid = v_uuid;
  perform pg_temp.assert(v_n = 1, 'TEST 3: double-flush of an assessment response yields ONE row (no double-count)');
end $$;

-- TEST 4 — an end-user CANNOT promote competency_state (no faked pass).
do $$
declare
  v_org  uuid := '00000000-0000-0000-0000-000000f40001';
  v_user uuid := '00000000-0000-0000-0000-000000f40002';
  v_comp uuid := '00000000-0000-0000-0000-000000f40003';
  v_blocked boolean := false;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user::text, 'org_id', v_org::text, 'roles', json_build_array('learner'))::text, true);
  set local role authenticated;
  begin
    insert into academy.competency_state (user_id, org_id, competency_id, status, source)
      values (v_user, v_org, v_comp, 'field_proven', 'course');
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  reset role;
  perform pg_temp.assert(v_blocked,
    'TEST 4: an authenticated end-user CANNOT insert competency_state (server-only; no faked pass)');
end $$;

-- TEST 5 — a late edit to a SIGNED sign-off is rejected by the F2 trigger.
do $$
declare
  v_org  uuid := '00000000-0000-0000-0000-000000f40001';
  v_user uuid := '00000000-0000-0000-0000-000000f40002';
  v_comp uuid := '00000000-0000-0000-0000-000000f40003';
  v_so uuid;
  v_rejected boolean := false;
begin
  insert into academy.signoffs (candidate_user_id, evaluator_user_id, competency_id, org_id, status)
    values (v_user, v_user, v_comp, v_org, 'draft') returning id into v_so;
  insert into academy.signoff_line_items (signoff_id, dimension, line_item_key, score, is_critical_safety) values
    (v_so, 'safety_compliance', 'k1', 2, true),
    (v_so, 'technical_execution', 'k2', 2, false),
    (v_so, 'verification_documentation', 'k3', 2, false),
    (v_so, 'independence_judgment', 'k4', 2, false);
  update academy.signoffs set status = 'signed' where id = v_so;
  begin
    update academy.signoffs set outcome = 'fail' where id = v_so;  -- tamper after sign
  exception when others then
    v_rejected := true;
  end;
  perform pg_temp.assert(v_rejected, 'TEST 5: a late edit to a SIGNED sign-off is REJECTED (immutable; /sync cannot bypass)');
end $$;

-- TEST 6 — unit_progress is UPSERT-by-natural-key, NOT append-by-uuid.
-- The fix: unit_progress/drafts/prefs carry NO client_event_uuid; /sync upserts on
-- the natural key (enrollment_id, unit_id) with last-writer-wins. Re-syncing the
-- SAME unit with a newer value UPDATES the one row (no duplicate, latest value).
do $$
declare
  v_org    uuid := '00000000-0000-0000-0000-000000f40001';
  v_user   uuid := '00000000-0000-0000-0000-000000f40002';
  v_course uuid := '00000000-0000-0000-0000-000000f40004';
  v_cv     uuid := '00000000-0000-0000-0000-000000f40005';
  v_unit   uuid := '00000000-0000-0000-0000-000000f40008';
  v_enr    uuid := '00000000-0000-0000-0000-000000f40009';
  v_n int; v_status academy.unit_progress_status;
begin
  insert into academy.units (id, course_version_id, ordinal, title, kind)
    values (v_unit, v_cv, 1, '[TEST] unit', 'lesson');
  insert into academy.enrollments (id, user_id, org_id, course_id, course_version_id)
    values (v_enr, v_user, v_org, v_course, v_cv);

  -- first sync (in_progress) then a LATER sync (passed) of the SAME unit
  insert into academy.unit_progress (enrollment_id, unit_id, org_id, status, synced_from_offline)
    values (v_enr, v_unit, v_org, 'in_progress', true)
    on conflict (enrollment_id, unit_id) do update set status = excluded.status;
  insert into academy.unit_progress (enrollment_id, unit_id, org_id, status, synced_from_offline)
    values (v_enr, v_unit, v_org, 'passed', true)
    on conflict (enrollment_id, unit_id) do update set status = excluded.status;

  select count(*) into v_n from academy.unit_progress where enrollment_id = v_enr and unit_id = v_unit;
  select status into v_status from academy.unit_progress where enrollment_id = v_enr and unit_id = v_unit;
  perform pg_temp.assert(v_n = 1, 'TEST 6: re-syncing unit_progress yields ONE row (upsert on natural key, not a uuid duplicate)');
  perform pg_temp.assert(v_status = 'passed', 'TEST 6: last-writer-wins kept the latest unit_progress value');
end $$;

-- TEST 7 — a sign-off DRAFT line item is UPSERT-by-(signoff_id, line_item_key) and
-- carries NO client_event_uuid. Re-syncing the same draft key UPDATES the one row.
-- (Draft only — immutability of TEST 5 still applies once the sign-off is SIGNED.)
do $$
declare
  v_org  uuid := '00000000-0000-0000-0000-000000f40001';
  v_user uuid := '00000000-0000-0000-0000-000000f40002';
  v_comp uuid := '00000000-0000-0000-0000-000000f40003';
  v_so uuid; v_n int; v_score int;
begin
  insert into academy.signoffs (candidate_user_id, evaluator_user_id, competency_id, org_id, status)
    values (v_user, v_user, v_comp, v_org, 'draft') returning id into v_so;
  insert into academy.signoff_line_items (signoff_id, dimension, line_item_key, score, is_critical_safety)
    values (v_so, 'technical_execution', 'k.draft', 1, false)
    on conflict (signoff_id, line_item_key) do update set score = excluded.score;
  insert into academy.signoff_line_items (signoff_id, dimension, line_item_key, score, is_critical_safety)
    values (v_so, 'technical_execution', 'k.draft', 3, false)
    on conflict (signoff_id, line_item_key) do update set score = excluded.score;

  select count(*) into v_n from academy.signoff_line_items where signoff_id = v_so and line_item_key = 'k.draft';
  select score into v_score from academy.signoff_line_items where signoff_id = v_so and line_item_key = 'k.draft';
  perform pg_temp.assert(v_n = 1, 'TEST 7: re-syncing a draft line item yields ONE row (upsert on natural key, not a uuid duplicate)');
  perform pg_temp.assert(v_score = 3, 'TEST 7: last-writer-wins kept the latest DRAFT score');
end $$;

-- TEST 8 — id-keyed draft upsert (signoffs / signoff_evidence) is idempotent ONLY
-- with a STABLE client-supplied id. The PK defaults to gen_random_uuid(); the
-- client must generate the id offline and re-send it, so ON CONFLICT (id) DO
-- UPDATE collapses a double-flush to one row. (sync-core validateSyncEvent REJECTS
-- an id-keyed upsert with no id — reason 'missing_conflict_key' — so this stable
-- id is guaranteed to be present; here we prove the DB-side idempotency it buys.)
do $$
declare
  v_org  uuid := '00000000-0000-0000-0000-000000f40001';
  v_user uuid := '00000000-0000-0000-0000-000000f40002';
  v_comp uuid := '00000000-0000-0000-0000-000000f40003';
  v_so   uuid := '00000000-0000-0000-0000-0000000d0001';  -- STABLE client-generated id
  v_ev   uuid := '00000000-0000-0000-0000-0000000d0002';  -- STABLE client-generated id
  v_n int;
begin
  -- double-flush of the SAME draft sign-off (stable id) -> ONE row
  insert into academy.signoffs (id, candidate_user_id, evaluator_user_id, competency_id, org_id, status)
    values (v_so, v_user, v_user, v_comp, v_org, 'draft')
    on conflict (id) do update set status = excluded.status;
  insert into academy.signoffs (id, candidate_user_id, evaluator_user_id, competency_id, org_id, status)
    values (v_so, v_user, v_user, v_comp, v_org, 'draft')
    on conflict (id) do update set status = excluded.status;
  select count(*) into v_n from academy.signoffs where id = v_so;
  perform pg_temp.assert(v_n = 1, 'TEST 8a: double-flush of a draft sign-off with a STABLE id yields ONE row');

  -- double-flush of the SAME evidence (stable id) -> ONE row
  insert into academy.signoff_evidence (id, signoff_id, kind, r2_key, source)
    values (v_ev, v_so, 'photo', 'r2://k', 'uploaded')
    on conflict (id) do update set r2_key = excluded.r2_key;
  insert into academy.signoff_evidence (id, signoff_id, kind, r2_key, source)
    values (v_ev, v_so, 'photo', 'r2://k', 'uploaded')
    on conflict (id) do update set r2_key = excluded.r2_key;
  select count(*) into v_n from academy.signoff_evidence where id = v_ev;
  perform pg_temp.assert(v_n = 1, 'TEST 8b: double-flush of draft evidence with a STABLE id yields ONE row');
end $$;

do $$
begin
  raise notice '------------------------------------------------------------';
  raise notice 'ALL SYNC IDEMPOTENCY TESTS PASSED: 3x append no double-count / faked-pass blocked /';
  raise notice 'immutable signed / upsert-on-natural-key (unit_progress + line item) / id-keyed';
  raise notice 'draft idempotency with a stable client-supplied id (signoffs + evidence).';
  raise notice '------------------------------------------------------------';
end $$;

rollback;
