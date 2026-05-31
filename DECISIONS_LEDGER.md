# Redex Academy — Build Decisions Ledger (authoritative for the build kit)

This ledger resolves the Wave 4 review findings (`wave4_review_buildreadiness.md`, `wave4_review_architecture.md`, `wave4_review_curriculum_alignment.md`) into locked decisions. Every build-kit document (CLAUDE.md, the goal specs, the F2 schema, the agent-roles/acceptance rubric) MUST conform to this ledger. Where a source doc (wave3 blueprint, wave2 curriculum, Build Sequencing) conflicts with this ledger, **the ledger wins** for the build.

## Locked context
- **Executor:** Claude Code via a `/goal` workflow, one goal at a time. Brian (expert COO/builder) does **Phase 0** himself (accounts, `.env`, full stack).
- **UltraCode** = a Claude Code **effort mode** (Opus 4.8): pins effort to `xhigh` and auto-spins dynamic workflows (parallel subagents + independent/adversarial verification). It burns substantially more tokens → reserved for heavy/critical goals; pair with **auto mode**. It is NOT a separate agent.
- **Toolchain (locked):** pnpm + Turborepo monorepo; Vite + React 18 + TypeScript (strict) + Tailwind; TanStack Query + Zod; React-Three-Fiber + Three.js + XState for sims (**Rapier physics deferred from MVP**); Workbox + Dexie for offline PWA; Supabase (Postgres, RLS, Edge Functions in **Deno**, Auth, Realtime, Storage) + Supabase CLI; Cloudflare Workers/R2/Stream/KV/D1 via Wrangler; react-i18next; Vitest + Playwright + axe-core; ESLint + Prettier + Husky/lint-staged; GitHub Actions + Netlify; self-hosted **Yet Analytics SQL LRS** (a managed LRS is acceptable for MVP); a W3C-VC / Open Badges 3.0 signing library.

## A. Identity & tenancy — greenfield, LOCKED
- **One Supabase project.** Two Postgres schemas: **`academy`** and **`workos`**. **Shared `auth.users`.**
- `academy.users.id` **=** `auth.users.id`. **DELETE** any `work_os_user_id` column — there is one identity space; join cross-schema on `auth.users.id`.
- **One canonical tenant table `academy.orgs`** that BOTH schemas' RLS key on, via `org_id = (auth.jwt() ->> 'org_id')::uuid`.
- **Cross-schema FK:** `academy.signoffs.work_os_job_id → workos.jobs(id)`.
- PostgREST: expose `academy` (and `workos` as needed); set `search_path`; explicit grants per role.
- **`.env`:** DELETE `REDEX_WORKOS_DB_URL`, `REDEX_WORKOS_API_URL`, `REDEX_WORKOS_SERVICE_KEY` (federation-only; now wrong + a needless secret-leak surface). Keep everything else from the Build Sequencing §2.2 template.

## B. Sign-off rubric & safety-veto — CRITICAL, was under-encoded
- Add table **`academy.signoff_line_items`**: `(id, signoff_id FK, dimension enum, line_item_key text, score int CHECK 0..3, is_critical_safety bool, note)`.
- The four dimensions (unchanged): `safety_compliance`, `technical_execution`, `verification_documentation`, `independence_judgment`.
- **Pass rule (enforce in a TRIGGER, not a CHECK — it is a cross-row rule):** a sign-off `outcome = 'pass'` ONLY IF **every dimension's rollup ≥ 2** AND **every `is_critical_safety` line item ≥ 2**. A single `0` on any safety line ⇒ automatic `fail`, non-overridable. Computed by the `finalize-signoff` Edge Function AND re-enforced by a DB trigger; **signed rows are immutable** (trigger blocks UPDATE/DELETE; corrections require a new voiding sign-off). Ship a committed pgTAP (or SQL) test proving: all-2s passes; one safety `0` fails; a late UPDATE to a signed row is rejected.

## C. Mastery thresholds — CRITICAL
- Move the threshold to the **assessment-item level**: `academy.assessment_items.is_safety_item bool`. Gating computes **safety items ≥ 90%, non-safety ≥ 80%** per the curriculum — a single per-competency scalar is insufficient. Keep `competencies.is_safety_critical` for badge/recert logic.

## D. Prerequisites & the MVP slice — CRITICAL
- **MVP slice (corrected for prereq closure):** `FND-101, FND-102, FND-103, INT-101, INT-102, ADC-101, ADC-102, ADC-201, AC-101, AC-102, AC-103, AC-201, AC-202, AC-203`. (`AC-201` requires `ADC-201`; `AC-203` requires `AC-202` — both were missing.) `ADC-101/102` are light Foundations courses; include them so `ADC-201` is reachable.
- **Credential-as-prerequisite resolver:** aggregate gates like "Certified Technician — AC" are modeled as a **credential** prereq, resolved by a Postgres function/view that checks held `credentials`. Tier credentials **auto-issue** when their component skill badges are all `field_proven`.

