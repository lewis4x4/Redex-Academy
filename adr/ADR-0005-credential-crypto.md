# ADR-0005 — Credential crypto: `eddsa-rdfc-2022` / Ed25519 / `did:web` / hosted status list (+ Deno constraint)

**Status:** Accepted

## Context

Redex must be the **issuer** of portable, verifiable **Open Badges 3.0 / W3C Verifiable Credentials** — owning the signing keys, the `credentialSubject`, the evidence links to real job records, and the expiry/revocation lifecycle (a Redex badge must *verify at a public URL*, not be a decorative PNG). wave3 §3.7 specified the issuer shape but the Wave 4 review found the **cryptographic specifics were unpinned** (no proof suite, no issuer identifier scheme, no revocation mechanism, no key-rotation plan), and a critical runtime hazard was unaddressed: Edge Functions run on **Deno**, and many VC-signing libraries are **Node-only** — a goal could naively assume a Node lib works in a Deno Edge Function and ship a broken signer. A signing bug is a credibility/liability event. (ledger §F; wave3 §3.7; CLAUDE.md §5 invariant 7.)

## Decision

Pin the credential crypto:

- **Proof suite:** **`eddsa-rdfc-2022`** with **Ed25519** keys.
- **Issuer identifier:** **`did:web:academy.goredex.com`** (or a stable hosted issuer profile served by a Worker at a `.well-known` URL).
- **Revocation:** a **hosted status list** (BitstringStatusList / StatusList2021) that verifiers check; `credential_status_list` is public-readable (carries no PII).
- **Key custody:** the signing key lives in **Supabase Vault only** (co-located with the `issue-badge` Edge Function) — **never** in Cloudflare Secrets, never in any client bundle.
- **Key rotation:** a documented plan; the issuer profile lists **current + retired** keys so existing proofs survive rotation.
- **Deno-compatibility requirement (the explicit hazard):** the VC-signing library **must be Deno-compatible**, **OR** issuance runs in a **dedicated Node context** (a Worker/container microservice). This is a **required, explicit decision in goal F6** — a goal may not assume a Node-only lib works in a Deno Edge Function.

## Consequences

- Badges are **portable and independently verifiable** (standard proof suite + resolvable issuer profile + reachable status list), and **revocable** (the "badge earned on a retired course version flips to recert-required" rule works).
- F6 must make and **wire** the Deno-vs-Node signing decision explicitly; the chosen path is what the human verifies — not an assumption.
- **F6 + M7 are UltraCode + human-gate** goals: a minted badge must verify at a public URL, signing must be server-side only, and key custody / rotation must be confirmed before release.
- Server-side-only signing is a **pinned invariant** (the client never signs); it composes with ADR-0003's "server-only computations" rule (badge issuance/revocation run only in service-role Edge Functions).
