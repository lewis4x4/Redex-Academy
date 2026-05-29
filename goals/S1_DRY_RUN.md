# S1 — Dry-Run: Expected Output & Human-Verify Checklist

A known-good target for the **MVP-slice catalog seed** run. Read this before running `/goal S1`, then check the result against §4–§6. If anything in §6 (Red Flags) appears, reject the run and re-prompt.

- **Goal:** apply the authored seed `seed/0001_mvp_slice_seed.sql` to the `academy` schema — the 14-course Access-Control-through-egress slice (2 orgs, 15 competencies, 14 courses, 14 published versions, 42 units, 24 prereq edges, 30 assessment_items, 4 badge_classes), the AC-201/202/203 §5.4 line-item templates (**29 rows in `academy.signoff_line_item_templates`**), and the slice badge stack — and prove the prerequisite graph stays a DAG.
- **Tier:** ultracode. (Content-as-data; the heavy adversarial lifting was F2. Pairing with auto mode is optional.)
- **Depends on:** **F2** merged (the `academy` schema + the DAG check + `0003_signoff_line_item_templates.sql`, which must be applied before this seed — the seed INSERTs into that table) and **F2a** merged (the `workos` stub — S1 itself seeds no jobs, but S1 is the contract M6's job-linked sign-off path consumes, so F2a should already be in).
- **Human gate:** none HARD for S1 (no safety/credential boundary is *enforced* here). But the AC-203 critical-safety line-item **data** seeded here feeds M6's veto — eyeball the 7 ⚠ keys (§5).

---

## 1. The `/goal` invocation to give Claude Code
> Run goal S1 per `goals/S1.md`. The authoritative seed already exists at `seed/0001_mvp_slice_seed.sql` (+ `SEED_NOTES.md`); it was authored against the F2 contract `migrations/0001_init_academy.sql` (+ `0003_signoff_line_item_templates.sql`). **Apply it — do not rewrite it or invent catalog/badge/line-item shapes** (invariant 5 — this seed *is* the contract M1/M2/M6/M7 build against). If the seed and the schema disagree on any column/enum/key, STOP and surface the diff; do not paper over it. Out of scope: the other 5 domains / 63 courses, the gating resolver (M1), sign-off finalize (M6), badge issuance (M7) — S1 only supplies the data those consume. The former **[SCHEMA GAP]** is RESOLVED: the AC-201/202/203 §5.4 rubrics are seeded as first-class rows in `academy.signoff_line_item_templates` (the canonical table, `0003` — apply it before the seed); each `signoff_prep` unit `content_ref` carries only a short pointer at that table (SEED_NOTES §4). Do **not** insert standalone `signoff_line_items` rows (those FK a live `signoffs` row).

## 2. Expected repo changes (the file tree S1 should produce)
```
supabase/
  seed/
    0001_mvp_slice_seed.sql       # = seed/0001_mvp_slice_seed.sql, copied verbatim
  config.toml                     # [db.seed] enabled; the seed path registered (if not already)
```
Nothing else. No new migration in S1 (S1 is data, not DDL). No `apps/`/feature code. **`0003_signoff_line_item_templates.sql` is an F2 migration, NOT written in S1** — it must already be applied (in F2, before this seed) because the seed INSERTs the rubric rows into `academy.signoff_line_item_templates`. S1 does not author or alter any schema, so no `gen types` re-run here and `packages/db-types/database.types.ts` is untouched (the template table's type was generated when `0003` landed in F2).

## 3. Commands it should run
```bash
supabase start                                   # local stack (F2 migrations incl. 0003 + F2a already applied)
cp seed/0001_mvp_slice_seed.sql supabase/seed/
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed/0001_mvp_slice_seed.sql   # apply once
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed/0001_mvp_slice_seed.sql   # apply AGAIN — idempotency proof
psql "$SUPABASE_DB_URL" -c "select academy.prereq_graph_is_dag();"                    # expect: t
```
(`SUPABASE_DB_URL` points at the local stack. The seed must be run as the DB owner / migration role — RLS is FORCEd on these tables; it is NOT run under a tenant JWT. The seed's own §8 `do $$ … $$` block self-asserts; running the test suite `tests/0001_invariants_test.sql` afterward is a bonus regression check.)

## 4. Expected RESULT signals (acceptance evidence)
- The seed applies cleanly and ends with the notice: **`S1 MVP-slice seed OK: 14 courses / 14 versions / closure edges present / rubric templates seeded (AC-201=9, AC-202=8, AC-203=12 incl. 7 critical-safety) / AC tier credential stacked / prereq graph is a DAG.`**
- **Exact row counts** (`select count(*)` per table after the seed):

  | Table | Count |
  |---|---|
  | `academy.orgs` | **2** (`Redex` + `CCS Partner (demo)`) |
  | `academy.competencies` | **15** |
  | `academy.courses` | **14** (all `status='published'`) |
  | `academy.course_versions` | **14** (one `1.0.0` published each; `active_version_id` wired) |
  | `academy.units` | **42** |
  | `academy.unit_competencies` | **43** (primary maps + the AC-102 `Spec the Door` → fail-state cross-map) |
  | `academy.course_prerequisites` | **24** |
  | `academy.course_platform_dependencies` | **7** |
  | `academy.assessment_items` | **30** |
  | `academy.badge_classes` | **4** (3 skill + 1 tier) |
  | `academy.signoff_line_item_templates` | **29** (AC-201 **9** + AC-202 **8** + AC-203 **12**; 7 of the AC-203 lines `is_critical_safety=true`) |

- **`academy.prereq_graph_is_dag()` returns `t`** and `academy.check_prereq_dag()` returns **zero rows**.
- **The two ledger-§D closure edges are present** (plus the two ADC-201 reachability edges): `AC-201 ← ADC-201`, `AC-203 ← AC-202`, `ADC-201 ← ADC-102`, `ADC-201 ← INT-101` (the seed's §8 asserts exactly these 4).
- **AC-203's rubric in `academy.signoff_line_item_templates`** (`course_id = 000000c1-0000-0000-0000-00000000000e`) has **12** rows, **7** of them `is_critical_safety=true`. (AC-203's `signoff_prep` unit `content_ref` is now just `{"signoff_rubric_template_ref":"academy.signoff_line_item_templates","course":"AC-203", …}` — a pointer, not the line items.)
- **`tier.ac.certified_technician.requires.badges`** = `["skill.ac.single_door_aero","skill.ac.mercury_wiring","skill.ac.maglock_rex_egress"]` with `auto_issue:"all_components_field_proven"`.
- **Idempotent re-run is a NO-OP:** the second `psql` run prints the same `S1 MVP-slice seed OK` notice, throws no error, and the counts above are unchanged (every INSERT is `ON CONFLICT (<natural key>) DO NOTHING`; the `active_version_id` patch only fires when null).

## 5. HUMAN-VERIFY checklist (you, before merge)
- [ ] **Seed applied + idempotent on a live Postgres** (not parse-only): two consecutive `psql … -f` runs both end `S1 MVP-slice seed OK …` with identical counts.
- [ ] **The 7 AC-203 ⚠ critical-safety keys** are present and flagged `is_critical_safety=true` in the AC-203 rows of `academy.signoff_line_item_templates` (these feed M6's safety veto — get them right): `ac203.release_on_power_loss`, `ac203.push_to_exit_30s`, `ac203.release_on_fire_alarm`, `ac203.pte_mount_40_48in_5ft`, `ac203.no_maglock_defeat_fire_latch`, `ac203.emergency_lighting_present`, `ac203.ahj_confirmed`. The 5 non-safety AC-203 lines are `is_critical_safety=false`.
- [ ] **`is_safety_critical=true`** on the 6 safety competencies: `FND.FIELD_SAFETY`, `AC.FAILSTATE_JUDGMENT`, `EGRESS.NFPA101_AWARENESS`, `AC.AERO_SINGLE_DOOR`, `AC.MERCURY_WIRING`, `EGRESS.MAGLOCK_FAILSAFE` (all `mastery_threshold=0.90`); the other 9 are `false`/`0.80`.
- [ ] **`is_safety_item=true`** on the gate-bearing assessment items: all AC-102 fail-state items, all AC-103 egress items, the AC-201/AC-202 fail-state/lock-power items, all AC-203 egress items, and the FND-102 safety items.
- [ ] **DAG is acyclic** (`prereq_graph_is_dag()` → `t`) — re-confirm by eye that no edge points "forward" against the topo order `FND-101 → INT-101 → FND-102 → FND-103 → ADC-101 → ADC-102 → ADC-201 → AC-101 → AC-102 → AC-103 → AC-201 → AC-202 → AC-203`.
- [ ] **AC-203's rubric-template location is understood:** it lives in `academy.signoff_line_item_templates` (the canonical table, `0003` — the resolved [SCHEMA GAP]), NOT in `signoff_line_items` (scored instances) and no longer inline in `content_ref` (now just a pointer). Confirm SEED_NOTES §4 records this so M6's author reads the template from the table.
- [ ] **The AC tier credential** `tier.ac.certified_technician` exists, `kind='tier'`, `requires.badges` = the three slice skill badges, `recert_months=12`, `is_compliance=true`.

## 6. RED FLAGS — reject the run if you see any of these
- **A cycle in `course_prerequisites`** — `prereq_graph_is_dag()` returns `f` / `check_prereq_dag()` returns rows. The seed must be un-shippable until acyclic (this is the guard that makes the ADC-201-class bug un-shippable).
- **The closure edges missing:** no `AC-201 ← ADC-201` edge, or no `AC-203 ← AC-202` edge (these are the two the ledger §D flagged as missing — their absence is the exact bug S1 exists to fix).
- **Safety competencies not flagged `is_safety_critical`** (e.g. `EGRESS.MAGLOCK_FAILSAFE` or `FND.FIELD_SAFETY` left `false`), or safety assessment items left `is_safety_item=false` — this would silently drop the ≥90% gate / weaken M6's veto data.
- The agent **rewrote the seed** (regenerated UUIDs with `gen_random_uuid()`, renamed keys, restructured templates) instead of applying the authored file — downstream FKs and M6/M7's contract break.
- **Standalone `signoff_line_items` rows seeded** — `signoff_line_items.signoff_id` is `NOT NULL` FK to a live sign-off; attempting this errors. The rubric **template** rows belong in `academy.signoff_line_item_templates` (the canonical `0003` table), seeded in section 7b; the `signoff_prep` `content_ref` holds only a pointer.
- **Re-run is NOT a no-op** — duplicate-key errors, doubled counts, or a missing `ON CONFLICT` clause. The seed must be re-runnable.
- Any course left `status` other than `published` (the catalog RLS would hide it), or `active_version_id` left null.
- **`0003_signoff_line_item_templates.sql` (re)written or altered during S1** — it is an **F2** migration (already merged, applied before this seed); S1 writes no DDL. S1 only INSERTs the template rows into the existing table. (Conversely, if `0003` is *missing* when the seed runs, the template INSERTs error — apply F2's `0003` first.)

## 7. Definition of Done (the merge gate)
All §4 signals present (the 11 exact counts incl. the 29 `signoff_line_item_templates` rows, the `S1 MVP-slice seed OK` notice, DAG `t`, the closure edges, the AC-201/202/203 rubric templates in the canonical table, the tier `requires`) · idempotent re-run proven · all §5 human checks ticked · GOALS_INDEX status for S1 → done. Only then are M1/M2/M6/M7 unblocked on real slice data.

---
*Known nit to enforce during the run: do NOT run the seed under a tenant JWT — RLS is `FORCE`d on these catalog tables (incl. `signoff_line_item_templates`); it must run as the DB owner / migration role (the same role that ran `0001`/`0003`). Catalog `SELECT` becomes public later via the published-status RLS policies (the template table is SELECT-readable by `authenticated`). The AC-201/202/203 §5.4 line-item templates are content (definitions), not scored instances — they live as rows in `academy.signoff_line_item_templates` (the canonical `0003` table), and M6 materializes `signoff_line_items` rows from them at sign-off time.*
