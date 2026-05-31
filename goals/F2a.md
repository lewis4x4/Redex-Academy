# F2a — `workos` Schema Stub + Cross-Schema FK + Grants

- **Effort tier:** ultracode
- **Phase:** 0 (Foundation)
- **HUMAN-GATE:** grants/RLS reviewed before release (touches tenant boundary).

## Objective
Stand up a minimal `workos` schema **stub** in the same Supabase project — just enough (`workos.jobs` + needed columns) to satisfy the cross-schema FK `academy.signoffs.work_os_job_id → workos.jobs(id)` and to let sign-offs/recert/dashboards join against real jobs. Runs before M6.

## Depends on
- **F2** (the `academy` schema must exist so the FK target column `academy.signoffs.work_os_job_id` and the join keys are present; shared `auth.users`).

## Consumes (contracts)
- `academy.signoffs` (the FK source), `academy.orgs` (the canonical tenant table both schemas key RLS on), `auth.users` (the one identity space).
- Generated types from F2.

## Tasks (ordered)
1. Create the `workos` schema. Add a **stub `workos.jobs`** table with the minimum columns the Academy joins on:
   - `id uuid PK`, `org_id uuid → academy.orgs(id)`, `tech_user_id uuid (= auth.users.id)`, `site_ref text`, `job_type text`, `status text`, `scheduled_at timestamptz`, `closed_at timestamptz`, plus evidence pointers the sign-off path references (`evidence_manifest jsonb` for photo/signature/closeout refs), `created_at`, `updated_at`.
   - This is a **stub** — it models only what the Academy must join to, not the full Work OS domain. Comment it as such.
2. Add the **cross-schema FK** (ledger §A): alter `academy.signoffs` so `work_os_job_id` references `workos.jobs(id)` (nullable until a job is linked; the FK is the contract).
3. **Tenancy (ledger §A):** `workos` RLS also keys on `org_id = (auth.jwt() ->> 'org_id')::uuid` against the **same `academy.orgs`** canonical tenant table. Deny-by-default; a tech reads their own org's jobs only.
4. **PostgREST + grants (ledger §A):** expose `workos` as needed; set `search_path` to include both schemas; explicit per-role `GRANT`s. End-user roles get SELECT on their org's jobs; only the service role writes `workos.jobs` in this build (the real Work OS owns writes in production — the stub is read/seed only here).
5. Add a tiny seed of demo `workos.jobs` rows (1–2 per demo org) so M6 can link a sign-off to a job id in tests/dev. Keep PII-free.
6. Regenerate types (`supabase gen types typescript`, now covering `workos`) → commit `packages/db-types/database.types.ts`; verify `typegen-drift` CI green.

## Done-criteria (testable)
- Migration applies; `workos.jobs` exists with the FK target satisfied.
- A `signoffs` row can be inserted with a valid `work_os_job_id` and is **rejected** with an invalid one (FK proven).
- **RLS proof (committed):** a cross-org actor gets **zero** `workos.jobs` rows; same-org actor sees their org's jobs; no end-user role can INSERT/UPDATE `workos.jobs`.
- A cross-schema join (`academy.signoffs ⋈ workos.jobs` on `work_os_job_id`, both filtered by `org_id`) returns the demo row for the owning org and nothing cross-org.
- Generated types include `workos`; `typegen-drift` green.

## Out of scope
- Any real Work OS domain modeling beyond the join stub.
- Sign-off finalize logic / evidence capture (that is **M6**).
- Writing to `workos.jobs` from end-user roles or the client.

## Invariants in play
- Inv. 3 (RLS deny-by-default + tenant isolation on the shared `academy.orgs`).
- Inv. 6 (one identity space — `tech_user_id = auth.users.id`; cross-schema join on `auth.users.id`/`org_id`, never a separate Work OS user id).
- Inv. 2 (state writes server-only).
- Inv. 8 (migration→typegen).

## Tests required
- **DB:** FK enforcement (valid/invalid `work_os_job_id`); RLS isolation on `workos.jobs`; the cross-schema join isolation test.
- **CI:** `typegen-drift`, `rls-negative` green.
