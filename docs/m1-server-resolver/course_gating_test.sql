-- ============================================================================
-- tests/0004_m1_gating_test.sql
-- Redex Academy — M1 prerequisite-gating resolver tests.
--
-- Proves academy.resolve_course_gating + academy.my_course_gating (M1):
--   TEST 1: roots (no prereqs) are 'available'; a hard_gate course is 'locked'
--           until its prereqs clear; a 'soft' prereq NEVER gates.
--   TEST 2: clearing the hard_gate prereqs flips the gate 'locked' -> 'available';
--           field_proven => 'mastered', sim_passed => 'passed'.
--   TEST 3: an in_progress enrollment resolves to 'in_progress'.
--   TEST 4: a CREDENTIAL-held prereq gates: 'locked' without the credential,
--           'available' once an active credential is held.
--   TEST 5: the my_course_gating view returns the resolver state for the caller.
--   TEST 6: the view is per-CURRENT-user — another user (even same org) does NOT
--           inherit user A's cleared progress (RLS, no cross-user leak).
--
-- Runner: plain psql. Each assertion RAISEs on failure (aborts -> CI fails).
-- Whole script is one transaction, ROLLED BACK — fixtures never persist. Uses
-- only __TEST__-scoped keys, so it is safe with OR without the S1 seed (CI
-- db-invariants applies migrations only).
--
-- Run as a role that can `SET ROLE authenticated` (postgres/owner in CI).
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f tests/0004_m1_gating_test.sql
-- ============================================================================

begin;
set local client_min_messages = warning;

create or replace function pg_temp.assert(cond boolean, label text)
returns void language plpgsql as $$
begin
  if cond then raise notice 'ok  - %', label;
  else raise exception 'not ok - %', label using errcode = 'assert_failure';
  end if;
end $$;

-- Resolve gating for a given user/course as that authenticated user (exercises
-- RLS exactly as the client would). Returns the gating state as text.
create or replace function pg_temp.gating_as(p_user uuid, p_org uuid, p_course uuid)
returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user::text, 'org_id', p_org::text,
                      'roles', json_build_array('learner'))::text, true);
  set local role authenticated;
  select academy.resolve_course_gating(p_user, p_course)::text into v;
  reset role;
  return v;
end $$;

-- Read the my_course_gating view's state for one course AS the given user.
create or replace function pg_temp.view_state_as(p_user uuid, p_org uuid, p_course uuid)
returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user::text, 'org_id', p_org::text,
                      'roles', json_build_array('learner'))::text, true);
  set local role authenticated;
  select gating_state::text into v from academy.my_course_gating where course_id = p_course;
  reset role;
  return v;
end $$;

do $$
declare
  v_org   uuid := '0000fee1-0000-0000-0000-000000000001';
  v_user  uuid := '0000fee1-0000-0000-0000-000000000002';
  v_user2 uuid := '0000fee1-0000-0000-0000-000000000003';
  -- competencies (one per course that grants a skill)
  c_a   uuid := '0000fee1-0000-0000-0000-0000000000ca';
  c_b   uuid := '0000fee1-0000-0000-0000-0000000000cb';
  c_y   uuid := '0000fee1-0000-0000-0000-0000000000cc';
  -- courses
  k_a    uuid := '0000fee1-0000-0000-0000-0000000000a0';  -- root, grants c_a
  k_b    uuid := '0000fee1-0000-0000-0000-0000000000b0';  -- root, grants c_b
  k_gate uuid := '0000fee1-0000-0000-0000-0000000000e0';  -- requires k_a + k_b (hard)
  k_soft uuid := '0000fee1-0000-0000-0000-0000000000f0';  -- requires k_y (SOFT only)
  k_y    uuid := '0000fee1-0000-0000-0000-0000000000c0';  -- root (a soft prereq)
  k_inp  uuid := '0000fee1-0000-0000-0000-0000000000d0';  -- root, used for in_progress
  k_cred uuid := '0000fee1-0000-0000-0000-0000000000c5';  -- requires a credential
  -- course versions
  cv_a    uuid := '0000fee2-0000-0000-0000-0000000000a0';
  cv_b    uuid := '0000fee2-0000-0000-0000-0000000000b0';
  cv_gate uuid := '0000fee2-0000-0000-0000-0000000000e0';
  cv_soft uuid := '0000fee2-0000-0000-0000-0000000000f0';
  cv_y    uuid := '0000fee2-0000-0000-0000-0000000000c0';
  cv_inp  uuid := '0000fee2-0000-0000-0000-0000000000d0';
  cv_cred uuid := '0000fee2-0000-0000-0000-0000000000c5';
  v_badge uuid := '0000fee1-0000-0000-0000-0000000000b9';
  v_enr   uuid;
