-- ============================================================================
-- tests/f3c_provisioning_test.sql  (F3c)
-- Proves the new-user provisioning trigger links auth.users -> academy profile +
-- role FROM AN INVITE, mints claims via the F3 hook, and HOLDS THE TENANT BOUNDARY
-- (CLAUDE.md inv. 3/4). The existing hook test seeds id-only auth.users (no email/
-- confirm), so the trigger is otherwise NEVER exercised in CI.
--
--   TEST 1 : unconfirmed email => NO profile (verified-email gate).
--   TEST 2 : confirm (UPDATE email_confirmed_at) => profile in INVITE org + capped
--            role + persona, invite consumed (password-signup-then-confirm path).
--   TEST 3 : insert already-confirmed (magic-link/OTP/SSO) => provisioned to invite org.
--   TEST 4 : the F3 hook then mints org_id/roles/persona for the provisioned user.
--   TEST 5 : NO invite => NO profile (pending_provisioning).
--   TEST 6 : EXPIRED invite => NO profile.
--   TEST 7 : REVOKED invite => NO profile.
--   TEST 8 : idempotent — re-confirm / re-fire does not duplicate or error.
--   TEST 9 : role CAP — an invite cannot request an elevated role (CHECK).
--   TEST 10: RLS tenant boundary — a CCS (org-B) admin sees ZERO org-A invites and
--            CANNOT create an invite into org A; a non-admin cannot create one;
--            an org-B admin CAN create an org-B invite.
--
-- Runner: plain psql; assertions RAISE on failure -> CI fails. Whole script runs
-- in a transaction that is ROLLED BACK. Assumes 0001 + the F3 FK + hook +
-- F3c provisioning migrations applied. Run as DB owner/superuser (can SET ROLE).
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

-- ---- Fixtures: two tenants + invites (org_id from the INVITE is the only org source) ----
do $$
declare
  v_orgA uuid := '00000000-0000-0000-0000-00000000a001';  -- Redex
  v_orgB uuid := '00000000-0000-0000-0000-00000000b002';  -- CCS partner
begin
  insert into academy.orgs (id, name, type) values
    (v_orgA, '__TEST__ Redex prov', 'redex'),
    (v_orgB, '__TEST__ CCS prov',   'ccs_partner');

  -- open invite (mixed-case email, to prove case-insensitive match), manager into A
  insert into academy.user_invitations (email, org_id, role_key, persona)
    values ('Invited@Example.test', v_orgA, 'manager', 'priya');
  -- open invite, magic-link path, learner into B
  insert into academy.user_invitations (email, org_id, role_key)
    values ('magic@example.test', v_orgB, 'learner');
  -- expired + revoked invites into A
  insert into academy.user_invitations (email, org_id, role_key, expires_at)
    values ('expired@example.test', v_orgA, 'learner', now() - interval '1 day');
  insert into academy.user_invitations (email, org_id, role_key, status)
    values ('revoked@example.test', v_orgA, 'learner', 'revoked');
end $$;

-- TEST 1 + 2 — password path: insert UNCONFIRMED (no provision), then confirm (provision).
do $$
declare
  v_u    uuid := '00000000-0000-0000-0000-0000000000e1';
  v_orgA uuid := '00000000-0000-0000-0000-00000000a001';
begin
  insert into auth.users (id, email, email_confirmed_at) values (v_u, 'invited@example.test', null);
  perform pg_temp.assert(
    not exists (select 1 from academy.users where id = v_u),
    'TEST 1: unconfirmed email -> NO profile');

  update auth.users set email_confirmed_at = now() where id = v_u;
  perform pg_temp.assert(
    exists (select 1 from academy.users where id = v_u and org_id = v_orgA),
    'TEST 2: confirmed -> profile created in the INVITE org');
  perform pg_temp.assert(
    (select persona::text from academy.users where id = v_u) = 'priya',
    'TEST 2: persona copied from invite');
  perform pg_temp.assert(
    exists (select 1 from academy.user_roles ur join academy.roles r on r.id = ur.role_id
            where ur.user_id = v_u and ur.org_id = v_orgA and r.key = 'manager'),
    'TEST 2: capped role (manager) granted in the invite org');
  perform pg_temp.assert(
    exists (select 1 from academy.user_invitations
            where lower(btrim(email)) = 'invited@example.test'
              and status = 'accepted' and consumed_user_id = v_u and consumed_at is not null),
    'TEST 2: invite marked accepted + consumed');
