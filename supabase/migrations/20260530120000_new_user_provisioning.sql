-- ============================================================================
-- 20260530120000_new_user_provisioning.sql  (F3c)
-- New-user provisioning: when a brand-new auth.users row's email is VERIFIED,
-- link its academy profile + a capped default role FROM AN ADMIN-CREATED
-- INVITATION, so the F3 custom_access_token_hook can then mint org_id / roles /
-- persona claims and F2's RLS becomes live for that user.
--
-- TENANT BOUNDARY (the whole point — ledger §A / CLAUDE.md inv. 4): org_id is
-- sourced ONLY from a pre-authorized academy.user_invitations row, NEVER from
-- user-controlled input. No matching invite => NO profile (pending_provisioning):
-- the user authenticates but has no org_id claim, so deny-by-default RLS yields
-- ZERO rows. A user can never self-assign an org.
--
-- Closes the link-trigger gap F3/F3b/M1 deferred (a server-side auth.users ->
-- profile trigger needs a schema migration). Migrations are now the typegen
-- source of truth (PR #12), so this ships in a PR off main with NO prod deploy.
--
-- BARE-CI: applies to a bare postgres:16 as superuser. The auth.users stub from
-- 20260529210646 has only `id`; §0 adds the GoTrue columns the trigger reads
-- ONLY IF missing (a no-op on real Supabase). The SECURITY DEFINER trigger bypasses
-- FORCE RLS the same way the F3 hook reads academy.users under FORCE.
--
-- REAL-STACK / RELEASE-GATE notes (out of scope for this CI-only PR — flag for the
-- F3/M12 reviewer): creating a trigger on the supabase_auth_admin-owned auth.users
-- is the standard Supabase handle_new_user pattern; the §0 auth-column guard issues
-- no ALTER there. RESIDUAL FOLLOW-UPS (non-blocking): unicode/NFC email-homograph
-- normalization at invite creation (app layer); TOCTOU re-check that invited_by
-- still holds admin in org at provision time; the pre-existing academy.users ->
-- auth.users ON DELETE CASCADE (20260529210646) deprovision semantics. Elevated
-- roles (org_admin/curriculum_admin/exec/support) are NEVER auto-granted here —
-- they require an explicit admin grant out-of-band.
-- ============================================================================

begin;

-- ---- 0. bare-CI safety: ensure the GoTrue columns the trigger reads exist. ----
-- On real Supabase auth.users is the full GoTrue table (these already exist) so the
-- guard issues NO alter (it must not ALTER the supabase_auth_admin-owned table).
-- On a bare CI Postgres (auth.users = id-only stub) it adds the minimal columns.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'email'
  ) then
    alter table auth.users add column email text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'email_confirmed_at'
  ) then
    alter table auth.users add column email_confirmed_at timestamptz;
  end if;
end $$;

-- ---- 1. Role catalog (idempotent) ----
-- The 8 closed role_key values. Previously seeded ONLY in supabase/seed (dev), so
-- academy.roles was EMPTY in CI/prod — the provisioning trigger's role lookup needs
-- it present (a missing role would otherwise fail the grant). Deterministic from the
-- enum; safe to (re)apply. (The dev seed's duplicate insert is removed in this PR.)
insert into academy.roles (key, label) values
  ('learner', 'Learner'), ('evaluator', 'Evaluator'), ('manager', 'Manager'),
  ('author', 'Author'), ('curriculum_admin', 'Curriculum Admin'),
  ('org_admin', 'Org Admin'), ('exec', 'Exec'), ('support', 'Support')
on conflict (key) do nothing;

-- ---- 2. Invitation status enum (guarded for clean re-apply) ----
do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'invitation_status' and n.nspname = 'academy'
  ) then
    create type academy.invitation_status as enum ('pending', 'accepted', 'revoked');
  end if;
end $$;

