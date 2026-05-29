-- ============================================================================
-- <ts>_custom_access_token_hook.sql  (F3)
-- The Supabase Auth Hook that MINTS the custom JWT claims F2's RLS helpers read.
-- Registered with GoTrue via supabase/config.toml:
--   [auth.hook.custom_access_token]
--   enabled = true
--   uri = "pg-functions://postgres/academy/custom_access_token_hook"
-- GoTrue calls it as supabase_auth_admin on every access-token mint/refresh.
--
-- It mints exactly the shape the 0001 helpers consume (do NOT change the helpers):
--   * academy.current_org_id()  reads top-level  claims ->> 'org_id'  (uuid text)
--   * academy.current_user_id() reads top-level  claims ->> 'sub'     (GoTrue sets this)
--   * academy.jwt_has_role()    reads top-level  claims -> 'roles'    (a JSON ARRAY)
-- Plus persona (UI), evaluator_authorized (bool) + domains (array) for M6/M11.
--
-- SECURITY: SECURITY DEFINER with a PINNED search_path so it reads academy.*
-- (owner bypasses RLS); EXECUTE granted to supabase_auth_admin ONLY and REVOKEd
-- from public/anon/authenticated — granting it to a user role would be a
-- claim-forgery hole. The only input it trusts is GoTrue's event.user_id.
-- ============================================================================

begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin noinherit;
  end if;
end $$;

create or replace function academy.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = academy, pg_temp
as $$
declare
  v_user_id          uuid    := nullif(event ->> 'user_id', '')::uuid;
  v_claims           jsonb   := coalesce(event -> 'claims', '{}'::jsonb);
  v_org_id           uuid;
  v_persona          text;
  v_roles            jsonb;
  v_eval_authorized  boolean;
  v_domains          jsonb;
begin
  if v_user_id is null then
    return event;  -- nothing to enrich; never fail the token mint
  end if;

  -- Tenant + persona from the profile row (id = auth.users.id).
  select u.org_id, u.persona::text
    into v_org_id, v_persona
  from academy.users u
  where u.id = v_user_id;

  -- roles as a JSON ARRAY (jwt_has_role intersects jsonb_array_elements_text(-> 'roles')).
  select coalesce(jsonb_agg(distinct r.key::text order by r.key::text), '[]'::jsonb)
    into v_roles
  from academy.user_roles ur
  join academy.roles r on r.id = ur.role_id
  where ur.user_id = v_user_id;

  -- Evaluator authority: authorized iff a non-expired 'authorized' row exists;
  -- domains = union of the domain[] arrays across such rows.
  select
    coalesce(bool_or(true), false),
    coalesce(jsonb_agg(distinct d order by d) filter (where d is not null), '[]'::jsonb)
  into v_eval_authorized, v_domains
  from academy.evaluator_authorizations ea
  left join lateral unnest(ea.domains) as d on true
  where ea.user_id = v_user_id
    and ea.status = 'authorized'
    and (ea.expires_at is null or ea.expires_at > now());

  -- Merge TOP-LEVEL claims (F2 helpers read top-level org_id / roles).
  v_claims := v_claims
    || jsonb_build_object('roles', coalesce(v_roles, '[]'::jsonb))
    || jsonb_build_object('evaluator_authorized', coalesce(v_eval_authorized, false))
    || jsonb_build_object('domains', coalesce(v_domains, '[]'::jsonb));

  if v_org_id is not null then
    v_claims := v_claims || jsonb_build_object('org_id', v_org_id::text);
  end if;
  if v_persona is not null then
    v_claims := v_claims || jsonb_build_object('persona', v_persona);
  end if;

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

comment on function academy.custom_access_token_hook(jsonb) is
  'Supabase custom_access_token_hook (F3). Mints top-level JWT claims org_id (uuid text), roles (JSON array), persona, evaluator_authorized (bool), domains (array) from academy.users/user_roles/roles/evaluator_authorizations — exactly the shape the 0001 RLS helpers read. SECURITY DEFINER + pinned search_path; EXECUTE granted to supabase_auth_admin ONLY (never anon/authenticated/public). Re-mints on every token mint/refresh, so a role/authorization change takes effect on the next token.';

-- GoTrue calls this hook as supabase_auth_admin. Lock execution to it ONLY.
grant usage on schema academy to supabase_auth_admin;
grant execute on function academy.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function academy.custom_access_token_hook(jsonb) from public;
revoke execute on function academy.custom_access_token_hook(jsonb) from anon;
revoke execute on function academy.custom_access_token_hook(jsonb) from authenticated;

commit;
