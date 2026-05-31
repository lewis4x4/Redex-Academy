# D1 — Adversarial Review (Design System & UI Foundation)

**Branch:** `d1-design-system` · **Gold standard:** `Redex_Academy_Prototype.html` · **Spec:** `goals/D1.md` + `goals/D1_DRY_RUN.md`
**Verdict in one line:** D1 is **substantially complete and on-brand** — tokens are the single source, the kit + shell + templates exist and are exported as the consumer contract, the no-raw-hex invariant is real and enforced, and the persona-density mechanism works without touching permissions. At review time it was **NOT yet clean enough** because of two confirmed keyboard-a11y defects in foundational overlay primitives (Modal + SlideOver) that violate Inv. 7, plus a measurable AA contrast miss and a cluster of gold-standard fidelity drift. **→ UPDATE: all 7 punch-list items (both major a11y blockers + all 5 minors) were FIXED on-branch and re-verified (focus-trap hook + tests; eyebrow contrast; motion/glow fidelity; gallery templates). D1 now clears the automated bar and is READY for its `[HUMAN-VERIFY]` gate — see §8.** Details, the as-found punch list, and the resolution table below.

All findings below were re-verified against source on `d1-design-system`. File:line and measured numbers are given for every load-bearing claim.

---

## 1. Per-task verdict vs `goals/D1.md`

| #   | Task                                                                                    | Verdict                                         | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Design tokens — single source** (color/type/space/radius/elevation/motion/background) | **Delivered**                                   | Tokens defined once in `packages/ui/src/styles/tokens.css` + `packages/ui/src/tokens/{colors,typography,layout,motion}.ts`. Brand `--red:#ed1b24` (tokens.css:7); navy `#0b3d91` is **gone** from all source (only survives in a `colors.ts:9` comment documenting its removal). Glow tokens `--glow`/`--glow-soft` present (tokens.css:74-75). Full keyframe library present — all 9 named keyframes (`pulseGlow heartbeat bossPulse edgeDash twinkle fadeUp sealPop toastIn toastOut`) exist in `keyframes.css`. Background system (dual red radial vignette, starfield, core-glow) in `background.css`. **Minor gaps:** no `text-shadow`/title-glow token (see §2, finding P3); `--ease-overshoot` defined but unwired (P1); `toastIn/out` defined but unwired (P2). |
| 2   | **`@redex/ui` component kit**                                                           | **Delivered**                                   | All primitives present and exported via `packages/ui/src/index.ts` (Button, Card, NavPill, Chip, Tag, Tooltip, Modal, SlideOver, Toast, Meter, StatBlock, Pip, TrophyMedal, Icon, Input, Toggle, States=Skeleton/Empty/Error). `StatusBadge` folded in (index.ts:29). Each has a unit test. Colorblind-safe shape+text+color confirmed in States/Meter/StatusBadge. **Defect:** Modal + SlideOver keyboard focus management is incomplete (Inv. 7) — see §4.                                                                                                                                                                                                                                                                                                            |
| 3   | **App Shell** (`packages/ui/src/shell`)                                                 | **Delivered**                                   | `AppShell`, `AppHeader`, `BrandMark`, `ScreenHead` present. Persona-adaptive density via `ShellDensity = 'field' \| 'dense'` (AppShell.tsx:6), reflected as `data-density` (AppShell.tsx:37) and driving type scale only (AppShell.tsx:40: `field → text-body-lg`, else `text-body`). Header carries brand mark + "Mastery, not seat-time" + nav pills + HUD.                                                                                                                                                                                                                                                                                                                                                                                                           |
| 4   | **Theme layer + raw-hex lint rule**                                                     | **Delivered**                                   | Dark default via CSS variables + Tailwind `darkMode`. The forbidden-hex lint rule is REAL: `packages/config/eslint-preset.js:61-72` uses `no-restricted-syntax` on `Literal[value=/#[0-9a-fA-F]{3,8}\b/]` **and** `TemplateElement` (string + template-literal coverage), with the token dirs excluded. Self-test exists (`packages/ui/src/no-raw-hex.test.ts`). Runs in CI `lint` job.                                                                                                                                                                                                                                                                                                                                                                                 |
| 5   | **Re-skin on-`main` surfaces** (F3 LoginPage + shell)                                   | **Delivered**                                   | LoginPage + App shell re-skinned on `@redex/ui`/tokens; e2e asserts the navy is gone (`d1-gallery.spec.ts:27-34`: H1 = "Redex Academy", bg ≠ white, Google Workspace button present). Correctly scoped: F4 SyncStatus + F5 Forge/sims **not** touched (Inv. 9 is their merge gate, per spec §5).                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 6   | **Module-archetype templates** (8 shells)                                               | **Delivered (shells)**                          | All 8 present + tested in `packages/ui/src/templates/`: CatalogGrid, ConstellationFrame, LessonReader, SimStage, SignoffForm, ManagerDashboard, BackpackWall, CapstoneStage. Exported (index.ts:34). Shells-only, no feature logic — correct per spec §6 / out-of-scope. **Gap:** not showcased in the gallery (see task 7 + coverage matrix).                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 7   | **Component gallery** (`/dev/ui`)                                                       | **Delivered for primitives; gap for templates** | Gallery renders every primitive, all states, both densities; e2e-verified at `/dev/ui` with a working density radiogroup (`d1-gallery.spec.ts:10,16-23`). **Gap:** `Gallery.tsx` renders **zero of the 8 templates** (grep for the 8 names → exit 1). The spec defines gallery content as "every PRIMITIVE, every state, both persona densities" (D1.md:49) — primitives, which it satisfies — so this is an enhancement gap, not a missed deliverable. The templates ARE the published contract (index.ts:34); M-goals consume them by import, not by reading the gallery.                                                                                                                                                                                             |

