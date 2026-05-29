# ADR-0003 — Enforce the safety-veto in the database (trigger + `signoff_line_items`)

**Status:** Accepted

## Context

The credibility spine is the **Evaluator-signed field sign-off** scored against the curriculum's **§5.4 four-dimension rubric** (`safety_compliance`, `technical_execution`, `verification_documentation`, `independence_judgment`). The **safety-veto** is the single most liability-critical rule in the system: a single `0` on a safety/compliance line must force an automatic, non-overridable **fail** (e.g., an egress door that doesn't release on power loss, push-to-exit, or fire alarm). The Wave 4 review found this was **under-encoded** — modeled at too coarse a grain and relying on UI/Edge-Function logic, which a buggy or tampered client could bypass. The pass rule is **cross-row** (the scores are child rows of the sign-off), so a single-row `CHECK` constraint cannot express it. (ledger §B; wave3 §3.5; CLAUDE.md §5 invariant 1–2.)

## Decision

**Enforce the safety-veto in the database, at line-item grain, with defense in depth.**

- Add table **`academy.signoff_line_items`**: `(id, signoff_id FK, dimension enum, line_item_key text, score int CHECK 0..3, is_critical_safety bool, note)`.
- **Pass rule (a TRIGGER, not a CHECK):** `outcome = 'pass'` **ONLY IF every dimension's rollup ≥ 2 AND every `is_critical_safety` line item ≥ 2.** A single `0` on any safety line ⇒ automatic, **non-overridable** `fail`; a sign-off with no line items can never pass. The `BEFORE INSERT OR UPDATE` trigger (`tg_signoff_compute_outcome`) fires when `status` becomes `signed`/`failed`, rolls up the children, **forces** `outcome`, and **rejects signing** if the rubric does not support a pass.
- Computed by the `finalize-signoff` **Edge Function** *and* re-enforced by the **DB trigger** (defense in depth — three layers counting the UI).
- **Signed rows are immutable:** a trigger blocks UPDATE/DELETE on a signed sign-off and its line items (the only legal transition is `signed → void` with a reason); corrections require a **new voiding sign-off**.
- Ship a committed **pgTAP/SQL invariant test** proving: all-2s passes; one safety `0` fails; a late UPDATE to a signed row is rejected.

## Consequences

- The veto holds even if the Edge Function is buggy or bypassed — the **DB is the backstop**, and it is the layer we trust.
- Sign-offs become an **immutable liability record** ("this tech, this egress install, this date, this evidence, this calibrated Evaluator").
- M6 (the sign-off goal) is an **UltraCode + human-gate** goal: the three-layer veto and the per-course §5.4 line-item data are adversarially verified and human-reviewed before merge — never agent-self-certified.
- A goal may **never** simplify, stub past, or "temporarily" relax this rule; doing so fails review by default (it is a pinned invariant).
