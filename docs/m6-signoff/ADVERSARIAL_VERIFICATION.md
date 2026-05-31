# M6 — Adversarial verification of the three-layer safety veto

**Goal:** M6 (Evaluator field sign-off + non-overridable safety veto + Work OS evidence) is the
single most liability-critical path in Redex Academy. Before committing, the veto and the
service-role write boundary were put through an **adversarial self-verification**: eight
independent skeptics, each tasked to **REFUTE** one safety/security property (default to
"broken" on any doubt) by tracing the actual code — the DB trigger (F2, consumed unchanged),
the `finalize-signoff` Edge Function, the RLS policies, and the UI.

> This is engineering self-verification. It **does NOT** substitute for the §J human gate
> (`RELEASE_GATES.md`): a designated **safety reviewer** + **security reviewer** still sign on a
> **live Postgres** before any real field sign-off.

Workflow: `m6-adversarial-veto` (8 skeptics, run `wf_68d7a88f-e33`).
Result: **6 properties HELD**; **2 findings** (1 HIGH, 1 LOW). The HIGH was a real M6 defect that has
been **fixed and regression-tested** (below). The LOW is a pre-existing F2 RLS gap with **no M6 safety
impact** — **surfaced** as an F2-hardening follow-up, **not** bent into M6 (modifying an F2 trigger/RLS
is out of M6 scope and an explicit red flag).

---

## Verdict table

| #   | Property attacked                                                                              | Verdict     | Severity |
| --- | ---------------------------------------------------------------------------------------------- | ----------- | -------- |
| 1   | The safety veto can be overridden (a critical-safety `0` still passes somewhere).              | **HELD**    | none     |
| 2   | A client can write `outcome='pass'` onto its own draft via raw PostgREST.                      | **refuted** | **LOW**  |
| 3   | `materializeLineItems` drops or un-flags a critical-safety line (weakening the veto).          | **HELD**    | none     |
| 4   | The idempotent replay branch promotes an **arbitrary** user/competency.                        | **refuted** | **HIGH** |
| 5   | Authorization is bypassable (stale JWT claim / wrong domain / non-evaluator / expired).        | **HELD**    | none     |
| 6   | The F2 DB trigger was modified, or its veto `RAISE` is caught/suppressed to force a pass.      | **HELD**    | none     |
| 7   | A signed sign-off is mutable, or `void` is abused to rewrite a signed row.                     | **HELD**    | none     |
| 8   | A pass can be faked offline / a secret ships in the client bundle / an unsanctioned migration. | **HELD**    | none     |

---

## Properties that HELD (the veto is defense-in-depth and non-overridable)

- **#1 / #6 — the veto holds at all three layers, non-overridably.** `outcome='pass'` requires
  **every dimension's MIN(score) ≥ 2 AND every `is_critical_safety` line ≥ 2**; a single critical
  `0` ⇒ `fail`. This is computed identically by (1) the DB trigger `tg_signoff_compute_outcome`
  (the trust boundary — consumed **unchanged**), (2) `_shared/rubric.computeSignoffOutcome` in the
  Edge Function (defense in depth), and (3) the UI preview (UX only). The function sets
  `status='signed'` **only** when _it_ computed a pass; the trigger then recomputes and `RAISE`s
  `check_violation` on any contradictory `signed`. The function **never** catches/retries that raise
  to force a pass — `finalize_rejected` is surfaced and the draft stays unsigned. Proven by
  `0001_invariants_test.sql` + `0004_signoff_finalize_test.sql` (run on a bare postgres in CI) and
  `_shared/rubric.test.ts`.
- **#3 — materialize cannot weaken the veto.** `dimension` and `is_critical_safety` are copied
  **verbatim from `signoff_line_item_templates`**; the client supplies **scores only**. A client
  cannot drop a line, add an unknown line, or un-flag a critical-safety line. `0004` proves all
  **7** AC-203 ⚠ flags survive materialization; `_shared/rubric.test.ts` proves a `0` on a template
  safety line still vetoes after materialize.
- **#5 — authorization is re-checked server-side from the TABLE.** The service role bypasses RLS,
  so the function _is_ the boundary: it requires role `evaluator` **and** a live
  `evaluator_authorizations` row (`status='authorized'`, not expired, course domain ∈ `domains[]`,
  same org) — read from the table, never the stale-until-refresh JWT claim alone. `_shared/authz.test.ts`
  proves wrong-domain / expired / suspended / non-evaluator / no-row are all refused.
- **#7 — signed rows are immutable.** `tg_signoff_immutable` + `tg_signoff_child_immutable` block
  UPDATE/DELETE on a signed row and its line items; only `signed→void` (with `void_reason`) is
  permitted. The function materializes line items while the parent is **draft**, then flips to
  signed. Proven by `0001`/`0004`.
