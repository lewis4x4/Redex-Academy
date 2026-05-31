# Redex Academy — Agent Roles & Acceptance

> How the build is executed and what it takes for a goal to be **accepted/merged**. Audience: Brian (driving Claude Code) and any reviewers.
>
> **Authoritative sources:** the **Build Decisions Ledger** (`wave4_decisions_ledger.md`) wins over everything — honor §I (effort tiering), §J (human-gate criteria), and the pinned invariants §A–§G. This doc operationalizes [`CLAUDE.md`](./CLAUDE.md) §9–§10 and the build-readiness review (`wave4_review_buildreadiness.md` §6). Where any doc conflicts with the ledger, **the ledger wins.**

---

## 1. Actors & when each is used

> **OPERATOR DIRECTIVE (supersedes the tables below):** run **EVERY goal with UltraCode + auto mode** — F1 through M12, including S1. The standard/ultracode split is retired; the "standard effort" actor row is no longer a routine path, and every **Effort** cell below is **UltraCode**.

There are **three** actors. **UltraCode is NOT a separate agent** — it is a Claude Code **effort mode** (Opus 4.8) that pins effort to `xhigh` and auto-spins dynamic workflows (parallel subagents + independent/adversarial verification). It burns substantially more tokens; per the directive above it is now used on **every** goal, **paired with auto mode**.

| Actor | What it is | When it runs |
|---|---|---|
| **Claude Code — standard effort** | Normal Claude Code on a single `/goal`, one goal at a time. | Routine goals: CRUD, content rendering, app-of-an-existing-engine, read-side UI. |
| **Claude Code — UltraCode mode** | Same Claude Code, effort pinned to `xhigh` + dynamic workflow (parallel subagents + adversarial verification). **Pair with auto mode.** | Heavy/critical goals: security boundaries, the credential/safety path, the sim engines, the hardest risk bets, CCS isolation. |
| **Human reviewer (Brian)** | Expert COO/builder. Owns **Phase 0** (accounts, `.env`, full stack) and every **gated merge**. | The human-verification gates in §6 — never agent self-certified. |

### Effort tier per goal (ledger §I — authoritative)

| Goal | Effort | Why |
|---|---|---|
| **F1** Repo + CI/CD + Netlify + env scaffolding | **UltraCode** | Mechanical scaffolding once the monorepo layout is given. |
| **F2** Base schema + RLS + generated types | **UltraCode** | Foundational contract every goal compiles against + RLS is a security boundary. |
| **F2a** `workos` schema stub + cross-schema FK + grants | **UltraCode** | Cross-schema boundary the sign-off/recert/dashboard joins depend on; runs before M6. |
| **F3** Auth + SSO + shared identity | **UltraCode** | Identity model is load-bearing and security-critical; JWT-claim/RLS interaction is subtle. |
| **F4** Offline sync spike | **UltraCode** | #1 program risk; conflict-safe append-only sync + "never fake a pass" is adversarial-verification territory. |
| **F5** Reusable sim engine v0 + fixture pipeline | **UltraCode** | #2 program risk; defines the reusable contract every sim consumes. |
| **F5b** Engine #5 (2D-interaction) + engine #6 (calculator) + schemas | **UltraCode** | MVP-critical engines + their JSON Schemas (AC-101/102, PPF/PoE calculators). |
| **F6** OB 3.0 issuer + key management | **UltraCode** | Cryptographic correctness + key custody; a signing bug is a credibility/liability event. |
| **S1** Seed the MVP-slice catalog + AC-203 line-items + badge_classes | **UltraCode** | Content-as-data load; M1/M2/M6/M7 depend on it. |
| **M1** Catalog + prereq-gated enrollment + skill-tree | **UltraCode** | CRUD + graph resolver. |
| **M2** MDX lessons + retry-to-mastery checks (EN+ES) | **UltraCode** | Content rendering + retry logic once the schema exists. |
| **M3** Branching scenario engine (egress-fail) | **UltraCode** | App of F5's engine if the F5 contract is solid. |
| **M4** Device-config sim (Aero/Mercury) | **UltraCode** | App of F5 + fixtures given the contract. |
| **M5** WebGL install sim (AC-201/203) | **UltraCode** | Spatial wiring correctness + the safety-fail (normally-open mag-lock) verdict; perf-budgeted 3D is hard. |
| **M6** §5.4 sign-off + DB safety-veto + Work OS evidence | **UltraCode** | Single most liability-critical goal; defense-in-depth veto must be adversarially verified. |
| **M7** OB 3.0 issuance for slice badges | **UltraCode** | Credential correctness + stackability + evidence binding. |
| **M8** xAPI → LRS + Postgres summary projection | **UltraCode** | Integration + mapping once the profile is pinned. |
| **M9** Authoring admin v1 (content-as-data) | **UltraCode** | Forms over schemas once F2 types + F5 schemas exist. |
| **M10** AI adaptive feedback + open-response grading | **UltraCode** | Assistive only; the guardrail is testable. |
| **M11** Manager sign-off dashboard (Realtime) | **UltraCode** | Read-side Realtime UI. |
| **M12** SSO + one CCS partner org (isolation test) | **UltraCode** | RLS/tenant-isolation adversarial test; a leak is a contractual breach with the anchor/CCS. |

