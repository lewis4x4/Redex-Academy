# Redex Academy — Pre-Build Checklist (Phase 0 "Definition of Ready")

> The gate **before `/goal F1`**. Phase 0 is **yours** (Brian) — accounts, `.env`, full stack (`README.md`, ledger §"Locked context"). This checklist is the crisp **Definition of Ready**: when every box here is checked, the foundation goals can run cleanly without a goal trying to invent a missing contract. Grounded in `Redex_Academy_Build_Sequencing_and_Setup.md` §2, the **Build Decisions Ledger** (`wave4_decisions_ledger.md`), and `CLAUDE.md`. Where any doc conflicts with the ledger, **the ledger wins.**

---

## Part A — Definition of Ready (the Phase-0 gate)

### A1. Accounts & services provisioned (you create these — never have an agent create accounts)

- [ ] **GitHub repo** — monorepo (`apps/web`, `packages/*`, `supabase/`, `workers/`, `goals/`).
- [ ] **Supabase project** — **one** project (system of record: Postgres/RLS/Auth/Edge/Storage/Realtime). Greenfield shared model confirmed (see A4).
- [ ] **Cloudflare account** — **R2** buckets (media + evidence), **Stream**, **3× KV** namespaces (flags / fixture manifest / catalog cache), **1× D1** db (edge read replica of catalog/prereqs), **Workers** enabled. Wrangler installed/authed.
- [ ] **Netlify site** — linked to the repo; PR preview deploys + instant rollback.
- [ ] **LRS host** — self-hosted **Yet Analytics SQL LRS** (small VM/container) **or** a managed conformant LRS for MVP. (ADR-0006.)
- [ ] **IdP / SSO** — OIDC/SAML app (Google Workspace or Microsoft Entra) for staff + CCS subcontractor login.
- [ ] **AI providers** — Anthropic API; ElevenLabs; (optional) OpenAI/Voyage for embeddings.
- [ ] **Email / monitoring** — Resend (or SendGrid); Sentry.

### A2. `.env.local` populated from `.env.example`; secrets in the right vaults

- [ ] **`.env.example` is complete** (names only — produced/verified by goal F1) and `.env.local` is populated **from it** with real values pasted from each provider's dashboard.
- [ ] **No real secret value** is in chat, the repo, or any prompt to an agent. Only `.env.example` **names** are committed.
- [ ] Secrets are in the correct stores: **local `.env.local`** (gitignored), **Netlify env** (build/CI), **Supabase Vault** (Edge Functions), **Cloudflare Secrets** (`wrangler secret put`).
- [ ] **Client-public values** are `VITE_`-prefixed only (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_BASE_URL`, `VITE_OB_ISSUER_PROFILE_URL`, `VITE_CF_STREAM_CUSTOMER_SUBDOMAIN`, `VITE_SENTRY_DSN`).
- [ ] **Server-only secrets** (never in the client bundle): `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_DB_URL`, `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`; Cloudflare (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `R2_*`, `CF_STREAM_API_TOKEN`, `CF_KV_NAMESPACE_*`, `CF_D1_DATABASE_ID`); LRS (`LRS_ENDPOINT`, `LRS_KEY`, `LRS_SECRET`, `LRS_DB_URL`); AI (`ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, optional `OPENAI_API_KEY`/`VOYAGE_API_KEY`); issuer (`OB_ISSUER_DID`, `OB_ISSUER_PRIVATE_KEY`, `OB_ISSUER_PUBLIC_KEY`); SSO (`OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`); notifications (`RESEND_API_KEY`/`SENDGRID_API_KEY`, `SENTRY_AUTH_TOKEN`).
- [ ] **DELETED and kept deleted (ledger §A / ADR-0002):** `REDEX_WORKOS_DB_URL`, `REDEX_WORKOS_API_URL`, `REDEX_WORKOS_SERVICE_KEY`. Greenfield = one shared Supabase project; there are **no** separate Work OS creds.

### A3. Supabase schema-exposure planned (PostgREST + search_path)

- [ ] Plan to expose **`academy`** (and **`workos`** as needed) via PostgREST, with `extra_search_path` and explicit per-role grants. Target config (applied at F2/F2a — `migrations/SCHEMA_NOTES.md` §5):
  - `config.toml [api] schemas = ["public", "academy", "workos", "graphql_public"]`, `extra_search_path = ["public", "academy", "workos"]`.
  - `authenticated → search_path = academy, workos, public`; `anon → academy, public`; `service_role → academy, workos, public`.
- [ ] All migration objects will be **schema-qualified** (`create table academy.…`) — never rely on the session default `search_path`.

### A4. Work OS identity model = greenfield shared (CONFIRMED)

