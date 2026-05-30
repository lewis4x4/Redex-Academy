-- ============================================================================
-- <ts>_auth_users_fk.sql  (F3)
-- Execute the academy.users.id -> auth.users(id) FK that 0001_init_academy.sql
-- §17 DOCUMENTS but leaves un-executed (so 0001 runs on a bare CI Postgres
-- without the Supabase auth schema). F3 brings auth online, so add it now.
--
-- Identity (LOCKED, ledger §A): academy.users.id = auth.users.id — ONE identity
-- space, NO work_os_user_id. ON DELETE CASCADE: deleting the auth user removes
-- the academy profile.
--
-- BARE-CI SAFETY: on a real Supabase project auth.users + supabase_auth_admin
-- already exist (GoTrue) — the IF NOT EXISTS guards below are NO-OPS there and
-- never clobber the real objects. On a bare local/CI Postgres they create the
-- MINIMAL stubs the FK + the F3 auth hook need. (auth.users on Supabase is a
-- superset of this stub.)
-- ============================================================================

begin;

create schema if not exists auth;

-- Minimal auth.users for bare CI; on Supabase this is a no-op (it already exists
-- with the full GoTrue column set). The FK only needs the id PK.
create table if not exists auth.users (
  id uuid primary key
);

-- GoTrue's role (calls the F3 access-token hook). Present on Supabase; stub here.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin noinherit;
  end if;
end $$;

-- The 0001 §17 contract, executed: academy.users.id references auth.users(id).
-- DEFERRABLE INITIALLY DEFERRED: still fully enforced at COMMIT (ON DELETE CASCADE
-- unchanged), but the check is deferred to transaction end, so a single tx may
-- insert academy.users + auth.users in either order (and the committed, ROLLED-BACK
-- invariant/RLS test fixtures can seed academy.users without first seeding
-- auth.users). It does NOT weaken integrity for any real (committed) write.
-- [F3 NOTE: §17 documents the plain `on delete cascade` form; the DEFERRABLE
-- addition is a deliberate, prod-safe superset — review at the gate.]
alter table academy.users
  add constraint users_id_authusers_fk
  foreign key (id) references auth.users(id)
  on delete cascade
  deferrable initially deferred;

comment on constraint users_id_authusers_fk on academy.users is
  'Ledger §A: academy.users.id = auth.users.id (one identity space, no work_os_user_id). ON DELETE CASCADE, DEFERRABLE INITIALLY DEFERRED (enforced at commit; flexible insert order within a tx). Documented in 0001 §17, executed in F3 against the real auth schema.';

commit;
