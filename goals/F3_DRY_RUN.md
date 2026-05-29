# F3 — Dry-Run: Expected Output & Human-Verify Checklist

A known-good target for your first **ultracode** run. Read this before running `/goal F3`, then check the result against §4–§6. If anything in §6 (Red Flags) appears, reject the run and re-prompt.

- **Goal:** wire Supabase Auth + OIDC/SAML SSO and the **custom JWT-claim** mechanism (Supabase Auth Hook `custom_access_token_hook`) that mints `org_id`, `roles`, `persona`, and `evaluator_authorized` (+ authorized `domains`) so F2's RLS becomes live; lock the one-identity-space model (`academy.users.id = auth.users.id`, no `work_os_user_id`); add the `academy.users.id → auth.users(id)` FK; build the persona-/role-adaptive auth flow in `apps/web`/`apps/admin`; provision dev identities across two orgs.
- **Tier:** ultracode (xhigh + dynamic workflow + adversarial verification). **Pair with auto mode.**
- **Depends on:** **F2** merged (the `academy` schema, the three JWT-reading helpers, RLS keyed on the claims — inert until F3 populates them), generated types committed. F2a is **not** required (no `workos` claim work here).
- **Human gate:** the identity model + the Auth-Hook claim-shaping logic + the claim→RLS interaction are reviewed on a **live Supabase** before merge (ledger §J). Adversarial self-verification does NOT substitute for this.

---

## 1. The `/goal` invocation to give Claude Code
> Run goal F3 per `goals/F3.md`. F2's schema is the contract: the JWT helpers `academy.current_org_id()`, `academy.current_user_id()`, and `academy.jwt_has_role(variadic text[])` already read `request.jwt.claims` (`org_id`, `sub`, `roles`) — **mint claims that match what they read; do not change the helpers or the policies.** Use the **named mechanism only**: a Supabase Auth Hook **`custom_access_token_hook`**; if it cannot carry the `roles`/`domains` array cleanly, STOP and surface it — do not invent a different injector. Add the `academy.users.id → auth.users(id)` FK that `0001_init_academy.sql` §17 documents but leaves un-executed. Out of scope: the `workos` schema/FK (F2a), Work OS API federation (does not exist), sign-off/credential/sim logic, and the full CCS adversarial isolation matrix (that is **M12** — F3 only provisions identities and proves basic isolation).

## 2. Expected repo changes (the file tree F3 should produce)
```
supabase/
  migrations/
    <ts>_auth_users_fk.sql        # adds academy.users.id → auth.users(id) ON DELETE CASCADE (0001 §17 contract)
    <ts>_custom_access_token_hook.sql  # academy.custom_access_token_hook(event jsonb)→jsonb; GRANT EXECUTE to supabase_auth_admin; REVOKE from anon/authenticated
  functions/
    # (no new Edge Function required — the claim hook is a Postgres function registered with GoTrue)
  config.toml                     # [auth.hook.custom_access_token] enabled=true, uri="pg-functions://postgres/academy/custom_access_token_hook"; [auth] external OIDC/SAML provider blocks
  seed/
    <ts>_dev_identities.sql       # 2 orgs (1 Redex + 1 CCS-partner), users in each with assorted roles + personas (M12 fixtures)
  tests/
    custom_access_token_hook_test.sql   # claim-shaping: user with roles X/Y in org Z → expected claim set
apps/web/src/
  auth/                           # supabase-js session + login/logout, claim parser (org_id/roles/persona/evaluator_authorized/domains)
  routing/                        # role-gated routes (reads roles claim), persona-adaptive shell selection (reads persona claim)
apps/admin/src/auth/             # admin login/session (manager/org_admin/exec/author/curriculum_admin)
packages/db-types/database.types.ts  # REGENERATED if the FK/hook migration changes generated shapes; committed
e2e/
  auth-login.spec.ts             # Playwright: login → same-org read OK, cross-org read = 0 rows; role change updates access
  auth-a11y.spec.ts             # axe on login + persona-switched shells; keyboard-navigable
scripts/ or .github/workflows/
  no-workos.test.ts (or lint rule) # guard: zero `work_os_user_id` / `REDEX_WORKOS_*` references anywhere
```
Nothing else. No sign-off/credential/sim code. The claim **minter** is a Postgres function (Auth Hook), not a hand-rolled JWT signer — F3 never signs its own tokens.

## 3. Commands it should run
```bash
supabase start
cp/author supabase/migrations/<ts>_auth_users_fk.sql            # academy.users.id → auth.users(id)
cp/author supabase/migrations/<ts>_custom_access_token_hook.sql # the claim hook + grants
supabase db reset                                               # applies F2 + the FK + the hook from scratch
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/custom_access_token_hook_test.sql
supabase gen types typescript --local --schema academy > packages/db-types/database.types.ts
pnpm typecheck && pnpm lint && pnpm build
pnpm test                  # unit: hook claim-shaping
pnpm test:e2e              # Playwright: login + cross-org-zero-rows + role-change
pnpm test:a11y             # axe on login + persona shells
pnpm test:rls              # F2 RLS now LIVE under real minted claims
```
(`OIDC_ISSUER_URL`/`OIDC_CLIENT_ID`/`OIDC_CLIENT_SECRET`/`SUPABASE_JWT_SECRET` come from `.env`/Vault — **names only**, never values. The hook is `--schema academy`; `workos` is not in scope until after F2a.)

