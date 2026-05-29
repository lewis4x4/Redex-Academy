# Redex Academy — Architecture Decision Records (ADRs)

Short, durable records of the load-bearing architectural decisions for Redex Academy. Each ADR follows the same shape: **Context / Decision / Consequences / Status**. They are grounded in the **Build Decisions Ledger** (`wave4_decisions_ledger.md`) and the **Platform Architecture Blueprint** (`wave3_platform_architecture.md`); where any ADR conflicts with the ledger, **the ledger wins.**

> ADRs capture *why* a decision was made so a future engineer (or a `/goal` run) doesn't re-litigate it. They do not restate the full design — see `CLAUDE.md`, `CODING_STANDARDS.md`, and `migrations/SCHEMA_NOTES.md` for the operative rules.

## Index

| ADR | Title | Status | Source |
|---|---|---|---|
| [ADR-0001](./ADR-0001-build-not-buy.md) | Build a custom app, do not buy an LMS | Accepted | wave3 §1 |
| [ADR-0002](./ADR-0002-greenfield-shared-supabase.md) | Greenfield: one shared Supabase project, two schemas, shared `auth.users` | Accepted | ledger §A; wave3 §2.5 |
| [ADR-0003](./ADR-0003-safety-veto-in-db.md) | Enforce the safety-veto in the database (trigger + `signoff_line_items`) | Accepted | ledger §B; wave3 §3.5 |
| [ADR-0004](./ADR-0004-six-sim-engines.md) | Six declarative sim engines + spec-authoring model | Accepted | ledger §E; wave3 §5 |
| [ADR-0005](./ADR-0005-credential-crypto.md) | Credential crypto: `eddsa-rdfc-2022` / Ed25519 / `did:web` / hosted status list (+ Deno constraint) | Accepted | ledger §F; wave3 §3.7 |
| [ADR-0006](./ADR-0006-xapi-lrs-alongside-postgres.md) | xAPI + a Learning Record Store alongside Postgres | Accepted | wave3 §4 |
| [ADR-0007](./ADR-0007-effort-tiering.md) | Effort tiering — UltraCode vs standard per goal | Accepted | ledger §I |

All seven are **Accepted**. They are inputs to the `/goal` build and to the pinned invariants in `CLAUDE.md` §5.