- [ ] **Confirmed: one Supabase project, two schemas (`academy`, `workos`), shared `auth.users`** (ledger §A; ADR-0002).
- [ ] `academy.users.id = auth.users.id`; **no `work_os_user_id` column**; cross-schema joins on `auth.users.id`.
- [ ] One canonical tenant table **`academy.orgs`**; both schemas' RLS key on `org_id = (auth.jwt() ->> 'org_id')::uuid`.
- [ ] Cross-schema FK planned: `academy.signoffs.work_os_job_id → workos.jobs(id)` (`ON DELETE RESTRICT`), stood up by **F2a** before M6.

### A5. Credential issuer prerequisites

- [ ] **Issuer Ed25519 keypair generated**; private key placed in **Supabase Vault only** (never Cloudflare Secrets, never a client bundle — ADR-0005 / CLAUDE.md invariant 7).
- [ ] **Issuer profile URL reserved** — `did:web:academy.goredex.com` (or a stable hosted issuer profile to be served by a Worker); `VITE_OB_ISSUER_PROFILE_URL` set.
- [ ] Proof suite / revocation / rotation plan acknowledged: **`eddsa-rdfc-2022` / Ed25519**, **hosted status list** (BitstringStatusList / StatusList2021), issuer profile lists current + retired keys. (The Deno-vs-Node signing-runtime decision is made *in* goal F6 — not now.)

### A6. LRS reachable

- [ ] **LRS endpoint is reachable** and `LRS_ENDPOINT`/`LRS_KEY`/`LRS_SECRET` (+ `LRS_DB_URL` if self-hosting) are set; a test xAPI statement can be POSTed and read back. (ADR-0006.)

> **Ready when:** every box in Part A is checked. Then proceed to Part B.

---

## Part B — Build order, effort tier, and dry-run links

Build in this order; run independent goals in parallel **only** once their `Depends on` are merged (`goals/GOALS_INDEX.md`). Effort tiers per ledger §I / ADR-0007. UltraCode goals pair with **auto mode**.

| Order | Goal | Tier | Depends on | Spec / dry-run |
|---|---|---|---|---|
| 1 | **F1** Repo + CI/CD + monorepo + env scaffolding | standard | (accounts) | [`goals/F1.md`](./goals/F1.md) |
| 2 | **F2** Academy schema apply + RLS + typegen | **UltraCode** | F1 | [`goals/F2.md`](./goals/F2.md) · dry-run: [`goals/F2_DRY_RUN.md`](./goals/F2_DRY_RUN.md) |
| 3 | **F2a** `workos` schema stub + cross-schema FK + grants | **UltraCode** | F2 | [`goals/F2a.md`](./goals/F2a.md) |
| 4 | **F3** Auth + SSO + shared-auth identity + JWT claims | **UltraCode** | F2 | [`goals/F3.md`](./goals/F3.md) |
| 5 | **F4** Offline PWA shell + IndexedDB + idempotent `/sync` | **UltraCode** | F2 | [`goals/F4.md`](./goals/F4.md) |
| 6 | **F5** Sim framework + engines #1 (branching) & #2 (device-config) + JSON Schemas | **UltraCode** | F2 | [`goals/F5.md`](./goals/F5.md) |
| 7 | **F5b** Engines #5 (2D-interaction) & #6 (calculator) + JSON Schemas | **UltraCode** | F5 | [`goals/F5b.md`](./goals/F5b.md) |
| 8 | **F6** OB 3.0 issuer + key mgmt + status list (Deno-vs-Node decision) | **UltraCode** | F2 | [`goals/F6.md`](./goals/F6.md) |
| 9 | **S1** MVP-slice catalog seed + AC-203 line-items + badge_class defs | standard | F2, F2a | [`goals/S1.md`](./goals/S1.md) |
| 10 | **M1** Catalog + prereq-gated enrollment + skill-tree view | standard | F2, S1 | [`goals/M1.md`](./goals/M1.md) |
| 11 | **M2** MDX lessons + retry-to-mastery knowledge checks (EN+ES) | standard | F2, M1, S1, F5b | [`goals/M2.md`](./goals/M2.md) |
| 12 | **M3** Branching egress-fail scenario (AC-103, AC-203) | standard | F5, S1, M1 | [`goals/M3.md`](./goals/M3.md) |
| 13 | **M4** Device-config sim — Aero/Mercury (AC-201) | standard | F5, S1, M1 | [`goals/M4.md`](./goals/M4.md) |
| 14 | **M5** WebGL install sim — AC-201/203 mag-lock/REX/egress | **UltraCode** | F5, S1, M1 | [`goals/M5.md`](./goals/M5.md) |
| 15 | **M6** §5.4 sign-off + line-items + safety-veto + Work OS evidence | **UltraCode** | F2a, F3, F4, S1 | [`goals/M6.md`](./goals/M6.md) |
| 16 | **M7** OB 3.0 issuance for the slice (skill→tier stackable) | **UltraCode** | F6, M6, S1 | [`goals/M7.md`](./goals/M7.md) |
| 17 | **M8** xAPI → LRS + Postgres summary projection | standard | F4, F5 | [`goals/M8.md`](./goals/M8.md) |
| 18 | **M9** Authoring admin v1 (content-as-data) | standard | F2, F5, F5b | [`goals/M9.md`](./goals/M9.md) |
| 19 | **M10** AI adaptive feedback + open-response grading (cached/budgeted) | standard | F5, M3 | [`goals/M10.md`](./goals/M10.md) |
| 20 | **M11** Manager sign-off dashboard (Realtime) | standard | F3, M6 | [`goals/M11.md`](./goals/M11.md) |
| 21 | **M12** SSO + one CCS org isolation test | **UltraCode** | F3, M6 | [`goals/M12.md`](./goals/M12.md) |

