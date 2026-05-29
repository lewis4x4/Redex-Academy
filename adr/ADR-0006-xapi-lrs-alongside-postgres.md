# ADR-0006 — xAPI + a Learning Record Store alongside Postgres

**Status:** Accepted

## Context

The product is **simulations and branching scenarios**, which emit *granular, semi-structured* learning telemetry: "learner chose branch B at decision node 3," "set partition delay to 0s (unsafe) then corrected," "aimed camera at 38 PPF then re-aimed." A single sim attempt can emit dozens to hundreds of events. We need (a) a write-optimized, analytics-shaped sink for that firehose, for sim tuning, branching-path analysis, and the content-lifecycle Watch list ("where do learners fail AC-203?"); and (b) an authoritative, relational store for gating, competency state, sign-offs, badges, and the joins to Work OS that the operational dashboards need. Pouring the firehose into transactional Postgres tables that also serve gating/dashboard queries would pollute the OLTP store and complicate RLS; hand-rolling the event model in relational tables reinvents a worse, less interoperable version of the xAPI vocabulary. (wave3 §4.)

## Decision

**Adopt xAPI (Experience API) with a dedicated, self-hosted Learning Record Store — running *alongside* Supabase Postgres, not instead of it.** Recommended LRS: **Yet Analytics SQL LRS** (open-source, self-hostable so we own the data); a managed conformant LRS is acceptable to defer ops for MVP. Division of labor:

- **LRS (xAPI) = the firehose / analytics truth.** Every meaningful interaction is an xAPI `actor/verb/object/result/context` statement; the client batches statements and **queues them offline in IndexedDB**, flushing on reconnect via the `xapi-bridge` Edge Function.
- **Postgres = the operational / authoritative truth.** Gating, competency state, sign-offs, badges, enrollments, and everything that must join to Work OS and enforce RLS live in Postgres.
- **The bridge** forwards statements to the LRS and **projects a small set of "milestone" statements** (attempt-completed-with-score, safety-veto-triggered) into Postgres summary tables (`sim_attempts`, `unit_progress`). **Rule of thumb: if a fact gates progression or issues a credential, it lives in Postgres; if a fact is for understanding behavior, it lives in the LRS.** Milestone facts live in both, cross-referenced for joinability.

## Consequences

- The OLTP store stays lean; the firehose is offloaded to a store built for it, and we keep the **industry-standard, interoperable** learning-analytics format (future-proofing, external tooling, a future buyer).
- We own a **standing operational component** (the LRS) — uptime, backups; mitigated by allowing a managed LRS in MVP (cost posture: tens of $/mo self-hosted).
- Gating/dashboards **never** query the LRS for an authoritative decision — they read Postgres summaries; this keeps the safety/credential path off the analytics store.
- Offline correctness depends on the **idempotent** statement flush (keyed on the client event UUID) — composes with the offline-sync invariant ("never fake a pass offline").
