# M7 — Human Verification Checklist (ledger §J HARD release gate)

> **Status: pending release verification.** M7 merges on green CI; this checklist is a
> **release gate, not a merge gate** (CLAUDE.md §8.8 / §9). A **qualified reviewer** (not
> the agent) signs off **before real slice badges are relied upon in the field**.
> Adversarial self-verification does NOT substitute for the public-URL check.

## What CI already proves (automated)

- ✅ **The rollup rides only a real, veto-passed, field_proven sign-off** (invariant 1):
  `runRollup` re-reads `competency_state` (must be `field_proven`) AND the sign-off
  (must be `status='signed'`, `outcome='pass'`, matching candidate+competency) before
  issuing — `rollup.test.ts` proves both guards REFUSE otherwise.
- ✅ **Skill badge issues with REAL evidence URLs** (pointing at the actual
  `signoff_evidence` rows + the `workos.jobs` record — not placeholders), a signed
  `eddsa-rdfc-2022` proof that **verifies**, and the **12-mo egress recert** on the credential.
- ✅ **Tier auto-issues ONLY when all 3 component skills are held** (`shouldAutoIssueTier`);
  never a tier without its components. The tier credential verifies too.
- ✅ **Reuses F6's builder/signer** (no re-invented credential shape — invariant 5); the Deno
  signer is byte-identical to the Node `@redex/credentials` signer (the F6 parity vector).
- ✅ **Idempotent** — re-running the rollup does not double-issue.
- ✅ **Server-only / key custody** — issuance gated to issuer roles (a learner can never mint
  a badge); the signing key is read from the Vault env, never bundled (the F6
  `signing-server-only` guard still passes; the Backpack UI is READ-ONLY).
- ✅ **Revocation propagates** — the `revoke` action flips `credentials.status` +
  `credential_status_list.revoked`, then **rebuilds + re-signs** the BitstringStatusList from the
  current revoked set; `rollup.test.ts` proves the re-signed list **verifies** and a verifier reads
  the revoked bit as SET (an unrelated index stays clear). Publishing it to the status-list
  Worker's KV is the deploy step (the §J gate), symmetric with hosted-assertion publishing.
- ✅ **Tenant isolation** (invariant 4) — both the rollup and revoke refuse cross-org
  (`cross_org_refused`): an issuer can only roll up / revoke within their own org.
- ✅ **No orphaned credential** — the status-list slot is reserved (UNIQUE on `list_index`)
  BEFORE the credential row is written, so a concurrent-allocation race never leaves an
  active-but-unlinked credential.
- ✅ **Digital Backpack** renders the skill → tier stack with each badge's hosted verify link
  and colorblind-safe status (`BackpackView.test.tsx`).

## The HARD gate — verify a real slice badge at a PUBLIC URL (manual)

Run AFTER F6's Workers are deployed + the issuer key is in Vault + the S1 slice seed is applied.

- [ ] Pass a real **AC-203** Evaluator sign-off (M6) for a candidate → `competency_state` is
      `field_proven` for `EGRESS.MAGLOCK_FAILSAFE`.
- [ ] Invoke the `issue-badge` **rollup** → a `credentials` row for `skill.ac.maglock_rex_egress`
      with `status='active'`, a signed `open_badge_json` + `proof`, a `hosted_assertion_url`, a
      `status_list_index`, and `evidence_urls` resolving to the real sign-off evidence / job.
- [ ] **Open the `hosted_assertion_url` in an INDEPENDENT OB 3.0 / VC verifier** — it reports
      **valid + signed by `did:web:academy.redex.education`** (not a 200 / a pretty image).
- [ ] Complete the other two AC skill sign-offs → the **tier** `tier.ac.certified_technician`
      **auto-issues** and **verifies** at its public URL.
- [ ] **Revoke** the skill credential → re-fetch the public status list → the verifier reports
      it **revoked** (the bit at its `list_index` is set).
- [ ] **Evidence URLs are real + auditable** back to the proving sign-off — not dead links.
- [ ] **Expiry metadata correct** — the egress AC-203 skill badge + the AC tier carry **12-month**
      recert (`is_compliance=true`).
- [ ] **F6 Deno-vs-Node decision honored** — issuance runs in the Deno `issue-badge` Edge
      Function (Path A); no Node-only lib was slipped in; the key is Vault-only, not in CF
      Secrets / the client bundle.
- [ ] **Stackability reviewed** — the skill issues only off a veto-passed `field_proven`
      competency; the tier needs ALL three components. Reviewed the adversarial report; findings addressed.
- [ ] The Digital Backpack shows the stack with working hosted verifiable URLs.

## Sign-off

- Reviewer: `(name)` — Date: `(YYYY-MM-DD)`
- Independent verifier used: `(tool / URL)`
- Result: ☐ skill badge verifies at public URL ☐ tier auto-issues + verifies ☐ revocation visible ☐ evidence real ☐ key custody confirmed
