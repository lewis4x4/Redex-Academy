# F6 — Dry-Run: Expected Output & Human-Verify Checklist

A known-good target for your first **ultracode** run. Read this before running `/goal F6`, then check the result against §4–§6. If anything in §6 (Red Flags) appears, reject the run and re-prompt.

- **Goal:** build the **Open Badges 3.0 / W3C Verifiable Credentials issuer** — construct + **sign** a credential server-side, publish a hosted verifiable assertion + the issuer `.well-known`/DID profile, maintain a hosted **status list** for revocation, and define key rotation. **Resolve the Deno-vs-Node signing decision explicitly** (ledger §F) before wiring the signer.
- **Tier:** ultracode (xhigh + dynamic workflow + adversarial verification). **Pair with auto mode.**
- **Depends on:** **F2** merged (`badge_classes` with `requires`, `credentials` with `open_badge_json`/`proof`/`hosted_assertion_url`/`status`, `credential_status_list`, generated types).
- **Human gate — [HUMAN-VERIFY], ledger §J:** a human confirms a real issued badge **verifies at a public URL**, and reviews **key custody + the proof suite + the rotation runbook** before merge. **The Deno-vs-Node signing-lib decision must be explicitly resolved and recorded.** Adversarial self-verification does NOT substitute.

---

## 1. The `/goal` invocation to give Claude Code
> Run goal F6 per `goals/F6.md`. Implement the **pinned crypto exactly** (ledger §F / Inv. 7): proof suite **`eddsa-rdfc-2022` / Ed25519** (Data Integrity proof), issuer **`did:web:academy.goredex.com`** (or a stable hosted issuer profile served by a Worker) whose profile lists **current + retired** keys, a hosted **BitstringStatusList** (a.k.a. StatusList2021) for revocation, and the signing key in **Supabase Vault only** (co-located with the `issue-badge` Edge Function — never Cloudflare Secrets, never both, never a client bundle). **FIRST, make and record the REQUIRED Deno-vs-Node decision:** Edge Functions run on **Deno** — either **(A)** use a **Deno-compatible** Ed25519 / Data-Integrity VC signing library inside the `issue-badge` Edge Function (prefer A for Vault co-location), **or (B)** run issuance in a dedicated **Node** Cloudflare Worker/microservice if no Deno-compatible lib produces a conformant `eddsa-rdfc-2022` proof. **Do NOT assume a Node-only library works in a Deno Edge Function.** Evaluate (A) first; if it cannot produce a conformant proof, fall back to (B) and document why. **Record the chosen path + rationale in the PR and in `CLAUDE.md`.** Signing **never** runs on the client. Out of scope: issuing the real slice badges from real sign-offs (**M7** — F6 proves the issuer with a test credential), the sign-off/evidence path (**M6**), and stackability rollup from real competencies (**M7**/S1).

## 2. Expected repo changes (the file tree F6 should produce)
```
CLAUDE.md                           # AMENDED: the Deno-vs-Node decision (A or B) + rationale recorded (REQUIRED)
adr/ADR-0005-credential-crypto.md   # updated/confirmed with the resolved signing-lib path (if used as the decision record)
packages/credentials/               # the shared, typed credential builder (M7 reuses it)
  src/builder.ts                     # OB 3.0 AchievementCredential / W3C VC: credentialSubject(recipient achievement),
                                     #   issuer (the DID), evidence (links to signoff_evidence/job), issuanceDate/expirationDate,
                                     #   credentialStatus (BitstringStatusList entry), proof — published as a typed builder
  src/status-list.ts                 # BitstringStatusList encode/decode (set/clear the revocation bit)
  src/credential.types.ts            # Zod + TS for the credential shape (boundary validation)
# --- signing lives in ONE place per the decision ---
supabase/functions/issue-badge/      # PATH (A): Deno Edge Function — builds + SIGNS server-side w/ the Vault-held key,
  index.ts                           #   writes credentials(open_badge_json, proof, hosted_assertion_url, status='active'),
                                     #   publishes the hosted assertion to R2/Worker. Uses a DENO-COMPATIBLE signer.
#   …OR (PATH B) a dedicated Node microservice: workers/issuer-node/ (documented as the chosen fallback w/ rationale)
workers/                             # Cloudflare Workers for the PUBLIC, always-on endpoints:
  badge-assertion/                   # the hosted assertion URL (verifiable)
  issuer-wellknown/                  # the .well-known / DID document profile (lists current + retired keys)
  status-list/                       # the hosted BitstringStatusList endpoint
packages/db-types/database.types.ts  # imported (no schema change expected); committed in sync
tests/
  credential-builder.test.ts         # credential shape
  proof-roundtrip.test.ts            # generate + VERIFY an eddsa-rdfc-2022 proof
  status-list.test.ts                # encode/decode + revocation flip
  signing-server-only.test.ts        # Security: signing unreachable from any client path; key not in any bundle
e2e/
  issue-verify-revoke.spec.ts        # issue → fetch hosted assertion → verify → revoke → re-verify (now revoked)
docs/
  F6_HUMAN_VERIFICATION.md           # committed checklist for the public-URL badge-verify gate
  KEY_ROTATION_RUNBOOK.md            # generate/retire keys; issuer profile carries both; old proofs still verify
```
Nothing else. F6 proves the issuer with a **test credential**; M7 issues the real slice badges from real sign-offs.

