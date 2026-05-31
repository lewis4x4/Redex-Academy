# M7 — Dry-Run: Expected Output & Human-Verify Checklist

A known-good target for the **credential-issuance ultracode run**. Read this before running `/goal M7`, then check the result against §4–§6. If anything in §6 (Red Flags) appears, reject the run and re-prompt. The output of this goal is a **signed, publicly verifiable Verifiable Credential** — a decorative image is a failure, not a near-miss.

- **Goal:** issue the slice's Open Badges 3.0 credentials from real sign-offs. On a `field_proven` event (from M6), the **stackability rollup** issues the matching **skill badge** with evidence URLs pointing at the real `signoff_evidence`/job records, and when all component skill badges are `field_proven` it **auto-issues the tier credential "Certified Technician — Access Control"**. All credentials are constructed + **signed server-side** by F6's issuer, written to `credentials` (+ `credential_status_list`), and published at a hosted verifiable URL.
- **Tier:** ultracode (xhigh + dynamic workflow + **adversarial verification**). **Pair with auto mode.** (Ledger §I.)
- **Depends on:** **F6** (the issuer: proof suite `eddsa-rdfc-2022`/Ed25519, `did:web:academy.goredex.com`, the status list, the credential builder, the **Deno-vs-Node `issue-badge` decision**, key custody in Supabase Vault), **M6** (the `finalize-signoff` path that flips `field_proven` and triggers issuance), **S1** (the slice `badge_classes` + the `requires` stackability chain).
- **Human gate (HARD, ledger §J / M7 spec):** a human confirms a slice badge **verifies at a public URL**, and reviews the **stackability rollup + key custody + server-only signing** before release.

---

## 1. The `/goal` invocation to give Claude Code
> Run goal M7 per `goals/M7.md`. **Consume F6's issuer — do not re-build it or re-invent the credential shape** (invariant 5): use F6's typed credential builder + the `issue-badge` signer + the hosted status list. **Honor F6's Deno-vs-Node signing decision** (ledger §F / F6 §"REQUIRED DECISION"): if F6 chose a Deno-compatible signer, `issue-badge` runs in the Edge Function; if F6 fell back to a Node microservice (Worker/container), issuance runs there — do NOT assume a Node-only lib works in a Deno Edge Function, and do NOT contradict F6's recorded choice. The signing key is **Vault-only** (never in the client bundle or repo). Read the stack from S1's `badge_classes.requires` (`tier.ac.certified_technician.requires.badges` + `auto_issue:"all_components_field_proven"`); evidence URLs must point at the real `academy.signoff_evidence` / `workos.jobs` records from the sign-off, not placeholders. Out of scope: building the issuer (F6); the sign-off path (M6 — M7 only reacts to its `field_proven`/issuance trigger); the full recert engine + N8N (Phase 2 — M7 only sets credential expiry metadata).

## 2. Expected repo changes (the file tree M7 should produce)
```
supabase/
  functions/
    issue-badge/                  # OR the Node microservice per the F6 Deno-vs-Node decision —
      index.ts                    #   the stackability rollup + issuance orchestration:
                                  #   on field_proven, resolve badge_classes.requires, build+sign
                                  #   (via F6's builder/signer), write credentials + credential_status_list,
                                  #   publish hosted assertion, auto-issue the tier when components complete
  functions/_shared/
    stackability.ts               # resolver: which skill badge(s) to issue; tier auto-issue when requires satisfied
packages/credentials/            # (F6-owned builder reused; M7 adds the slice's rollup glue only)
apps/web/
  src/features/backpack/          # Digital Backpack: earned/expiring badges, the stack (skill → tier),
                                  #   each with its hosted verifiable URL
supabase/tests/
  0003_issuance_test.sql / *.test.ts # rollup (skill→tier auto-issue); evidence-URL binding; expiry metadata; revocation
.github/workflows/ci.yml          # adds M7 e2e (pass AC-203 → skill issues+verifies; complete stack → tier auto-issues+verifies; revoke → status list)
```
**No new `academy` migration in M7** — it consumes the F2 `credentials` / `credential_status_list` tables + the S1 `badge_classes` seed + F6's issuer. `packages/db-types/database.types.ts` is unchanged unless a schema shape changes (it should not). Signing happens **only** server-side (Edge Fn or the F6 Node microservice) — **never** in `apps/web`.

