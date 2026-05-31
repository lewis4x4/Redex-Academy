# M6 — Evaluator sign-off + three-layer safety veto · Release gates (ledger §J)

**The single most liability-critical goal.** These are **release gates, not merge gates**
(DECISIONS_LEDGER §J, CLAUDE.md §9): the PR merges on green CI (the locked invariant suite),
but a **designated qualified reviewer** — the **safety reviewer** for the veto/content, the
**security reviewer** for the service-role function + tenant isolation — **MUST** sign each
item below, **on a live Postgres**, **before any real field sign-off**. The agent does **not**
self-certify any of these. Adversarial self-verification (see `ADVERSARIAL_VERIFICATION.md`)
does NOT substitute for the human gate.

## What CI already proves (merge-clearing, no human needed)

- **DB layer (the trust boundary)** — `0001_invariants_test.sql` (all-2s ⇒ pass + signed_at;
  one safety 0 ⇒ signing rejected + outcome fail; dimension rollup <2 rejected; signed-row
  UPDATE/DELETE rejected; signed→void permitted) + **`0004_signoff_finalize_test.sql`** (the
  rubric MATERIALIZED FROM templates preserves all 7 ⚠ flags; the veto fires; **no line items
  can never pass**; the materialized signed row is immutable). Run on a bare postgres:16.
- **Edge-Fn layer** — `_shared/rubric.test.ts` (the pass-rule mirrors the trigger: MIN-per-dimension,
  any critical-safety 0 ⇒ fail, no-lines ⇒ fail) + `_shared/authz.test.ts` (authorized-in-domain
  passes; wrong-domain / expired / suspended / non-evaluator refused) + `deno check` of the function.
- **UI layer** — `signoffSource.test.ts` (the preview mirrors the rule) + the e2e
  (`m6-signoff.spec.ts`: pass→promoted; a safety 0 → the UI blocks signing-as-pass + the server
  records a fail; offline → finalize disabled) + axe on the sign-off screen + EN/ES key resolution.
- **Server-only sign** — `0002_rls_negative.sql` proves a client/evaluator can create a draft but
  **cannot self-transition to `signed`** (finalize is service-role only).

## Release-gate checklist (pending release verification, on a LIVE stack)

- [ ] **Safety reviewer — three-layer veto on live Postgres.** By hand: an all-≥2 AC-203 sign-off
      finalizes `outcome='pass'`; then set **one** ⚠ line (e.g. `ac203.release_on_power_loss`) to `0`
      → finalizing is **rejected / fail, non-overridable** at the trigger AND the Edge Fn AND blocked
      in the UI; a sign-off with **no line items** cannot pass.
- [ ] **Safety reviewer — the rubric line-item DATA is correct.** Spot-check that all **7** AC-203 ⚠
      keys arrive flagged `is_critical_safety=true` after materialization (else the veto silently
      weakens), and that AC-201/AC-202's `safety_compliance` non-critical lines are NOT over-flagged.
- [ ] **Security reviewer — the function is the access boundary.** Confirm finalize-signoff re-checks
      the caller server-side (role `evaluator` + a **live** `evaluator_authorizations` row:
      `status='authorized'`, not expired, the course domain ∈ `domains[]`, same org) and does NOT trust
      the JWT `evaluator_authorized`/`domains` claim alone (a just-revoked authorization must be refused).
      Confirm an unauthorized / wrong-domain / expired / suspended / non-evaluator caller is refused.
- [ ] **Security reviewer — nothing safety-critical is client-computed.** The client cannot set
      `signed`/`outcome`; the outcome is computed server-side AND re-enforced by the DB trigger; the
      function never catches/suppresses the trigger's SAFETY VETO raise to force a pass.
- [ ] **Immutability + audit on live DB.** A late UPDATE/DELETE to a `signed` sign-off (API, /sync, UI)
      is rejected; only `signed→void` (with `void_reason`) succeeds; every finalize/void appends an
      `audit_log` row (append-only).
- [ ] **Deploy.** Deploy `supabase/functions/finalize-signoff` with `SUPABASE_SERVICE_ROLE_KEY` in the
      function env (Supabase Vault, never a client bundle). Confirm the prod Data API exposes
      `academy` + `workos` (PostgREST `db.schemas`).
- [ ] **EN/ES content SME accuracy.** The chrome is EN/ES; the rubric line **labels** are DB content
      (English) — professionally SME-translate them (and keep the locked safety glossary verbatim)
      before field use; ES safety wording is SME-reviewed.
