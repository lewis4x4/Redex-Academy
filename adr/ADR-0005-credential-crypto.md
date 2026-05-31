# ADR-0005 — Credential crypto: `eddsa-rdfc-2022` / Ed25519 / `did:web` / hosted status list (+ Deno constraint)

**Status:** Accepted

## Context

Redex must be the **issuer** of portable, verifiable **Open Badges 3.0 / W3C Verifiable Credentials** — owning the signing keys, the `credentialSubject`, the evidence links to real job records, and the expiry/revocation lifecycle (a Redex badge must *verify at a public URL*, not be a decorative PNG). wave3 §3.7 specified the issuer shape but the Wave 4 review found the **cryptographic specifics were unpinned** (no proof suite, no issuer identifier scheme, no revocation mechanism, no key-rotation plan), and a critical runtime hazard was unaddressed: Edge Functions run on **Deno**, and many VC-signing libraries are **Node-only** — a goal could naively assume a Node lib works in a Deno Edge Function and ship a broken signer. A signing bug is a credibility/liability event. (ledger §F; wave3 §3.7; CLAUDE.md §5 invariant 7.)

## Decision

Pin the credential crypto:

- **Proof suite:** **`eddsa-rdfc-2022`** with **Ed25519** keys.
- **Issuer identifier:** **`did:web:academy.redex.education`** (reconciled in F6 from the placeholder `did:web:academy.goredex.com` — see the F6 addendum below); resolves to `https://academy.redex.education/.well-known/did.json`, served by a Worker.
- **Revocation:** a **hosted status list** (BitstringStatusList / StatusList2021) that verifiers check; `credential_status_list` is public-readable (carries no PII).
- **Key custody:** the signing key lives in **Supabase Vault only** (co-located with the `issue-badge` Edge Function) — **never** in Cloudflare Secrets, never in any client bundle.
- **Key rotation:** a documented plan; the issuer profile lists **current + retired** keys so existing proofs survive rotation.
- **Deno-compatibility requirement (the explicit hazard):** the VC-signing library **must be Deno-compatible**, **OR** issuance runs in a **dedicated Node context** (a Worker/container microservice). This is a **required, explicit decision in goal F6** — a goal may not assume a Node-only lib works in a Deno Edge Function.

## Consequences

- Badges are **portable and independently verifiable** (standard proof suite + resolvable issuer profile + reachable status list), and **revocable** (the "badge earned on a retired course version flips to recert-required" rule works).
- F6 must make and **wire** the Deno-vs-Node signing decision explicitly; the chosen path is what the human verifies — not an assumption.
- **F6 + M7 are UltraCode + human-gate** goals: a minted badge must verify at a public URL, signing must be server-side only, and key custody / rotation must be confirmed before release.
- Server-side-only signing is a **pinned invariant** (the client never signs); it composes with ADR-0003's "server-only computations" rule (badge issuance/revocation run only in service-role Edge Functions).

## Addendum (F6 — resolved)

**Status:** Accepted (F6). The two required F6 decisions are now made + wired:

1. **Deno-vs-Node = PATH A — a Deno-compatible signer inside the `issue-badge` Edge Function.** De-risked empirically before building: `jsonld` (URDNA2015 canonicalization) + `@noble/ed25519` (pure-JS Ed25519) + WebCrypto SHA-256 run UNCHANGED under Deno 2.x, with a **static, offline document loader** (vendored contexts; no network at sign/verify time — both a security and a Deno-runtime requirement). Path A is preferred over Path B because it keeps the signing key co-located with **Supabase Vault**. **Conformance is proven, not assumed:** the signer emits a **byte-identical `proofValue`** to the digitalbazaar `eddsa-rdfc-2022` reference suite, the reference verifier accepts our credentials, and ours accepts the reference's (`packages/credentials/src/conformance.test.ts`). The Node package signer and the Deno Edge-Function signer are pinned to one output by a deterministic test vector asserted in BOTH runtimes (`src/test-vector-data.ts` ↔ `supabase/functions/issue-badge/handler.test.ts`).

2. **Issuer DID reconciled to `did:web:academy.redex.education`** (from the placeholder `goredex.com`). The product is hosted at `redex.education` (auth callbacks / `.env.example`), so the placeholder did:web would not resolve and a badge would fail the public-URL verify gate. Per the F6 hand-off's fallback (land domain-reconciliation first; else set the issuer here and keep it identical everywhere), this is the single source of truth (`packages/credentials/src/issuer-config.ts`). The already-merged migration's `goredex.com` table COMMENT is cosmetic (does not affect verification) and is left for the dedicated domain-reconciliation goal — a merged migration is not rewritten.

The shared, typed builder + signer live in `packages/credentials` so **M7 reuses them** (it does not re-implement the crypto). The three public Cloudflare Workers (`workers/issuer-wellknown`, `workers/badge-assertion`, `workers/status-list`) serve the DID document / profile, the hosted assertion, and the status list. **Release gate (ledger §J):** a qualified reviewer confirms a real issued badge verifies at its public URL in an independent verifier — see `docs/F6_HUMAN_VERIFICATION.md`.
