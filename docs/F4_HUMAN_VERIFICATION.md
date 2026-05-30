# F4 — Human Verification Checklist (REAL hardware, airplane mode)

> **This is the gate that matters (ledger §J).** The Playwright `setOffline(true)`
> proxy passing in CI is **necessary but NOT sufficient**. F4 stays
> **`pending_human_verification`** (not `done`) until a human completes + signs this
> on a real device. **Never fake a pass.**

## Setup

- A real phone (the field device class — mid-range Android is the worst case).
- A built PWA installed/served, the academy auth configured (F3), the `/sync`
  Edge Function deployed, and at least one course with a downloadable field pack.
- A test identity (a CCS dev tech from the F3 dev-identities seed is fine).

## The run (perform in order)

1. **Download a field pack** for a course over Wi-Fi. Confirm the pack (sim specs,
   checklists, captions, rubric) is available; confirm **video was NOT auto-downloaded**
   (only an explicit "download for offline" per video).
2. **Enable airplane mode** (true offline — not just devtools throttling).
3. **Run a sim / Core flow offline.** Generate attempts + telemetry. Start a
   **sign-off draft** with an evidence photo. Confirm the UI works fully offline.
4. Confirm **sync state is unmissable**: every queued item shows a clear
   "will complete on reconnect" state. A tech **cannot** mistake a queued job for
   a completed one (the INT-102 failure mode).
5. **Re-enable the network.** Confirm queued events **reconcile** with **no lost work**.
6. **Force a double flush** (toggle airplane mode rapidly / let background sync fire
   twice). Confirm **no double-count** of attempts/telemetry/responses
   (`client_event_uuid` dedupe holds end-to-end, not just in the unit test).

## Invariants to confirm BY HAND (any failure = do not merge)

- [ ] **Never faked a pass:** the offline run did **not** mint competency promotion,
      a sign-off `outcome`, a badge, or recert. The server computed every verdict;
      the device only **queued raw events**.
- [ ] **`/sync` rejected server-only fields:** an attempt to sync a client-set
      `outcome` / `competency_state` / badge was rejected (surfaced, not silently dropped).
- [ ] **Immutable-after-sign holds against the real DB:** a late edit to a `signed`
      sign-off is rejected (the F2 `tg_signoff_immutable` trigger fires).
- [ ] **Idempotent on real reconnect:** double-flush produced **no duplicate rows**.
- [ ] **Conflict surfaced, not swallowed:** a genuine two-sided draft conflict
      asked the user, never silently overwrote.
- [ ] **No work lost** across the offline→online transition.

## Sign-off

| Field       | Value                |
| ----------- | -------------------- |
| Verified by | (name)               |
| Device / OS | (model / OS version) |
| Date        | (yyyy-mm-dd)         |
| Result      | PASS / FAIL          |

Notes:

---

_Automated status (CI, all green — necessary but NOT sufficient for the run above):_

- _Playwright offline-state proxy (`apps/web/e2e/offline-sync.spec.ts`): `synced → offline → synced` in a real browser, past the auth gate; logged-in shell axe-clean._
- _Unit idempotency / classification / server-only-rejection / LWW (`@redex/sync-core`, `apps/web/src/offline/*.test.ts`)._
- _SQL idempotency 1–8 (`supabase/tests/sync_idempotency_test.sql`): append no-double-count, faked-pass blocked, immutable-signed, upsert-on-natural-key, id-keyed stable-id._
- _**End-to-end `/sync` acceptance pipeline** (`supabase/functions/sync/sync.integration.test.ts`): the REAL `validateSyncEvent → planWrite → upsert` path run against a live Postgres — proves a double-flush does not double-count, a client-set sign-off `outcome` is rejected, an edit to a `signed` sign-off is rejected by the F2 trigger, and draft LWW — as one pipeline._

_None of these substitute for the real-hardware airplane-mode run above. The HTTP/auth wrapper (`getUser` + caller-token RLS) is exercised only on a live Supabase project (its own live/human gate)._
