# Redex Academy — S1 MVP-Slice Seed Notes

> Companion to `seed/0001_mvp_slice_seed.sql`. What the seed populates, the exact prerequisite DAG it lays down, how M1/M2/M6/M7 consume it, and how the AC-203 §5.4 line-item templates are stored — now **RESOLVED**: promoted to a first-class table `academy.signoff_line_item_templates` (migration `0003`). Source of truth for content: `course_bible_master.md`; reconciled with `wave4_decisions_ledger.md` §B/§C/§D and `goals/S1.md`. The binding schema is `migrations/0001_init_academy.sql` (+ `0003` for the rubric-template table) — the seed uses its **exact** table/column/enum names and invents nothing.

---

## 1. What's seeded (counts)

| Table | Rows | Notes |
|---|---|---|
| `academy.orgs` | 2 | `Redex` (`redex`) + `CCS Partner (demo)` (`ccs_partner`, `parent_org_id` → Redex) for the M12 isolation test. |
| `academy.competencies` | 15 | The atomic skills the 14 courses grant; `is_safety_critical=true` on the 6 egress/life-safety/fail-state/field-safety ones (see §3). |
| `academy.courses` | 14 | The exact MVP slice (ledger §D). All `status='published'`. |
| `academy.course_versions` | 14 | One published `1.0.0` per course; `platform_manifest` populated where relevant (Aero X1100, Mercury LP1501/LP1502, ADC portal, OSHA/NFPA/TIA standards). `courses.active_version_id` wired to each. |
| `academy.units` | 42 | 3–4 per course, mapped to the engine kinds (`unit.kind` + a `content_ref.engine` hint). AC-201/202/203 each carry a `signoff_prep` unit whose `content_ref` now holds only a short **pointer** at the §5.4 rubric-template table (the line items themselves live in `academy.signoff_line_item_templates` — see §4). |
| `academy.signoff_line_item_templates` | 29 | The §5.4 sign-off rubric line-item **templates** (CANONICAL; table added by `0003`): AC-201 **9**, AC-202 **8**, AC-203 **12** (incl. the 7 ⚠ critical-safety lines). M6 materializes `signoff_line_items` from these (see §4). |
| `academy.unit_competencies` | 43 | Each unit's primary competency + the AC-102 "Spec the Door" → fail-state-judgment cross-map. |
| `academy.course_prerequisites` | 24 | The full edge set incl. the ledger §D closure fixes; **verified acyclic** (see §2). |
| `academy.course_platform_dependencies` | 7 | Normalized manifest for §8 recert targeting (ADC portal, Aero, Mercury LP1501/LP1502, Securitron 1200s). |
| `academy.assessment_items` | 30 | Representative per course; `is_safety_item=true` on all AC-102 fail-state, AC-103 egress, AC-201/202 fail-state/lock-power, **all AC-203 egress**, and FND-102 safety items (the ≥90% gate, ledger §C). |
| `academy.badge_classes` | 4 | 3 skill badges (AC-201/202/203, one per signable competency) + the **Certified Technician — Access Control** tier credential with `requires` referencing the 3 skill badges. |

**Idempotency.** Every INSERT is `ON CONFLICT (<natural key>) DO NOTHING` (keys: `orgs.id`, `competencies.code`, `courses.code`, `course_versions(course_id,semver)`, `units(course_version_id,ordinal)`, `unit_competencies(unit_id,competency_id)`, `course_prerequisites(course_id,requires_course_id)`, `course_platform_dependencies(course_id,platform_key)`, `assessment_items.id`, `badge_classes.key`, `signoff_line_item_templates(course_id,line_item_key)`). The `active_version_id` patch only fires when null. **Re-running the seed yields identical row counts and never errors** (S1 done-criterion). Forward-only — never edit this file after merge; add a new seed.

**Stable UUIDs.** Deterministic literal UUIDs from a documented namespace scheme (header of the SQL): orgs `00000a60-…`, competencies `000000c0-…`, courses `000000c1-…`, course_versions `000000c2-…`, units `000000c3-CCCC-…-00UU`, assessment_items `000000a5-CCCC-…-00II`, badge_classes `000000b9-…`, signoff_line_item_templates `000000b1-CCCC-…-00LL` (CCCC=course slot, LL=line ordinal). No `gen_random_uuid()` for seeded rows, so FKs and downstream test fixtures are stable across every environment.

