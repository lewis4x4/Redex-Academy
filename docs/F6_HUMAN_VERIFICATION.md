# F6 — Human Verification Checklist (ledger §J release gate)

> **Status: pending release verification.** F6 merges on green CI; this checklist is a
> **release gate, not a merge gate** (CLAUDE.md §8.8 / §9). A **qualified reviewer** (not
> the agent, not necessarily the COO) signs this off **before the issuer goes to
> production / a real badge is relied upon**. Adversarial self-verification does NOT
> substitute for the public-URL check below.

## What CI already proves (automated — no human needed)

- ✅ A credential is signed with **`eddsa-rdfc-2022` / Ed25519** and **verifies** — against an
  **independent reference verifier** (digitalbazaar `eddsa-rdfc-2022` suite), not a stub.
  The signer even emits a **byte-identical `proofValue`** to the reference
  (`packages/credentials/src/conformance.test.ts`).
- ✅ The **Deno** `issue-badge` signer reproduces the **same** proofValue as the Node
  `@redex/credentials` signer (deterministic test vector — `handler.test.ts`).
- ✅ **Revocation:** flipping the BitstringStatusList bit makes a still-signed credential
  read as revoked; the status-list credential itself verifies (`issue-verify-revoke.test.ts`).
- ✅ **Key rotation:** a pre-rotation credential still verifies against the **retired** key
  after rotation (`did-web.test.ts`).
- ✅ **Server-only signing:** no client/`apps/**` path imports the signer or the key; the
  Cloudflare Workers never hold the private key; nothing assigns `OB_ISSUER_PRIVATE_KEY`
  a value (`signing-server-only.test.ts`).

## The decisions (confirm they are recorded + matched by the code)

- [ ] **Deno-vs-Node = PATH A** (a Deno-compatible signer inside the `issue-badge` Edge
      Function) is recorded in `CLAUDE.md` §5a + `adr/ADR-0005` (addendum) + this PR, and the
      implementation matches it — **no Node-only lib is imported into the Deno Edge Function**
      (it uses `jsonld` + `@noble/ed25519` + WebCrypto, with a static offline loader).
- [ ] **Issuer = `did:web:academy.redex.education`** everywhere (one source of truth:
      `packages/credentials/src/issuer-config.ts`). The reconciliation from the `goredex.com`
      placeholder is understood and accepted (see CLAUDE.md §5a).

## The gate that matters — verify at a PUBLIC URL (manual)

Run AFTER the Workers are deployed (`workers/README.md`) and a test badge is issued.

- [ ] **Deploy the issuer surface** and route it at the issuer host:
      `academy.redex.education/.well-known/*`, `/credentials/*`, `/status/*`.
- [ ] `curl https://academy.redex.education/.well-known/did.json` returns the DID document
      with the **current** key (and any **retired** keys), `type: Multikey`.
- [ ] **Issue a test badge** via the `issue-badge` Edge Function (an authorized issuer role).
      It returns a `hosted_assertion_url` under `https://academy.redex.education/credentials/…`.
- [ ] **Open that public URL in an INDEPENDENT OB 3.0 / VC verifier** (e.g. the 1EdTech /
      VC Playground verifier, or `vc-test-suite` tooling — NOT our own code). It reports
      **valid**, signed by **`did:web:academy.redex.education`** — not just a 200 / a pretty PNG.
- [ ] **Revoke** the test credential (flip its status bit, re-publish the status list),
      re-run the verifier → it now reports **revoked**.
- [ ] **Rotation:** retire the current key, confirm the DID document lists **current +
      retired**, and the pre-rotation badge **still verifies** against the retired key.

## Key custody (confirm by hand — invariant 7/8)

- [ ] The Ed25519 **private key** lives in **Supabase Vault ONLY** (co-located with
      `issue-badge`). It is **not** in Cloudflare Secrets, **not** in both, **not** in the
      repo, **not** in any `VITE_`/client bundle.
- [ ] Only **public** keys are in Cloudflare (the `ISSUER_KEYS` var on `issuer-wellknown`).
- [ ] The **rotation runbook** (`docs/KEY_ROTATION_RUNBOOK.md`) has been read; a dry-run
      rotation was performed in staging.

## Sign-off

- Reviewer: `(name)` — Date: `(YYYY-MM-DD)`
- Independent verifier used: `(tool / URL)`
- Result: ☐ badge verifies at public URL ☐ revocation visible ☐ rotation preserves old proofs ☐ key custody confirmed