> **Order string:** `F1 → F2 → F2a → F3 → F4 → F5 → F5b → F6 → S1 → M1 … M12`. Only **F2** currently ships a standalone dry-run (`F2_DRY_RUN.md`); for every other goal the dry-run is the goal spec's Tasks + Done-criteria block. **Critical gates:** F2 gates everything; F5 gates M3/M4/M5/M10 and F5b gates M2/M9; F2a gates M6; S1 gates M1–M7; F6 gates M7; M6 gates M7/M11; F3 gates M6/M11/M12.

---

## Part C — Consolidated human-verify gates (ledger §J — never agent-self-certified)

These criteria **cannot** be agent-self-certified. The agent builds an agent-satisfiable proxy, then **stops** and produces an artifact + checklist marked **"pending human verification."** You perform the real check and sign off **before merge**.

| `[HUMAN-VERIFY]` gate | Goal(s) | What you check |
|---|---|---|
| **Offline on real hardware** | **F4** | On a real device in **airplane mode**: the offline path works; a server-authoritative outcome (pass/badge) is **not** faked; queued events sync idempotently; a signed sign-off rejects a late edit on reconnect. |
| **Credential verifies at a public URL + signing-key handling** | **F6**, **M7** | A minted OB 3.0 badge **verifies at a public URL** (issuer profile/`.well-known` resolves, proof validates, status list reachable); signing is **server-side only**; the key lives in **Supabase Vault only**; rotation plan is sound; the chosen **Deno-vs-Node** signing path is the one actually wired. |
| **Safety-veto behavior** | **M6** | The defense-in-depth veto (DB trigger + Edge Function + UI) enforces: all-2s passes; one safety `0` ⇒ non-overridable fail; a signed row is immutable. The **per-course §5.4 line-item data** is correct (right items flagged `is_critical_safety`). |
| **RLS policy + tenant-isolation review** | **F2**, **F3**, **M12** | A human reads **every** RLS policy and the negative-test matrix; confirms a CCS tech is signed off yet returns **zero** Redex/other-partner rows. (A CCS leak is a contractual breach.) |
| **F5 sim-engine-contract sign-off** | **F5** (before M3–M5/M9) | The engine API + JSON Schemas are approved **before** any consumer builds against them. |
| **Content / fixture SME gates** | **M9 / authoring path** | Safety/egress content + translations need **SME + safety-reviewer** sign-off; fixtures need **SME-accuracy + PII-sanitization** review before `fixture_sets.sanitized = true`. |
| **Any safety-/credential-critical merge** | (catch-all) | Any merge touching the safety-veto, credential signing, RLS/tenant isolation, or offline "never fake a pass" gets a human review before merge — even outside the named goals. |

> **Also gating, before the schema goals merge:** the committed migration **invariant test** (`migrations/tests/0001_invariants_test.sql`) must **pass on a live Supabase/Postgres instance** (safety-veto pass/fail, signed-row immutability, RLS cross-tenant isolation, fixture gate, audit append-only, DAG cycle detection) — it has only been parse-validated in the authoring sandbox (`SCHEMA_NOTES.md` §10).

---

## How to start goal #1 today

1. Clear **Part A** (accounts + Cloudflare resources; `.env.local`; secrets in Vault/CF/Netlify; schema-exposure planned; greenfield shared model confirmed; issuer keypair + profile URL; LRS reachable).
2. Run **`/goal F1`** (repo + CI + env), then **`/goal F2`** (schema + RLS + generated types) — set effort tier per Part B.
3. Proceed F2a → F3 → F4 → F5 → F5b → F6, then S1, then the M-slice in parallel where `Depends on` allow.
4. **Stop at every Part C gate**; produce the artifact + checklist; do **not** self-certify.
