# Redex Academy — CLAUDE.md (repo-root context)

> Read this on every run. It is the authoritative build context for Claude Code. The **Build Decisions Ledger** (`wave4_decisions_ledger.md`) is the ultimate source of truth; where any doc conflicts with the ledger, **the ledger wins**. Detailed conventions live in [`CODING_STANDARDS.md`](./CODING_STANDARDS.md) — but this file stands alone as the primary context.

---

## 1. Project

Redex Academy is a **competency engine + simulation runtime, not an LMS**. Its reason to exist is the **See one / Do one / Prove one** loop: a tech learns (See), rehearses in a realistic simulation (Do), then earns an **Evaluator-signed field sign-off with evidence** captured against a real Work OS job (Prove) — which mints a portable **Open Badges 3.0** Verifiable Credential and is kept current as gear changes across ~1,600 sites. Courses are *one content type* layered on a domain of **competencies, simulation telemetry, field evidence, and credentials**. "Slides-and-quiz is banned." We build a custom app on the Redex stack (Supabase + React/TS + Cloudflare) and share Work OS's identity + database so credentials fall out of the real job, not separate homework.

---

## 2. Toolchain (LOCKED)

Do not introduce frameworks outside this list. Pin majors; do not pull a breaking newer major without a goal that explicitly upgrades it.

| Area | Choice |
|---|---|
| Monorepo | **pnpm** workspaces + **Turborepo** |
| Build / app | **Vite** + **React 18** + **TypeScript (strict)** + **Tailwind** |
| Data / state | **TanStack Query** + **Zod**; **Zustand** for sim-local state |
| Sims | **React-Three-Fiber + Three.js** (+ drei) for 3D; **XState** for state-machine sims. **Rapier physics is DEFERRED from MVP — do not add it.** |
| Offline PWA | **Workbox** (service worker) + **Dexie** (IndexedDB) |
| Backend | **Supabase** — Postgres, RLS, **Edge Functions in Deno**, Auth, Realtime, Storage + **Supabase CLI** |
| Edge | **Cloudflare** Workers / R2 / Stream / KV / D1 via **Wrangler** |
| i18n | **react-i18next** |
| Test | **Vitest** (unit), **Playwright** (e2e + offline/PWA), **axe-core** (a11y) |
| Lint / format | **ESLint** + **Prettier** + **Husky/lint-staged** |
| CI / host | **GitHub Actions** + **Netlify** |
| Telemetry | self-hosted **Yet Analytics SQL LRS** (managed LRS acceptable for MVP) |
| Credentials | a **W3C-VC / Open Badges 3.0** signing library (must be Deno-compatible — see §5/§6) |

**Canonical commands** (run from repo root):

```bash
pnpm install
pnpm dev                 # run the web app
pnpm build               # turbo build all packages
pnpm typecheck           # tsc --noEmit across the graph
pnpm lint                # eslint + prettier check
pnpm test                # vitest unit
pnpm test:e2e            # playwright (incl. offline path)
pnpm test:a11y           # axe-core
pnpm test:rls            # RLS negative / isolation tests
pnpm dag:check           # assert course-prerequisite graph is a DAG

# Supabase (run inside supabase/)
supabase db diff -f <name>          # author a migration from local changes
supabase db push                    # apply migrations
supabase gen types typescript --schema academy,workos > ../packages/db-types/database.types.ts   # academy only at F2; academy,workos after F2a

# Cloudflare
wrangler deploy           # deploy a worker (from workers/<name>)
```

---

## 3. Monorepo layout

pnpm + Turborepo. Generated types and JSON Schemas are **committed artifacts** — never gitignored, never hand-edited.