end $$;

-- TEST 3 — magic-link/OTP/SSO path: insert ALREADY-CONFIRMED -> provisioned to org B.
do $$
declare
  v_u    uuid := '00000000-0000-0000-0000-0000000000e2';
  v_orgB uuid := '00000000-0000-0000-0000-00000000b002';
begin
  insert into auth.users (id, email, email_confirmed_at) values (v_u, 'magic@example.test', now());
  perform pg_temp.assert(
    exists (select 1 from academy.users where id = v_u and org_id = v_orgB),
    'TEST 3: already-confirmed insert -> provisioned to invite org B');
  perform pg_temp.assert(
    exists (select 1 from academy.user_roles ur join academy.roles r on r.id = ur.role_id
            where ur.user_id = v_u and r.key = 'learner'),
    'TEST 3: learner role granted');
end $$;

-- TEST 4 — the F3 hook mints org_id/roles/persona for the provisioned user.
do $$
declare
  v_u    uuid := '00000000-0000-0000-0000-0000000000e1';
  v_orgA uuid := '00000000-0000-0000-0000-00000000a001';
  v_claims jsonb;
begin
  v_claims := academy.custom_access_token_hook(
    jsonb_build_object('user_id', v_u::text,
      'claims', jsonb_build_object('sub', v_u::text, 'role', 'authenticated'))) -> 'claims';
  perform pg_temp.assert(v_claims ->> 'org_id' = v_orgA::text, 'TEST 4: hook mints org_id = invite org');
  perform pg_temp.assert(v_claims -> 'roles' @> '["manager"]'::jsonb, 'TEST 4: hook mints roles incl. manager');
  perform pg_temp.assert(v_claims ->> 'persona' = 'priya', 'TEST 4: hook mints persona');
end $$;

-- TEST 5 — NO invite => pending_provisioning (no profile).
do $$
declare v_u uuid := '00000000-0000-0000-0000-0000000000e3';
begin
  insert into auth.users (id, email, email_confirmed_at) values (v_u, 'noinvite@example.test', now());
  perform pg_temp.assert(
    not exists (select 1 from academy.users where id = v_u),
    'TEST 5: no invite -> NO profile (pending_provisioning)');
end $$;

-- TEST 6 — EXPIRED invite => no provision.
do $$
declare v_u uuid := '00000000-0000-0000-0000-0000000000e4';
begin
  insert into auth.users (id, email, email_confirmed_at) values (v_u, 'expired@example.test', now());
  perform pg_temp.assert(
    not exists (select 1 from academy.users where id = v_u),
    'TEST 6: expired invite -> NO profile');
end $$;

-- TEST 7 — REVOKED invite => no provision.
do $$
declare v_u uuid := '00000000-0000-0000-0000-0000000000e5';
begin
  insert into auth.users (id, email, email_confirmed_at) values (v_u, 'revoked@example.test', now());
  perform pg_temp.assert(
    not exists (select 1 from academy.users where id = v_u),
    'TEST 7: revoked invite -> NO profile');
end $$;

-- TEST 8 — idempotent: a second confirm/re-fire does not duplicate or error.
do $$
declare
  v_u uuid := '00000000-0000-0000-0000-0000000000e1';
  v_profiles int;
  v_roles int;
begin
  update auth.users set email_confirmed_at = now() where id = v_u;  -- re-fire update trigger
  select count(*) into v_profiles from academy.users where id = v_u;
  select count(*) into v_roles from academy.user_roles ur join academy.roles r on r.id = ur.role_id
    where ur.user_id = v_u and r.key = 'manager';
  perform pg_temp.assert(v_profiles = 1, 'TEST 8: re-fire does not duplicate the profile');
  perform pg_temp.assert(v_roles = 1, 'TEST 8: re-fire does not duplicate the role grant');
