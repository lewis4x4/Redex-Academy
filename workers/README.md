# workers/ — Cloudflare Workers (Wrangler)

Each Worker is its own directory with a `wrangler.toml`. Deploy with `wrangler deploy`
from the Worker dir. Worker **deploys are a §J release gate**, not a CI merge gate —
the public-serving response logic lives in `@redex/credentials` (`src/hosting.ts`) and
is unit-tested in CI (vitest); the Workers are thin entrypoints that fetch stored data
and delegate to it.

## F6 — the OB 3.0 issuer surface (live now)

| Worker | Route | Serves |
|---|---|---|
| **`issuer-wellknown/`** | `academy.redex.education/.well-known/*` | the did:web **DID document** (`/.well-known/did.json`, current + retired keys) and the OB 3.0 **issuer Profile** (`/.well-known/issuer`). |
| **`badge-assertion/`** | `academy.redex.education/credentials/*` | the public, verifiable **hosted assertion** (`/credentials/:id`) — what makes a badge "verify at a public URL". |
| **`status-list/`** | `academy.redex.education/status/*` | the hosted **BitstringStatusList** credential (`/status/1`) a verifier checks for revocation (short cache so revocations propagate). |

**Issuer = `did:web:academy.redex.education`** (see `adr/ADR-0005` + the reconciliation note in
`CLAUDE.md`). `did:web:academy.redex.education` resolves to
`https://academy.redex.education/.well-known/did.json`, so the `issuer-wellknown` Worker
**must** be routed at that host for badges to verify.

### Key custody (invariant 7/8) — non-negotiable

- Only **PUBLIC** keys live in Cloudflare (the DID document / issuer profile key list,
  set via the `ISSUER_KEYS` var — public, not a secret).
- The **Ed25519 PRIVATE signing key** lives in **Supabase Vault ONLY**, co-located with the
  `issue-badge` Edge Function. It is **never** in Cloudflare Secrets, never in both, never
  in a client bundle. These Workers neither hold nor need it — they only **serve** signed,
  public data.

### Deploy (release gate)

```bash
# 1) create KV namespaces and put their ids in the wrangler.toml files
wrangler kv namespace create ASSERTIONS
wrangler kv namespace create STATUS_LIST

# 2) set the PUBLIC issuer key list on issuer-wellknown (current + retired)
#    ISSUER_KEYS = '[{"id":"key-2026-05","publicKeyMultibase":"z6Mk…","status":"current"}]'

# 3) deploy each Worker, routed at the issuer host
( cd issuer-wellknown && wrangler deploy )
( cd badge-assertion  && wrangler deploy )
( cd status-list      && wrangler deploy )
```

After deploy, run `docs/F6_HUMAN_VERIFICATION.md` — confirm a real issued badge verifies
in an independent OB 3.0 / VC verifier at its public URL, and a revocation flips it.

## Other Workers (later goals)

- **F5** — signed-fixture serving Worker (sanitized fixtures via signed URL).
- Image resize + edge catalog cache as needed.
