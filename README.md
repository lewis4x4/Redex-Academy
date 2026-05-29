# Redex Academy — Build Kit

Everything Claude Code needs to build Redex Academy via a `/goal` workflow. **You handle Phase 0** (accounts, `.env`, stack); this kit drives the build from there.

## Use it in this order
1. **`DECISIONS_LEDGER.md`** — the authoritative decisions (greenfield shared-Supabase, the safety-veto model, the 6 sim engines, effort tiering, etc.). Everything else conforms to this. Read it once.
2. **`CLAUDE.md`** (+ `CODING_STANDARDS.md`) — copy these into your **repo root**. Claude Code reads `CLAUDE.md` on every run: toolchain, monorepo layout, pinned invariants, the 6 engines, when to flip on **UltraCode**, and how to run a `/goal`.
3. **`AGENT_ROLES_AND_ACCEPTANCE.md`** — how the build is executed (Claude Code standard vs UltraCode mode vs your review gates) and the merge/acceptance rubric. Read before goal #1.
4. **`goals/GOALS_INDEX.md`** — the ordered backlog + dependency graph + effort tiers. Then run each `goals/<ID>.md` through `/goal` in order.
5. **`migrations/`** — the concrete F2 artifact: `0001_init_academy.sql` (29 tables, RLS, the safety-veto trigger), `0002_workos_stub.sql` (cross-schema FK), `tests/0001_invariants_test.sql` (committed proof), `SCHEMA_NOTES.md`.

## Phase 0 (yours, before goal #1)
Follow `../Redex_Academy_Build_Sequencing_and_Setup.md` §2: create the accounts, provision Cloudflare R2/KV/D1/Stream, stand up the LRS, register SSO, and populate `.env` / Supabase Vault / Cloudflare Secrets. **Note:** per the ledger, the `REDEX_WORKOS_*` vars are removed (greenfield = one shared Supabase project), and secret values are pasted by you — never committed.

## The build order (from GOALS_INDEX)
`F1 → F2 → F2a → F3 → F4 → F5 → F5b → F6` (foundations) → `S1` (seed) → `M1…M12` (the Access-Control MVP slice, end to end). Respect each goal's `Depends on`.

## Effort tiering (token-aware)
- **UltraCode** (xhigh + dynamic workflow + adversarial verification; pair with auto mode): **F2, F2a, F3, F4, F5, F5b, F6, M5, M6, M7, M12.**
- **Standard:** **F1, S1, M1, M2, M3, M4, M8, M9, M10, M11.**

## Human gates (never agent-self-certified)
Run/verify yourself before merging: **F4** (offline on real hardware in airplane mode), **F6 + M7** (badge verifies at a public URL; signing-key handling), **M6** (safety-veto behavior on real Postgres), **F2/F3/M12** (RLS policy review). The migration's invariant test must pass on a live instance before the schema goals merge.

## Companion docs (one level up)
`Redex_Academy_Course_Bible.docx` (the 77-course curriculum the platform serves), `Redex_Academy_Platform_Build_Blueprint.docx` (the full architecture), `Redex_Academy_Build_Sequencing_and_Setup.md` (Phase-0 + `.env`).
