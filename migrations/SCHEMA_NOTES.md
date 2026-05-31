# Redex Academy — F2 Schema Notes

> The concrete database contract every later goal (M1, M2, M6, M7, S1, F2a, dashboards) compiles against. Source of truth: the **Build Decisions Ledger** (`wave4_decisions_ledger.md` §A,B,C,F,G), the architecture review (`wave4_review_architecture.md`), and wave3 §3 / §3.8 / §7. Where any doc conflicts with the ledger, **the ledger wins**.

Files in this folder:

| File | What it is |
|---|---|
| `0001_init_academy.sql` | The `academy` schema: all core tables, enums, RLS, triggers, the DAG check, grants, indexes. |
| `0002_workos_stub.sql` | The `workos` schema stub (`workos.jobs`) + the **cross-schema FK** + grants + PostgREST notes. (Goal F2a.) |
| `0003_signoff_line_item_templates.sql` | `academy.signoff_line_item_templates` — the canonical §5.4 sign-off **rubric-template** table (the per-course line-item catalog M6 materializes `signoff_line_items` from). RLS ENABLE+FORCE, catalog-readable SELECT, service-role-only writes. **Applies after `0001`, before the S1 seed** (resolves the flagged [SCHEMA GAP], SEED_NOTES §4). |
| `tests/0001_invariants_test.sql` | Committed assertion tests: safety-veto pass/fail, signed-row immutability, RLS cross-tenant isolation, fixture gate, audit append-only, DAG cycle detection. |
| `SCHEMA_NOTES.md` | This file. |

> **Repo placement.** In the monorepo these belong in `supabase/migrations/` and `supabase/tests/` (CLAUDE.md §3). They are authored here in `migrations/` as the F2 deliverable; copy them into `supabase/` when wiring the Supabase CLI. They are **forward-only** — never edit a merged migration; add a new one.

---

## 1. Model overview

One Supabase project, **two Postgres schemas**, **shared `auth.users`** (ledger §A).

```
auth.users (Supabase-managed, shared)  ← the ONE identity space
        │  id
        ├──────────────► academy.users.id   (= auth.users.id; NO work_os_user_id)
        └──────────────► workos.jobs.tech_user_id (= auth.users.id)

academy.orgs   ← the ONE canonical tenant table; BOTH schemas' RLS key on its id
        ▲                                   ▲
        │ org_id                            │ org_id
   academy.* (30 tables)              workos.jobs (stub)
        │
        └─ academy.signoffs.work_os_job_id ──FK──► workos.jobs.id   (ON DELETE RESTRICT)
```

### `academy` tables (30) by area

- **Identity / tenancy:** `orgs` (canonical tenant), `users` (PK = `auth.users.id`), `roles`, `user_roles`, `evaluator_authorizations`.
- **Catalog:** `competencies` (`is_safety_critical`), `courses`, `course_versions` (semver + `platform_manifest`), `units`, `unit_competencies`, `course_prerequisites` (`hard_gate|soft`), `course_platform_dependencies`.
- **Progress:** `enrollments`, `unit_progress`, `competency_state` (the spine; server-write only).
- **Simulation:** `sim_definitions` (6 engine kinds), `fixture_sets` (`sanitized` publish gate), `sim_attempts` (UNIQUE `client_event_uuid`), `sim_telemetry_events` (UNIQUE `client_event_uuid`).
- **Credibility spine:** `signoffs`, `signoff_line_items` (`dimension` enum, `line_item_key`, `score 0..3`, `is_critical_safety`), `signoff_evidence`, **`signoff_line_item_templates`** (the canonical §5.4 rubric-template catalog — `dimension`, `line_item_key`, `is_critical_safety`, `ordinal`, `label`; added by `0003`; `signoff_line_items` are **materialized per sign-off** from these templates by M6).
- **Recert / credentials:** `recert_schedules`, `badge_classes`, `credentials`, `credential_status_list` (revocation).
- **Assessment:** `assessment_items` (`is_safety_item`), `assessment_responses` (UNIQUE `client_event_uuid`).
- **Audit:** `audit_log` (append-only).

### `workos` tables (1, stub)

- `workos.jobs` — minimal job record (`org_id` → `academy.orgs`, `tech_user_id` = `auth.users.id`, `site_id`, `status`, timestamps). The FK target for `academy.signoffs.work_os_job_id`. Replaced by the full Work OS migration later; the FK + grants contract is stable.

---

## 2. Identity & tenancy (LOCKED, ledger §A)