- **#8 — no fake-pass offline, no client secret, no migration.** Finalize is online-only and
  service-role-only; the UI shows a "completes on reconnect" state offline and **never** reports a
  pass (`0002_rls_negative.sql` proves a client/evaluator cannot self-transition to `signed`). Only
  `VITE_*` values reach the browser; the service-role key lives in the function env (Vault). M6 adds
  **no** schema migration (it consumes F2/F2a/0003 unchanged) — typegen-drift stays green.

---

## Finding #4 — HIGH (FIXED) · idempotent replay could promote an arbitrary user

**Claim (refuted the "promotion is always for the verified candidate" property).** The idempotent
already-signed branch ran **before** the step-4 own-org candidate check and called
`promoteCompetency` using the **request-body** `candidate_user_id` / `competency_id`. So an
**authorized** evaluator could replay the id of a _single legitimately-signed_ sign-off with a
**swapped** candidate/competency in the body and promote an **arbitrary** user to `field_proven` —
unaudited, and bypassing the own-org check.

**This was a real defect introduced by M6** (not a pre-existing contract issue). The _fresh_ finalize
path was never vulnerable — it own-org-validates the candidate (step 4) and builds the sign-off from
the same values before promoting. Only the idempotent short-circuit was wrong.

**Fix** (`finalize-signoff/handler.ts`, idempotent branch):

1. The existing-row `SELECT` now also fetches `candidate_user_id, competency_id, org_id`.
2. The replay is **bound to the STORED row**: if the request's `org_id` / `candidate_user_id` /
   `competency_id` don't match the stored sign-off, it's refused **`409 signoff_mismatch`** — before
   any promotion.
3. Promotion uses the **STORED** subject (`ex.candidate_user_id` / `ex.competency_id` / `ex.org_id`),
   never the request body.
4. `promoteCompetency` now reports whether it actually changed state, so a **recovery** retry (the
   original call signed the row but died before promoting/auditing) **repairs** the audit trail,
   while a **pure** replay stays a true no-op (no duplicate `competency_promoted` audit rows).

**Regression coverage** (`finalize-signoff/handler.test.ts`, 6 tests, in CI deno-check + deno test):
a swapped-candidate replay → `409` + **zero** `competency_state` writes; a swapped-competency replay →
same; a matching replay promotes the **stored** candidate only + repairs audit; a pure replay is a
no-op; a different evaluator → `not_your_signoff`; a failed-row replay never promotes. (The handler
logic was extracted from `index.ts` into `handler.ts` so it is unit-testable without binding a
server; `index.ts` is now the thin `Deno.serve(handleRequest)` entrypoint — production behavior
unchanged.)

---

## Finding #2 — LOW (SURFACED, not fixed in M6) · client can stamp an inert `outcome` on its own draft

**Claim.** A client can `PATCH` `signoffs.outcome='pass'` onto its **own draft/submitted** row via
raw PostgREST: the `signoffs` RLS `WITH CHECK` clauses (F2, `init_academy.sql:1276-1281,1290-1293`)
constrain who/what can be inserted/updated but **omit the `outcome` column**, and
`tg_signoff_compute_outcome` **early-returns** for any status not in (`signed`,`failed`) — so it never
forces `outcome=NULL` on a draft.

**Why it's LOW / no M6 safety impact.** The stamped `outcome` is **inert**:

- Promotion and "pass" are gated on `status='signed'` **plus** a server-recomputed pass — never on the
  `outcome` column a client could touch. A client **cannot** set `status='signed'` (proven by
  `0002_rls_negative.sql`: `insufficient_privilege`).
- The moment status legitimately becomes `signed`/`failed`, the trigger **recomputes** `outcome` from
  the line items, overwriting any client value.
- M6's `finalize-signoff` creates the draft with `outcome` unset and never trusts a client-supplied
  outcome. So this is an orphaned, never-read field on an unsigned row.

**Disposition — surfaced, not bent.** Both candidate fixes (tighten the `signoffs` RLS `WITH CHECK`
to forbid client writes to `outcome`, **or** make `tg_signoff_compute_outcome` force `outcome=NULL`
for non-terminal statuses) require modifying an **F2** RLS policy or trigger. That is **out of M6
scope** and an explicit M6 red flag ("an agent modified the F2 triggers"). Per CLAUDE.md §5, a
contract change is an F2 migration to be **surfaced for human review**, not made inside a consumer
goal. Recorded as an **F2-hardening follow-up** in `RELEASE_GATES.md`. M6 itself is sound: it never
trusts the client `outcome`.

---

## Bottom line

The non-overridable three-layer safety veto, the server-side authorization boundary, materialize
integrity, signed-row immutability, and the no-fake-pass/no-secret/no-migration invariants **all
held** under adversarial tracing. The one real M6 defect (HIGH #4) is **fixed and regression-tested**;
the one pre-existing F2 RLS gap (LOW #2) is **inert for M6** and **surfaced** for an F2 follow-up
rather than bent into this goal. The §J human safety + security reviewers still sign on a live stack
before field use.