```
redex-academy/
├─ apps/
│  └─ web/                  # the PWA (Vite + React 18). Learner + manager + admin UI,
│                           #   persona-adaptive, offline-first. Authoring admin lives here
│                           #   (in-repo — Lovable is OUT OF SCOPE; do not integrate a Lovable runtime).
├─ packages/
│  ├─ sim-engines/          # the 6 declarative engines (see §6) + the shared Verdict/scoring/
│  │                        #   safety-veto hook, telemetry emitter, offline cache + i18n contracts.
│  ├─ sim-schemas/          # JSON Schema + Zod for each engine's declarative spec (the F5 contract).
│  ├─ ui/                   # shared component library; WCAG 2.1 AA + colorblind-safe primitives.
│  ├─ db-types/             # generated Supabase types (database.types.ts) + shared Zod schemas.
│  ├─ i18n/                 # react-i18next config + locale JSON + the LOCKED safety glossary.
│  └─ config/               # shared tsconfig / eslint / tailwind presets.
├─ supabase/
│  ├─ migrations/           # SQL migrations (RLS on from migration #1). Source of truth for schema.
│  ├─ functions/            # Edge Functions (Deno): finalize-signoff, issue-badge, xapi-bridge,
│  │                        #   grade-open-response, sim-feedback, recert-scan, sync.
│  └─ tests/                # pgTAP/SQL invariant tests (safety-veto, immutability, RLS).
├─ workers/                 # Cloudflare Workers (signed-fixture serving, issuer .well-known +
│                           #   credential verify, image resize, edge catalog cache).
├─ goals/                   # the /goal specs: goals/<ID>.md + GOALS_INDEX.md (status board).
├─ pnpm-workspace.yaml
├─ turbo.json
└─ CLAUDE.md                # this file
```

If a goal needs a package that doesn't exist, create it under `packages/` with the shared `config/` presets — do not vendor code into `apps/web` that other goals will need.

---

## 4. Data & identity model (greenfield — LOCKED)

- **One Supabase project.** Two Postgres schemas: **`academy`** and **`workos`**. **Shared `auth.users`.**
- `academy.users.id` **=** `auth.users.id`. There is **one identity space** — there is **NO `work_os_user_id` column**; join cross-schema on `auth.users.id`.
- **One canonical tenant table `academy.orgs`.** BOTH schemas' RLS key on it via `org_id = (auth.jwt() ->> 'org_id')::uuid`.
- **Cross-schema FK:** `academy.signoffs.work_os_job_id → workos.jobs(id)`. (Goal **F2a** stands up the `workos.jobs` stub + FK + grants before M6.)
- PostgREST: expose `academy` (and `workos` as needed); set `search_path`; explicit grants per role.
- **`.env`:** the `REDEX_WORKOS_DB_URL` / `REDEX_WORKOS_API_URL` / `REDEX_WORKOS_SERVICE_KEY` vars are **DELETED** (federation-only; wrong now and a needless secret surface). Keep the rest of the `.env.example` template.

**Migration → typegen rule (NON-NEGOTIABLE).** After ANY schema change:
1. write a migration in `supabase/migrations/`,
2. run `supabase gen types typescript --schema academy,workos > packages/db-types/database.types.ts` (use `--schema academy` at F2 before the `workos` stub exists; `--schema academy,workos` after F2a),
3. **commit both together.** Never hand-edit `database.types.ts`. CI fails if the committed types differ from a fresh generation (typegen-drift check).

---

## 5. PINNED INVARIANTS (never violate — a goal may NOT weaken these)

> These are inviolable. If a goal seems to require weakening one, **STOP and surface it for human review** — do not simplify, stub past, or "temporarily" relax it. These live in the repo as locked tests; a goal that changes them fails review by default.

1. **Safety-veto (defense in depth).** Sign-off scoring uses `academy.signoff_line_items` (`dimension`, `line_item_key`, `score 0..3 CHECK`, `is_critical_safety`). The four dimensions are `safety_compliance`, `technical_execution`, `verification_documentation`, `independence_judgment`. A sign-off `outcome = 'pass'` **ONLY IF every dimension's rollup ≥ 2 AND every `is_critical_safety` line item ≥ 2.** A single `0` on any safety line ⇒ automatic, **non-overridable** `fail`. Enforced in BOTH the `finalize-signoff` Edge Function AND a **DB trigger** (it is a cross-row rule — a trigger, not a CHECK). **Never let a goal simplify this.**

2. **Signed sign-offs are immutable.** Once `signed`, a DB trigger blocks UPDATE/DELETE on the row and its line items. Corrections require a **new voiding sign-off** with an audit trail. Ship a committed pgTAP/SQL test proving: all-2s passes; one safety `0` fails; a late UPDATE to a signed row is rejected.