**Token-cost rationale.** Per the operator directive, **every goal runs UltraCode + auto mode** — including routine CRUD / content / app-of-engine goals. This applies uniform max-thoroughness + adversarial verification across the whole build; the higher token cost (UltraCode burns substantially more, even on light goals like F1/S1) is the accepted trade. Always **pair UltraCode with auto mode**.

---

## 2. The goal lifecycle

Run **one goal at a time.** For each goal:

1. **Pick the goal** — read its spec in `goals/<ID>.md` (scope, `Depends on`, acceptance-test list, out-of-scope / pinned-invariant block).
2. **Confirm all `Depends on` are merged.** A goal consumes contracts (DB schema, generated types, engine API + JSON Schemas, seed data). **If a contract is missing, STOP and surface it — do not invent it.** Contract-producer goals merge before consumers.
3. **Set effort to UltraCode + auto mode** — every goal (operator directive; no standard tier).
4. **Build** the vertical slice; honor every pinned invariant in §5; write the tests the Definition of Done requires.
5. **Self-verify** against the goal's done-criteria **and** the shared Definition of Done (§3).
6. **Run the invariant tests** (§4) — the locked safety-veto / immutability / RLS / idempotency / no-fake-pass / no-client-secret suite must pass.
7. **At any `[HUMAN-VERIFY]` gate** (§6): produce the artifact + checklist, mark the goal **"pending release verification,"** and do **not** self-certify. This is a **release gate, not a merge blocker** — the goal still merges on green CI; the reviewer sign-off is recorded for ship-time.
8. **Human review / merge** — the reviewer applies the acceptance rubric (§4). For UltraCode/critical goals, the **adversarial-verification report is reviewed first** (§7).
9. **Update the goal status** in `goals/GOALS_INDEX.md` (e.g. `in_progress → in_review → pending_human_verification → merged`).

---

## 3. Definition of Done (shared)

Every goal must satisfy this checklist before it can enter review. (Mirrors `CLAUDE.md` §8.)

