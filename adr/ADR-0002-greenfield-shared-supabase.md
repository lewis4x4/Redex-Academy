# ADR-0002 — Greenfield: one shared Supabase project, two schemas, shared `auth.users`

**Status:** Accepted

## Context

The Academy's highest-leverage architectural move is to **share Work OS's identity and database** so that field sign-offs are captured *as a side effect of doing the real job* (a tech logs in once; sign-offs record against a real Work OS job ID; evidence is the job's own photos). wave3 §2.5 left two options: **(a) one Supabase project / two schemas if greenfield**, or **(b) federate two separate projects via a shared IdP if Work OS already exists. The Wave 4 architecture review found option (b)-flavored artifacts had leaked into the build (a `work_os_user_id` column, `REDEX_WORKOS_*` DB/API/service-key env vars) that are wrong for a greenfield build and create a needless cross-project secret surface and ambiguous identity. The identity/tenancy model is load-bearing: it determines whether evidence capture and exec KPIs are a trivial **join** or a brittle cross-project **API call**, and whether RLS tenant isolation actually holds across both apps. (ledger §A; wave3 §2.5, §3.1.)

## Decision

**Greenfield, shared — LOCKED.** **One Supabase project** with **two Postgres schemas, `academy` and `workos`**, over a **shared `auth.users`**. Specifically:

- `academy.users.id` **=** `auth.users.id`. There is **one identity space** — **delete any `work_os_user_id` column**; cross-schema joins resolve on `auth.users.id`.
- **One canonical tenant table, `academy.orgs`**, that **both** schemas' RLS key on via `org_id = (auth.jwt() ->> 'org_id')::uuid`.
- **Cross-schema FK:** `academy.signoffs.work_os_job_id → workos.jobs(id)` (`ON DELETE RESTRICT`). Goal **F2a** stands up the `workos.jobs` stub + FK + grants before M6.
- **PostgREST:** expose `academy` (and `workos` as needed); set `search_path`; explicit per-role grants.
- **`.env`:** **delete** `REDEX_WORKOS_DB_URL`, `REDEX_WORKOS_API_URL`, `REDEX_WORKOS_SERVICE_KEY`.

## Consequences

- Academy↔Work OS data is one `JOIN` away: field sign-offs, evidence, and the exec dashboard's Time-to-Field-Ready / First-Time-Fix KPIs come from joining Academy competency/credential data to Work OS job data — no sync job, no API rate limits.
- Tenant isolation is **provable across both apps** because both read the *same* `org_id` JWT claim against the *same* `academy.orgs`.
- One fewer secret surface (no cross-project service keys). The deleted `REDEX_WORKOS_*` vars must **stay** deleted (`AGENT_ROLES_AND_ACCEPTANCE.md` §5).
- The `workos` schema starts as a **stub** (`workos.jobs`) and is replaced by the full Work OS migration later; **the FK + grants contract is stable**, so downstream sign-off/recert/dashboard goals are unaffected by that swap.
- If Work OS had *already* existed as a separate project, this decision would not apply (federation would) — it is explicitly a **greenfield** call.
