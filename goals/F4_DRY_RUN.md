# F4 — Dry-Run: Expected Output & Human-Verify Checklist

A known-good target for your first **ultracode** run. Read this before running `/goal F4`, then check the result against §4–§6. If anything in §6 (Red Flags) appears, reject the run and re-prompt.

- **Goal:** build the offline-first PWA spine — a Workbox service worker (precache app shell + on-demand "field pack"), a Dexie/IndexedDB durable local store (in-progress attempts, telemetry, sign-off **drafts** + evidence Blobs, queued xAPI), and the **idempotent `/sync` Edge Function (Deno)** that reconciles on reconnect **without losing work or faking a pass**. This is the program's **#1 risk bet** (wave3 §12.6).
- **Tier:** ultracode (xhigh + dynamic workflow + adversarial verification). **Pair with auto mode.**
- **Depends on:** **F2** merged — the event tables with `UNIQUE(client_event_uuid)` (`sim_attempts`, `sim_telemetry_events`, `assessment_responses`), `competency_state`/`signoffs` server-authoritative, the immutable-signed trigger, generated types.
- **Human gate — [HUMAN-VERIFY], ledger §J:** the offline run is verified on **REAL hardware in airplane mode** before release. The Playwright `setOffline(true)` harness is a **proxy only** — it does NOT substitute. Mark the goal **"pending human verification," not "done."** **Never fake a pass.**

---

## 1. The `/goal` invocation to give Claude Code
> Run goal F4 per `goals/F4.md`. The sync contract is F2 + ledger §G: every append-only event carries a **client-generated UUID + device timestamp**, and `/sync` is **idempotent keyed on `UNIQUE(client_event_uuid)`** — insert `ON CONFLICT (client_event_uuid) DO NOTHING` (SCHEMA_NOTES §6). **Server-only computations are NEVER accepted from the client** (competency promotion, mastery verdict, sign-off finalize/outcome, badge issuance, recert) — `/sync` must **reject** any payload attempting to set them, and a `signed` sign-off is **immutable** (late edits rejected by `/sync` AND by the F2 DB trigger). Last-writer-wins applies **only to drafts/prefs**, tie-broken by **server receipt time**. Don't invent new event shapes — emit against F2's tables (Inv. 5); the real sim engines are F5/F5b, so use a **stub event** in the harness. Out of scope: xAPI→LRS forwarding (M8 — F4 only **queues** xAPI locally), sign-off finalize / badge issuance (M6/M7 — F4 handles only the **draft** path + rejection of illegal server-only writes).

## 2. Expected repo changes (the file tree F4 should produce)
```
apps/web/
  vite.config.ts                 # Workbox plugin (vite-plugin-pwa or workbox-build) wired
  src/sw/
    service-worker.ts            # precache app shell; runtime: cache-first hashed assets,
                                 #   network-first API, stale-while-revalidate catalog; update lifecycle + prompt
  src/offline/
    db.ts                        # Dexie schema: coursePacks, simAttempts, telemetryQueue,
                                 #   signoffDrafts (+ evidence Blobs), xapiQueue — every row has client_event_uuid + device_ts
    field-pack.ts                # on-demand pack download (sim HTML/JS, JSON specs, images, captions,
                                 #   checklists, sign-off rubric). Video NOT force-cached — explicit per-video "download for offline"
    sync-queue.ts                # flush on `online` event + periodic retry w/ backoff
    sync-state.ts                # UI store: "will complete on reconnect" / "synced" — UNMISSABLE (INT-102)
  src/components/SyncStatus.tsx  # visible sync state; an un-synced job never "looks done"
supabase/functions/sync/
  index.ts                       # the /sync Edge Function (Deno): upsert-by-UUID for append-only events;
                                 #   LWW (server receipt) for drafts/prefs; REJECT server-only fields; REJECT edits to signed sign-offs
  sync.schema.ts                 # Zod for the /sync payload (validate, don't trust)
packages/db-types/database.types.ts   # imported (no schema change expected); committed in sync
e2e/
  offline-sync.spec.ts           # context.setOffline(true): download pack → act offline → queue → online → reconcile; idempotent; no faked pass
tests/
  sync-idempotency.test.ts       # UUID replay = no-op; double-flush no double-count
  sync-rejects-server-only.test.ts  # client cannot set competency_state / outcome / badge / recert
  sync-immutable-signed.test.ts  # late edit to a signed sign-off rejected
  sync-lww.test.ts               # concurrent draft edits resolve by server receipt; genuine 2-sided conflict surfaced
docs/
  F4_HUMAN_VERIFICATION.md       # committed real-hardware airplane-mode checklist artifact (the proxy can't replace it)
```
Nothing else. F4 syncs whatever event shapes the engines emit; it does **not** build the engines.

## 3. Commands it should run
```bash
supabase start
supabase functions serve sync                 # local Deno runtime for /sync
pnpm build                                     # PWA build emits the service worker + precache manifest
pnpm typecheck && pnpm lint
pnpm test          # unit: idempotency, server-only rejection, immutable-signed, LWW tie-break
pnpm test:e2e      # Playwright offline: download → offline → reconnect → reconcile; sync-state UI visible
pnpm test:a11y     # sync-status surfaces are accessible
# /sync runs in Deno — do NOT import a Node-only module into it
```