- **`academy.users.id = auth.users.id`.** There is exactly one identity space; there is **no `work_os_user_id` column**. Academy↔Work OS joins resolve on `auth.users.id`.
- **`academy.orgs` is the single canonical tenant table.** `workos.jobs.org_id` references it directly, so both schemas' RLS read the **same** `org_id` JWT claim. This is what makes cross-app tenant isolation actually hold (`wave4_review_architecture.md` §1.3).
- The FK `academy.users.id → auth.users(id)` is documented in `0001` (section 17) but **not executed unconditionally**, so the file runs in a bare CI Postgres without the Supabase `auth` schema. The Supabase-targeted migration must add it (it is part of the contract).

---

## 3. How RLS keys on the JWT (invariant 4 — deny-by-default)

RLS is **ENABLE + FORCE** on every table from migration #1. A row is visible only if a policy grants it; an unauthenticated/cross-tenant caller naturally gets **zero rows**.

Three helper functions read the verified JWT claims (`current_setting('request.jwt.claims', true)`):

| Function | Returns | Used for |
|---|---|---|
| `academy.current_org_id()` | `org_id` claim → `uuid` (NULL if unauthenticated) | tenant isolation on every personal/tenant policy |
| `academy.current_user_id()` | `sub` claim → `uuid` (= `academy.users.id`) | "learners read own rows" |
| `academy.jwt_has_role(variadic text[])` | bool — JWT `roles` array intersects the args | "managers/admins read org rows" |

**Policy shape:**

- **Tenant isolation** — personal/tenant rows: `org_id = academy.current_org_id()`.
- **Published catalog** (`courses`, `course_versions`, `units`, `competencies`, `sim_definitions`, `badge_classes`, …) is **cross-tenant readable** via an explicit `status = 'published'` policy (the only cross-tenant-readable class). `fixture_sets` are **not** public (sensitive recordings → authors/admins only). `credential_status_list` **is** public-readable (external verifiers check the revocation bit; it carries no PII).
- **Self vs. supervisory** — learners read own `enrollments`/`unit_progress`/`competency_state`/`credentials`/`assessment_responses`/`sim_attempts`; managers (`jwt_has_role('manager','org_admin','exec')`) read their org's rows.
- **State-changing writes are NOT granted to end-user roles at all** (invariant 3). `competency_state`, `credentials`, `credential_status_list`, `recert_schedules`, sign-off **finalize** (transition to `signed`), badge issuance, catalog authoring, `audit_log` inserts, `evaluator_authorizations`, `roles`/`user_roles` — **no INSERT/UPDATE/DELETE policy exists**. The only writer is a **service-role Edge Function**, which **bypasses RLS** by design (Supabase `service_role` has `BYPASSRLS`). The function therefore *is* the write access-control boundary and re-checks the caller's JWT/role before writing (`wave4_review_architecture.md` §3.3). Tables are also `FORCE`d so the owner is subject to RLS too — only `service_role` bypasses.
- **What end users CAN write directly** (append-only learner events + drafts, RLS-scoped to self): `sim_attempts`, `sim_telemetry_events`, `assessment_responses`, `enrollments` (self-enroll), `unit_progress` (ticks), and **DRAFT** `signoffs`/`signoff_line_items`/`signoff_evidence` by the owning evaluator. A client **cannot** insert or self-transition a sign-off to `signed` (policy `WITH CHECK status in ('draft','submitted')`); finalize is service-role only.

**Minting the `org_id` claim:** on login, the auth hook copies the user's `academy.users.org_id` and their `academy.user_roles` keys into custom JWT claims (`org_id`, `roles`, plus `persona`, `evaluator_authorized`/`domains`). That is goal **F3**; this schema consumes the claims.

---

## 4. The safety-veto trigger (invariant 1 — the most important rule in the system)

The §5.4 rubric is scored at **line-item grain** in `signoff_line_items`: four `dimension`s (`safety_compliance`, `technical_execution`, `verification_documentation`, `independence_judgment`), each line `score int CHECK (0..3)`, with `is_critical_safety bool`. The *definition* of which lines a course's rubric has (and which are critical-safety) lives in **`academy.signoff_line_item_templates`** (the canonical rubric-template table, `0003`); M6 `finalize-signoff` **materializes** one `signoff_line_items` row per template line on each sign-off, copying `dimension` + `is_critical_safety` so the veto below grades correctly.

