# workers/ — Cloudflare Workers (Wrangler)

Empty scaffold at F1. Populated by later goals:

- **F5** — signed-fixture serving Worker (sims load sanitized fixtures via a signed
  URL, never a bundled fixture or a live API).
- **F6 / M7** — the OB 3.0 issuer `.well-known` profile + credential **verify**
  Worker, and the hosted **status list** (BitstringStatusList / StatusList2021)
  for revocation. The signing key lives in **Supabase Vault only** — never in
  Cloudflare Secrets and never in a client bundle (CLAUDE.md invariant §7/§8).
- Image resize + edge catalog cache as needed.

Each Worker is its own directory with a `wrangler.toml`. Deploy with `wrangler deploy`
from the Worker dir.