end $$;

-- TEST 9 — role CAP: an invite cannot request an elevated role (CHECK constraint).
do $$
declare
  v_orgA uuid := '00000000-0000-0000-0000-00000000a001';
  v_raised boolean := false;
begin
  begin
    insert into academy.user_invitations (email, org_id, role_key)
      values ('escalate@example.test', v_orgA, 'org_admin');
  exception when check_violation then
    v_raised := true;
  end;
  perform pg_temp.assert(v_raised, 'TEST 9: invite with elevated role (org_admin) rejected by CHECK');
end $$;

-- TEST 10 — RLS tenant boundary on user_invitations under MINTED claims.
do $$
declare
  v_orgA uuid := '00000000-0000-0000-0000-00000000a001';
  v_orgB uuid := '00000000-0000-0000-0000-00000000b002';
  v_seen int;
  v_raised boolean;
  -- a CCS (org-B) org_admin context, and a CCS learner context
  v_claims_b_admin jsonb := jsonb_build_object('sub', '00000000-0000-0000-0000-0000000000f9',
                                                'org_id', v_orgB::text, 'roles', '["org_admin"]'::jsonb);
  v_claims_b_learner jsonb := jsonb_build_object('sub', '00000000-0000-0000-0000-0000000000fa',
                                                 'org_id', v_orgB::text, 'roles', '["learner"]'::jsonb);
begin
  -- (a) org-B admin sees ZERO of org A's invitations.
  perform set_config('request.jwt.claims', v_claims_b_admin::text, true);
  set local role authenticated;
  select count(*) into v_seen from academy.user_invitations where org_id = v_orgA;
  reset role;
  perform pg_temp.assert(v_seen = 0, 'TEST 10a: org-B admin sees ZERO org-A invitations (RLS)');

  -- (b) org-B admin CANNOT create an invite into org A (WITH CHECK pins org_id).
  v_raised := false;
  perform set_config('request.jwt.claims', v_claims_b_admin::text, true);
  set local role authenticated;
  begin
    insert into academy.user_invitations (email, org_id, role_key) values ('x@example.test', v_orgA, 'learner');
  exception when insufficient_privilege then
    v_raised := true;
  end;
  reset role;
  perform pg_temp.assert(v_raised, 'TEST 10b: org-B admin CANNOT invite into org A (cross-tenant denied)');

  -- (c) org-B NON-admin (learner) cannot create an invite even into its own org.
  v_raised := false;
  perform set_config('request.jwt.claims', v_claims_b_learner::text, true);
  set local role authenticated;
  begin
    insert into academy.user_invitations (email, org_id, role_key) values ('y@example.test', v_orgB, 'learner');
  exception when insufficient_privilege then
    v_raised := true;
  end;
  reset role;
  perform pg_temp.assert(v_raised, 'TEST 10c: org-B learner CANNOT create an invite (not an admin)');

  -- (d) org-B admin CAN create an invite into its OWN org.
  perform set_config('request.jwt.claims', v_claims_b_admin::text, true);
  set local role authenticated;
  insert into academy.user_invitations (email, org_id, role_key) values ('ok@example.test', v_orgB, 'learner');
  reset role;
  perform pg_temp.assert(
    exists (select 1 from academy.user_invitations where lower(btrim(email)) = 'ok@example.test' and org_id = v_orgB),
    'TEST 10d: org-B admin CAN create an invite into its own org');
end $$;

do $$
begin
  raise notice '------------------------------------------------------------';
  raise notice 'ALL F3c PROVISIONING TESTS PASSED (verified-email gate / invite-sourced org +';
  raise notice '  capped role / hook claims / pending_provisioning / expired+revoked / idempotent /';
  raise notice '  role cap / RLS tenant boundary on invitations).';
  raise notice '------------------------------------------------------------';
end $$;

rollback;