-- ---- 3. The invitation allow-list (the ONLY trusted source of a new user's org) ----
create table academy.user_invitations (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,                       -- matched case-insensitively: lower(btrim(email))
  org_id            uuid not null references academy.orgs(id) on delete cascade,
  -- Auto-grantable roles are CAPPED to operational roles. A brand-new account must
  -- never be auto-minted with admin power on first login; elevated roles
  -- (org_admin/curriculum_admin/exec/support) are granted out-of-band by an admin.
  role_key          academy.role_key not null default 'learner'
                      check (role_key in ('learner', 'evaluator', 'manager', 'author')),
  persona           academy.persona,                     -- optional UI hint; NULL => hook mints no persona
  invited_by        uuid references academy.users(id) on delete set null,   -- NULL for service-role/system invites
  status            academy.invitation_status not null default 'pending',
  expires_at        timestamptz not null default (now() + interval '14 days'),
  consumed_at       timestamptz,
  consumed_user_id  uuid references academy.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table academy.user_invitations is
  'Admin-created allow-list binding a specific email to a specific org (+ a CAPPED operational role/persona). The F3c provisioning trigger reads ONLY this table to assign a brand-new VERIFIED user their org — org_id is never derived from user input (tenant boundary, ledger §A / inv. 4). One OPEN invite per email; accepted/revoked invites allow re-invitation.';

-- One OPEN (pending) invite per email; accepted/revoked don't block re-invite.
create unique index user_invitations_open_email_uq
  on academy.user_invitations (lower(btrim(email)))
  where status = 'pending';
create index user_invitations_org_idx on academy.user_invitations (org_id);

-- updated_at maintenance (repo convention for mutable tables).
create trigger user_invitations_set_updated_at
  before update on academy.user_invitations
  for each row execute function academy.tg_set_updated_at();

-- ---- 4. RLS — ENABLE + FORCE (deny-by-default), matching init_academy §15. ----
-- CRITICAL: §15's enable/force loop uses a HARDCODED table list that does NOT
-- include this table, and §14 default-privileges auto-GRANT select to authenticated
-- for new academy tables — so without this block the table would be cross-tenant
-- readable. The SECURITY DEFINER trigger (owner) bypasses RLS the same way the F3
-- hook reads academy.users under FORCE; service_role bypasses via BYPASSRLS.
alter table academy.user_invitations enable row level security;
alter table academy.user_invitations force row level security;

revoke all on academy.user_invitations from anon, public;
grant select, insert, update on academy.user_invitations to authenticated;  -- RLS filters; service_role has ALL + bypass

-- Admins/managers READ invites for THEIR OWN org only.
create policy user_invitations_select_org on academy.user_invitations
  for select to authenticated
  using (
    org_id = academy.current_org_id()
    and academy.jwt_has_role('org_admin', 'curriculum_admin', 'manager', 'exec')
  );

-- org_admin / curriculum_admin CREATE invites INTO THEIR OWN org only.
-- (Cross-org Redex onboarding of a partner org is service_role only — bypasses RLS.)
create policy user_invitations_insert_org_admin on academy.user_invitations
  for insert to authenticated
  with check (
    org_id = academy.current_org_id()
    and academy.jwt_has_role('org_admin', 'curriculum_admin')
  );

-- org_admin / curriculum_admin REVOKE/EDIT invites in their own org only; the
-- WITH CHECK pins org_id so an admin cannot move an invite to another tenant.
create policy user_invitations_update_org_admin on academy.user_invitations
  for update to authenticated
  using (
    org_id = academy.current_org_id()
    and academy.jwt_has_role('org_admin', 'curriculum_admin')
  )
  with check (
    org_id = academy.current_org_id()
    and academy.jwt_has_role('org_admin', 'curriculum_admin')
  );

-- ---- 5. The provisioning function (SECURITY DEFINER; the tenant boundary lives here) ----
create or replace function academy.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = academy, pg_temp
as $$
declare
  v_inv     academy.user_invitations;
  v_role_id uuid;
begin
  -- Verified-email gate: only provision on a CONFIRMED email. NULL/blank email or
  -- unconfirmed => no-op (blocks pre-confirmation provisioning / signup-as-victim).
  if new.email is null or btrim(new.email) = '' or new.email_confirmed_at is null then
    return new;
  end if;

  -- Idempotent + coexists with the dev seed: never clobber an existing profile,
  -- never re-provision on a re-fire / email re-confirm (also blocks moving an
  -- already-provisioned user into a second org via an email change).
  if exists (select 1 from academy.users u where u.id = new.id) then
    return new;
  end if;

  -- The ONLY org source: the newest OPEN, UNEXPIRED invite for this exact email.
  select * into v_inv
  from academy.user_invitations
  where lower(btrim(email)) = lower(btrim(new.email))
    and status = 'pending'
    and (expires_at is null or expires_at > now())
  order by created_at desc
  limit 1
  for update;

  if not found then
    return new;  -- no invite => pending_provisioning (no org, zero rows under RLS)
  end if;

  -- Create the academy profile with org_id FROM THE INVITE (never from user input).
  insert into academy.users (id, org_id, email, persona)
  values (new.id, v_inv.org_id, new.email, v_inv.persona)
  on conflict (id) do nothing;

  -- Grant the (capped) invited role. The catalog is migration-seeded; if a row is
  -- somehow absent, skip the grant rather than RAISE (raising would abort the GoTrue
  -- auth.users write and brick login). ON CONFLICT does NOT swallow an FK violation,
  -- hence the explicit lookup + guard.
  select id into v_role_id from academy.roles where key = v_inv.role_key;
  if v_role_id is not null then
    insert into academy.user_roles (user_id, role_id, org_id)
    values (new.id, v_role_id, v_inv.org_id)
    on conflict (user_id, role_id, org_id) do nothing;
  end if;

  -- Consume the invite (audit: who/when).
  update academy.user_invitations
     set status = 'accepted', consumed_at = now(), consumed_user_id = new.id, updated_at = now()
   where id = v_inv.id;

  return new;
end;
$$;
comment on function academy.handle_new_auth_user() is
  'F3c new-user provisioning. On a NEW auth.users row whose email is CONFIRMED, links an academy.users profile + a capped operational role from the newest open, unexpired academy.user_invitations row matching the email (case-insensitive), and consumes that invite. org_id comes ONLY from the invite (tenant boundary). No invite => no profile (pending_provisioning). SECURITY DEFINER + pinned search_path; idempotent (skips if a profile exists); never RAISEs (so it cannot abort the GoTrue auth.users write).';

-- GoTrue (supabase_auth_admin) performs the auth.users write that fires the trigger.
grant execute on function academy.handle_new_auth_user() to supabase_auth_admin;

-- ---- 6. Triggers on auth.users (NULL -> NOT NULL email-confirm transition) ----
-- Two triggers so the UPDATE one can gate on OLD (a combined INSERT-OR-UPDATE WHEN
-- cannot reference OLD). INSERT covers magic-link/OTP/SSO (auth.users created already
-- confirmed); UPDATE OF email_confirmed_at covers password signup confirming later.
-- The function's "profile already exists" guard is the idempotency safety net.
-- drop-if-exists makes the migration safe to re-apply.
drop trigger if exists on_auth_user_confirmed_insert on auth.users;
create trigger on_auth_user_confirmed_insert
  after insert on auth.users
  for each row
  when (new.email_confirmed_at is not null)
  execute function academy.handle_new_auth_user();

drop trigger if exists on_auth_user_confirmed_update on auth.users;
create trigger on_auth_user_confirmed_update
  after update of email_confirmed_at on auth.users
  for each row
  when (new.email_confirmed_at is not null and old.email_confirmed_at is null)
  execute function academy.handle_new_auth_user();

commit;