- [ ] **Done-criteria met** — the goal's own acceptance-test list passes.
- [ ] **Types regenerated if schema touched** — migration written, `supabase gen types typescript --schema academy,workos > packages/db-types/database.types.ts` run (`--schema academy` at F2; `--schema academy,workos` after F2a), **both committed together**; never hand-edited. (CI typegen-drift check is green.)
- [ ] **Unit tests** for all new logic; sims have explicit **pass / fail / safety-veto** Verdict cases.
- [ ] **e2e (Playwright)** for the user-visible done-criterion, including an **offline path** (`context.setOffline(true)`) for any field / `2xx` goal.
- [ ] **Offline behavior** correct for field goals: append-only events, idempotent sync, no faked pass.
- [ ] **a11y (axe)** passes on new screens; colorblind-safe (shape + text + color, never color alone); sims keyboard-navigable.
- [ ] **No secrets in client** — only `VITE_`-prefixed public values ship; no real secret value read, printed, or committed.
- [ ] **Lint / typecheck clean** — `pnpm typecheck && pnpm lint && pnpm build` green.
- [ ] **i18n** — EN+ES keys present for `1xx`/`2xx`; locked safety-glossary terms unchanged.
- [ ] **Docs / goal-status updated** — `goals/GOALS_INDEX.md` reflects the new state; any contract the goal publishes is documented.

> **Non-CI-automatable criteria** (real-hardware offline, public-URL badge verify, fixture sanitization/SME review) are **not agent-self-certified.** The goal produces the artifact + checklist and marks itself **"pending release verification"** (see §6). This does **not** block the merge or "done" on green CI — it is a **release gate**: a designated qualified reviewer signs before the production/field ship.

---

## 4. The acceptance / merge rubric

A goal **may not merge** until items **1–4** (all automated) hold — that is the **merge** gate. Item **5** is a **release** gate: it does not block the merge (it blocks the ship). (De-bottlenecked 2026-05-30, ledger §J.)

1. **Done-criteria ✓** — the goal's acceptance-test list passes.
2. **Definition of Done ✓** — every box in §3 is checked.
3. **Invariant tests pass** — the locked suite, specifically:
   - [ ] **Safety-veto trigger behavior** — all-2s passes; a single `0` on any `is_critical_safety` line ⇒ non-overridable `fail`; enforced in BOTH the `finalize-signoff` Edge Function AND the DB trigger.
   - [ ] **RLS cross-tenant isolation** — a CCS (or other-partner) actor returns **zero rows** of Redex people / progress / sign-offs / evidence / credentials; only published catalog is cross-tenant-readable.
   - [ ] **Idempotent `/sync`** — replaying an event keyed on `UNIQUE(client_event_uuid)` does **not** double-apply.
   - [ ] **Signed-signoff immutability** — a late UPDATE/DELETE on a signed sign-off (or its line items) is rejected; corrections require a new voiding sign-off.
   - [ ] **"No pass faked offline"** — server-authoritative outcomes (competency promotion, mastery verdict, sign-off finalize, badge issuance/revocation, recert) never resolve on the client/offline; offline shows a "will complete on reconnect" state.
   - [ ] **No client secrets** — the client bundle contains no service-role key or signing key; the lint/test that asserts "client never imports a service-role key and never writes a state table" passes.
4. **Adversarial-verification report reviewed** — for **UltraCode / critical** goals, the independent/adversarial pass's report (§7) is **read and accepted by the human** before merge. Its output is reviewed, not blindly trusted.
5. **Reviewer gate scheduled (release, not merge)** — if the goal hits any `[HUMAN-VERIFY]` gate in §6, the artifact + checklist are produced and the gate is recorded on the release checklist for a designated qualified reviewer to sign **before the production/field release**. Per ledger §J this does **not** block the merge — automated CI (items 1–4) clears the merge.

A goal that **weakens any locked invariant test fails review by default** — there is no "temporary" relaxation.

---

## 5. Pinned invariants checklist (the build may NEVER weaken these)

Restated from ledger §A–§G / `CLAUDE.md` §5 as a hard **pre-merge** checklist. If a goal seems to require weakening one, **STOP and surface it for human review.**