## 3. Commands it should run
```bash
supabase start
supabase functions serve issue-badge          # local Deno runtime (PATH A) — verify the signer loads under Deno
wrangler dev workers/badge-assertion          # public hosted-assertion endpoint
wrangler dev workers/issuer-wellknown         # .well-known / DID profile (current + retired keys)
wrangler dev workers/status-list              # BitstringStatusList endpoint
pnpm typecheck && pnpm lint && pnpm build
pnpm test          # unit: builder shape; proof gen+verify (eddsa-rdfc-2022); status-list encode/decode; revocation flip
pnpm test:e2e      # issue → fetch → verify → revoke → re-verify(revoked)
# conformance: run an OB 3.0 / VC verifier against the issued credential in CI
# the signing key is read from Supabase Vault — NEVER printed, committed, or placed in a VITE_/client path
```

## 4. Expected RESULT signals (acceptance evidence)
- **The Deno-vs-Node decision is MADE and DOCUMENTED** (in the PR **and** `CLAUDE.md`); the signer matches the chosen path. Path A = a **Deno-compatible** signer inside `issue-badge`; Path B = a dedicated **Node** Worker/microservice with a written rationale for why no Deno-compatible lib met the proof-suite requirement.
- A **test badge is issued, signed (`eddsa-rdfc-2022` / Ed25519), and VERIFIES** against an OB 3.0 / VC verifier **in CI**.
- The **hosted assertion URL**, the **`.well-known`/DID issuer profile** (lists **current + retired** keys), and the **status-list endpoint** are all reachable.
- **Revocation test:** flipping `credentials.status` to `revoked`/`recert_required` updates the published **BitstringStatusList**; the verifier then reports the credential as **revoked**.
- **Signing-location test:** issuance/signing is **unreachable from any client path** (server-only); the private key **never appears in a client bundle** and is read from **Supabase Vault only**.
- The credential builder is a **typed, published package** (`packages/credentials`) with the OB 3.0 `AchievementCredential` shape (`credentialSubject`/`issuer`/`evidence`/`issuanceDate`/`expirationDate`/`credentialStatus`/`proof`) — so **M7 reuses it**, not re-implements it.
- A **key-rotation runbook** exists: generate/retire keys, the issuer profile carries both, **old proofs still verify against the retired key**.
- `typecheck`/`lint`/`build` green; types committed and in sync.