- [ ] **Security reviewer — idempotent replay binds to the stored sign-off (adversarial HIGH #4).** On a
      live stack, replay a legitimately-signed `signoff_id` with a **swapped** `candidate_user_id`
      (and again with a swapped `competency_id`): each is rejected `409 signoff_mismatch` with **no**
      `competency_state` write; a faithful replay promotes only the **stored** candidate.
- [ ] **Reviewed `ADVERSARIAL_VERIFICATION.md`; all findings addressed** (HIGH #4 fixed + regression-tested;
      LOW #2 surfaced as an F2-hardening follow-up, no M6 safety impact).

## Design observations surfaced (NOT invariant bends — recorded for the reviewer, not blockers)

- **`competency_source` enum has no `signoff` value** (`course`/`rpl`/`bootstrap`). The promotion uses
  `source='course'` (the sign-off is the course's prove-one) with `status='field_proven'` (the status
  is what M7 consumes). Adding a `signoff`/`field` source would be an **F2 enum migration** — out of
  M6 scope; surfaced, not added.
- **`audit_action` has no `signoff_failed`/`signoff_finalized`.** M6 audits `signoff_signed` +
  `competency_promoted` (on pass) and `signoff_voided` (on void). A failed finalize is recorded by the
  `failed` sign-off row itself (no audit_action fits; inventing one is an F2 enum migration).
- **An evaluator cannot read `workos.jobs` via client RLS** (the policy admits the assigned tech +
  manager-tier roles only). The UI therefore **binds the job by id/ref** and the **service-role
  function validates own-org**. A dropdown picker would need an evaluator-read RLS policy = an **F2a
  migration** — surfaced, not added. The own-org binding is server-authoritative regardless.
- **Multi-write atomicity.** supabase-js has no multi-statement transaction; finalize orders writes
  draft→lines→sign→promote→audit idempotently (a client-supplied stable `signoff_id` makes a retry
  safe). True all-or-nothing would need a **SECURITY DEFINER RPC** = an F2 migration — surfaced as a
  prod hardening, not added. The signed row's outcome is always trigger-correct; a promote that fails
  after a sign is recoverable + re-runnable.
- **R2 evidence serving is absent.** `signoff_evidence.r2_key` is recorded (a reserved Redex-owned key)
  alongside the Work OS ref, but there is **no R2 upload / signed-URL Worker yet** (the table mandates
  short-lived signed URLs after re-auth). Building the evidence-capture + signed-URL serving path is a
  **release-gate / future-goal** item — M6 records the refs.
- **M7 issue-badge is not built.** M6 writes `field_proven` + the audit and stops there; OB 3.0
  issuance (M7) rides this `field_proven` later. M6 never calls a non-existent function.
- **No schema migration** — M6 consumes the F2/F2a/0003 schema + triggers unchanged (typegen-drift safe).
- **F2-hardening follow-up (adversarial LOW #2) — the `signoffs` RLS `WITH CHECK` does not constrain
  the `outcome` column.** A client can `PATCH` `outcome='pass'` onto its **own draft/submitted** row
  via raw PostgREST (`init_academy.sql:1276-1281,1290-1293` omit `outcome`; `tg_signoff_compute_outcome`
  early-returns for non-terminal status). The value is **inert** — promotion/"pass" gate on
  `status='signed'` + a server recompute (a client cannot set `signed` — `0002_rls_negative.sql`), and
  the trigger overwrites `outcome` the moment status becomes terminal. M6 never trusts the client
  `outcome`. The fix (tighten the `signoffs` `WITH CHECK` to forbid client `outcome` writes, or force
  `outcome=NULL` for non-terminal statuses in the trigger) is an **F2** RLS/trigger change — out of M6
  scope and a red flag to make inside a consumer goal — so it is **surfaced here for an F2 migration**,
  not bent into M6. See `ADVERSARIAL_VERIFICATION.md` finding #2.
- **Replay-binding (adversarial HIGH #4) — FIXED in M6.** The `finalize-signoff` idempotent branch now
  binds a replay to the **stored** sign-off (org + candidate + competency) and refuses a mismatch
  (`409 signoff_mismatch`), promoting only the stored subject — so a replay of a signed id cannot
  promote an arbitrary user. Security reviewer: on a live stack, replay a signed `signoff_id` with a
  swapped `candidate_user_id` and confirm it is rejected with **no** `competency_state` write. Covered
  in CI by `finalize-signoff/handler.test.ts`; see `ADVERSARIAL_VERIFICATION.md` finding #4.
