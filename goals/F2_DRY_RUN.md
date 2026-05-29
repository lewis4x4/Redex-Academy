# F2 — Dry-Run: Expected Output & Human-Verify Checklist

A known-good target for your first **ultracode** run. Read this before running `/goal F2`, then check the result against §4–§6. If anything in §6 (Red Flags) appears, reject the run and re-prompt.

- **Goal:** apply the `academy` schema, turn on deny-by-default RLS, enforce the safety-veto + immutability triggers, wire `gen types`, and prove the invariants with committed tests.
- **Tier:** ultracode (xhigh + dynamic workflow + adversarial verification). **Pair with auto mode.**
- **Depends on:** F1 merged (monorepo, `supabase/`, `packages/db-types`, CI jobs as stubs).
- **Human gate:** RLS policy review + the invariant test run on a **live Postgres** before merge. Adversarial self-verification does NOT substitute for this.

---

## 1. The `/goal` invocation to give Claude Code
> Run goal F2 per `goals/F2.md`. The authoritative DDL already exists at `migrations/0001_init_academy.sql` (+ `tests/0001_invariants_test.sql`, `SCHEMA_NOTES.md`). **Apply it — do not rewrite it.** If the spec and the DDL disagree on any column/enum/policy, STOP and surface the diff; do not invent shapes. Out of scope: the `workos` schema + cross-schema FK (that's F2a), JWT-claim minting (F3), seed data (S1).

## 2. Expected repo changes (the file tree F2 should produce)
```
supabase/
  migrations/
    <ts>_init_academy.sql                 # = migrations/0001_init_academy.sql, copied verbatim
    <ts>_signoff_line_item_templates.sql  # = migrations/0003_..., copied verbatim (academy; needs only 0001)
  tests/
    0001_invariants_test.sql     # = migrations/tests/..., copied verbatim
    0002_rls_negative.sql        # NEW: cross-org RLS negative matrix (F2.md "Tests required")
  config.toml                    # [api] schemas += "academy"; extra_search_path += "academy"
packages/db-types/
  database.types.ts              # REGENERATED + COMMITTED (academy only at F2; workos added in F2a)
infra/
  dag-check.ts                   # now real: calls academy.prereq_graph_is_dag(); exits non-zero on a cycle
.github/workflows/ci.yml         # rls-negative, dag-check, typegen-drift flip stub → real & required
```
No `apps/`/feature code. `0002_workos_stub.sql` is **NOT** applied here (it's F2a — `workos.jobs` doesn't exist yet, so the cross-schema FK can't be added). `0003` (the `signoff_line_item_templates` rubric-template catalog) **IS** wired in alongside `0001`: it is academy-schema, depends only on `0001`, is already applied on the live project, and the S1 seed needs it — so the committed db-types and the migration set stay in lockstep at 30 academy tables.

## 3. Commands it should run
```bash
supabase start                                  # local stack
cp migrations/0001_init_academy.sql supabase/migrations/<ts>_init_academy.sql
cp migrations/tests/0001_invariants_test.sql supabase/tests/
supabase db reset                               # applies migration to local from scratch
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/0001_invariants_test.sql
supabase gen types typescript --local --schema academy > packages/db-types/database.types.ts
pnpm dag:check && pnpm typecheck && pnpm lint
```
(Exact migration timestamp is the agent's to set. `SUPABASE_DB_URL` points at the local stack for this step.)

## 4. Expected RESULT signals (acceptance evidence)
- `supabase db reset` applies cleanly from scratch — **idempotent, forward-only**.
- Object counts (from `0001` + `0003`): **30 tables** (incl. `signoff_line_item_templates`), ~**25 enum types**, **53 policies**, **8 triggers** (+ per-table `updated_at` triggers), the `check_prereq_dag()` / `prereq_graph_is_dag()` functions, plus the three JWT helpers (`current_org_id`, `current_user_id`, `jwt_has_role`). _(F2 now wires `0003` alongside `0001` — see §2; the table count was 29 with `0001` alone.)_
- **RLS is `ENABLE` + `FORCE` on every one of the 30 tables** (the loop in `0001` covers its 29; `0003` enables + forces `signoff_line_item_templates`).
- The invariant test ends with the notices: each assertion `ok` and a final **`ALL INVARIANT TESTS PASSED`**.
- `typegen-drift` CI job **green**; `database.types.ts` committed and covers `academy.*` (workos types arrive after F2a).
- `dag-check` **fails on a seeded cycle, passes on the acyclic graph**.
- `rls-negative` job: a cross-org `authenticated` actor returns **zero rows** on every personal table; a Redex manager (positive control) **does** see Redex rows.

## 5. HUMAN-VERIFY checklist (you, before merge — not agent-self-certified)
- [ ] **Invariant test passed on a live Supabase/Postgres** (not just CI parse): `psql … -f supabase/tests/0001_invariants_test.sql` → `ALL INVARIANT TESTS PASSED`.
- [ ] **Safety-veto behaves** (spot-check by hand): a sign-off with one `is_critical_safety` line `score=0` → signing **rejected / outcome `fail`**; all dimensions `≥2` and all safety lines `≥2` → `pass`; a sign-off with **no line items** → cannot pass.
- [ ] **Immutability:** UPDATE/DELETE on a `signed` sign-off (and its line items/evidence) is **rejected**; only `signed → void` (with `void_reason`) is allowed.
- [ ] **RLS read every policy:** deny-by-default (no stray permissive policy); tenant isolation keys on `academy.current_org_id()` on all personal tables; published catalog cross-tenant readable, **`fixture_sets` NOT public**, `credential_status_list` public.
- [ ] **No state-write policy exists** for end-user roles on `competency_state`, `credentials`, `credential_status_list`, `recert_schedules`, sign-off **finalize** (`signed`), badge issuance, `audit_log`, `roles`/`user_roles`/`evaluator_authorizations`. Clients may insert only **draft/submitted** sign-offs (`WITH CHECK status in ('draft','submitted')`).
- [ ] `academy.users.id = auth.users.id`; **no `work_os_user_id` column** anywhere.
- [ ] `UNIQUE(client_event_uuid)` on `sim_attempts`, `sim_telemetry_events`, `assessment_responses`.
- [ ] The Supabase-targeted migration **adds the `academy.users.id → auth.users(id)` FK** (documented in `SCHEMA_NOTES` §2 but intentionally not executed in bare CI).
- [ ] Reviewed the **adversarial-verification report** the ultracode run produced; its findings are addressed.

## 6. RED FLAGS — reject the run if you see any of these
- Safety-veto implemented as a `CHECK` constraint instead of a **TRIGGER** (a CHECK can't read sibling line items — it would silently let unsafe sign-offs pass).
- Any INSERT/UPDATE policy that lets a non-service role write `competency_state` / `credentials` / a sign-off `outcome` or `signed` status.
- RLS `ENABLE`d but not `FORCE`d (table owner bypasses → isolation hole).
- The agent **edited the provided DDL's intent** instead of applying it and surfacing conflicts.
- `database.types.ts` hand-edited, not committed, or `typegen-drift` not actually wired/blocking.
- `work_os_user_id` reintroduced, or a `users` identity not keyed to `auth.users.id`.
- `0002_workos_stub.sql` applied here (it belongs to F2a) — the cross-schema FK will error because `workos.jobs` doesn't exist.
- Any real secret value written into a file; or the invariant test "passed" by parse-only (no live Postgres).
- `gen types` run with the wrong output path (must be `packages/db-types/database.types.ts`, per F1/F2; at F2 generate `--schema academy` only — `workos` arrives after F2a).

## 7. Definition of Done (the merge gate)
All §4 signals present · all §5 human checks ticked · CI `typegen-drift` + `rls-negative` + `dag-check` green and required · types committed · GOALS_INDEX status for F2 → done. Only then is F2a (the `workos` stub + cross-schema FK) unblocked.

---
*Known nit to enforce during the run: F2 generates types for `--schema academy` only; F2a re-runs `gen types --schema academy,workos` once `workos.jobs` exists. The `SCHEMA_NOTES` §7 command shows the post-F2a (`academy,workos`) form.*
