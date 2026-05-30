-- ============================================================================
-- seed/<ts>_dev_identities.sql  (F3)
-- Dev identities across two orgs (1 Redex + 1 CCS partner) with assorted roles +
-- personas — the fixtures M12's CCS-isolation matrix logs in as. PII-FREE
-- (example.test emails, no real people).
--
-- LOCAL/DEV: self-contains auth.users stub rows (id only) so it applies on a bare
-- stack alongside the F3 auth-users FK. ON THE LIVE PROJECT, real dev identities
-- are created via the Auth Admin API (invite / SSO) — GoTrue owns auth.users; the
-- academy.* rows below link by id (the auth.users inserts are no-ops there via
-- ON CONFLICT once the ids exist). This is dev/test seed, not the S1 catalog seed.
-- ============================================================================

begin;

-- Role catalog (idempotent).
insert into academy.roles (key, label) values
  ('learner', 'Learner'), ('evaluator', 'Evaluator'), ('manager', 'Manager'),
  ('author', 'Author'), ('curriculum_admin', 'Curriculum Admin'),
  ('org_admin', 'Org Admin'), ('exec', 'Exec'), ('support', 'Support')
on conflict (key) do nothing;

-- Two tenants: Redex HQ + one CCS partner nested under it (shared catalog, isolated PII).
insert into academy.orgs (id, name, type, parent_org_id) values
  ('00000000-0000-0000-0000-0000000d0001', 'Redex (dev)', 'redex', null)
on conflict (id) do nothing;
insert into academy.orgs (id, name, type, parent_org_id) values
  ('00000000-0000-0000-0000-0000000d0002', 'CCS Partner (dev)', 'ccs_partner',
   '00000000-0000-0000-0000-0000000d0001')
on conflict (id) do nothing;

-- auth.users stubs (see header).
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000e0001'),
  ('00000000-0000-0000-0000-0000000e0002'),
  ('00000000-0000-0000-0000-0000000e0003'),
  ('00000000-0000-0000-0000-0000000e0004')
on conflict (id) do nothing;

-- Profiles: persona drives UI, roles (below) drive permissions.
insert into academy.users (id, org_id, display_name, email, persona) values
  ('00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-0000000d0001', 'Dev Evaluator (Redex)', 'eval.dev@example.test', 'priya'),
  ('00000000-0000-0000-0000-0000000e0002', '00000000-0000-0000-0000-0000000d0001', 'Dev Manager (Redex)',   'mgr.dev@example.test',  'dana'),
  ('00000000-0000-0000-0000-0000000e0003', '00000000-0000-0000-0000-0000000d0001', 'Dev Tech (Redex)',      'tech.dev@example.test', 'marco'),
  ('00000000-0000-0000-0000-0000000e0004', '00000000-0000-0000-0000-0000000d0002', 'Dev Tech (CCS)',        'tech.ccs@example.test', 'nova')
on conflict (id) do nothing;

-- Role grants (org-scoped).
insert into academy.user_roles (user_id, role_id, org_id)
select v.user_id, r.id, v.org_id
from (values
  ('00000000-0000-0000-0000-0000000e0001'::uuid, '00000000-0000-0000-0000-0000000d0001'::uuid, 'evaluator'),
  ('00000000-0000-0000-0000-0000000e0001'::uuid, '00000000-0000-0000-0000-0000000d0001'::uuid, 'learner'),
  ('00000000-0000-0000-0000-0000000e0002'::uuid, '00000000-0000-0000-0000-0000000d0001'::uuid, 'manager'),
  ('00000000-0000-0000-0000-0000000e0003'::uuid, '00000000-0000-0000-0000-0000000d0001'::uuid, 'learner'),
  ('00000000-0000-0000-0000-0000000e0004'::uuid, '00000000-0000-0000-0000-0000000d0002'::uuid, 'learner')
) as v(user_id, org_id, rolekey)
join academy.roles r on r.key = v.rolekey::academy.role_key
on conflict (user_id, role_id, org_id) do nothing;

-- The Redex evaluator is authorized in AC + SEC (drives evaluator_authorized/domains claims).
insert into academy.evaluator_authorizations (user_id, org_id, domains, status, source)
values ('00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-0000000d0001',
        array['AC', 'SEC']::academy.domain[], 'authorized', 'founding_bootstrap')
on conflict do nothing;

commit;