- [ ] **§B Safety-veto (defense in depth).** `outcome = 'pass'` ONLY IF every dimension rollup ≥ 2 AND every `is_critical_safety` line ≥ 2. A single safety `0` ⇒ automatic, non-overridable `fail`. Enforced in the Edge Function **and** a DB trigger (cross-row rule ⇒ trigger, not CHECK).
- [ ] **§B Signed sign-offs are immutable.** A DB trigger blocks UPDATE/DELETE on a signed row + its line items; corrections require a new voiding sign-off with an audit trail.
- [ ] **§G Server-only computations.** Competency promotion, mastery verdict, sign-off finalize/outcome, badge issuance/revocation, recert scheduling run **only** in service-role Edge Functions. End-user roles have **no write grant** on state tables; the client never writes them (lint/test-enforced).
- [ ] **§A Deny-by-default RLS + tenant isolation.** RLS ON for every table from migration #1; personal/tenant policies key on `org_id = (auth.jwt() ->> 'org_id')::uuid`. Only published catalog is cross-tenant-readable.
- [ ] **§G Never fake a pass offline.** Append-only events with a client UUID; `/sync` idempotent on `UNIQUE(client_event_uuid)`; last-writer-wins **only** for drafts/prefs (tie-broken by server receipt); finalized sign-offs immutable.
- [ ] **§E/§K No production-system contact.** Sims use sanitized, recorded fixtures only (`fixture_sets.sanitized = true` is a publish gate). No live Alarm.com/OpenEye/Mercury credentials; production customer footage is never a fixture.
- [ ] **§F Credential signing is server-side with the pinned proof suite.** OB 3.0 / W3C VC signing is server-only; proof suite **`eddsa-rdfc-2022` (Ed25519)**; issuer **`did:web:academy.goredex.com`** (or a stable hosted issuer profile); a hosted status list (BitstringStatusList / StatusList2021) for revocation; a documented key-rotation plan. Signing key in **Supabase Vault only** (co-located with `issue-badge`), never in Cloudflare Secrets, never in any client bundle. **Deno constraint** decided explicitly in **F6** (Deno-compatible lib OR a dedicated Node Worker/microservice).
- [ ] **No secrets in client bundles.** Only `VITE_`-prefixed public values ship to the browser; only `.env.example` names are committed; the deleted `REDEX_WORKOS_*` vars stay removed (§A).

---

## 6. Human-verification gates (ledger §J)

These criteria **cannot be agent-self-certified.** The agent builds an agent-satisfiable proxy (e.g. Playwright offline mode, a conformance fixture) and produces an artifact + checklist marked **"pending release verification."** A **designated qualified reviewer** (safety reviewer for safety/offline; security reviewer for RLS/credential — any competent delegate, not necessarily the COO) performs the real check and signs off **before the production/field release**. These are **release gates: they do not block the merge into `main`** (automated CI clears that); they block the ship.

| Gate `[HUMAN-VERIFY]` | Goal(s) | What the reviewer checks (before release) |
|---|---|---|
| **Offline on real hardware** | **F4** | On a real device in **airplane mode**: the offline path works; a server-authoritative outcome (pass/badge) is **not** faked; queued events sync idempotently and a signed sign-off rejects a late edit on reconnect. |
| **Credential verifies at a public URL + signing-key handling** | **F6** + **M7** | A minted OB 3.0 badge **verifies at a public URL** (issuer profile / `.well-known` resolves, proof validates, status list reachable). Signing runs **server-side only**; the key lives in Supabase Vault only; key-rotation plan is sound; the chosen Deno-vs-Node signing path is the one actually wired. |
| **Safety-veto behavior** | **M6** | The three-layer veto (CHECK + trigger + Edge Function) enforces: all-2s passes; one safety `0` ⇒ non-overridable fail; a signed row is immutable. The **per-course §5.4 rubric line-item data** is correct (correct items flagged `is_critical_safety`). |
| **RLS policy + tenant-isolation review** | **F2** / **F3** / **M12** | The **security reviewer** reads **every** RLS policy and the negative-test matrix; confirms a CCS tech is signed off yet returns **zero** Redex/other-partner rows. (A CCS leak is a contractual breach.) |
| **Any safety-/credential-critical change** | (catch-all) | Anything touching the safety-veto, credential signing, RLS/tenant isolation, or offline never-fake-a-pass logic gets a qualified-reviewer review **before release** — even outside the named goals above. |