3. **Server-only computations — never offline, never on the client.** Competency promotion, mastery verdict, sign-off finalize/outcome, badge issuance/revocation, and recert scheduling run **only** in service-role Edge Functions after server-side validation. End-user roles have **no write grant** on state tables (`competency_state`, `credentials`, `signoffs`, etc.). The client **never** writes state tables — this is lint/test-enforced.

4. **Deny-by-default RLS + tenant isolation.** RLS is ON for every table from migration #1; a row is visible only if a policy grants it. Every personal/tenant policy keys on `org_id = (auth.jwt() ->> 'org_id')::uuid`. A CCS actor MUST get **zero rows** of Redex or other partners' people/progress/sign-offs/evidence/credentials. Published catalog content is the only cross-tenant-readable data.

5. **Never fake a pass offline.** Offline events are append-only with a client UUID; the `/sync` Edge Function is idempotent on `UNIQUE(client_event_uuid)`. Last-writer-wins applies **only to drafts/prefs** (tie-broken by server receipt). Anything needing server authority shows a clear "will complete on reconnect" state — a tech cannot mint themselves a badge on a plane.

6. **No production-system contact.** The Academy never holds live Alarm.com/OpenEye/Mercury credentials and never hits production customer systems. Sims use **sanitized, recorded fixtures only** (`fixture_sets.sanitized = true` is a publish gate). Production customer footage is never a training fixture.

7. **Credential signing is server-side with the pinned proof suite.** OB 3.0 / W3C VC signing runs server-side only, with proof suite **`eddsa-rdfc-2022` (Ed25519)**, issuer **`did:web:academy.goredex.com`** (or a stable hosted issuer profile served by a Worker), and a **hosted status list** (BitstringStatusList / StatusList2021) for revocation, plus a documented **key-rotation** plan (issuer profile lists current + retired keys). The signing key lives in **Supabase Vault only** (co-located with `issue-badge`), never in Cloudflare Secrets and never in any client bundle. **Deno constraint:** the VC lib must be Deno-compatible OR signing runs in a dedicated Node Worker/microservice — this is a required, explicit decision in goal **F6**; do not assume a Node-only lib works in a Deno Edge Function.

8. **No secrets in client bundles.** Only `VITE_`-prefixed public values ship to the browser. Never read, print, or commit real secret values — only `.env.example` names. Server secrets live in Supabase Vault / Cloudflare Secrets.

---

## 6. The 6 simulation engines

There are **SIX** engines (this supersedes the wave3 "4 data shapes" and the experience-design "archetypes" — they are reconciled into this list). "The Forge" is the umbrella name for engine #3 + the shared sim framework.

1. **Branching scenario engine** — judgment / customer / egress-fail decision trees.
2. **Device-config state-machine engine** — Alarm.com Partner Portal, panel programming, OpenEye, DragonFruit static-IP.
3. **WebGL 3D install engine** — R3F/Three.js; mounting/wiring/egress installs. **Rapier deferred.**
4. **Virtual IQ-panel state machine** — XState (arming/partitions/delays/chime/faults).
5. **Declarative 2D-interaction engine** — drag/label/match/sort/hotspot. **MVP-critical** (AC-101, AC-102; ~25–30 courses).
6. **Parametric calculator engine** — PPF/DORI, PoE power budget, storage-retention math, "will it hold."