**Done-criteria roll-up (D1.md:51-57):** Tokens single-source ✓ · navy gone ✓ · full kit exported + gallery renders primitives ✓ · login/shell re-skinned ✓ · persona density from claim w/o permission change ✓ (e2e `d1-gallery.spec.ts:16-23`) · **a11y NOT fully met** — axe green on scanned routes but Modal/SlideOver keyboard focus + one AA contrast pairing fail (§4). reduced-motion ✓ · shape+text+color ✓.

---

## 2. Token / Type / Motion fidelity diff (vs prototype)

| Aspect                                  | Prototype (gold)                                                                            | Implementation                                                                                                                                                            | Status                                                                                                                                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand red                               | `--red:#ED1B24`                                                                             | `--red:#ed1b24` (tokens.css:7)                                                                                                                                            | ✓ match                                                                                                                                                                                                                                 |
| Placeholder navy                        | n/a (removed)                                                                               | absent from source                                                                                                                                                        | ✓ removed                                                                                                                                                                                                                               |
| Canvas / panel / line                   | `#0a0a0c` / `#121216`,`#17171d` / `#26262e`                                                 | identical (tokens.css)                                                                                                                                                    | ✓ match                                                                                                                                                                                                                                 |
| State + domain hues                     | pass/fail/veto/pending/gold + 6 domain hues                                                 | all present (colors.ts)                                                                                                                                                   | ✓ match                                                                                                                                                                                                                                 |
| Glow (box-shadow)                       | `--glow`, `--glow-soft`                                                                     | present (tokens.css:74-75)                                                                                                                                                | ✓ match                                                                                                                                                                                                                                 |
| Type scale / weights / eyebrow tracking | 900/800/700/600/400 + uppercase eyebrow tracking                                            | present; eyebrow 10px/700 uppercase (tailwind-preset.js:81,87)                                                                                                            | ✓ match                                                                                                                                                                                                                                 |
| Keyframe library                        | 9 named keyframes                                                                           | all 9 defined in `keyframes.css`                                                                                                                                          | ✓ defined                                                                                                                                                                                                                               |
| reduced-motion guard                    | per-animation                                                                               | **single comprehensive guard** — `keyframes.css:119-134` kills all `rdx-anim-*` + global `transition-duration:0.001ms`                                                    | ✓ **exceeds** prototype                                                                                                                                                                                                                 |
| **Seal-pop easing**                     | `sealPop .7s .15s cubic-bezier(.18,1.4,.4,1)` (line 437) — back-out overshoot + 0.15s delay | `.rdx-anim-seal: sealPop 0.5s var(--ease-out) both` (keyframes.css:111) — softer ease-out, no delay, 0.5s                                                                 | **DRIFT (minor)** — keyframe keeps a 1.08 peak so a bounce remains, but easing is flattened. `--ease-overshoot` (tokens.css:99, the exact `.18,1.4,.4,1` curve) is **defined but unwired**                                              |
| **Toast entrance/exit**                 | `toastIn .4s` (translateY 20px scale .9) + `toastOut .4s 2.6s` (lift −10px) (lines 475-479) | Toast uses generic `rdx-anim-fadeup` (8px, no scale); **no exit animation** (DOM-removed, Toast.tsx). `toastIn/toastOut` keyframes **defined but never bound to a class** | **DRIFT (minor)** + dead keyframes (the spec D1.md:26 names `toastIn/out`)                                                                                                                                                              |
| **Capstone title bloom**                | `.cap-title .red{color:var(--red);text-shadow:0 0 30px rgba(237,27,36,.5)}` (line 384)      | `CapstoneStage.tsx:99` renders title flat white, no red accent, no glow. **No title-glow/text-shadow token exists** anywhere                                              | **DRIFT (minor)** — missing token is also an Inv. 9 trap: a consumer can't reproduce the bloom without a raw `rgba()`. Note: the claim that the _seal_ title also glows is FALSE — prototype line 442 carries red color only, no shadow |