The pass rule is **cross-row** (the scores are child rows of `signoffs`), so it is enforced in a **TRIGGER, not a CHECK** (a CHECK cannot read sibling rows). `academy.tg_signoff_compute_outcome()` is a `BEFORE INSERT OR UPDATE` trigger on `signoffs` that fires when `status` becomes `signed` or `failed`:

1. It rolls up the line items: per-dimension **MIN** score (`dim_min`), whether **any** `is_critical_safety` line scored `0`, and whether **every** safety line is `≥ 2`.
2. **`outcome = 'pass'` ONLY IF** every present dimension's rollup `≥ 2` **AND** every `is_critical_safety` line `≥ 2`. A sign-off with **no line items can never pass**.
3. **A single `0` on any safety line ⇒ `outcome = 'fail'`, non-overridable** — the safety veto dominates everything.
4. Because `status = 'signed'` asserts a passing outcome, if the rubric does **not** support a pass, **signing is rejected** with a `check_violation` exception. This is the DB backstop: a buggy or tampered `finalize-signoff` function still cannot persist a passing sign-off that violates the rule (defense in depth — the Edge Function computes the outcome too).
5. The trigger **forces** `outcome` to the computed value (the caller cannot override it) and stamps `signed_at`.

The truth table was validated against the spec across the corner cases (all-2s → pass; any safety 0 → fail; a dimension rolling up to 1 with no safety 0 → still fail; no lines → fail; multiple safety lines where one is exactly 2 → pass).

### Immutability (invariant 2)

`academy.tg_signoff_immutable()` (`BEFORE UPDATE OR DELETE` on `signoffs`) blocks all DELETE of a signed row and all UPDATE **except** the single legal transition `signed → void` (which requires a `void_reason`; `superseded_by` points at the corrected re-evaluation). `academy.tg_signoff_child_immutable()` freezes `signoff_line_items` and `signoff_evidence` once their parent is signed. Corrections require a **new voiding sign-off**, never an in-place edit.

### Other triggers

- `tg_audit_append_only` — blocks UPDATE/DELETE on `audit_log`.
- `tg_block_unsanitized_fixture` — a **published** `sim_definition` may not reference a fixture unless `fixture_sets.sanitized = true` (invariant 6 publish gate).
- `tg_set_updated_at` — `updated_at` maintenance on every mutable-by-users table.

---

## 5. The cross-schema FK (ledger §A, wave4 §1.5)

`0002_workos_stub.sql` adds, after `workos.jobs` exists:

```sql
alter table academy.signoffs
  add constraint signoffs_work_os_job_fk
  foreign key (work_os_job_id) references workos.jobs(id) on delete restrict;
```

- **`ON DELETE RESTRICT`** — you must never silently lose the job a credential was proven on; sign-off immutability (§3.5) demands the job survive as long as the (immutable) sign-off references it.
- Cross-schema FKs require the referencing role to have **USAGE** on the referenced schema — `0002` grants `usage on schema workos` to `authenticated`/`service_role`; writes go through `service_role`.
- This is why **F2a runs before M6**: `workos.jobs` must exist before the sign-off flow can reference real jobs. The stub is replaced by the full Work OS migration later; the FK + grants contract stays the same.

### PostgREST exposed-schema + `search_path` (apply in Supabase config — see `0002` §4)

```toml
# supabase/config.toml
[api]
schemas = ["public", "academy", "workos", "graphql_public"]
extra_search_path = ["public", "academy", "workos"]
```

```sql
alter role authenticated set search_path = academy, workos, public;
alter role anon          set search_path = academy, public;
alter role service_role  set search_path = academy, workos, public;
```

All migration objects are **schema-qualified** (`create table academy.…`) — never rely on the session default `search_path`.

---

## 6. Idempotent offline sync (invariant 5, ledger §G)

Every append-only event table carries **`UNIQUE (client_event_uuid)`**: `sim_attempts`, `sim_telemetry_events`, `assessment_responses`. The `/sync` Edge Function inserts with `ON CONFLICT (client_event_uuid) DO NOTHING`, so a double-flush on a flaky reconnect cannot double-count attempts/telemetry/responses. Server-only outcomes (competency promotion, mastery verdict, sign-off finalize, badge issuance/revocation, recert) are never computed offline.

---

## 7. Type generation (NON-NEGOTIABLE — CLAUDE.md §4)

After applying these migrations, regenerate the shared types **off the migrations** (the schema source of truth — not the live remote) and commit them with the migration. The canonical output path is **`packages/db-types/database.types.ts`** (F1/F2):