**The rule:** authors write a **declarative JSON spec** validated by a published **JSON Schema + Zod** (in `packages/sim-schemas`), and choose a sanitized fixture set. **Authors NEVER write a new runtime.** Every engine shares: the **xAPI telemetry emitter**, the **scoring / safety-veto Verdict hook**, the **offline cache contract**, the **i18n string layer**, and **colorblind-safe state rendering** (never color alone for pass/fail — use shape + text + color). (Goal **F5b** builds engines #5 and #6 + their schemas.)

---

## 7. Conventions

- **TypeScript strict** everywhere; no `any` without a justified, commented exception.
- **Zod at every boundary** — API inputs/outputs, Edge Function payloads, sim specs, env parsing. Validate, don't trust.
- **RLS-first.** Design the policy before the query. Client reads go through RLS; state writes go through Edge Functions.
- **Error handling:** never swallow errors; surface typed errors; offline paths degrade gracefully (AI/LRS unavailable must not break the sim).
- **Naming:** course codes (e.g. `AC-203`) are canonical IDs; competency codes are `DOMAIN.THING` (e.g. `EGRESS.MAGLOCK_FAILSAFE`). **Persona** (nova/marco/priya/dana) and **role** (learner/evaluator/manager/author/curriculum_admin/org_admin/exec/support) are separate concepts — persona drives UI, role drives permissions.
- **Secrets:** only `VITE_*` public values client-side (see invariant 8).
- **i18n:** `react-i18next`; EN+ES first-class for all `1xx`/`2xx` strings; the **locked safety glossary** (fail-safe/fail-locked, REX, egress, PPF, partition) is **non-overridable** across languages.
- Full detail in [`CODING_STANDARDS.md`](./CODING_STANDARDS.md).

---

## 8. Testing & Definition of Done

CI required-checks (all block merge): `typecheck`, `lint`, `test` (unit), `test:e2e` (incl. offline), `test:a11y`, `test:rls`, `dag:check`, typegen-drift, and the sanitized-fixture publish-gate.

**Definition of Done — every goal must satisfy:**

1. `pnpm typecheck && pnpm lint && pnpm build` green; generated types committed and in sync with migrations.
2. **Unit tests** for all new logic; sims have explicit **pass / fail / safety-veto** Verdict cases.
3. **e2e (Playwright)** for the user-visible done-criterion, including an **offline path** (`context.setOffline(true)`) for any field/`2xx` goal.
4. **a11y (axe)** passes on new screens; colorblind-safe assertion (no color-only state); sims keyboard-navigable.
5. **RLS negative tests** for any goal touching tenant data: a cross-org actor returns **zero rows**.
6. **Invariant regression tests** (§5) still pass — a goal that weakens them fails review.
7. **i18n:** EN+ES keys present for `1xx`/`2xx`; safety-glossary terms unchanged.
8. **Human-verification stub:** where a criterion is not CI-automatable (real-hardware offline, public-URL badge verify, fixture sanitization/SME review), produce the artifact + a checklist and mark the goal **"pending human verification," not "done."**

WebGL sims carry an explicit **mobile perf budget** (FPS + asset-size) asserted as a test (they must run on a tech's phone — LOD, lazy load, Draco).

---

## 9. Effort: when to use UltraCode

**UltraCode is a Claude Code effort mode** (Opus 4.8: pins effort to `xhigh`, auto-spins dynamic workflows — parallel subagents + adversarial verification). It is **NOT a separate agent**. It burns substantially more tokens, so it is **reserved** for heavy/critical goals and **paired with auto mode**.

- **UltraCode goals:** `F2, F2a, F3, F4, F5, F5b, F6, M5, M6, M7, M12` (security boundaries, the credential/safety path, the sim engines, the hardest bets, CCS isolation).
- **Standard goals:** `F1, S1, M1, M2, M3, M4, M8, M9, M10, M11`.

**Human-gate items (ledger §J) are never agent-self-certified:** F4 offline test on **real hardware in airplane mode**; F6 "badge verifies at a public URL"; and **all safety-/credential-critical merges** (M6 safety-veto, F6/M7 signing, F2/F3/M12 RLS + tenant isolation, F5 engine-contract sign-off). These get an explicit human-verification checkbox and stop for review before merge.

---

## 10. How to run a `/goal`

1. **Read the spec** in `goals/<ID>.md` (scope, depends-on, acceptance-test list, out-of-scope / pinned-invariant block).
2. **Confirm dependencies are merged.** A goal consumes contracts (schema, generated types, engine API/JSON Schema). **If a contract is missing, STOP and surface it — do not invent it.** Contract-producer goals merge before consumers.
3. **Set the effort tier** per §9 (UltraCode + auto mode for the listed goals; standard otherwise).
4. **Build** the vertical slice; honor every pinned invariant in §5; write the tests in the §8 DoD.
5. **Self-verify** against the goal's done-criteria and the DoD checklist.
6. **Stop at any human-gate** (§9): produce artifacts + checklist, mark "pending human verification," do not self-certify.
7. **Update status** in `goals/GOALS_INDEX.md` (e.g. `in_progress → in_review / pending_human_verification / merged`).
