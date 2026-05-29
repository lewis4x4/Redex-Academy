# Redex Academy — Coding Standards

> Detailed conventions referenced from [`CLAUDE.md`](./CLAUDE.md) §7. CLAUDE.md is the primary context and the pinned invariants there always win. This file expands the day-to-day "how we write code" rules. Where this conflicts with the Build Decisions Ledger (`wave4_decisions_ledger.md`), the ledger wins.

---

## 1. TypeScript

- **Strict mode on** (`strict: true`, `noUncheckedIndexedAccess: true`). Shared `tsconfig` lives in `packages/config`.
- **No `any`.** Use `unknown` + a Zod parse at boundaries. A genuinely unavoidable `any` carries an inline `// eslint-disable-next-line` with a one-line reason.
- Prefer **discriminated unions** over boolean flags for state (e.g. sim Verdict: `{ kind: 'pass' } | { kind: 'fail'; reasons } | { kind: 'safety_veto'; line_item_key }`).
- Exhaustiveness-check unions with a `never` default in switches.
- Derive types from a single source: Postgres → `packages/db-types/database.types.ts` (generated); shapes that cross the wire → Zod schema first, `z.infer` the type.

## 2. Zod at boundaries

Validate at every trust boundary; never trust a payload by its TS type alone.

- **Env:** parse `import.meta.env` / `Deno.env` through a Zod schema at startup; fail fast on a missing required var.
- **Edge Functions:** parse the request body and the JWT claims (`org_id`, `role`, `persona`, `evaluator_authorized`, `domains`) with Zod before any logic.
- **Sim specs:** every engine's declarative JSON is validated against its JSON Schema *and* a Zod schema in `packages/sim-schemas` before it runs. A spec that fails validation never loads.
- **Forms (authoring admin):** Zod resolver on every form; the same schema validates server-side.

## 3. RLS-first data access

- **Design the policy before the query.** Every table is deny-by-default; write the SELECT/INSERT/UPDATE policies as part of the migration that creates the table.
- **Client reads** go directly through the Supabase client and rely on RLS for isolation. Do not build "filter by org_id in the WHERE clause" as the security mechanism — RLS is the boundary; query filters are for UX only.
- **State writes** (anything in invariant §5.3 of CLAUDE.md: `competency_state`, `credentials`, `signoffs`/line items, `recert_schedules`, `enrollments` status transitions) go through **service-role Edge Functions** after server-side authz. End-user roles hold **no write grant** on these tables.
- A repo lint/test asserts the client never imports a service-role key and never writes a state table.
- **Tenant key:** every personal/tenant policy includes `org_id = (auth.jwt() ->> 'org_id')::uuid`. Catalog (published courses/units/sims) is the only cross-tenant-readable class, via an explicit "published content is org-agnostic" policy.

## 4. Postgres / migrations

- Migrations in `supabase/migrations/`, timestamped, **forward-only**; never edit a merged migration — add a new one.
- **RLS ON from the migration that creates the table.** No table ships without policies.
- Enums: use Postgres enums for closed, stable sets (status, dimension, role keys); `text` + a CHECK or a lookup table for sets that churn.
- Cross-row business rules (the safety-veto pass rule) are **triggers**, not CHECK constraints. Single-row rules (`score 0..3`) are CHECK constraints.
- Every mutable-by-users table has `created_at`, `updated_at`, `created_by`.
- After ANY schema change: regenerate `database.types.ts` and commit both (CLAUDE.md §4). Never hand-edit generated types.
- Ship invariant tests (pgTAP/SQL) in `supabase/tests/` for safety-veto, signed-row immutability, and RLS isolation.

## 5. Edge Functions (Deno)

- One responsibility per function; the canonical set: `finalize-signoff`, `issue-badge`, `xapi-bridge`, `grade-open-response`, `sim-feedback`, `recert-scan`, `sync`.
- Parse input with Zod first; authorize with JWT claims; do the work; return a typed result.
- **Idempotency:** `/sync` and any append-event endpoint dedupe on `UNIQUE(client_event_uuid)`. Re-running a request must not double-apply.
- AI/LRS calls degrade gracefully: a timeout or budget-cap hit falls back to authored static content; the user-facing feature still works.
- Deno-compatible deps only. The VC-signing path obeys CLAUDE.md invariant §7 (Deno-compatible lib or a dedicated Node Worker — decided in F6).