```bash
# Apply the migrations to a local Postgres ($SUPABASE_DB_URL) as a superuser, then gen from it.
# (These migrations are authored for bare-Postgres apply — the same path the DB CI jobs use;
#  `supabase start` is NOT used, as its constrained migration role can't create the auth-stub.)
for f in supabase/migrations/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done
supabase gen types typescript --db-url "$SUPABASE_DB_URL" --schema academy,workos > packages/db-types/database.types.ts
```

- **Schema scope by phase:** at **F2** only `academy` exists, so generate with `--schema academy`. **After F2a** (the `workos` stub lands), generate with `--schema academy,workos` so the generated types cover both `academy.*` and `workos.*`.
- **Never hand-edit `database.types.ts`.** CI fails if the committed types differ from a fresh generation (typegen-drift check).
- **Migrations-sourced, not prod.** The typegen-drift check runs `gen types --db-url` against a bare `postgres:16` built purely from `supabase/migrations/*` — NOT `--project-id`/the remote. So a schema-adding PR is green once its migration + regenerated types are committed together; it does **not** require (and must not wait on) a production schema deploy. The check still catches stale types: change a migration without regenerating and the fresh gen diverges → CI fails.
- Every goal imports this one types package (`packages/db-types`) rather than redefining row shapes.

---

## 8. CI DAG check

`academy.check_prereq_dag()` returns the rows on any cycle in `course_prerequisites` (empty = the graph is a DAG); `academy.prereq_graph_is_dag()` is the boolean convenience. `pnpm dag:check` fails the build if a cycle exists — this is the guard that makes the broken `ADC-201`-class prerequisite bug un-shippable (wave3 §3.2).

---

## 9. How the M-goals consume this

| Goal | Consumes |
|---|---|
| **F2a** | `0002_workos_stub.sql` — the `workos.jobs` stub + cross-schema FK + grants (already here). |
| **F3** | Mints the JWT claims (`org_id`, `roles`, `persona`, `evaluator_authorized`/`domains`) the RLS helpers read; adds the `auth.users` FK. |
| **S1** | Seeds the MVP-slice catalog (`courses`/`course_versions`/`units`/`competencies`/`course_prerequisites`), the AC-201/202/203 §5.4 rubric line items into **`signoff_line_item_templates`** (the canonical table, `0003`), and the slice `badge_classes`. (Apply `0003` before the seed.) |
| **M1** | Reads `courses`/`course_prerequisites`/`competency_state` for the prerequisite-gated skill-tree; relies on the DAG check. |
| **M2** | `units` (MDX/`content_ref`), `assessment_items` (`is_safety_item` → ≥90% safety gate / ≥80% else), `assessment_responses` (retry-to-mastery). |
| **M6** | The credibility spine: `finalize-signoff` reads **`signoff_line_item_templates`** to materialize `signoff_line_items`, writes `signoffs`/`signoff_line_items` (the trigger enforces the veto + immutability), `signoff_evidence`, joins `work_os_job_id → workos.jobs`, promotes `competency_state` to `field_proven`, writes `audit_log`. **All as the service role.** |
| **M7** | `issue-badge` reads `badge_classes`/`competency_state`, writes `credentials` + `credential_status_list` (revocation), signs server-side (proof suite `eddsa-rdfc-2022`/Ed25519, issuer `did:web:academy.redex.education` — F6, invariant 7; the merged `0001` table comment still reads the placeholder `goredex.com` — cosmetic, reconciled by the domain-reconciliation goal). |
| **F4** | `UNIQUE(client_event_uuid)` on the event tables + idempotent `/sync`. |
| Dashboards | Manager pipeline board reads `signoffs(org_id,status)`; exec KPIs join `academy.competency_state`/`credentials` to `workos.jobs`. |

---

## 10. Verification status

- All SQL files parse cleanly against **libpg_query** (PostgreSQL's own grammar): `0001` 240 statements, `0002` 25, `0003` (the rubric-template table) parses clean, the test 14.
- The safety-veto truth table was validated against the spec across nine corner cases.
- **Pending live verification** (no Postgres in the authoring sandbox): apply against a real Supabase/Postgres instance and run `psql -v ON_ERROR_STOP=1 -f tests/0001_invariants_test.sql` (expect all `ok` notices + `ALL INVARIANT TESTS PASSED`). Per CLAUDE.md §8.8, the safety-veto + RLS isolation are **human-gate** items — do not self-certify the merge.