## E. Simulation engines — SIX, not four (reconcile the taxonomy conflict)
The canonical engine set (the wave3 "4 data shapes" and the experience-design "Forge/archetypes" are reconciled into THIS list):
1. **Branching scenario engine** (judgment / customer / egress-fail decisions).
2. **Device-config state-machine engine** (Partner Portal, panel programming, OpenEye, DragonFruit static-IP).
3. **WebGL 3D install engine** (R3F/Three.js; mounting/wiring/egress installs). **Rapier physics deferred from MVP.**
4. **Virtual IQ-panel state machine** (XState).
5. **Declarative 2D-interaction engine** (drag/label/match/sort/hotspot) — **MVP-critical** (AC-101, AC-102, ~25–30 courses).
6. **Parametric calculator engine** (PPF/DORI, PoE power budget, storage-retention math, "will it hold").
- Every engine: a **declarative JSON spec** validated by a published **JSON Schema + Zod**; shared **xAPI telemetry emitter**, shared **scoring/safety-veto hook**, the **offline cache contract**, the **i18n string layer**, and **colorblind-safe state rendering** (never color-alone for pass/fail). **Authors write specs + choose fixtures; they never write a new runtime.** "The Forge" is the umbrella name for engine #3 + the shared sim framework.

## F. Credentialing crypto — was unspecified; pin it
- OB 3.0 / W3C Verifiable Credentials: pin a **proof suite** (`eddsa-rdfc-2022` / Ed25519), **issuer `did:web:academy.redex.education`** (reconciled in F6 from the placeholder `goredex.com`; resolves to `https://academy.redex.education/.well-known/did.json`, served by a Worker), and a **hosted status list** for revocation (BitstringStatusList / StatusList2021). Define a **key-rotation** plan (issuer profile lists current + retired keys).
- **Deno constraint:** Edge Functions run on **Deno**; the VC-signing library must be **Deno-compatible**, OR issuance runs in a dedicated Node context (a Worker/container microservice). **This is a required decision in goal F6** — surface it explicitly; do not let a goal assume a Node-only lib works in a Deno Edge Function.
- **RESOLVED (F6): PATH A** — a Deno-compatible `eddsa-rdfc-2022` signer (`jsonld` + `@noble/ed25519` + WebCrypto, static offline loader) in the `issue-badge` Edge Function, key co-located with **Supabase Vault**. Conformance proven byte-for-byte against the digitalbazaar reference suite; Node `@redex/credentials` and the Deno function are pinned to one proofValue by a deterministic test vector. See `adr/ADR-0005` (addendum) + `CLAUDE.md` §5a.

## G. Offline-first sync correctness
- `UNIQUE(client_event_uuid)` on all append-only event tables; the `/sync` Edge Function is **idempotent** keyed on it.
- **Server-only computations (never offline, never client):** competency promotion, mastery verdict, sign-off finalize/outcome, badge issuance/revocation, recert scheduling.
- Append-only events for telemetry/progress; **last-writer-wins only for drafts/prefs**, tie-broken by server receipt; **finalized sign-offs immutable**. Never fake a pass offline.

## H. New goals to add to the backlog
- **F2a** — Stand up the `workos` schema **stub** (minimal `workos.jobs` table + needed columns) + the cross-schema FK + grants, so `signoffs`/recert/dashboards can join. Runs before M6.
- **F5b** — Build **engine #5 (2D-interaction)** and **engine #6 (calculator)** + their JSON Schemas (MVP needs them for AC-101/102 and PPF/PoE calculators).
- **S1 (seed data)** — Seed the MVP-slice **catalog** (courses/units/competencies/prerequisites), the **§5.4 line-items for AC-203** (its ~6 safety lines), and the **badge_class** definitions for the slice. M1/M2/M6/M7 depend on S1.

## I. Effort — UltraCode on EVERY goal (operator directive)
- **Run ALL goals (F1 → M12, including S1) with UltraCode** (xhigh + dynamic workflow + adversarial verification), **paired with auto mode.** Standing directive from Brian: maximum thoroughness on every goal; the higher token cost is accepted.
- This **supersedes** the earlier standard/ultracode split. There is **no "standard" tier** anymore — any per-goal label or table cell still reading "standard" is overridden by this rule.
- Trade-off acknowledged: light goals (F1, S1, simple MVP goals) burn far more tokens under UltraCode than they strictly need; that is the accepted cost of uniform rigor + adversarial verification on every goal.

## J. Done-criteria that are NOT CI-automatable (delegated reviewer verification at release)
- **F4** offline test on **real hardware in airplane mode**; **F6** "badge verifies at a public URL"; and **all safety-/credential-critical work**. These get an explicit **reviewer-verification** checkbox in the acceptance rubric — never agent self-certification.
- **These are RELEASE gates, not merge gates (de-bottlenecked 2026-05-30).** They do **not** block the PR merge into `main` — the merge is cleared by automated CI (the locked invariant suite: safety-veto, RLS isolation, signed-row immutability, no-fake-pass, no-client-secret). The human check is performed by a **designated qualified reviewer** — the **safety reviewer** for safety-veto/offline, the **security reviewer** for RLS/credential/key-custody; **any competent delegate, not necessarily the COO, never the authoring agent** — and is signed off **before the production / field release** (the deploy that puts the goal in front of real users). A goal may merge and be marked **done** with its release-verification tracked as an open item on the release checklist; it ships only after the reviewer signs.

## K. Cost / perf guardrails
- Defer Rapier physics from MVP; budget R3F assets for mobile (LOD, lazy load, Draco). MVP LRS may be single-container/managed. AI: per-org and per-day **budget caps** in the Edge Function + aggressive caching (narration/feedback/tutor) + tiered models. Be mindful that ultracode itself burns tokens during the build — reserve per §I.