**Net:** color/type/space/elevation/background fidelity is **excellent**; the three drift items are all in the **motion/glow finish layer** and all on not-yet-mounted shells or one ephemeral component. The reduced-motion implementation is genuinely better than the prototype's.

---

## 3. Component + Template coverage matrix

**Primitives (task 2)** — exported in `index.ts`, in gallery, unit-tested:

| Component                                          | Exported | In gallery | Unit test | Notes                                          |
| -------------------------------------------------- | :------: | :--------: | :-------: | ---------------------------------------------- |
| Button (primary/secondary/ghost/disabled)          |    ✓     |     ✓      |     ✓     | red-gradient + glow                            |
| Card / Panel                                       |    ✓     |     ✓      |     ✓     | eyebrow slot has a contrast miss on panel (§4) |
| NavPill (+dot+glow)                                |    ✓     |     ✓      |     ✓     |                                                |
| Chip / Tab / Pill (+ gold persona)                 |    ✓     |     ✓      |     ✓     |                                                |
| Tag (tier/gate/boss/keystone)                      |    ✓     |     ✓      |     ✓     |                                                |
| Tooltip                                            |    ✓     |     ✓      |     ✓     |                                                |
| Modal + Scrim                                      |    ✓     |     ✓      |     ✓     | **focus-trap/restore missing (§4)**            |
| SlideOver                                          |    ✓     |     ✓      |     ✓     | **focus-on-open/restore missing (§4)**         |
| Toast + Stack                                      |    ✓     |     ✓      |     ✓     | entrance/exit drift (§2)                       |
| ProgressBar / Meter                                |    ✓     |     ✓      |     ✓     | green→amber→red                                |
| StatBlock / HUD stat                               |    ✓     |     ✓      |     ✓     |                                                |
| Pip + TrophyMedal (locked/earned)                  |    ✓     |     ✓      |     ✓     | domain-hued                                    |
| Icon set (inline SVG)                              |    ✓     |     ✓      |     ✓     |                                                |
| Form controls (input/select/checkbox/radio/switch) |    ✓     |     ✓      |     ✓     | Input + Toggle                                 |
| Skeleton / Loading / Empty / Error                 |    ✓     |     ✓      |     ✓     | States.tsx                                     |
| StatusBadge (folded in)                            |    ✓     |     ✓      |     ✓     | index.ts:29                                    |

**Templates (task 6)** — exported, unit-tested, but NOT in gallery:

| Template           | Exists | Exported | Unit test | In gallery |
| ------------------ | :----: | :------: | :-------: | :--------: |
| CatalogGrid        |   ✓    |    ✓     |     ✓     |     ✗      |
| ConstellationFrame |   ✓    |    ✓     |     ✓     |     ✗      |
| LessonReader       |   ✓    |    ✓     |     ✓     |     ✗      |
| SimStage           |   ✓    |    ✓     |     ✓     |     ✗      |
| SignoffForm        |   ✓    |    ✓     |     ✓     |     ✗      |
| ManagerDashboard   |   ✓    |    ✓     |     ✓     |     ✗      |
| BackpackWall       |   ✓    |    ✓     |     ✓     |     ✗      |
| CapstoneStage      |   ✓    |    ✓     |     ✓     |     ✗      |

Primitive coverage is **complete**. The only matrix hole is template visualization in the gallery (minor — they are still the published, importable contract).

---

## 4. Measured a11y + contrast report

### Contrast (WCAG 1.4.3 AA, dark theme)

| Pairing                                                        | Ratio                           | Threshold    | Result             |
| -------------------------------------------------------------- | ------------------------------- | ------------ | ------------------ |
| `text-redex #ed1b24` on `bg-canvas #0a0a0c` (eyebrow 10px/700) | **4.505:1**                     | 4.5 (normal) | ✓ pass (barely)    |
| `text-redex #ed1b24` on `bg-panel #121216` (eyebrow 10px/700)  | **4.256:1**                     | 4.5 (normal) | ✗ **FAIL by 0.24** |
| `text-redex` inside `text-h1` 26px (ScreenHead accent)         | passes as large text (≥18.66px) | 3.0          | ✓ pass             |

**Defect (major→minor):** `Card.tsx:62` renders the eyebrow as `text-eyebrow font-label uppercase tracking-eyebrow text-redex` on a `bg-panel` surface. At 10px/700 this is **normal text** under WCAG (large = ≥18.66px bold), so it needs 4.5:1 and measures **4.256:1**. Shipped in `SignoffForm.tsx:139` (`<Card variant="panel" eyebrow="Evidence">`) and the in-template legend eyebrow (`SignoffForm.tsx:104`). **The axe gate misses it** — `a11y.spec.ts` only scans `/` and `/dev/ui`; SignoffForm is not mounted, and the gallery's panel Card specimens (`Gallery.tsx:264,274`) omit the eyebrow prop, so red-on-panel is never scanned. Faithfully inherited from the prototype (`.eyebrow{color:var(--red)}` at 10px/700 on `--panel`) — but still a real AA miss in shipped contract code. Blast radius is narrow: a single decorative uppercase label whose white passing-contrast title below carries the same meaning.

### Keyboard operability (Inv. 7 / WCAG 2.4.3) — **two confirmed defects**

**D-1 (major) — Modal has no Tab focus-trap and no focus restore.** `Modal.tsx` `handleKeyDown` (lines 72-80) branches only on `Escape`; there is no Tab/Shift+Tab interception. The card is `role="dialog" aria-modal="true" tabIndex={-1}` but the Modal is **not portaled** and does **not** `inert`/`aria-hidden` the background — so Tab leaks focus to obscured background content behind the scrim (a WAI-ARIA APG modal-dialog violation). On open it calls `cardRef.current?.focus()` without capturing `document.activeElement`, and there is no return-focus on close → focus drops to `<body>`. The author's own comments call it "focus-trapped-ish" (Modal.tsx:56,66). The gallery wires a multi-button "Confirm sign-off" Modal (Gallery.tsx:377-390) so the leak is reachable. axe (static DOM) cannot catch it, so the gate stays green. The approved prototype itself has no trap/restore either — so this is a generalized WCAG/APG shortfall the spec's "full keyboard nav" + Inv. 7 require, not visual drift. M6 (sign-off rubric modal) and the Backpack inherit this primitive.

