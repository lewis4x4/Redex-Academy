-- ============================================================================
-- tests/s1_slice_seed_test.sql — S1 MVP-slice seed acceptance test.
--
-- Runs AFTER supabase/migrations/* AND supabase/seed/0001_mvp_slice_seed.sql are
-- applied (the CI `slice-seed` job). Asserts the slice DATA CONTRACT that M1/M2/
-- M6/M7 build against (invariant 5): exact row counts, the §D closure edges, the
-- 7 AC-203 ⚠ critical-safety line-item keys by NAME (these feed M6's veto), the
-- stackable AC tier credential's `requires`, and that the prereq graph is a DAG.
-- The seed's own §8 block self-asserts on apply; this is the independent,
-- name-level regression check. Read-only: RAISEs EXCEPTION on any failure.
--
-- Run: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f tests/s1_slice_seed_test.sql
-- ============================================================================
do $$
declare
  n int;
  v_badges jsonb;
begin
  -- 1. Exact row counts (the slice data contract — S1_DRY_RUN §4, seed-authoritative).
  --    NOTE: units=45 / unit_competencies=46 — the authored seed evolved +3 past the
  --    S1_DRY_RUN doc's 42/43; the seed is authoritative ("apply, don't rewrite").
  perform 1;
  if (select count(*) from academy.orgs) <> 2 then raise exception 'orgs <> 2'; end if;
  if (select count(*) from academy.competencies) <> 15 then raise exception 'competencies <> 15'; end if;
  if (select count(*) from academy.courses) <> 14 then raise exception 'courses <> 14'; end if;
  if (select count(*) from academy.courses where status <> 'published') <> 0
    then raise exception 'not all 14 courses are published'; end if;
  if (select count(*) from academy.course_versions) <> 14 then raise exception 'course_versions <> 14'; end if;
  if (select count(*) from academy.course_versions where status='published') <> 14
    then raise exception 'published course_versions <> 14'; end if;
  if (select count(*) from academy.units) <> 45 then raise exception 'units <> 45'; end if;
  if (select count(*) from academy.unit_competencies) <> 46 then raise exception 'unit_competencies <> 46'; end if;
  if (select count(*) from academy.course_prerequisites) <> 24 then raise exception 'course_prerequisites <> 24'; end if;
  if (select count(*) from academy.course_platform_dependencies) <> 7 then raise exception 'course_platform_dependencies <> 7'; end if;
  if (select count(*) from academy.assessment_items) <> 30 then raise exception 'assessment_items <> 30'; end if;
  if (select count(*) from academy.badge_classes) <> 4 then raise exception 'badge_classes <> 4'; end if;
  if (select count(*) from academy.badge_classes where kind='skill') <> 3 then raise exception 'skill badges <> 3'; end if;
  if (select count(*) from academy.badge_classes where kind='tier') <> 1 then raise exception 'tier badges <> 1'; end if;
  if (select count(*) from academy.signoff_line_item_templates) <> 29 then raise exception 'signoff_line_item_templates <> 29'; end if;

  -- 2. The four ledger-§D closure edges (child <- requires), by course CODE.
  for n in
    select 1 from (values
      ('AC-201','ADC-201'), ('AC-203','AC-202'), ('ADC-201','ADC-102'), ('ADC-201','INT-101')
    ) as e(child, req)
    where not exists (
      select 1 from academy.course_prerequisites p
        join academy.courses c  on c.id  = p.course_id          and c.code  = e.child
        join academy.courses rc on rc.id = p.requires_course_id  and rc.code = e.req)
  loop
    raise exception 'missing a §D closure prerequisite edge';
  end loop;

  -- 3. AC-203's 7 ⚠ critical-safety line-item keys by NAME (these feed M6's veto).
  for n in
    select 1 from unnest(array[
      'ac203.release_on_power_loss','ac203.push_to_exit_30s','ac203.release_on_fire_alarm',
      'ac203.pte_mount_40_48in_5ft','ac203.no_maglock_defeat_fire_latch',
      'ac203.emergency_lighting_present','ac203.ahj_confirmed']) k(key)
    where not exists (
      select 1 from academy.signoff_line_item_templates t
      where t.line_item_key = k.key and t.is_critical_safety)
  loop
    raise exception 'missing an AC-203 critical-safety template key';
  end loop;
  if (select count(*) from academy.signoff_line_item_templates
        where course_id = (select id from academy.courses where code='AC-203')) <> 12
    then raise exception 'AC-203 template rows <> 12'; end if;
  if (select count(*) from academy.signoff_line_item_templates
        where course_id = (select id from academy.courses where code='AC-203') and is_critical_safety) <> 7
    then raise exception 'AC-203 critical-safety template rows <> 7'; end if;

  -- 4. The stackable AC tier credential.
  select requires->'badges' into v_badges from academy.badge_classes where key='tier.ac.certified_technician';
  if v_badges is null then raise exception 'tier.ac.certified_technician missing'; end if;
  if not (v_badges ? 'skill.ac.single_door_aero'
      and v_badges ? 'skill.ac.mercury_wiring'
      and v_badges ? 'skill.ac.maglock_rex_egress')
    then raise exception 'tier requires[] missing a component skill badge'; end if;
  if (select requires->>'auto_issue' from academy.badge_classes where key='tier.ac.certified_technician')
       <> 'all_components_field_proven'
    then raise exception 'tier auto_issue rule wrong'; end if;
  if (select recert_months from academy.badge_classes where key='tier.ac.certified_technician') <> 12
    then raise exception 'tier recert_months <> 12'; end if;
  if not (select is_compliance from academy.badge_classes where key='tier.ac.certified_technician')
    then raise exception 'tier is_compliance not true'; end if;

  -- 5. The egress safety competency is flagged (the slice's keystone safety competency).
  if not (select is_safety_critical from academy.competencies where code='EGRESS.MAGLOCK_FAILSAFE')
    then raise exception 'EGRESS.MAGLOCK_FAILSAFE not is_safety_critical'; end if;
  if (select count(*) from academy.competencies where is_safety_critical) <> 6
    then raise exception 'expected 6 safety-critical competencies'; end if;

  -- 6. The prerequisite graph is a DAG (the un-shippable guard).
  if not academy.prereq_graph_is_dag() then raise exception 'course_prerequisites is NOT a DAG'; end if;

  raise notice 'S1 acceptance OK: 14 courses / 14 versions / 24 prereqs (4 closure) / 29 rubric templates (AC-203 7 critical-safety) / AC tier stacked / DAG.';
end $$;