## 6. Error handling

- Never swallow an error. Log with context; return a typed, user-safe error to the client (no stack traces, no secret values).
- Offline paths: catch network failure, queue the event in Dexie, surface "will complete on reconnect." Never present a queued action as a confirmed server result.
- Surface, don't paper over: if a goal hits a missing contract or an invariant conflict, fail loudly and stop (CLAUDE.md §10 step 2).

## 7. Naming

- **Course codes** (`FND-101`, `AC-203`) are canonical IDs. Use reconciled codes only; note retired codes (`VID-310`/`SEC-310`) — never reintroduce them.
- **Competency codes:** `DOMAIN.THING` uppercase (`EGRESS.MAGLOCK_FAILSAFE`).
- **Persona vs role are separate.** Persona ∈ {nova, marco, priya, dana} drives UI/recommendations. Role ∈ {learner, evaluator, manager, author, curriculum_admin, org_admin, exec, support} drives permissions. Never gate a permission on persona or render UI off a role alone where persona is meant.
- Files/dirs: kebab-case; React components PascalCase; hooks `useThing`; Zod schemas `thingSchema`; types `Thing`.
- i18n keys: dot-namespaced `domain.course.unit.key` (e.g. `ac.203.signoff_prep.maglock_warning`), lowercase, stable (keys are contracts — rename via migration, not in place).

## 8. i18n & the safety glossary

- All `1xx`/`2xx` strings exist in **EN + ES** before a goal is done; +Tagalog for INT/ADC/support where the curriculum requires.
- The **locked safety glossary** (fail-safe / fail-locked, REX, egress, PPF, partition) is a non-overridable term table in `packages/i18n`. The translation layer must render these identically across languages and field docs — a goal may not localize or paraphrase a glossary term.
- No hardcoded user-facing strings in components — everything goes through `react-i18next`.

## 9. Accessibility (WCAG 2.1 AA)

- Color is never the sole carrier of meaning — **shape + text + color** for every pass/fail/state indicator (egress sims, the PoE-budget meter). Assert this in axe/e2e tests.
- Sims are **keyboard-navigable**; interactive targets are labeled for screen readers.
- Contrast meets AA; video carries captions/transcripts.
- a11y is enforced by the shared `packages/ui` primitives + axe-core in CI.

## 10. Offline / PWA

- Workbox precaches the app shell; a course "field pack" (sim JS, JSON specs, images, captions, checklists, sign-off rubric) downloads on demand. Video is opt-in "download for offline," never force-cached.
- Dexie stores: downloaded packs, in-progress sim attempts + telemetry, queued sign-off drafts + evidence blobs, queued xAPI statements.
- Sync model: append-only events with client UUID + device timestamp (no merge conflicts; server dedupes); last-writer-wins **only** for drafts/prefs (tie-broken by server receipt). Finalized sign-offs are immutable (server rejects late edits).
- Competency/credential state is **server-authoritative** — never computed offline (CLAUDE.md invariant §5.5).

## 11. Sims (engine consumers)

- Author a **declarative JSON spec** validated by the engine's JSON Schema + Zod — never write a bespoke runtime (CLAUDE.md §6).
- Every sim uses the shared **Verdict hook** (deterministic scoring + safety veto). AI only *explains* a Verdict; it never decides pass/fail.
- Emit xAPI through the shared telemetry emitter; route fixtures through the signed-fixture Worker (never bundle a fixture; never a live API).
- Fixtures must be `sanitized = true` to publish — the publish-gate test enforces it.

## 12. Testing detail

- Unit (Vitest): pure logic, Verdict/scoring + safety-veto pass/fail/veto cases, Zod schema round-trips.
- e2e (Playwright): the user-visible done-criterion; an **offline path** for any field goal; the RLS negative matrix for tenant goals (cross-org actor → zero rows).
- a11y (axe): every new screen; colorblind-safe + keyboard assertions.
- Invariant tests are **locked** — they live in the repo and a goal that weakens one fails review by default.
- AI guardrail test: the model never issues a safety/egress pass; near-threshold and all safety-relevant open responses route to SME.
- Where a criterion is not CI-automatable, produce a human-verification artifact + checklist and mark the goal "pending human verification" (CLAUDE.md §8.8).