## 5. HUMAN-VERIFY checklist (you, before merge — not agent-self-certified) — [HUMAN-VERIFY]
- [ ] **A real issued badge verifies at a PUBLIC URL** (the gate that matters, ledger §J): fetch the hosted assertion from its public endpoint and run it through an independent OB 3.0 / VC verifier — it reports **valid**, with a resolvable issuer profile.
- [ ] **The Deno-vs-Node decision is explicitly resolved and recorded** in `CLAUDE.md` + the PR, with rationale — and the implementation **matches** it (no Node-only lib silently imported into a Deno Edge Function; if Path B, the Node context is a real separate service, not a fiction).
- [ ] **Key custody reviewed:** the Ed25519 **private key lives in Supabase Vault ONLY** — not in Cloudflare Secrets, not in both, not in the repo, not in any `VITE_`/client bundle. Confirm by hand.
- [ ] **Proof suite is `eddsa-rdfc-2022` / Ed25519** (a real Data Integrity proof), issuer is `did:web:academy.goredex.com` (or the stable hosted profile), status list is a **BitstringStatusList / StatusList2021**.
- [ ] **Revocation visible to a verifier:** flip status → re-fetch the public status list → the verifier reports **revoked** ("badge earned on a retired version flips to recert required" works end-to-end).
- [ ] **Rotation runbook reviewed:** retire a key, confirm the issuer profile lists **current + retired**, and an **old proof still verifies** against the retired key.
- [ ] **Signing is provably not client-reachable:** there is no client path to the signer and the key never reaches the browser (the security test reflects reality).
- [ ] **`docs/F6_HUMAN_VERIFICATION.md` is signed** and the goal is marked **pending human verification** until the public-URL verify is confirmed.
- [ ] Reviewed the **adversarial-verification report** the ultracode run produced; its findings are addressed.

## 6. RED FLAGS — reject the run if you see any of these
- **A Node-only signing library assumed to work inside a Deno Edge Function** — the single biggest F6 trap (ledger §F). If no Deno-compatible signer produces a conformant `eddsa-rdfc-2022` proof, the run MUST choose **Path B** (a Node Worker/microservice) and **document why** — not paper over a runtime incompatibility.
- **The Deno-vs-Node decision was not made or not recorded** in `CLAUDE.md` + the PR (it is a required, explicit deliverable of this goal — not an implementation detail to skip).
- **Wrong crypto:** any proof suite other than `eddsa-rdfc-2022`/Ed25519, a non-DID/ad-hoc issuer, or a homegrown "status" instead of a **BitstringStatusList** — the pinned suite is non-negotiable (Inv. 7).
- **Key custody wrong:** the private key in Cloudflare Secrets, in **both** Vault and CF Secrets, committed to the repo, or reachable from a `VITE_`/client bundle. The key lives in **Supabase Vault only**.
- **Signing runs (or is reachable) client-side** — issuance/signing is server-only; a client must never be able to mint or sign a credential (Inv. 2).
- The credential **does not actually verify** against a real OB 3.0 / VC verifier (a stubbed/fake "verified: true"), or verification was only asserted, never run.
- **Revocation doesn't reach the verifier** — flipping status doesn't update the published status list, so a revoked badge still verifies as valid.
- **No rotation plan**, or retired keys dropped from the issuer profile so old proofs stop verifying.
- The builder is **inlined in the Edge Function** instead of a shared package M7 can reuse; or `database.types.ts` hand-edited / not committed.
- Any **real secret value** (the private key, a Vault token) printed, logged, or written to a file — only `.env.example` names (`OB_ISSUER_DID`, `OB_ISSUER_PRIVATE_KEY`, `OB_ISSUER_PUBLIC_KEY`, `VITE_OB_ISSUER_PROFILE_URL`).

## 7. Definition of Done (the merge gate)
The **Deno-vs-Node decision made + recorded** (CLAUDE.md + PR) and the signer matches it · all §4 signals present · a test badge signs + **verifies in CI** · hosted assertion + `.well-known`/DID profile + status-list endpoints reachable · revocation + signing-server-only + rotation tests green · `typecheck`/`lint`/`build` green · types committed · **`docs/F6_HUMAN_VERIFICATION.md` + `KEY_ROTATION_RUNBOOK.md` produced** · **goal marked `pending_human_verification`** (NOT `done`) until a human confirms a real badge **verifies at a public URL** and reviews key custody + proof suite + rotation. Only after the human gate does F6 flip to `done`; **M7** (which depends on F6) reuses the credential builder + issuer to issue the real slice badges.

---
*Known nit to enforce during the run: F6 proves the issuer with a **test credential** — issuing real slice badges from real sign-offs is **M7**, and the slice's `requires` stackability chain comes from **S1**. The crypto + the Deno-vs-Node call are the load-bearing deliverables here; don't gold-plate stackability.*
