-- M1 — Prerequisite-gating resolver (server-authoritative).
--
-- The skill-tree / Constellation home resolves every course node to a gating
-- state for the CURRENT learner. This is computed in the database (a view over
-- pure functions), never on the client: the client cannot fake a node's state,
-- and RLS keeps the per-user inputs (competency_state, enrollments, credentials)
-- own-row only. Two prereq kinds are honored (M1 §1):
--   1. course-edge `hard_gate` prereqs (academy.course_prerequisites)
--   2. credential-held prereqs (academy.course_credential_prerequisites — added
--      here — the "Certified Technician — AC"-style aggregate gate the schema
--      comment on course_prerequisites refers to: modeled as a credential prereq,
--      not a single course edge).
--
-- Invariants: Inv. 2 (client never writes competency_state — no policy exists;
-- gating is read-only derived), Inv. 3 (RLS: published catalog cross-tenant,
-- personal inputs own-row), Inv. 5 (consumes the seeded catalog/badge shapes —
-- invents none). Applies cleanly on bare postgres:16 (db-invariants CI).

-- ── Node state (mirrors @redex/ui ConstellationNodeState; 'boss' is a UI overlay
-- for hard-gate capstones, derived in the client, not a resolver state). ───────
create type academy.course_gating_state as enum (
  'locked', 'available', 'in_progress', 'passed', 'mastered'
);

-- ── Credential-as-prerequisite edges (ledger §D; the aggregate-gate model the
-- course_prerequisites comment defers to). A course can require the learner to
-- HOLD a credential (e.g. an AC-301-style course gated on the "Certified
-- Technician — Access Control" tier credential). Catalog-like: globally readable,
-- service-role authored (no end-user write policy). ──────────────────────────
create table academy.course_credential_prerequisites (
  course_id              uuid not null references academy.courses(id) on delete cascade,
  requires_badge_class_id uuid not null references academy.badge_classes(id) on delete restrict,
  created_at             timestamptz not null default now(),
  primary key (course_id, requires_badge_class_id)
);
comment on table academy.course_credential_prerequisites is
  'Credential-held prerequisites: a course unlocks only once the learner holds the named badge_class credential. The aggregate ("Certified Technician — AC") gate the course_prerequisites comment defers to. Resolved by academy.resolve_course_gating via academy.holds_credential.';

alter table academy.course_credential_prerequisites enable row level security;
alter table academy.course_credential_prerequisites force row level security;
create policy course_credential_prereq_select_all on academy.course_credential_prerequisites
  for select using (true);  -- global catalog edge (no PII); writes are service-role only

-- ── holds_credential: does the user hold an ACTIVE credential for this badge? ──
create or replace function academy.holds_credential(p_user_id uuid, p_badge_class_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from academy.credentials cr
    where cr.recipient_user_id = p_user_id
      and cr.badge_class_id    = p_badge_class_id
      and cr.status            = 'active'
  )
$$;
comment on function academy.holds_credential(uuid, uuid) is
  'True if the user holds an active credential for the given badge_class. RLS-scoped: only resolves for the calling user (credentials_select_own).';

-- ── course_is_cleared: has the user PASSED a course (its skill is held)? Cleared
-- = enrollment completed OR any granted competency is sim_passed/field_proven.
-- "Granted competencies" = the active course version's units' primary competency.
create or replace function academy.course_is_cleared(p_user_id uuid, p_course_id uuid)
returns boolean
language sql
stable
as $$
  select
    exists (
      select 1 from academy.enrollments e
      where e.user_id = p_user_id and e.course_id = p_course_id
        and e.status = 'completed'
    )
    or exists (
      select 1
      from academy.courses c
      join academy.course_versions cv on cv.id = c.active_version_id
      join academy.units u            on u.course_version_id = cv.id
      join academy.competency_state cs on cs.competency_id = u.competency_id
      where c.id = p_course_id
        and cs.user_id = p_user_id
        and cs.status in ('sim_passed', 'field_proven')
    )
$$;
comment on function academy.course_is_cleared(uuid, uuid) is
  'True if the user has passed the course (enrollment completed, or a granted competency is sim_passed/field_proven). Used for prerequisite satisfaction.';

-- ── course_is_mastered: a granted competency is field_proven (Evaluator-signed). ─
create or replace function academy.course_is_mastered(p_user_id uuid, p_course_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from academy.courses c
    join academy.course_versions cv on cv.id = c.active_version_id
    join academy.units u            on u.course_version_id = cv.id
    join academy.competency_state cs on cs.competency_id = u.competency_id
    where c.id = p_course_id
      and cs.user_id = p_user_id
      and cs.status = 'field_proven'
  )
$$;
comment on function academy.course_is_mastered(uuid, uuid) is
  'True if a competency granted by the course is field_proven (post Evaluator sign-off).';

-- ── resolve_course_gating: the server-authoritative node-state resolver. ──────
-- Order of precedence: mastered > passed > in_progress > available > locked.
-- available REQUIRES every hard_gate course prereq cleared AND every credential
-- prereq held. Soft prereqs are advisory and never gate (kind <> 'hard_gate').
create or replace function academy.resolve_course_gating(p_user_id uuid, p_course_id uuid)
returns academy.course_gating_state
language sql
stable
as $$
  select case
    when academy.course_is_mastered(p_user_id, p_course_id) then 'mastered'::academy.course_gating_state
    when academy.course_is_cleared(p_user_id, p_course_id)  then 'passed'::academy.course_gating_state
    when exists (
      select 1 from academy.enrollments e
      where e.user_id = p_user_id and e.course_id = p_course_id
        and e.status = 'in_progress'
    ) then 'in_progress'::academy.course_gating_state
    when
      -- every hard_gate course prerequisite is cleared …
      not exists (
        select 1 from academy.course_prerequisites pr
        where pr.course_id = p_course_id
          and pr.kind = 'hard_gate'
          and not academy.course_is_cleared(p_user_id, pr.requires_course_id)
      )
      -- … and every credential prerequisite is held.
      and not exists (
        select 1 from academy.course_credential_prerequisites cpr
        where cpr.course_id = p_course_id
          and not academy.holds_credential(p_user_id, cpr.requires_badge_class_id)
      )
      then 'available'::academy.course_gating_state
    else 'locked'::academy.course_gating_state
  end
$$;
comment on function academy.resolve_course_gating(uuid, uuid) is
  'Server-authoritative skill-tree node state for (user, course): mastered > passed > in_progress > available > locked. available needs all hard_gate course prereqs cleared AND all credential prereqs held. RLS-scoped to the calling user.';

-- ── my_course_gating: the client contract. One row per published course with the
-- CURRENT learner''s gating state. security_invoker so RLS (courses=published,
-- competency_state/enrollments/credentials=own-row) applies to the caller. ─────
create view academy.my_course_gating
with (security_invoker = true)
as
  select
    c.id            as course_id,
    c.code,
    c.title,
    c.domain,
    c.tier,
    c.personas,
    academy.resolve_course_gating(academy.current_user_id(), c.id) as gating_state
  from academy.courses c
  where c.status = 'published';
comment on view academy.my_course_gating is
  'Per-course gating state for the current learner (the M1 skill-tree/Constellation data contract). Computed server-side; the client only reads it. anon/unauthenticated sees published catalog with roots available and gated courses locked.';

grant select on academy.my_course_gating to anon, authenticated;