begin
  insert into academy.orgs (id, name, type) values (v_org, '__TEST__ M1 org', 'redex');
  insert into academy.users (id, org_id, display_name) values
    (v_user,  v_org, '[TEST] learner'),
    (v_user2, v_org, '[TEST] learner 2');

  insert into academy.competencies (id, code, title, domain) values
    (c_a, '__TEST__.M1.A', '[TEST] comp A', 'AC'),
    (c_b, '__TEST__.M1.B', '[TEST] comp B', 'AC'),
    (c_y, '__TEST__.M1.Y', '[TEST] comp Y', 'FND');

  insert into academy.courses (id, code, title, domain, tier, status) values
    (k_a,    '__TEST__-M1-A',    '[TEST] A',    'AC',  'core',        'published'),
    (k_b,    '__TEST__-M1-B',    '[TEST] B',    'AC',  'core',        'published'),
    (k_gate, '__TEST__-M1-GATE', '[TEST] Gate', 'AC',  'advanced',    'published'),
    (k_soft, '__TEST__-M1-SOFT', '[TEST] Soft', 'AC',  'core',        'published'),
    (k_y,    '__TEST__-M1-Y',    '[TEST] Y',    'FND', 'foundations', 'published'),
    (k_inp,  '__TEST__-M1-INP',  '[TEST] InP',  'AC',  'core',        'published'),
    (k_cred, '__TEST__-M1-CRED', '[TEST] Cred', 'AC',  'mastery',     'published');

  insert into academy.course_versions (id, course_id, semver, status) values
    (cv_a, k_a, '1.0.0', 'published'), (cv_b, k_b, '1.0.0', 'published'),
    (cv_gate, k_gate, '1.0.0', 'published'), (cv_soft, k_soft, '1.0.0', 'published'),
    (cv_y, k_y, '1.0.0', 'published'), (cv_inp, k_inp, '1.0.0', 'published'),
    (cv_cred, k_cred, '1.0.0', 'published');
  update academy.courses set active_version_id = cv_a   where id = k_a;
  update academy.courses set active_version_id = cv_b   where id = k_b;
  update academy.courses set active_version_id = cv_gate where id = k_gate;
  update academy.courses set active_version_id = cv_soft where id = k_soft;
  update academy.courses set active_version_id = cv_y   where id = k_y;
  update academy.courses set active_version_id = cv_inp where id = k_inp;
  update academy.courses set active_version_id = cv_cred where id = k_cred;

  -- one unit per course, mapped to its granted competency (drives course_is_cleared)
  insert into academy.units (id, course_version_id, ordinal, title, kind, competency_id) values
    (gen_random_uuid(), cv_a, 1, '[TEST] u', 'lesson', c_a),
    (gen_random_uuid(), cv_b, 1, '[TEST] u', 'lesson', c_b),
    (gen_random_uuid(), cv_y, 1, '[TEST] u', 'lesson', c_y);

  -- edges: GATE requires A + B (hard_gate); SOFT requires Y (soft, must NOT gate)
  insert into academy.course_prerequisites (course_id, requires_course_id, kind) values
    (k_gate, k_a, 'hard_gate'), (k_gate, k_b, 'hard_gate'),
    (k_soft, k_y, 'soft');

  -- credential prereq: CRED requires holding v_badge
  insert into academy.badge_classes (id, key, kind, title)
    values (v_badge, '__TEST__.M1.BADGE', 'tier', '[TEST] tier badge');
  insert into academy.course_credential_prerequisites (course_id, requires_badge_class_id)
    values (k_cred, v_badge);

  -- ── TEST 1: initial states (no progress) ────────────────────────────────
  perform pg_temp.assert(pg_temp.gating_as(v_user, v_org, k_a) = 'available',
    'TEST 1: root course A is available');
  perform pg_temp.assert(pg_temp.gating_as(v_user, v_org, k_gate) = 'locked',
    'TEST 1: hard-gate course is locked while prereqs uncleared');
  perform pg_temp.assert(pg_temp.gating_as(v_user, v_org, k_soft) = 'available',
    'TEST 1: a SOFT prereq does not gate (course is available)');
  perform pg_temp.assert(pg_temp.gating_as(v_user, v_org, k_cred) = 'locked',
    'TEST 1: credential-gated course is locked without the credential');

  -- ── TEST 2: clear A (field_proven => mastered) + B (sim_passed => passed) ──
  insert into academy.competency_state (user_id, org_id, competency_id, status, source) values
    (v_user, v_org, c_a, 'field_proven', 'course'),
    (v_user, v_org, c_b, 'sim_passed',  'course');
  perform pg_temp.assert(pg_temp.gating_as(v_user, v_org, k_a) = 'mastered',
    'TEST 2: field_proven competency => course mastered');
  perform pg_temp.assert(pg_temp.gating_as(v_user, v_org, k_b) = 'passed',
    'TEST 2: sim_passed competency => course passed');
  perform pg_temp.assert(pg_temp.gating_as(v_user, v_org, k_gate) = 'available',
    'TEST 2: hard-gate flips to available once both prereqs are cleared');

  -- ── TEST 3: in_progress enrollment ───────────────────────────────────────
  insert into academy.enrollments (id, user_id, org_id, course_id, course_version_id, status)
    values (gen_random_uuid(), v_user, v_org, k_inp, cv_inp, 'in_progress') returning id into v_enr;
  perform pg_temp.assert(pg_temp.gating_as(v_user, v_org, k_inp) = 'in_progress',
    'TEST 3: an in_progress enrollment resolves to in_progress');

  -- ── TEST 4: grant the credential -> CRED unlocks ─────────────────────────
  insert into academy.credentials (badge_class_id, recipient_user_id, org_id, status)
    values (v_badge, v_user, v_org, 'active');
  perform pg_temp.assert(pg_temp.gating_as(v_user, v_org, k_cred) = 'available',
    'TEST 4: credential-gated course unlocks once the credential is held');

  -- ── TEST 5: the view returns the resolver state for the caller ───────────
  perform pg_temp.assert(pg_temp.view_state_as(v_user, v_org, k_gate) = 'available',
    'TEST 5: my_course_gating view returns available for the gate (caller=user)');
  perform pg_temp.assert(pg_temp.view_state_as(v_user, v_org, k_a) = 'mastered',
    'TEST 5: my_course_gating view returns mastered for A (caller=user)');

  -- ── TEST 6: per-user isolation — user2 (same org) did NOT clear anything ──
  perform pg_temp.assert(pg_temp.view_state_as(v_user2, v_org, k_gate) = 'locked',
    'TEST 6: view is per-current-user — user2 sees the gate locked (no cross-user leak)');
  perform pg_temp.assert(pg_temp.view_state_as(v_user2, v_org, k_a) = 'available',
    'TEST 6: user2 sees root A merely available (not mastered) — own progress only');

  raise notice '--- M1 gating: all assertions passed ---';
end $$;

rollback;