> **Review-flagged additions (carry as gates):** the build-readiness review (`wave4_review_buildreadiness.md` §6) and `CLAUDE.md` §9 also require **(a) an F5 sim-engine-contract sign-off** — a human approves the engine API + JSON Schemas before M3–M5/M9 consume them — and **(b) content/fixture SME gates** in the M9/authoring path: safety/egress content + translations need SME + safety-reviewer sign-off, and fixtures need SME-accuracy + PII-sanitization review before `sanitized = true`. Treat both as `[HUMAN-VERIFY]` gates.

---

## 7. How adversarial verification is leveraged (UltraCode goals)

On UltraCode goals, the effort mode spins an **independent/adversarial verification pass** (a parallel subagent that did not write the code, tasked to break it). It targets the **invariants** and the **done-criteria** — not stylistic nits:

- **Try to defeat the safety-veto** — construct line-item sets that should fail and confirm they cannot be coerced to `pass`; bypass the Edge Function and confirm the DB trigger still vetoes.
- **Try to cross tenants** — run the RLS negative matrix as a CCS/other-partner actor and assert zero rows; probe every state table and view.
- **Try to double-apply or fake a pass** — replay `/sync` events; attempt an offline self-issued pass/badge; edit a signed sign-off after the fact.
- **Try to leak a secret** — scan the client bundle for any service-role/signing key; attempt a client-side state-table write.
- **Hammer the done-criteria** — re-derive the goal's acceptance tests independently and look for gaps the author's own tests miss.

**Its output is a report that is reviewed by the human, not blindly trusted.** The acceptance rubric (§4.4) blocks merge until that report is read and accepted. If the adversarial pass finds a hole, the goal returns to **build**, not to merge.

---

## Summary

**Actor model.** Three actors: **Claude Code — standard effort** (routine goals: CRUD, content, app-of-engine, read-side UI), **Claude Code — UltraCode mode** (an `xhigh` + dynamic-workflow effort mode with parallel subagents and adversarial verification — *not* a separate agent — reserved for the token-heavy critical goals **F2, F2a, F3, F4, F5, F5b, F6, M5, M6, M7, M12**, always paired with auto mode), and the **human reviewer (Brian)** for Phase 0 and every gated merge.

**Merge-gate essentials.** A goal merges when: (1) its done-criteria pass, (2) the shared Definition of Done is fully checked (types regenerated if schema touched, unit/e2e/offline/a11y green, no client secrets, lint/typecheck clean, docs/status updated), (3) the **locked invariant suite passes** — safety-veto trigger behavior, RLS cross-tenant isolation, idempotent `/sync`, signed-signoff immutability, no-pass-faked-offline, no client secrets, and (4) for UltraCode/critical goals the **adversarial-verification report is reviewed and accepted**. Items 1–4 are all automated / CI-checkable. **Any `[HUMAN-VERIFY]` reviewer gate is a RELEASE gate, not part of this merge rubric** (ledger §J): it is recorded for a designated qualified reviewer to sign before the production/field release. Weakening any locked invariant fails review by default.

**Reviewer release gates (cannot be agent-self-certified; signed before release, not a merge blocker):** **F4** (offline on real hardware in airplane mode), **F6 + M7** (credential verifies at a public URL; signing-key handling), **M6** (safety-veto behavior + §5.4 line-item data), **F2 / F3 / M12** (RLS policy + tenant-isolation review), and **any safety-/credential-critical change** as a catch-all. Plus the review-flagged **F5 engine-contract sign-off** and the **content/fixture SME** gates in the authoring path.
