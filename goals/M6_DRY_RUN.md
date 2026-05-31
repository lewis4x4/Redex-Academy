# M6 — Dry-Run: Expected Output & Human-Verify Checklist

A known-good target for the **single most liability-critical ultracode run** in the build. Read this before running `/goal M6`, then check the result against §4–§6. If anything in §6 (Red Flags) appears, **reject the run and re-prompt** — this is the safety boundary; a wrong pass here can get someone trapped behind a mag-locked door.

- **Goal:** build the Evaluator field sign-off against a **Work OS job id** + the `finalize-signoff` Edge Function, wiring the §5.4 four-dimension / 0–3 / safety-veto rubric (incl. AC-203's ⚠ lines) so the veto is enforced at **three layers** (DB trigger + Edge Fn + UI). On pass: attach evidence, promote `competency_state` to `field_proven`, trigger badge issuance (hand to M7), and write `audit_log` — **all as the service role**.
- **Tier:** ultracode (xhigh + dynamic workflow + **adversarial verification**). **Pair with auto mode.** (Ledger §I.)
- **Depends on:** **F2a merged** (the cross-schema FK `academy.signoffs.work_os_job_id → workos.jobs(id)` — without it the job join fails), **F3** (the `evaluator_authorized`/`domains` JWT claim), **F4** (offline draft path + `/sync` rejection of server-only writes), **S1** (the AC-201/202/203 line-item templates in `academy.signoff_line_item_templates` + `is_critical_safety` flags + competencies; the rubric-template table `0003` is applied in F2 before the seed).
- **Human gate (HARD, ledger §J / M6 spec):** a human reviews the **three-layer veto + the rubric line-item data + the Work OS evidence binding** on a **live Postgres** before release. Adversarial self-verification does NOT substitute.

---

## 1. The `/goal` invocation to give Claude Code
> Run goal M6 per `goals/M6.md`. The DB safety-veto + immutability triggers ALREADY EXIST in F2 (`academy.tg_signoff_compute_outcome`, `academy.tg_signoff_immutable`, `academy.tg_signoff_child_immutable` in `migrations/0001_init_academy.sql` §12) — **consume them, do not modify them** (if they need changes, that is an F2 migration — STOP and surface it). The line-item rubric comes from S1 via the canonical rubric-template table **`academy.signoff_line_item_templates`** (migration `0003`, the resolved [SCHEMA GAP] — SEED_NOTES §4): `finalize-signoff` reads the course's rows from that table (by `course_id`) and materializes one `signoff_line_items` row per template line (preserving `dimension` + `is_critical_safety` so the trigger fires correctly). It does **not** read the rubric from `content_ref` (the `signoff_prep` `content_ref` is now just a pointer at the table). The function is **service-role** and is the write boundary: it re-checks the caller's JWT/role + evaluator domain authorization itself (service_role bypasses RLS). Out of scope: the OB 3.0 credential construction/signing (that is **M7** — M6 only *triggers* issuance + writes `field_proven`); the manager dashboard (M11); building the sims (M3–M5).

## 2. Expected repo changes (the file tree M6 should produce)
```
supabase/
  functions/
    finalize-signoff/
      index.ts                    # the service-role Edge Function (Deno): validates rubric,
                                  #   re-checks JWT/role + evaluator domain, computes outcome,
                                  #   inserts/updates signoffs+line_items, attaches evidence,
                                  #   promotes competency_state, triggers issue-badge, writes audit_log
      deno.json / import_map      # Deno deps (Edge Functions run on Deno — ledger §F)
  functions/_shared/
    rubric.ts                     # reads academy.signoff_line_item_templates (by course_id); pass-rule helper (mirrors the DB trigger)
    authz.ts                      # evaluator-authorization + domain check (reads evaluator_authorizations / JWT)
apps/web/
  src/features/signoff/           # Evaluator sign-off UI: pick candidate + competency/badge target +
                                  #   Work OS job (own-org only), score each §5.4 line 0–3, UI veto (UX layer),
                                  #   evidence capture (Work OS refs + R2 copy). Colorblind-safe, mobile-first.
supabase/tests/
  0002_signoff_veto_test.sql      # DB-layer: all-2s pass; one safety 0 => fail; signed-row immutability; no-lines => fail
packages/db-types/database.types.ts # NO new migration in M6 → types unchanged (the 0003 rubric-template table landed in F2, so its type is already generated)
.github/workflows/ci.yml          # adds the M6 e2e (Playwright) + the offline + rls-negative + audit jobs
```
**No new migration is required for M6** — it consumes the F2 schema (incl. `0003_signoff_line_item_templates.sql`, applied in F2 before the S1 seed) + F2 triggers + the F2a FK + the S1 seed. `finalize-signoff` reads the rubric from the `academy.signoff_line_item_templates` table (not `content_ref`). M6 adds no DDL, so `packages/db-types/database.types.ts` is unchanged (the template table's type was already generated when `0003` landed in F2).

## 3. Commands it should run
```bash
supabase start                                   # local stack: 0001 + 0002 migrations + the S1 seed applied
supabase functions serve finalize-signoff        # run the Edge Fn locally against the local stack
# DB-layer veto + immutability proof (the trust boundary):
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/0002_signoff_veto_test.sql
pnpm test --filter signoff                        # unit: pass-rule in the Edge Fn; domain-authz; rubric materialization
pnpm exec playwright test signoff                 # e2e: sign vs a job id → pass → field_proven + issuance; safety 0 → fail; UI blocks override
pnpm typecheck && pnpm lint
```
(The Edge Fn is invoked with a **service-role** server context but re-checks the *caller's* JWT/role; the e2e exercises an authorized Evaluator JWT, a wrong-domain Evaluator, and a cross-org reader.)

## 4. Expected RESULT signals (acceptance evidence)
- **Happy path:** an Evaluator authorized for `AC` signs off a candidate against a `workos.jobs` row (own-org only); on a clean rubric the function writes `signoffs.status='signed'`, the **trigger forces** `outcome='pass'` and stamps `signed_at`, `competency_state` flips to **`field_proven`**, an `audit_log` row (`action='signoff_signed'` + `'competency_promoted'`) is appended, and **`issue-badge` is invoked** (M7's path).
- **Safety `0` ⇒ auto-fail at all three layers:** a single `0` on any AC-203 ⚠ line (e.g. `ac203.release_on_fire_alarm`) forces `outcome='fail'`, non-overridable —
  - **DB trigger:** attempting `status='signed'` on that rubric raises `SAFETY VETO: sign-off … cannot be signed as pass …` (`errcode check_violation`);
  - **Edge Fn:** computes `fail` and refuses to finalize as pass (returns the failure, writes a `failed` sign-off, no promotion, no issuance);
  - **UI:** the sign button is blocked / the override is impossible.
- **Pass rule exact:** `outcome='pass'` ONLY IF every dimension rollup (MIN score per dimension) `≥2` AND every `is_critical_safety` line `≥2`; a sign-off with **no line items can never pass** (trigger sets it `fail`).
- **Row immutable after sign:** a late `UPDATE`/`DELETE` to a `signed` sign-off (via API, `/sync`, or UI) is **rejected** by `tg_signoff_immutable` / `tg_signoff_child_immutable`; the only legal transition is `signed → void` (with a `void_reason` + `superseded_by`); a correction is a **new voiding sign-off**.
- **Evidence binding:** evidence is the job's own photos/signatures/closeout (referenced by `signoff_evidence.work_os_ref`) **plus a Redex-owned immutable copy** in R2 (`signoff_evidence.r2_key`); sensitive evidence is fetched via short-lived **signed URLs** after re-auth, never a blanket `SELECT`.
- **Authorization:** an Evaluator **not** authorized for the competency's domain (`evaluator_authorizations.status<>'authorized'`, expired, or domain not in `domains[]`) **cannot finalize** — rejected by the function's own authz check.
- **Tenant isolation (RLS-negative):** a cross-org Evaluator/manager sees **zero** of another org's sign-offs/evidence/jobs.
- **Server-only:** the finalize path is unreachable offline — an offline client can queue a **draft** + evidence Blobs (F4) but cannot set `outcome` or promote competency; `/sync` rejects any illegal server-only state write.
- **Audit:** every finalize AND every void writes an **append-only** `audit_log` row (UPDATE/DELETE on `audit_log` is blocked by `tg_audit_append_only`).
- **The adversarial-verification report** the ultracode run produced is present and its findings are addressed.

## 5. HUMAN-VERIFY checklist (a qualified reviewer, before release — HARD GATE, not agent-self-certified)
- [ ] **Safety-veto behaves on a LIVE Postgres** (by hand, not just CI parse): create a draft AC-203 sign-off, set every safety line `≥2` and every dimension `≥2` → finalizing yields `outcome='pass'`; then set **one** safety line (e.g. `ac203.release_on_power_loss`) to `0` → finalizing is **rejected / `fail`, non-overridable**; a sign-off with **no line items** cannot pass.
- [ ] **Signed row is immutable on the live DB:** `UPDATE` a `signed` sign-off's `outcome` or a line-item `score` → rejected; `DELETE` → rejected; only `signed → void` (with `void_reason`) succeeds.
- [ ] **The function re-checks the caller's JWT/role + evaluator domain** — it does NOT trust the client; confirm an unauthorized/wrong-domain/expired Evaluator is refused **inside the function** (service_role bypasses RLS, so the function IS the access-control boundary).
- [ ] **Nothing safety-relevant is computed client-side / accepted from the client:** the client cannot set `signed`/`outcome`; the outcome is computed server-side AND re-enforced by the DB trigger (the client's submitted scores are inputs only).
- [ ] **The rubric line-item source is correct:** `finalize-signoff` materializes `signoff_line_items` from the canonical **`academy.signoff_line_item_templates`** table (the resolved [SCHEMA GAP], `0003`), preserving every `dimension` + `is_critical_safety` flag — spot-check that all **7** AC-203 ⚠ keys arrive flagged `is_critical_safety=true` (else the veto silently weakens). It must NOT read the rubric from `content_ref`.
- [ ] **Evidence is a Redex-owned immutable copy** (`r2_key`) in addition to the Work OS reference (`work_os_ref`); sensitive evidence is served via signed URLs after re-auth, never inline.
- [ ] **Three-layer defense reviewed:** DB trigger (F2, the trust boundary), Edge Fn (this goal), UI (this goal, UX only) — all three tested; the DB is authoritative.
- [ ] **Work OS job binding:** the sign-off references a real `workos.jobs(id)` via the F2a cross-schema FK (`ON DELETE RESTRICT`); own-org only.
- [ ] Reviewed the **adversarial-verification report**; findings addressed.

## 6. RED FLAGS — reject the run if you see any of these
- **The outcome is computed ONLY in the function and not also enforced by the DB trigger** — a buggy/tampered function could then persist a passing sign-off that violates the rule. The `tg_signoff_compute_outcome` trigger is the backstop and MUST remain the trust boundary; the function recomputing it is defense-in-depth, never the sole gate.
- **The veto re-implemented as a `CHECK` constraint** (instead of consuming the F2 cross-row TRIGGER) — a CHECK cannot read sibling line items and would silently let unsafe sign-offs pass.
- **The client is allowed to set `signed`/`outcome`** (or to insert/self-transition a `signed` sign-off) — clients may only write `draft`/`submitted` (`signoffs_insert_evaluator` WITH CHECK `status in ('draft','submitted')`); finalize is service-role only.
- **A safety `0` is overridable** anywhere (UI lets you sign through it, the function has an override flag, the trigger is bypassed) — the safety veto is non-overridable, full stop.
- **Evidence is NOT stored as a Redex-owned immutable copy** (only a Work OS pointer, or mutable, or returned inline by a blanket `SELECT` instead of a signed URL).
- **The agent modified the F2 triggers** (weakened/edited `tg_signoff_compute_outcome` / `tg_signoff_immutable` / `tg_signoff_child_immutable`) instead of consuming them and surfacing any needed change as an F2 migration.
- **`finalize-signoff` invents its own line-item shape / rubric** instead of reading S1's canonical `academy.signoff_line_item_templates` table — breaks the invariant-5 contract and can drop safety flags. (Reading from the old `content_ref` blob is also wrong now — `0003` made the table the single source of truth.)
- **Competency promotion or issuance runs without a passing, signed sign-off** (e.g. promoted on `submitted`, or issuance triggered off a `fail`) — a badge may only ride a `field_proven` that passed the veto.
- **F2a not actually merged** — the `work_os_job_id → workos.jobs` join/FK errors (M6 cannot bind a real job without it).
- Any real secret written to a file; or the veto/immutability "passed" by parse-only with no live Postgres.

## 7. Definition of Done (the merge gate)
All §4 signals present · all §5 HARD-GATE human checks ticked on a **live Postgres** (veto behaves, signed row immutable, function re-checks JWT/role, nothing safety-critical client-computed) · the committed three-layer veto review checklist filled · CI green and required (DB veto test, signoff unit, Playwright e2e, rls-negative, offline, audit) · the adversarial-verification report addressed · GOALS_INDEX status for M6 → done. Only then is **M7** (real issuance off the `field_proven`/issuance trigger) on solid ground.

---
*Known nits to enforce during the run: (1) the rubric template lives in `academy.signoff_line_item_templates` (the canonical table, `0003` — the resolved S1 [SCHEMA GAP]) — `finalize-signoff` must materialize `signoff_line_items` from THAT table and preserve `is_critical_safety` per line, or the veto degrades silently. Do not read the rubric from `content_ref` (now just a pointer). (2) The DB trigger is authoritative — the Edge Fn computing the outcome is required defense-in-depth, but if the trigger and the function ever disagree, the trigger wins by rejecting the write. (3) Finalize is server-only and never offline — the client queues drafts (F4), the server computes the verdict.*