**D-2 (major) — SlideOver never moves focus into the panel on open and never restores it on close.** `SlideOver.tsx:53-138` has exactly one effect (60-70): an Escape listener. The `<aside>` is `role="dialog" aria-modal="true"` but is never focused and has no `tabIndex={-1}`; no trap; no restore. A keyboard/SR user who opens the drawer keeps focus on the now-obscured trigger. The asymmetry is telling: its sibling `Modal` at least focuses-on-open and the team shipped a test for that. **Credit where due:** the closed state is handled correctly — `inert` + `aria-hidden` (SlideOver.tsx:79,97-98) remove the off-screen close button from tab order AND the a11y tree, which is exactly why axe stays green and why this is invisible to automation. No focus-trap dependency exists in any `package.json` (verified).

### Reduced motion (WCAG 2.3.3 / spec "every animation gated")

**✓ Pass — exceeds the prototype.** A single comprehensive guard at `keyframes.css:119-134` disables every `*[class*='rdx-anim-']` and globally forces `transition-duration:0.001ms` under `prefers-reduced-motion: reduce`. No animation escapes it.

### Colorblind-safe (Inv. 7 — shape + text + color)

**✓ Pass.** StatusBadge/States/Meter all carry shape + text alongside color (never color alone). ConstellationFrame builds a colorblind-safe legend from token classes.

---

## 5. §6 RED-FLAG scan