## 3. Commands it should run
```bash
supabase start                                   # local stack: 0001+0002 migrations + S1 seed; F6 issuer + Vault key configured
supabase functions serve issue-badge             # (or run the F6 Node microservice, per the decision)
pnpm test --filter credentials                    # unit: stackability rollup, evidence-URL binding, expiry metadata
pnpm exec playwright test issuance                # e2e: pass AC-203 sign-off → skill badge issues + VERIFIES;
                                                  #   complete the stack → tier credential AUTO-ISSUES + verifies; revoke → status list reflects it
pnpm test:security --filter issuance              # assert signing is unreachable client-side; key not in any bundle
curl -s "$HOSTED_ASSERTION_URL" | <ob3-vc-verifier>   # conformance: the issued credential verifies (eddsa-rdfc-2022)
pnpm typecheck && pnpm lint
```
(The verifier check uses F6's OB 3.0 / VC conformance verifier — same one F6 wired into tests. `$HOSTED_ASSERTION_URL` is the `credentials.hosted_assertion_url` of the issued badge.)

## 4. Expected RESULT signals (acceptance evidence)
- **Skill badge issues off a real sign-off:** on a passing AC-203 sign-off (`competency_state='field_proven'` for `EGRESS.MAGLOCK_FAILSAFE`), the rollup issues `skill.ac.maglock_rex_egress` — a `credentials` row with `status='active'`, a signed `open_badge_json` + `proof` (proof suite `eddsa-rdfc-2022` / Ed25519, issuer `did:web:academy.goredex.com`), a `hosted_assertion_url`, a `status_list_index`, and **`evidence_urls` pointing at the real `signoff_evidence` / `workos.jobs` records** from that sign-off.
- **The badge verifies:** fetching `hosted_assertion_url` and running F6's OB 3.0 / VC verifier reports **valid** (signature checks against the issuer DID profile's current key; `credentialStatus` resolves to the hosted BitstringStatusList).
- **Tier auto-issues (stackable):** when all three component skill badges (`skill.ac.single_door_aero`, `skill.ac.mercury_wiring`, `skill.ac.maglock_rex_egress`) are `field_proven`/held, the rollup **auto-issues** `tier.ac.certified_technician` ("Certified Technician — Access Control") per `requires.auto_issue:"all_components_field_proven"` — and the tier credential also verifies at its public URL.
- **Signed server-side only:** every credential's `proof` is produced in the server context (Edge Fn or F6's Node microservice per the decision); the private key is **Vault-held** and appears in **no** client bundle.
- **Digital Backpack** in `apps/web` shows the stack (skill → tier) with each badge's working hosted verifiable URL.
- **Expiry/recert metadata set:** the issued credentials carry expiry from `badge_classes.recert_months` (`12` for the egress AC-203 skill badge and the AC tier, `is_compliance=true`) — the egress 12-month rule is encoded on the credential.
- **Revocation works:** flipping `credentials.status` to `revoked`/`recert_required` (via F6's path) updates `credential_status_list` (`revoked=true` at the credential's `list_index`), and the verifier subsequently reports the credential **revoked**.
- **The adversarial-verification report** is present; its findings are addressed.