## 4. Expected RESULT signals (acceptance evidence)
- A user logs in via OIDC; the **issued JWT carries** `org_id` (uuid), `roles` (a JSON **array**), `persona`, `evaluator_authorized` (bool), and authorized `domains` — exactly the claims F2's helpers read (`org_id`, `sub`, `roles`).
- After login, F2's RLS returns the correct **own-org rows** and **zero cross-org rows** — the `org_id` claim is live and `academy.current_org_id()` now resolves to a real tenant (not NULL).
- A **manager/org_admin/exec** sees their org's supervisory rows via `academy.jwt_has_role(...)`; a learner sees only own `enrollments`/`unit_progress`/`competency_state`/`sim_attempts`/etc.
- **Changing a user's role re-mints/refreshes** the claim (re-mint on role/authorization update); the new permission takes effect on the next token — the refresh path is documented.
- The **`auth.users` FK exists**: `academy.users.id → auth.users(id) ON DELETE CASCADE` (0001 §17 contract executed against Supabase).
- The **Marco persona** renders the field-first low-literacy/dyslexia-friendly mobile UI; an exec/manager persona renders the dense mode — driven by the `persona` claim, not the `roles` claim.
- **Guard test green:** zero `work_os_user_id` and zero `REDEX_WORKOS_*` references in code or schema.
- `typegen-drift` green; `database.types.ts` committed and in sync.

## 5. HUMAN-VERIFY checklist (you, before merge — not agent-self-certified)
- [ ] **Auth-Hook claim logic reviewed on a live Supabase:** decode a freshly-minted JWT and confirm `org_id`/`roles`/`persona`/`evaluator_authorized`/`domains` are **shaped correctly** and sourced from `academy.users`/`user_roles`/`evaluator_authorizations` (not hard-coded, not client-supplied). `roles` is a real JSON array that `jwt_has_role` intersects.
- [ ] **Claim → RLS interaction proven with REAL claims** (not the synthetic `set request.jwt.claims` of F2's test): log in as a Redex user → own-org rows visible; log in as the CCS-partner user → **zero** Redex rows on every personal table; published catalog still cross-tenant readable; `fixture_sets` still **not** public.
- [ ] **Role-change refresh works end-to-end:** flip a user's `user_roles`, re-mint, confirm the new claim changes access (e.g. grant `manager` → org rows appear).
- [ ] **`academy.users.id → auth.users(id)` FK is present** on the Supabase-targeted migration (the 0001 §17 contract), and `academy.users.id` truly equals `auth.users.id` for every dev identity.
- [ ] **No `work_os_user_id` column anywhere; no `REDEX_WORKOS_*` env usage** — the guard test/lint actually runs and blocks.
- [ ] **Secrets discipline:** OIDC client secret + `SUPABASE_JWT_SECRET` are server-side only; no secret value in the client bundle or any committed file (only `.env.example` names).
- [ ] **Persona vs. role kept distinct:** UI shell is chosen by `persona`; permissions/routes by `roles` — neither is conflated (CLAUDE.md §7).
- [ ] Reviewed the **adversarial-verification report** the ultracode run produced; its findings are addressed.

## 6. RED FLAGS — reject the run if you see any of these
- The agent **invented a claim-injection mechanism** other than the Supabase Auth Hook `custom_access_token_hook` (e.g. a client-side claim, a hand-signed JWT, or stuffing claims into `user_metadata` and reading them in RLS) — F2's helpers read top-level `org_id`/`roles`, so claims must land there.
- The hook **changed the helper functions or RLS policies** to match a different claim shape instead of minting the shape they already read.
- `roles` minted as a **string/CSV** rather than a JSON **array** — `jwt_has_role` does `jsonb_array_elements_text(... -> 'roles')` and would silently match nothing (or everything).
- The hook function granted to **`anon`/`authenticated`** instead of **`supabase_auth_admin` only** (a privilege/claim-forgery hole).
- The `auth.users` FK **omitted**, or `academy.users.id` keyed to anything other than `auth.users.id` — or `work_os_user_id` reintroduced / `REDEX_WORKOS_*` env resurrected.
- Cross-org isolation "passes" only under F2's **synthetic** `set request.jwt.claims` and was never re-checked with a **real minted** token (the actual F3 deliverable).
- A real secret value (OIDC secret, JWT secret) written into a file or printed; or `persona` used to gate **permissions** (must be `roles`).
- `database.types.ts` hand-edited or not committed; `typegen-drift` not wired/blocking.
- The agent attempted **Work OS API federation** or stood up the `workos` schema (that is F2a / out of scope).

## 7. Definition of Done (the merge gate)
All §4 signals present · all §5 human checks ticked · CI `typecheck`/`lint`/`build`/`test`/`test:e2e`/`test:a11y`/`test:rls`/`typegen-drift` green and required · the `auth.users` FK on the Supabase migration · dev identities provisioned across two orgs (M12 fixtures) · the no-`work_os_user_id` guard live · types committed · `GOALS_INDEX` status for F3 → done. F3 makes F2's RLS **live**; M6/M11/M12 (which depend on F3) are unblocked once it merges.

---
*Known nit to enforce during the run: the claim mint is **server-side at token issuance** (the hook), never trusted from the client. F3 proves isolation with **real** claims; the **full** CCS adversarial isolation matrix is M12, not F3 — don't gold-plate it here.*