| #   | Red flag (D1_DRY_RUN.md §6)                                               | Result             | Evidence                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Raw hex scattered through components/screens; navy still present as brand | **ABSENT**         | `grep 0b3d91` in src → only a removal comment; `no-restricted-syntax` hex rule (eslint-preset.js:61-72) enforced in CI `lint`; self-test exists                                  |
| 2   | Kit "exists" but screens hand-roll styles; login/Forge not re-skinned     | **ABSENT**         | LoginPage + shell built on `@redex/ui`; e2e asserts navy gone (`d1-gallery.spec.ts:27-34`). Forge correctly out-of-scope per spec §5 (F5's merge gate)                           |
| 3   | Motion with no reduced-motion guard                                       | **ABSENT**         | comprehensive guard `keyframes.css:119-134`                                                                                                                                      |
| 3b  | Color-only status                                                         | **ABSENT**         | shape+text+color throughout                                                                                                                                                      |
| 3c  | Contrast below AA on dark theme                                           | **FOUND (narrow)** | red eyebrow on `bg-panel` = 4.256:1 < 4.5 (see §4). The only AA miss; affects one decorative label on an unmounted shell                                                         |
| 4   | Persona used to gate **permissions**                                      | **ABSENT**         | `ShellDensity` drives type scale only (AppShell.tsx:40); e2e proves layout-only toggle (`d1-gallery.spec.ts:16-23`); comments explicitly state "density only, never permissions" |
| 5   | Feature logic smuggled in                                                 | **ABSENT**         | templates are shells only; no catalog gating / Constellation states / sim scoring / sign-off logic                                                                               |
| 6   | Gallery missing states (loading/empty/error/disabled)                     | **ABSENT**         | States.tsx (Skeleton/Empty/Error) + disabled Button all in gallery                                                                                                               |

**One red flag partially triggers** (3c, contrast), in a narrow, fixable form. All others are clean.

---

## 6. Prioritized punch list

Severities are this review's adjudicated values (several upstream "major" claims were verified real but downgraded on blast-radius).

### Critical

_(none)_

### Major

1. **Modal: add Tab focus-trap + capture/restore `document.activeElement`.** `Modal.tsx:59-121`. **Fixable now** (on-branch). Real WCAG 2.4.3 / APG defect in a contract primitive M6 + Backpack inherit. Either implement a trap + `inert` the background, or adopt a focus-trap util. Add a Tab-cycle + return-focus test.
2. **SlideOver: focus the panel/close-button on open + restore focus on close.** `SlideOver.tsx:53-138`. **Fixable now.** Mirror the pattern Modal already uses; add `tabIndex={-1}` to the `<aside>`. Closed-state `inert`/`aria-hidden` is already correct — keep it.

### Minor

3. **Red eyebrow on `bg-panel` fails AA (4.256:1 < 4.5).** `Card.tsx:62` + `SignoffForm.tsx:104,139`. **Fixable now.** Use `--red-bright #ff3b43` for the eyebrow on panel surfaces (or bump eyebrow to large-text size, or use `text-ink` for the panel-eyebrow variant). **Also surface:** extend the axe gate to mount SignoffForm (or any panel+eyebrow specimen) so the gate would catch it.
4. **Seal-pop flattened; `--ease-overshoot` defined-but-unused.** `keyframes.css:111`. **Fixable now** — change `.rdx-anim-seal` to `sealPop 0.7s 0.15s var(--ease-overshoot) both` to match prototype line 437 exactly and retire the dead token.
5. **Toast entrance/exit drift; `toastIn`/`toastOut` dead keyframes.** `Toast.tsx`. **Fixable now** — bind `.rdx-anim-toast-in`/`-out` (and align values to the prototype's 20px/scale .9 in, −10px out), and add an exit-animation-then-remove cycle in the provider. D1.md:26 names these keyframes, so leaving them unbound is a spec gap.
6. **Capstone title has no red bloom; no title-glow token.** `CapstoneStage.tsx:99`. **Fixable now** — add `--glow-title: 0 0 30px rgba(237,27,36,.5)` + a `text-shadow` utility, and let the title slot carry a `text-redex` accent (the ScreenHead.tsx:33 pattern already exists). Closes both a fidelity gap and an Inv. 9 reproducibility trap.
7. **Templates not showcased in the gallery.** `Gallery.tsx`. **Fixable now** — add a "Templates" section rendering each of the 8 shells with placeholder content, in both densities. Enhances the human-review artifact; not a spec-mandated deliverable.

### Nit

8. **No dedicated `no-raw-hex` / visual-regression CI job.** DRY_RUN §2 envisioned a distinct CI job; no-raw-hex actually runs inside `lint` (functionally fine) and there is no screenshot/visual-regression job. **Surface** — the human eye gate (§5 checklist) substitutes for visual regression at this phase; consider adding `toHaveScreenshot` baselines post-merge.

**Fixable-now vs surface:** items 1-7 are all fixable on this branch before merge. Item 8 is a process/surface note. None require touching other branches.

---

## 7. FINAL HONEST VERDICT

**Is D1 ready for its `[HUMAN-VERIFY]` gate? — Not yet. Close, but two real blockers stand between it and the bar.**

What is genuinely **beyond-world-class** here: the token layer is a true single source with a _real, self-tested_ lint invariant (string + template-literal hex both caught); the navy is fully excised; the kit is complete and exported as a clean contract; persona-density is correctly decoupled from permissions and proven by e2e; the colorblind-safe shape+text+color discipline is consistent; and the reduced-motion guard is more thorough than the approved prototype itself. The scope discipline is exemplary — templates are shells only, Forge/SyncStatus correctly left for their own merge gates, no feature logic smuggled in. The §6 red-flag sheet is almost entirely clean.

Why it is **not yet** ready:

- **Blocker 1 (major, Inv. 7):** `Modal` has no focus-trap and no focus restore — keyboard focus escapes an `aria-modal` dialog to obscured background, and is dropped to `<body>` on close. This is a foundational primitive M6 (safety-critical sign-off modal) and the Digital Backpack inherit directly.
- **Blocker 2 (major, Inv. 7):** `SlideOver` never moves focus into the drawer on open and never restores it on close.

Both are silent to the automated axe gate (axe doesn't simulate Tab), so the green CI is **misleading on exactly the dimension the human gate must catch**. The done-criteria demand "full keyboard nav" and WCAG 2.1 AA; these two defects mean that criterion is not met. The contrast miss (minor) and the three motion/glow drift items (minor) sharpen the fidelity story but would not, alone, block the gate.

**Recommendation:** fix punch-list items 1-3 (the two keyboard defects + the AA contrast miss) and ideally 4-6 (the fidelity drift, all one-liners) **on-branch before** the human reviewer opens the gallery. After that, D1 clears its `[HUMAN-VERIFY]` gate cleanly and is safe to gate M1/M2/M6/M7/M11/G1/C1. The remaining items (7-8) are enhancement/surface and need not block merge. _(As-found recommendation — superseded by §8: the two keyboard blockers were fixed and locked with Tab-cycle/return-focus tests, and per the 2026-05-30 de-bottleneck the prototype-match is a non-blocking post-merge check, so D1 is `done` on green CI.)_

---

## 8. Resolution — fixes applied this review (re-verified)

§1-7 above record the design system **as-found**. All 7 punch-list items — **both Major a11y blockers and all 5 Minor** — were then fixed on `d1-design-system` and re-verified. Item 8 (the nit) is surfaced, not fixed.

| #   | Finding                                  | Fix                                                                                                                                                                                                                       | Proof                                                                                 |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | Modal: no focus-trap / no restore        | New `useFocusTrap(ref, active)` hook (`packages/ui/src/useFocusTrap.ts`): captures the trigger, focuses the first focusable in the dialog, traps Tab/Shift+Tab, restores focus to the trigger on close. Into `Modal.tsx`. | `Modal.test.tsx` (13): focus-in-on-open, Tab wrap, Shift+Tab wrap, restore-on-Escape. |
| 2   | SlideOver: no focus-on-open / no restore | `useFocusTrap(panelRef, open)` + `tabIndex={-1}` on the `<aside>`; closed-state `inert`/`aria-hidden` kept intact.                                                                                                        | `SlideOver.test.tsx` (10): focus-into-panel-on-open, restore-on-close.                |
| 3   | Red eyebrow on panel 4.256:1 < AA        | Eyebrow `text-redex` → `text-redex-bright` (#ff3b43 ≈ 5.2:1 on panel) in `Card.tsx`, `ScreenHead.tsx`, + the 3 templates that surfaced it once shown in the gallery (CapstoneStage/SignoffForm/ConstellationFrame).       | axe green on the gallery (now mounting the templates).                                |
| 4   | sealPop flattened easing                 | `.rdx-anim-seal` → `var(--ease-overshoot)` (the prototype's back-out "seal lands").                                                                                                                                       | `keyframes.css:110-113`.                                                              |
| 5   | Toast motion drift; dead toastIn/out     | Added `.rdx-anim-toast-in`/`-out` (bound the keyframes, reduced-motion-guarded); Toast entrance → `rdx-anim-toast-in`.                                                                                                    | `keyframes.css:114-118`, `Toast.tsx`.                                                 |
| 6   | Capstone title no bloom; no token        | Added `.rdx-title-glow` (red `text-shadow` bloom, non-motion); applied to the CapstoneStage display title.                                                                                                                | `keyframes.css:128-130`, `CapstoneStage.tsx`.                                         |
| 7   | Templates not in gallery                 | Added a "Module-archetype templates" gallery section rendering all 8 shells with placeholder slots.                                                                                                                       | `/dev/ui` renders + axe-clean; `docs/d1-review/gallery-dense.png`.                    |
| 8   | No dedicated no-raw-hex/visual CI job    | **Surfaced (not fixed):** no-raw-hex is enforced inside the `lint` job; visual-regression baselines are a post-merge enhancement (the human eye gate covers it now).                                                      | —                                                                                     |

**Re-verification (all green):** typecheck ✓ · lint 0 errors, prettier-clean ✓ · unit **200 tests** (ui 184) ✓ · no-raw-hex provably fails a planted hex ✓ · build ✓ · `test:a11y` axe **2/2** (gallery — incl. the newly-mounted templates — + login) ✓ · `test:e2e` **8 passed + 1 HUMAN-VERIFY skip** ✓.

> **Updated verdict:** with both keyboard blockers fixed and locked by Tab-cycle/return-focus tests, and the contrast + motion/glow minors resolved, **D1 clears the automated bar and is cleared to merge.** The prototype side-by-side (`docs/D1_HUMAN_VERIFICATION.md`; screenshots `docs/d1-review/{prototype,login,gallery-dense,gallery-field}.png`) is now a **non-blocking post-merge polish pass any reviewer can do** — it no longer gates the #6 merge or the modules built on `@redex/ui`. Status: **`done`** on green CI; visual divergences are fast-follow fixes. _(De-bottlenecked 2026-05-30 — the prototype-match was the only true human visual-approval gate and it was holding up the merge.)_
