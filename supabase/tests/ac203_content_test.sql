-- ============================================================================
-- tests/ac203_content_test.sql — AC-203 (the flagship) content acceptance test.
--
-- Runs AFTER supabase/migrations/* + supabase/seed/0001 + 0002 + 0003 (the CI
-- `slice-seed` job). Independent, name-level regression check of the AC-203
-- ingestion contract M6/M7 + the learner UI build against: the knowledge-check unit,
-- the 12 authored items (safety/non-safety split), the §5.4 rubric swap (fire-alarm
-- line removed, armature-seal critical line added — still 12 lines / 7 critical so the
-- veto set never shrank, Inv. 1), the 6 published AC-203 sims, and that the re-centered
-- egress branching sim no longer references the fire-alarm release. RAISEs on failure.
--
-- Run: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f tests/ac203_content_test.sql
-- ============================================================================
do $$
declare
  cv   uuid := '000000c2-0000-0000-0000-00000000000e';  -- AC-203 course_version 1.0.0
  crs  uuid := '000000c1-0000-0000-0000-00000000000e';  -- AC-203 course
  k    text;
  branch_spec jsonb;
begin
  -- 1. The knowledge-check UNIT (M2 grader resolves items by course_version_id).
  if (select count(*) from academy.units where course_version_id = cv and kind = 'knowledge_check') <> 1
    then raise exception 'AC-203 must have exactly one knowledge_check unit'; end if;
  if (select content_ref->>'placeholder' from academy.units
        where id = '000000c3-000e-0000-0000-000000000001') is not null
    then raise exception 'AC-203 u1 lesson is still a placeholder'; end if;
  -- u3 build re-tagged off the unbuilt webgl_install engine onto device_config.
  if (select content_ref->>'engine' from academy.units
        where id = '000000c3-000e-0000-0000-000000000003') <> 'device_config'
    then raise exception 'AC-203 u3 build is not device_config'; end if;

  -- 2. The 12 authored knowledge-check items, with BOTH mastery bars exercised.
  if (select count(*) from academy.assessment_items where course_version_id = cv) <> 12
    then raise exception 'AC-203 assessment_items <> 12'; end if;
  if (select count(*) from academy.assessment_items where course_version_id = cv and is_safety_item) <> 9
    then raise exception 'AC-203 safety items <> 9'; end if;
  if (select count(*) from academy.assessment_items where course_version_id = cv and not is_safety_item) <> 3
    then raise exception 'AC-203 non-safety items <> 3 (the 80%% bar would be vacuous)'; end if;
  -- No placeholder answer_keys survive (placeholders grade as wrong → KC unwinnable).
  if exists (select 1 from academy.assessment_items
        where course_version_id = cv and answer_key ? 'placeholder')
    then raise exception 'AC-203 has a placeholder answer_key (ungradable)'; end if;
  if exists (select 1 from academy.assessment_items
        where course_version_id = cv and (answer_key->'correct') is null)
    then raise exception 'AC-203 item missing a gradable correct answer'; end if;

  -- 3. §5.4 rubric swap — fire-alarm gone, armature critical line in, 12/7 preserved.
  if exists (select 1 from academy.signoff_line_item_templates
        where course_id = crs and line_item_key = 'ac203.release_on_fire_alarm')
    then raise exception 'AC-203 fire-alarm-release rubric line was not removed'; end if;
  if not exists (select 1 from academy.signoff_line_item_templates
        where course_id = crs and line_item_key = 'ac203.armature_sealed_pull_test'
          and is_critical_safety and dimension = 'safety_compliance')
    then raise exception 'AC-203 armature-seal critical line missing/not safety_compliance'; end if;
  if (select count(*) from academy.signoff_line_item_templates where course_id = crs) <> 12
    then raise exception 'AC-203 rubric lines <> 12'; end if;
  if (select count(*) from academy.signoff_line_item_templates where course_id = crs and is_critical_safety) <> 7
    then raise exception 'AC-203 critical-safety rubric lines <> 7 (the veto set shrank!)'; end if;

  -- 4. The 6 AC-203 sims are published (4 new 2D + the device-config build + branching).
  if (select count(*) from academy.sim_definitions where key like 'ac-203/%' and status = 'published') <> 6
    then raise exception 'AC-203 published sim_definitions <> 6'; end if;
  foreach k in array array[
      'ac-203/mag-vs-strike-pick','ac-203/armature-mount','ac-203/button-placement',
      'ac-203/follow-the-power','ac-203/virtual-door-maglock']
  loop
    if not exists (select 1 from academy.sim_definitions where key = k and status = 'published')
      then raise exception 'AC-203 sim % missing', k; end if;
  end loop;

  -- 5. The re-centered egress branching sim no longer scores the fire-alarm release,
  --    and now maps its climax to the push-to-exit release key (Inv.1 veto mapping).
  select spec into branch_spec from academy.sim_definitions where key = 'ac-203/egress-compliant';
  if branch_spec::text like '%release_on_fire_alarm%'
    then raise exception 'AC-203 branching sim still references ac203.release_on_fire_alarm'; end if;
  if branch_spec::text not like '%push_to_exit_30s%'
    then raise exception 'AC-203 branching sim lost its push-to-exit release mapping'; end if;

  raise notice 'AC-203 content OK: 1 KC unit / 12 items (9 safety + 3 non-safety, gradable) / 6 published sims / 12 rubric lines (7 critical; fire-alarm→armature) / branching re-centered.';
end $$;
