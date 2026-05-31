# Issuer Key-Rotation Runbook (F6 — ledger §F)

The issuer signs OB 3.0 / W3C VC credentials with an **Ed25519** key. Rotation must
**never invalidate already-issued badges**: the did:web DID document lists **current +
retired** keys, so a proof signed by a now-retired key still resolves and verifies. The
issuer signs **new** credentials with the **current** key only.

## Invariants (do not violate)

- The **private key** lives in **Supabase Vault ONLY**, co-located with the `issue-badge`
  Edge Function (env `OB_ISSUER_PRIVATE_KEY` = the `secretKeyMultibase`). Never in
  Cloudflare Secrets, never in both, never in the repo, never in a client bundle
  (invariant 7/8).
- Cloudflare holds **public** keys only (the `ISSUER_KEYS` var on `issuer-wellknown`).
- A **retired** key stays published in the DID document + `assertionMethod` **forever**
  (or as long as any badge it signed must verify) — dropping it would break old proofs.
- One source of truth for the issuer DID: `packages/credentials/src/issuer-config.ts`
  (`did:web:academy.redex.education`).

## Key model

Each key has a fragment id used as the verificationMethod, e.g.
`did:web:academy.redex.education#key-2026-05`. Keys carry a status: `current` (signs new
credentials) or `retired` (verifies old proofs only). The DID document publishes all of
them as `Multikey` entries.

## Generate a new key

```bash
pnpm --filter @redex/credentials exec tsx scripts/generate-issuer-key.ts key-2026-09
```

This prints (to your terminal only — nothing is written to the repo):

- `publicKeyMultibase` — PUBLIC; add to the `ISSUER_KEYS` var + DID document.
- `secretKeyMultibase` — **SECRET**; paste into Supabase Vault (below), then clear your
  scrollback. **Never** commit it, log it, or put it in Cloudflare.
- A ready-to-paste DID-document `verificationMethod` entry + an `ISSUER_KEYS` element.

## Rotation procedure

1. **Generate** the new key (above). Choose a dated fragment id (`key-YYYY-MM`).
2. **Store the secret** in Supabase Vault for the `issue-badge` function:
   ```bash
   supabase secrets set OB_ISSUER_PRIVATE_KEY="<new secretKeyMultibase>"
   supabase secrets set OB_ISSUER_KEY_ID="key-2026-09"
   ```
3. **Publish the public key.** Update `issuer-wellknown`'s `ISSUER_KEYS` var so it lists
   BOTH the new key (`status:"current"`) AND the previous key (`status:"retired"`,
   `retiredAt:<ISO>`), then redeploy:
   ```bash
   ( cd workers/issuer-wellknown && wrangler deploy )
   ```
   Confirm: `curl https://academy.redex.education/.well-known/did.json` lists both keys;
   both appear under `assertionMethod`.
4. **Cut over signing.** With `OB_ISSUER_KEY_ID=key-2026-09`, the `issue-badge` function now
   signs new credentials with the new key. The old key signs nothing further.
5. **Verify old proofs still validate.** Take a badge issued before the rotation and run it
   through a verifier — it must still report **valid** (it resolves the retired key in the
   DID document). This is the regression `did-web.test.ts` encodes; confirm it in production.
6. **Record** the rotation (date, retired fragment id, reason) in the release log.

## Compromise (emergency) rotation

If a private key is suspected compromised:

1. Rotate to a new current key (steps 1–4) **immediately**.
2. Mark the compromised key `retired` in the DID document but **flag the affected
   credentials for re-issuance** — a compromised key means proofs it produced can no longer
   be trusted as authentic. Use the **status list** to `revoke` credentials signed by the
   compromised key (flip their bits, re-publish), and re-issue from the new key.
3. Rotate the Supabase Vault secret and audit access.

## Why retired keys stay published

A verifier resolves `proof.verificationMethod` (e.g. `…#key-2026-05`) against the DID
document. If the retired key were removed, every badge it signed would fail to verify —
silently breaking credentials techs already earned. Keeping retired keys listed (but never
signing with them) is what makes rotation safe. See `packages/credentials/src/did-web.ts`
(`buildDidDocument`) and the rotation regression test in `did-web.test.ts`.