## 5. HUMAN-VERIFY checklist (a qualified reviewer, before release — HARD GATE, not agent-self-certified)
- [ ] **A slice badge verifies at a PUBLIC URL** (the headline ledger-§J check): open the issued skill badge's `hosted_assertion_url` in a real OB 3.0 / VC verifier and confirm it reports **valid + signed by `did:web:academy.goredex.com`**, not just a 200 / a pretty image.
- [ ] **Revocation via the status list works end-to-end:** revoke the credential → the published status list flips the bit at its `list_index` → re-verifying the same URL now reports **revoked**.
- [ ] **The signing key is Vault-only:** confirm `OB_ISSUER_PRIVATE_KEY` lives in Supabase Vault (co-located with the signer), is **not** in the repo, `.env` committed files, or any client bundle, and is **not** duplicated to CF Secrets (single custody location, per F6).
- [ ] **Signing is server-only:** confirm no client path can reach the signer; the security test proves the key/signing is absent from `apps/web`'s bundle.
- [ ] **The Deno-vs-Node decision from F6 is honored:** the `issue-badge` signer runs exactly where F6 recorded (Deno Edge Fn **or** Node microservice) — M7 did not silently switch contexts or drop a Node-only lib into a Deno Edge Function.
- [ ] **Stackability rollup reviewed:** the skill badge issues only off a `field_proven` competency that passed M6's safety veto; the tier `tier.ac.certified_technician` auto-issues **only** when all three component skill badges are field_proven (`requires.badges` + `auto_issue`). No tier without its components.
- [ ] **Evidence URLs are real:** `credentials.evidence_urls` point at the actual `signoff_evidence` / `workos.jobs` records from the proving sign-off — not placeholders, not dead links.
- [ ] **Expiry metadata correct:** the egress AC-203 skill badge and the AC tier carry the **12-month** recert/expiry (`is_compliance=true`); AC-201/AC-202 skill badges carry their cadence (24-mo Core).
- [ ] Reviewed the **adversarial-verification report**; findings addressed.

## 6. RED FLAGS — reject the run if you see any of these
- **A decorative PNG/image instead of a signed VC** — the credential has no valid `proof`, or `open_badge_json` is absent/unsigned, or it fails the OB 3.0 / VC verifier. The deliverable is a *verifiable* credential, not a badge picture.
- **Signing on the client** — any Ed25519 signing, key material, or `proof` generation reachable from `apps/web` / a browser bundle. Issuance/revocation is server-only (invariant 2); the key is Vault-only.
- **The F6 Deno-vs-Node decision not honored** — M7 assumes a Node-only signing lib works inside a Deno Edge Function (or contradicts F6's recorded choice / splits the signer across contexts). Honor F6's documented path.
- **M7 re-invents the credential shape / issuer / status list** instead of consuming F6's builder + signer + hosted status list (invariant 5) — drift from the conformant shape breaks verification and stackability.
- **The tier auto-issues without all components** (or the skill badge issues off a sign-off that did NOT pass the safety veto / is not `field_proven`) — a badge may only ride a vetoed-pass `field_proven` (invariant 1); the tier needs all three skill badges.
- **Evidence URLs are placeholders / decorative** rather than the real `signoff_evidence` / job records — the credential's evidence must be auditable back to the proving sign-off.
- **Key in the repo / `.env` / client bundle, or duplicated to CF Secrets** — single Vault custody only.
- **Revocation does not propagate** — flipping `credentials.status` leaves the status list (and therefore the verifier) reporting the credential as still valid.
- Any real secret written to a file; or "it verifies" claimed from parse-only with no actual verifier run against the public URL.

## 7. Definition of Done (the merge gate)
All §4 signals present · all §5 HARD-GATE human checks ticked — **a real slice badge verifies at a public URL**, revocation propagates through the status list, signing is server-only with a Vault-only key, and F6's Deno-vs-Node decision is honored · the committed public-URL-verification checklist filled · CI green and required (rollup unit, Playwright issue→verify→revoke e2e, signing-location security test, OB 3.0 conformance) · the adversarial-verification report addressed · GOALS_INDEX status for M7 → done. With M6 + M7 done, the slice's See-one/Do-one/**Prove-one → credential** loop is closed end-to-end.

---
*Known nits to enforce during the run: (1) M7 is glue over F6 — it consumes F6's builder/signer/status-list and S1's `requires` chain; it must not re-implement the issuer or the credential JSON-LD shape. (2) The auto-issue trigger is `tier.ac.certified_technician.requires.auto_issue:"all_components_field_proven"` reading the three S1 skill-badge keys — resolve held credentials server-side, never on the client. (3) A credential may only issue off a `field_proven` competency that passed M6's safety veto — never off a faked or vetoed pass. (4) The egress AC-203 badge + the AC tier are `is_compliance=true` / 12-month — set that expiry on the issued credential so the Phase-2 recert engine has the data.*
