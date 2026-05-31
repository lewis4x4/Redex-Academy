# M3 — AC-203 egress-fail sim · Release gates (ledger §J)

These are **release gates, not merge gates** (DECISIONS_LEDGER §J, CLAUDE.md §9). The PR
merges on green CI (the locked invariant suite — safety-veto coupling, RLS isolation,
no-fake-pass, no-raw-hex, typegen-drift); a **designated qualified reviewer** (the
**safety reviewer** for the veto/SME content, the **security reviewer** for the service-role
function) signs each item below **before the production / field release**. None block the merge.

The agent does **not** self-certify any of these.

## What CI already proves (merge-clearing, no human needed)

- The branching Verdict over the AC-203 graph: **pass**, **non-critical miss → fail (no veto)**,
  **critical-safety choice → non-overridable safety-veto** (`packages/sim-engine` `core.test.ts`,
  `verdict.test.ts`).
- The **server-side** re-scorer agrees with the browser engine on the same three cases
  (`supabase/functions/finalize-sim-attempt/score.test.ts`, run under `deno test` in CI).
- Every `verdict.line_item_key` maps to an authoritative seeded S1 ⚠ key (`ac203-rubric.test.ts`).
- e2e: boss node → play → **pass advances the node**; **fail/veto blocks** + shows the coded
  post-mortem + returns to the deciding node; an **offline** run queues and never fakes a pass
  (`apps/web/e2e/ac203-sim.spec.ts`).
- a11y (axe) on the sim screen; colorblind-safe state (shape+text+color); EN/ES key resolution
  (`i18n.test.ts`); RLS write-isolation for `sim_attempts` (`0002_rls_negative.sql`).

## Release-gate checklist (pending release verification)

- [ ] **Safety reviewer — server-side veto fires (live).** On the live stack, confirm the
      `finalize-sim-attempt` function **refuses promotion** and the attempt records
      `safety_veto_triggered=true` for each critical branch (fail-locked / motion-REX-only /
      out-of-reach push-to-exit / no-fire-interface). The veto is non-overridable and never
      client-spoofable (the function re-scores from the DB spec, ignoring any posted outcome).
- [ ] **Safety reviewer — SME content accuracy.** AC-203 scenario copy is SME-accurate: the
      **NFPA 101 §7.2.1.6.2** citation; the fail-safe / fail-locked distinction; the push-to-exit
      headline numbers (40–48 in, within 5 ft, ≥30 s); the three required release modes (power
      loss, push-to-exit, fire alarm). EN canonical is locked; the 4 mapped ⚠ keys are correct.
- [ ] **Safety reviewer — ES SME translation.** The Spanish scenario + UI prose
      (`packages/sim-engine/src/i18n/sim-strings.ts`, `packages/i18n .../es/common.json`) is
      professionally SME-reviewed. Locked safety terms stay canonical (never machine-translated);
      `SAFETY_GLOSSARY.md` ES/TL remain `[SME-REVIEW REQUIRED]` until SME-complete.
- [ ] **Security reviewer — service-role function.** Deploy `supabase/functions/finalize-sim-attempt`
      with `SUPABASE_SERVICE_ROLE_KEY` in its function env (Supabase Vault, never a client bundle).
      Confirm it promotes only the **caller's own** competency and never downgrades `field_proven`.
- [ ] **Prod Data API exposes `academy`.** Settings → API → Exposed schemas must include `academy`
      (same one-time setting the Constellation needed) so the sim's reads/writes resolve.
- [ ] **Seed the AC-203 `sim_definitions` row in prod.** Apply `seed/0001_mvp_slice_seed.sql`
      (M3 block, id `000000d1-…-000e`, key `ac-203/egress-compliant`) so the finalize function
      can load the authoritative spec by id.
- [ ] **(Optional) Sanitized R2 media.** The screen ships on-brand SVG tableaux (no external
      asset). If photoreal media is desired, upload **sanitized** fixtures (Inv 6) at the
      `sims/ac203/*.jpg` R2 keys; the spec already references them via `alt_i18n`.

## Noted future hardening (not required for M3)

- Bind the finalize `choices` to the **recorded** `sim_telemetry_events` (rather than a posted
  path) for stronger anti-cheat. Today the path IS the answer (a passing path requires the
  correct life-safety judgments), and promotion is server-computed, so no pass can be faked;
  tightening this is M8/M10 telemetry-projection territory.