## 4. Expected RESULT signals (acceptance evidence)
- **Automatable proxy (CI):** with Playwright `setOffline(true)`, a downloaded **field pack runs offline**; queued events **flush on reconnect**; **replaying a flush is idempotent** — no duplicate rows, proven via `UNIQUE(client_event_uuid)` + `ON CONFLICT DO NOTHING`.
- **Never-fake-a-pass:** an offline attempt **cannot** promote `competency_state` or set a sign-off `outcome`; verdicts compute **server-side only**; `/sync` **rejects** any client-set state field.
- **Immutability:** a late edit to a `signed` sign-off is rejected by `/sync` **and** by the F2 DB trigger (`tg_signoff_immutable`).
- **LWW:** concurrent **draft** edits resolve by **server receipt time** (with clock-skew tolerance); a genuine two-sided conflict is **surfaced to the user**, never silently dropped.
- **Sync state is unmissable:** anything awaiting server authority shows a clear **"will complete on reconnect"** state; an un-synced job does not render as done (INT-102).
- **Video is not force-cached:** the field pack caches sim assets/specs/images/captions/checklists/rubric; video is offered as an **explicit per-video** "download for offline" only.
- `pnpm typecheck && pnpm lint && pnpm build` green; types committed and in sync; **`/sync` contains no Node-only import**.

## 5. HUMAN-VERIFY checklist (a qualified reviewer, before release — not agent-self-certified) — [HUMAN-VERIFY]
- [ ] **REAL hardware, airplane mode (the gate that matters):** on an actual phone, **download a field pack**, enable airplane mode, **run a sim offline** (stub or real), generate telemetry, re-enable network, and confirm **reconciliation with no lost work**. The Playwright proxy passing is **not** sufficient.
- [ ] **Idempotent on real reconnect:** trigger a **double flush** (e.g. background sync fires twice on a flaky network) and confirm **no double-count** of attempts/telemetry/responses (`client_event_uuid` dedupe holds end-to-end, not just in the unit test).
- [ ] **Never faked a pass:** confirm by hand that an offline attempt did **not** mint competency promotion / a sign-off `outcome` / a badge — the server computed every verdict; the device only **queued** raw events.
- [ ] **Immutable-after-sign holds against the real DB:** a late edit to a `signed` sign-off is rejected (the F2 trigger fires, not just app code).
- [ ] **Sync state was genuinely unmissable** on the device: a tech could not mistake an un-synced job for a completed one (the INT-102 failure mode).
- [ ] **Conflict surfaced, not swallowed:** force a real two-sided draft conflict and confirm the user is asked, not silently overwritten.
- [ ] **`docs/F4_HUMAN_VERIFICATION.md` checklist is signed** and the goal is marked **pending human verification** until this is done.
- [ ] Reviewed the **adversarial-verification report** the ultracode run produced; its findings are addressed.

## 6. RED FLAGS — reject the run if you see any of these
- **The run self-certifies "done" from the Playwright proxy alone** — the real-hardware airplane-mode test is the human gate (ledger §J); a proxy pass is necessary but NOT sufficient. **Never fake a pass.**
- `/sync` is **not idempotent** — it inserts without `ON CONFLICT (client_event_uuid) DO NOTHING`, or dedupes on app-generated row ids instead of the **client UUID**, so a double-flush **double-counts**.
- `/sync` **accepts a server-only field** from the client (sets `competency_state`, a sign-off `outcome`/`signed`, badge issuance, or recert) — a tech could mint themselves a pass on a plane.
- A `signed` sign-off can be **edited via `/sync`** (the immutability check was dropped, relying on nothing or on app code only).
- **LWW applied to events/state** instead of only drafts/prefs (append-only events must never be last-writer-wins), or conflicts **silently dropped** instead of surfaced.
- A **Node-only library imported into the Deno `/sync` Edge Function** (it will fail at runtime — Edge Functions are Deno).
- **Video force-cached** into the field pack (blows the offline storage budget) instead of explicit per-video opt-in.
- Sync state hidden/ambiguous so an un-synced job "looks done" (the exact INT-102 risk this goal exists to kill).
- New event shapes **invented** instead of emitting against F2's tables (Inv. 5); or `database.types.ts` hand-edited / not committed.
- Any real secret value written into a file.

## 7. Definition of Done (the merge gate)
All §4 signals present · the Playwright offline proxy green in CI (`test:e2e`) · idempotency/server-only-rejection/immutable-signed/LWW unit tests green · `typecheck`/`lint`/`build`/`test:a11y` green · types committed · **`docs/F4_HUMAN_VERIFICATION.md` produced** · **goal marked `pending_human_verification`** (NOT `done`) in `GOALS_INDEX` until the **real-hardware airplane-mode** run is signed off. Only after the human gate does F4 flip to `done`; M6 (which depends on F4) consumes the draft-sync + immutability contract.

---
*Known nit to enforce during the run: the proxy DoD (Playwright `setOffline`) and the human DoD (real device) are **two separate gates** — CI green ≠ merge-ready. F4 owns only the **draft** sign-off path + rejection of illegal server-only writes; finalize is M6.*
