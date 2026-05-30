-- ============================================================================
-- tests/custom_access_token_hook_test.sql  (F3)
-- Proves the auth hook mints EXACTLY the claim shape F2's RLS helpers read, and
-- that those minted claims drive RLS correctly (CLAUDE.md inv. 3/6).
--
--   TEST 1: claim shape for a manager+evaluator (org_id / roles[] / persona /
--           evaluator_authorized / domains[]); pre-existing claims preserved.
--   TEST 2: jwt_has_role / current_org_id / current_user_id resolve under the
--           minted claims (roles is a real JSON array).
--   TEST 3: a learner mints [learner], persona, no evaluator authority.
--   TEST 4: RLS under HOOK-MINTED claims — same-org sees, cross-org sees ZERO
--           (the F3 deliverable: real claim shape, not F2's hand-set set_config).
--   TEST 5: EXECUTE on the hook is locked to supabase_auth_admin only.
--
-- Runner: plain psql; assertions RAISE on failure -> CI fails. Runs inside a
-- transaction that is ROLLED BACK. Assumes 0001 + the F3 FK + hook migrations
-- applied. Run as a role that can SET ROLE authenticated (DB owner/superuser).
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

-- Roles catalog (0001 creates the table; rows are normally S1-seeded — seed minimal here).
insert into academy.roles (key, label) values
  ('learner', 'Learner'), ('evaluator', 'Evaluator'), ('manager', 'Manager'),
  ('org_admin', 'Org Admin'), ('exec', 'Exec')
on conflict (key) do nothing;

do $$
declare
  v_org_a uuid := '00000000-0000-0000-0000-00000000aa01';
  v_org_b uuid := '00000000-0000-0000-0000-00000000bb02';
  v_uA    uuid := '00000000-0000-0000-0000-00000000cc03';  -- Redex: manager+evaluator, persona priya
  v_uB    uuid := '00000000-0000-0000-0000-00000000dd04';  -- CCS: learner, persona marco
  v_rid   uuid;
begin
  insert into auth.users (id) values (v_uA), (v_uB);   -- FK targets (academy.users.id = auth.users.id)
  insert into academy.orgs (id, name, type) values
    (v_org_a, '__TEST__ Redex hook', 'redex'),
    (v_org_b, '__TEST__ CCS hook',   'ccs_partner');
  insert into academy.users (id, org_id, display_name, persona) values
    (v_uA, v_org_a, '[TEST] Priya', 'priya'),
    (v_uB, v_org_b, '[TEST] Marco', 'marco');
  for v_rid in select id from academy.roles where key in ('manager', 'evaluator') loop
    insert into academy.user_roles (user_id, role_id, org_id) values (v_uA, v_rid, v_org_a);
  end loop;
  insert into academy.user_roles (user_id, role_id, org_id)
    select v_uB, id, v_org_b from academy.roles where key = 'learner';
  insert into academy.evaluator_authorizations (user_id, org_id, domains, status, source)
    values (v_uA, v_org_a, array['AC', 'SEC']::academy.domain[], 'authorized', 'founding_bootstrap');
end $$;

-- TEST 1 — claim shape for the manager+evaluator.
do $$
declare
  v_uA uuid := '00000000-0000-0000-0000-00000000cc03';
  v_org_a uuid := '00000000-0000-0000-0000-00000000aa01';
  v_claims jsonb;
begin
  v_claims := (academy.custom_access_token_hook(
    jsonb_build_object('user_id', v_uA::text,
      'claims', jsonb_build_object('sub', v_uA::text, 'role', 'authenticated')))) -> 'claims';
  perform pg_temp.assert(v_claims ->> 'org_id' = v_org_a::text, 'TEST 1: org_id minted = user org');
  perform pg_temp.assert(jsonb_typeof(v_claims -> 'roles') = 'array', 'TEST 1: roles is a JSON ARRAY');
  perform pg_temp.assert(v_claims -> 'roles' @> '["manager","evaluator"]'::jsonb, 'TEST 1: roles contains manager+evaluator');
  perform pg_temp.assert(v_claims ->> 'persona' = 'priya', 'TEST 1: persona minted');
  perform pg_temp.assert((v_claims ->> 'evaluator_authorized')::boolean, 'TEST 1: evaluator_authorized = true');
  perform pg_temp.assert(v_claims -> 'domains' @> '["AC","SEC"]'::jsonb, 'TEST 1: domains = union(AC,SEC)');
  perform pg_temp.assert(v_claims ->> 'sub' = v_uA::text, 'TEST 1: pre-existing sub claim preserved');
end $$;

-- TEST 2 — the F2 helpers resolve under the minted claims.
do $$
declare
  v_uA uuid := '00000000-0000-0000-0000-00000000cc03';
  v_org_a uuid := '00000000-0000-0000-0000-00000000aa01';
  v_claims jsonb;
begin
  v_claims := (academy.custom_access_token_hook(
    jsonb_build_object('user_id', v_uA::text, 'claims', jsonb_build_object('sub', v_uA::text)))) -> 'claims';
  perform set_config('request.jwt.claims', v_claims::text, true);
  perform pg_temp.assert(academy.jwt_has_role('manager'), 'TEST 2: jwt_has_role(manager) true under minted claims');
  perform pg_temp.assert(academy.jwt_has_role('exec', 'manager'), 'TEST 2: jwt_has_role(exec,manager) intersect true');
  perform pg_temp.assert(not academy.jwt_has_role('org_admin'), 'TEST 2: jwt_has_role(org_admin) false');
  perform pg_temp.assert(academy.current_org_id() = v_org_a, 'TEST 2: current_org_id() resolves from minted org_id');
  perform pg_temp.assert(academy.current_user_id() = v_uA, 'TEST 2: current_user_id() resolves from sub');
end $$;

-- TEST 3 — learner shape.
do $$
declare
  v_uB uuid := '00000000-0000-0000-0000-00000000dd04';
  v_org_b uuid := '00000000-0000-0000-0000-00000000bb02';
  v_claims jsonb;
begin
  v_claims := (academy.custom_access_token_hook(
    jsonb_build_object('user_id', v_uB::text, 'claims', jsonb_build_object('sub', v_uB::text)))) -> 'claims';
  perform pg_temp.assert(v_claims ->> 'org_id' = v_org_b::text, 'TEST 3: learner org_id');
  perform pg_temp.assert(v_claims -> 'roles' = '["learner"]'::jsonb, 'TEST 3: learner roles = ["learner"]');
  perform pg_temp.assert(v_claims ->> 'persona' = 'marco', 'TEST 3: learner persona = marco');
  perform pg_temp.assert(not (v_claims ->> 'evaluator_authorized')::boolean, 'TEST 3: learner not evaluator_authorized');
  perform pg_temp.assert(v_claims -> 'domains' = '[]'::jsonb, 'TEST 3: learner domains empty');
end $$;

-- TEST 4 — RLS under HOOK-MINTED claims (same-org sees, cross-org ZERO).
do $$
declare
  v_uA uuid := '00000000-0000-0000-0000-00000000cc03';
  v_uB uuid := '00000000-0000-0000-0000-00000000dd04';
  v_org_a uuid := '00000000-0000-0000-0000-00000000aa01';
  v_comp uuid;
  v_claims_a jsonb;
  v_claims_b jsonb;
  v_seen_a int;
  v_seen_b int;
begin
  insert into academy.competencies (code, title, domain, is_safety_critical)
    values ('__TEST__.HOOK.COMP', '[TEST] comp', 'AC', true) returning id into v_comp;
  insert into academy.competency_state (user_id, org_id, competency_id, status, source)
    values (v_uA, v_org_a, v_comp, 'sim_passed', 'course');

  v_claims_a := (academy.custom_access_token_hook(
    jsonb_build_object('user_id', v_uA::text, 'claims', jsonb_build_object('sub', v_uA::text)))) -> 'claims';
  v_claims_b := (academy.custom_access_token_hook(
    jsonb_build_object('user_id', v_uB::text, 'claims', jsonb_build_object('sub', v_uB::text)))) -> 'claims';

  perform set_config('request.jwt.claims', v_claims_a::text, true);
  set local role authenticated;
  select count(*) into v_seen_a from academy.competency_state;
  reset role;
  perform pg_temp.assert(v_seen_a >= 1, 'TEST 4: Redex manager SEES org-A competency_state under MINTED claims');

  perform set_config('request.jwt.claims', v_claims_b::text, true);
  set local role authenticated;
  select count(*) into v_seen_b from academy.competency_state;
  reset role;
  perform pg_temp.assert(v_seen_b = 0, 'TEST 4: CCS actor sees ZERO org-A competency_state under MINTED claims');
end $$;

-- TEST 5 — EXECUTE on the hook is locked to supabase_auth_admin only.
do $$
begin
  perform pg_temp.assert(
    not has_function_privilege('public', 'academy.custom_access_token_hook(jsonb)', 'execute'),
    'TEST 5: hook NOT executable by public');
  perform pg_temp.assert(
    not has_function_privilege('anon', 'academy.custom_access_token_hook(jsonb)', 'execute'),
    'TEST 5: hook NOT executable by anon');
  perform pg_temp.assert(
    not has_function_privilege('authenticated', 'academy.custom_access_token_hook(jsonb)', 'execute'),
    'TEST 5: hook NOT executable by authenticated');
  perform pg_temp.assert(
    has_function_privilege('supabase_auth_admin', 'academy.custom_access_token_hook(jsonb)', 'execute'),
    'TEST 5: hook IS executable by supabase_auth_admin');
end $$;

do $$
begin
  raise notice '------------------------------------------------------------';
  raise notice 'ALL CUSTOM-ACCESS-TOKEN-HOOK TESTS PASSED (claim shape / helper resolution /';
  raise notice '  learner shape / RLS under minted claims / execute locked to supabase_auth_admin).';
  raise notice '------------------------------------------------------------';
end $$;

rollback;