**Verification done (authoring sandbox — no live Postgres, per SCHEMA_NOTES §10):**
- Parses clean against **libpg_query** (PostgreSQL's own grammar) via `pglast`: **32 top-level statements, 28 INSERTs** (the +3 INSERTs over the original 25 are the AC-201/202/203 rubric-template blocks added for `0003`).
- Static semantic cross-check against `0001_init_academy.sql` (+ `0003`): every INSERT column exists on its table; every enum literal (`domain`, `tier`, `publish_status`, `org_type`, `persona`, `unit_kind`, `assessment_kind`, `badge_kind`, `prereq_kind`, `signoff_dimension`) is a valid value; all UUID literals well-formed hex (incl. the 29 new `000000b1-…` template-row UUIDs).
- All **152 `::jsonb` literals parse as valid JSON** (SQL apostrophe-escaping verified).
- Prereq graph: **24 edges / 14 nodes, acyclic** (mirrors `academy.check_prereq_dag()`).
- The SQL also embeds a **`do $$ … $$` post-seed assertion block** that raises if any of: 14 courses, 14 active published versions, the 4 closure edges, the rubric-template counts (AC-201=9 / AC-202=8 / AC-203=12 with exactly 7 ⚠ critical-safety lines, read from `academy.signoff_line_item_templates`), the AC tier `requires[]`, or **`academy.prereq_graph_is_dag()`** is wrong — so a live run fails loudly on any drift.
- **Pending live run** (apply against Supabase/Postgres after `0001`+`0002`): `psql -v ON_ERROR_STOP=1 -f seed/0001_mvp_slice_seed.sql` → expect the `S1 MVP-slice seed OK: …` notice. Run it twice to confirm idempotent counts.

---

## 2. The prerequisite DAG (the full edge set)

`child  ←  requires`  (`hard_gate` unless marked `soft`). All edges are within the 14-course slice; the graph is **acyclic** (confirmed; it will be run through `academy.check_prereq_dag()` / `prereq_graph_is_dag()` for the CI `dag:check`).

```
FND-101  (root; entry)
INT-101  (root; entry)
FND-102  ← FND-101
FND-103  ← FND-102
INT-102  ← INT-101
ADC-101  ← FND-101            [soft]   (bible prereq FND-104 is out-of-slice → soft on FND-101)
ADC-102  ← ADC-101
ADC-201  ← ADC-102, INT-101            (closure: ADC-101→102 makes ADC-201 reachable)
AC-101   ← FND-101
AC-101   ← FND-103            [soft]   (recommended alongside per the bible)
AC-102   ← AC-101
AC-103   ← AC-101, AC-102
AC-201   ← AC-101, AC-102, AC-103, FND-102, FND-103, ADC-201   ★ AC-201 ← ADC-201 (ledger §D closure)
AC-202   ← AC-201, FND-103
AC-203   ← AC-201, AC-202, AC-103, FND-102                     ★ AC-203 ← AC-202 (ledger §D closure)
```

★ = the two edges the ledger §D flagged as *missing* and that S1 must add. Also present per the §D closure note: `ADC-201 ← ADC-102` and `ADC-201 ← INT-101` (so ADC-201, and therefore AC-201, are reachable). Topo order (one valid linearization): `FND-101 → INT-101 → FND-102 → FND-103 → ADC-101 → ADC-102 → ADC-201 → AC-101 → AC-102 → AC-103 → AC-201 → AC-202 → AC-203`.

`kind` (`hard_gate` vs `soft`) is set per the bible: the two advisory/"recommended alongside" edges (`ADC-101←FND-101`, `AC-101←FND-103`) are `soft`; everything else — and **all egress/safety gating** — is `hard_gate`.

---

## 3. Competencies & the safety flags (ledger §C)

`is_safety_critical=true` (→ badge/recert logic; `mastery_threshold=0.90`) on:

- `FND.FIELD_SAFETY` (FND-102 hard safety gate),
- `AC.FAILSTATE_JUDGMENT` (fail-safe vs fail-locked — safety-adjacent; AC-102 items at ≥90%),
- `EGRESS.NFPA101_AWARENESS` (AC-103 egress awareness, ≥90% even at the awareness tier),
- `AC.AERO_SINGLE_DOOR`, `AC.MERCURY_WIRING` (Core installs whose sign-offs carry ⚠ safety lines),
- `EGRESS.MAGLOCK_FAILSAFE` (AC-203 egress hard gate — the sharpest edge).

All others (`FND.COMPANY_MODEL`, `FND.LOWVOLTAGE_CABLING`, `INT.*`, `ADC.*`, `AC.DOOR_ANATOMY`, `AC.CRED_LOCK_SELECTION`) are `is_safety_critical=false` / `0.80`. Note: `competencies.mastery_threshold` is the schema's *coarse fallback*; the **authoritative gate is item-level** (`assessment_items.is_safety_item`: safety ≥90%, non-safety ≥80%). `EGRESS.MAGLOCK_FAILSAFE` is the real AC-203 competency. The invariant test (`tests/0001_invariants_test.sql`) deliberately uses a **distinct `__TEST__`-scoped** competency code so its fixtures never collide with this seed when both are applied to the same database (the test also runs inside a transaction that ROLLBACKs).

---

## 4. AC-203 §5.4 line-item templates — the SCHEMA GAP (RESOLVED by `0003`)

**The gap (was).** `academy.signoff_line_items` is the rubric line-item *scoring* table, and its `signoff_id` is `NOT NULL` with an FK to a live `academy.signoffs` row (+ `unique(signoff_id, line_item_key)`, + immutability triggers once the parent is signed). It can hold **scored instances only — never the rubric TEMPLATE** (the per-course definition of which lines exist and which are critical-safety). So the AC-201/202/203 §5.4 line-item **catalog** (content/definition data) had nowhere to live as standalone rows, and S1 originally stashed it as `signoff_rubric_template` JSON on each course's `signoff_prep` unit `content_ref`. That was functional but an architectural smell on the **safety-critical** path.

**The fix (now shipped).** Migration **`migrations/0003_signoff_line_item_templates.sql`** promotes the template to a first-class table, **`academy.signoff_line_item_templates`** — the **CANONICAL single source of truth** for the rubric lines:

```sql
create table academy.signoff_line_item_templates (
  id                 uuid primary key default gen_random_uuid(),
  course_id          uuid not null references academy.courses(id) on delete cascade,
  competency_id      uuid references academy.competencies(id) on delete set null,
  dimension          academy.signoff_dimension not null,
  line_item_key      text not null,
  is_critical_safety boolean not null default false,
  ordinal            int not null,
  label              text not null,
  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (course_id, line_item_key)
);
-- RLS ENABLE+FORCE; SELECT to `authenticated` (org-agnostic catalog, like the
-- published catalog); NO end-user write policy → service-role-only authoring
-- (these define HOW SAFETY IS GRADED), mirroring assessment_items. tg_set_updated_at;
-- indexes on course_id, (course_id, dimension), and a partial index on the
-- critical-safety lines. Apply order: after 0001, before the S1 seed.
```

**How M6 consumes it.** `finalize-signoff` reads **`academy.signoff_line_item_templates`** (by `course_id`) and materializes one `signoff_line_items` row per template line on each draft sign-off, **preserving `dimension` + `is_critical_safety`** so the safety-veto trigger (`tg_signoff_compute_outcome`) fires correctly. The `signoff_prep` unit `content_ref` now carries only a short pointer: `{"signoff_rubric_template_ref":"academy.signoff_line_item_templates","course":"AC-2xx"}` (AC-203 also keeps a `gate_note`).

**The seeded templates** (section 7b of the seed; stable `000000b1-CCCC-…-00LL` UUIDs; `on conflict (course_id, line_item_key) do nothing`):

- **AC-203 — 12 line items, the 7 ⚠ critical-safety keys (`is_critical_safety=true`, S1 §5):**
  `ac203.release_on_power_loss`, `ac203.push_to_exit_30s`, `ac203.release_on_fire_alarm`, `ac203.pte_mount_40_48in_5ft`, `ac203.no_maglock_defeat_fire_latch`, `ac203.emergency_lighting_present`, `ac203.ahj_confirmed`
  plus 5 non-critical (dimension-scored, `is_critical_safety=false`): `ac203.tech.fail_safe_wiring`, `ac203.tech.rex_fire_terminated`, `ac203.tech.supply_battery_sized` (technical_execution); `ac203.verify.three_release_modes_logged` (verification_documentation); `ac203.indep.recognize_no_maglock_escalate` (independence_judgment).
- **AC-201 — 9 line items** (2 ⚠: `ac201.failstate_set_before_energize`, `ac201.no_egress_block`) and **AC-202 — 8 line items** (2 ⚠: `ac202.failstate_and_lock_power`, `ac202.no_egress_block`), per the bible §5.4 blocks.

All `dimension` values are the four schema enum values; the key strings + flags are **identical** to the values previously inlined in `content_ref`, so the S1 line-item test still passes and M6's contract is unchanged. The table is now the **only** place the AC-203 line items are defined (no duplicate inline source remains).

---

## 5. Badges & the credential-as-prerequisite resolver (ledger §D/§F)

- **Skill badges** (`kind='skill'`, one per signable/field-proven competency): `skill.ac.single_door_aero` (AC-201), `skill.ac.mercury_wiring` (AC-202), `skill.ac.maglock_rex_egress` (AC-203 — `gating:true`, egress). Each `requires` = `{ competency, signoff_required:true, courses }` — issued only after an Evaluator field sign-off proves the competency (See-one/Do-one/**Prove-one**). `recert_months`: 24 for AC-201/202 (Core), **12** for the egress AC-203 (`is_compliance=true`).
- **Tier credential** `tier.ac.certified_technician` ("Certified Technician — Access Control", `kind='tier'`): `requires.badges = [skill.ac.single_door_aero, skill.ac.mercury_wiring, skill.ac.maglock_rex_egress]` + `auto_issue:"all_components_field_proven"`. `recert_months=12`, `is_compliance=true` (the egress 12-mo rule). This is the **credential-as-prerequisite** data the M1/M7 resolver reads to gate AC-301+ ("Certified Technician — AC (incl. AC-203)" in the bible). The resolver/auto-issue *logic* is M7; **S1 supplies only the data it reads** (ledger §D, S1 out-of-scope).

`badge_classes.requires` is the schema's free-form `jsonb` "stack" column; the shapes above are the contract M7 must honor (invariant 5 — M7 doesn't reinvent badge shape).

---

## 6. How the M-goals consume this seed

| Goal | Consumes |
|---|---|
| **M1** (skill-tree) | `courses` (14, `status='published'`) + `course_prerequisites` (the DAG) + `competency_state` for prerequisite-gating; the credential-as-prerequisite gate (AC-301…) reads `badge_classes` `tier.ac.certified_technician` + a held-credentials resolver. Relies on the DAG staying acyclic. |
| **M2** (assessments) | `units` (`content_ref` MDX/spec pointers + `engine` hints), `assessment_items` (`is_safety_item` → ≥90% safety / ≥80% else), writes `assessment_responses` (retry-to-mastery). |
| **M6** (finalize-signoff) | The AC-201/202/203 **§5.4 line-item templates** in `academy.signoff_line_item_templates` (the canonical table, §4) → materializes `signoff_line_items` (the safety-veto trigger enforces the verdict + immutability); promotes `competency_state` to `field_proven`. Reads the template **table** (not `content_ref`), preserving `dimension` + `is_critical_safety` per line. |
| **M7** (issue-badge) | `badge_classes` (skill + tier `requires`/`auto_issue`) + `competency_state`; writes `credentials` (+ `credential_status_list`). The AC tier credential auto-issues when its 3 component skill badges are all `field_proven`. |
| **M12** (CCS isolation) | The two `orgs` (Redex + nested `ccs_partner`) as the cross-tenant isolation fixture. |

---

## 7. Schema mismatches / decisions surfaced

1. **[GAP — RESOLVED by `0003`] sign-off line-item template table.** Detailed in §4: `migrations/0003_signoff_line_item_templates.sql` adds `academy.signoff_line_item_templates` as the canonical rubric-template source; the seed populates it (section 7b) and the `signoff_prep` `content_ref` is now just a pointer at it. M6 reads the table.
2. **`units` has both `competency_id` (direct) and the `unit_competencies` join table.** The seed populates **both** (direct = the unit's primary competency; join table mirrors it + adds the AC-102 cross-map) so M1/M2 can resolve either way. No conflict — intentional redundancy per wave3 §7 #7.
3. **`competencies.mastery_threshold` vs item-level gating.** Seeded coherently (0.90 safety / 0.80 else) but documented as the *coarse fallback*; the authoritative gate is `assessment_items.is_safety_item` (ledger §C). No schema change needed.
4. **No seeded `sim_definitions`/`fixture_sets`.** Out of S1 scope (engines/specs are M2–M5, F5/F5b); the `unit.content_ref.engine`+`spec_key`+`fixture` hints are the forward pointers those goals fill. Not a gap — a scope boundary.
5. **No seeded users / enrollments / sign-offs / credentials.** Those are runtime/per-tenant rows (created by the app, M6, M7), not catalog seed. Only the two `orgs` are seeded (tenancy fixtures). Intentional.
