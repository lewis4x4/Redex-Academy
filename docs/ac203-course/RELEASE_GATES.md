# AC-203 course ingestion — release gates (ledger §J)

> The flagship course **AC-203 — Mag Locks, REX & Basic Egress Wiring** is now wired
> end-to-end: 6 lesson sections (Units 1–6) with 4 embedded 2D sims, the re-centered
> egress branching scenario, the device-config virtual-door build, 12 knowledge-check
> items, and the updated §5.4 sign-off rubric. **All CI merge gates are green.** The
> items below are **release gates** (CLAUDE.md §9 / ledger §J): a designated qualified
> reviewer signs them **before the production/field release** — they do **not** block the
> merge. None is agent-self-certified.

## What landed (the merge — green CI)

- **Lessons:** `apps/web/src/lessons/content/ac-203/u1.mdx` (Units 1–6 folded, M2 component
  contract: `<Sim spec>`, `<Callout tone>`, `<Checklist>`, `<KnowledgeCheck/>`). The lesson
  de-placeholders unit `…000e-…0001`.
- **Sims (6):** 4 new `interaction_2d` (`ac-203/mag-vs-strike-pick`, `armature-mount`,
  `button-placement`, `follow-the-power`), the `device_config` build
  (`ac-203/virtual-door-maglock`, replacing the unbuilt `webgl_install` placeholder on u3),
  and the **re-centered** branching `ac-203/egress-compliant` (the climax moved off the
  fire-alarm interface onto the **power-loss + push-to-exit ≥30 s release**; trap-the-occupant
  veto kept; node/choice ids unchanged; verdict key → `ac203.push_to_exit_30s`).
- **Knowledge checks (12):** seeded into `academy.assessment_items` (cv `…c2-…000e`), **9
  safety (≥90 %) + 3 non-safety (≥80 %)** so both mastery bars are exercised, with real
  gradable `answer_key`s. A new `knowledge_check` unit (`…000e-…0005`) holds the set; the
  server-only `grade-knowledge-check` Edge Function is the authority (promotes `in_progress`,
  never `sim_passed`).
- **§5.4 rubric:** removed `ac203.release_on_fire_alarm`, added the critical-safety
  `ac203.armature_sealed_pull_test` ("Armature sealed — pull test holds"). A 1-for-1 critical
  swap — AC-203 stays **12 lines / 7 critical**, so the non-overridable safety veto set never
  shrank (Inv. 1). The M6 veto trigger / RLS / functions are key-agnostic and untouched.
- **Schema:** none. Seed-only (`supabase/seed/0003_ac203_content.sql`, idempotent, wired into
  CI slice-seed + `config.toml`). `typegen-drift` stays green; **no prod schema deploy is
  required to merge.**

## Release gates (sign before field release — NOT merge blockers)

- [ ] **Safety SME — content accuracy.** A qualified evaluator confirms the AC-203 content is
      field-accurate before a real tech learns it: - **NFPA 101 §7.2.1.6.2** numbers: push-to-exit **40–48 in**, **within 5 ft**, releases
      **≥30 s**, signed. - **Fail-safe wiring**: lock **Black → 24 V** supply, **Red → controller NC** (24 V locked
      / 0 V unlocked). - **The armature seal + Redex pull test** (Loctited-but-floating on the rubber washers;
      over-tight **and** loose both give a weak hold). Confirm the `armature-mount` sim's
      **qualitative** model (loose / sealed / solid) faithfully represents the field truth —
      no invented quantitative holding-force values were introduced. - The **fire-alarm escalation** cue (specialist job → flag & escalate, not wired on this
      install) and that **removing the fire-alarm-release §5.4 line is correct for Redex's
      door scope**. - The **12 knowledge-check items** — stems, options, correct answers, and the
      `is_safety_item` split (items 3, 9, 10 non-safety).

- [ ] **ES — SME translation pass (locked safety glossary canonical).** ES is authored as a
      _working_ translation where the build requires a non-empty string, and left to SME where
      it is not faked. Sign off the ES safety wording before the Spanish release: - **Sim strings** (`packages/sim-engine/src/i18n/sim-strings.ts`, `es` block): the AC-203
      sim copy (new sims + the re-centered branching) — working ES, locked terms
      (fail-safe / fail-locked / REX / egress / push-to-exit / AHJ) and `NFPA 101 §7.2.1.6.2`
      kept canonical; **SME review required**. - **Knowledge-check items**: `academy.assessment_items.locale_variants.es` is intentionally
      **empty** (EN fallback) — the 12 item bodies are an **SME authoring task** (safety strings
      are never machine-faked). - **Lesson MDX**: `ac-203/u1.mdx` is **EN only** (the repo has no ES MDX convention); the ES
      lesson body is an SME authoring task. - `SAFETY_GLOSSARY.md` ES entries remain `[SME-REVIEW REQUIRED]` until complete.

- [ ] **Engine-contract / F5 sim sign-off.** Confirm the engine assignments and safety mappings:
      the 4 embeddable sims are `interaction_2d`, the build is `device_config` (the `webgl_install`
      3D edition is M5 — out of scope), and every `safety_flag` item/rule scores
      `safety_compliance` on a scored band (no warn-band veto bypass). Confirm the re-centered
      branching climax (release-time ≥30 s → `ac203.push_to_exit_30s`) faithfully replaces the
      retired fire-alarm climax and the trap terminal is intact.

- [ ] **Sanitized media (Inv. 6).** The sims ship with schematic ids / on-brand tableaux and **no
      fixture** (`fixture_set_ref: null`). If photoreal schematics are desired, upload **sanitized**
      assets at the `schematic_id` / `r2_key` references; never use production customer media.

## Noted follow-ups (minor — not gates)

- **Per-item "why wrong" feedback** is preserved in `assessment_items.prompt.rationale` (consumed
  from the pack, not dropped) but the **M2 KnowledgeCheck renderer reads only `prompt.text`** today,
  so the rationale is not yet surfaced. A small future M2 enhancement can render it.
- The `ac203.verify.three_release_modes_logged` rubric **key** is retained (internal id) while its
  **label** now reads "Both release modes tested live; pull-test seal proven; logged" to match the
  re-centered two-release-mode scope.
- The re-centered branching node retains the internal id `firealarm` (now the release-time/emergency
  climax) to avoid rippling the hardcoded click-path arrays in the M3 tests/UI; all learner-visible
  content is re-centered.
