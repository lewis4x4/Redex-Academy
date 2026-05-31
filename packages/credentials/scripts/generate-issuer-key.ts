// Generate a NEW Ed25519 issuer signing key for rotation (docs/KEY_ROTATION_RUNBOOK.md).
//
//   pnpm --filter @redex/credentials exec tsx scripts/generate-issuer-key.ts <key-fragment-id>
//
// Prints the PUBLIC key parts (safe to publish) and the SECRET key ONCE to your
// terminal (paste into Supabase Vault, then clear your scrollback). NOTHING is
// written to disk and this script file contains NO key material — it mints a fresh
// random key each run. NEVER commit, log, or put the secret in Cloudflare.
import { generateKeyPair } from '../src/eddsa-rdfc-2022';
import { DEFAULT_ISSUER_DID, resolveIssuerEndpoints } from '../src/issuer-config';

const keyId = process.argv[2];
if (!keyId || !/^[A-Za-z0-9._-]+$/.test(keyId)) {
  console.error('usage: tsx scripts/generate-issuer-key.ts <key-fragment-id>   e.g. key-2026-09');
  process.exit(1);
}

const did = process.env.OB_ISSUER_DID ?? DEFAULT_ISSUER_DID;
const ep = resolveIssuerEndpoints(did);
const kp = generateKeyPair();
const verificationMethod = `${did}#${keyId}`;

console.log(`
# ── NEW ISSUER KEY (${verificationMethod}) ──────────────────────────────────
# Issuer DID         : ${did}
# DID document URL   : ${ep.didDocumentUrl}

# PUBLIC — publish in the DID document + the ISSUER_KEYS var (workers/issuer-wellknown):
publicKeyMultibase = ${kp.publicKeyMultibase}

# Add to ISSUER_KEYS (mark the previous key status:"retired", retiredAt:<ISO>):
#   {"id":"${keyId}","publicKeyMultibase":"${kp.publicKeyMultibase}","status":"current"}

# DID-document verificationMethod entry:
#   {"id":"${verificationMethod}","type":"Multikey","controller":"${did}","publicKeyMultibase":"${kp.publicKeyMultibase}"}

# ── SECRET — Supabase Vault ONLY. Paste, then CLEAR your scrollback. Never commit/log. ──
#   supabase secrets set OB_ISSUER_KEY_ID="${keyId}"
#   supabase secrets set OB_ISSUER_PRIVATE_KEY="${kp.secretKeyMultibase}"
`);
