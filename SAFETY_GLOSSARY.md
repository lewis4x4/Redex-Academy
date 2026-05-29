# Redex Academy — Locked Bilingual Safety Glossary

> **Authoritative source:** the **Build Decisions Ledger** (`wave4_decisions_ledger.md` §B and the curriculum §4b "locked safety glossary"), grounded in the **Course Bible** (`course_bible_master.md`, esp. FND-102, AC-101/102/103, AC-202, AC-203, AC-303, SEC-101, VID-201/202) and the cited NFPA 101 / IEEE 802.3 content. Where any doc conflicts with the ledger, **the ledger wins.**

This is the **locked term table the translation layer cannot override** (CLAUDE.md §7, `CODING_STANDARDS.md` §8, wave3 §2.2). Every term below must render **identically** across:

- the **app UI** (`react-i18next`, `packages/i18n`),
- **field docs** (checklists, sign-off rubrics, pre-flight cards), and
- the **i18n string tables** for every locale.

A goal **may not** localize, paraphrase, abbreviate, or "improve" a glossary term. These terms are contracts; the `packages/i18n` locked-glossary table is non-overridable, and a goal that changes a glossary rendering fails review by default (CLAUDE.md §5 invariant context; `CODING_STANDARDS.md` §8).

---

## The translation rule (READ FIRST — non-negotiable)

**Safety terms are NEVER machine-translated.** A mistranslated egress or fail-state term is a life-safety event, not a copy nit. Therefore:

- The **English (EN) canonical definition** below is authoritative for *meaning*. It is the source of truth a translator works from.
- **ES (Spanish)** and **TL (Tagalog)** renderings are intentionally left as **`[SME-REVIEW REQUIRED]`** placeholders. They must be supplied by **professional, domain-qualified SME translation** (curriculum §4b: "safety-critical line items professionally translated and SME-reviewed"; wave3 §8.1 localization-as-a-workflow-state). Do **not** fill these in with an automated translation, and do **not** let a course version go "publishable for field" until the EN+ES (and Tagalog where the curriculum requires it) glossary terms for that content are SME-complete and reviewed.
- ES is **first-class** for all `1xx`/`2xx` content; **Tagalog** is required for INT/ADC/support trees and the Philippines-based support team (curriculum §4b, scope note). The placeholders are present for **all three** so the locked table has one shape everywhere.
- A term's **meaning must not drift between languages.** The fail-safe / fail-locked / fail-secure distinction in particular has killed people when blurred ("fail-safe" ≠ "safe/good") — see the memory hooks in each entry.

> **Status of this table:** EN canonical = **locked**. ES / TL = **pending SME translation** (`[SME-REVIEW REQUIRED]`). The table itself (the term set and their EN meanings) is the locked contract; translations fill in without changing meaning.

---

## The non-negotiable terms

### 1. fail-safe
**EN (canonical):** A locking behavior in which **loss of power releases (unlocks) the lock**. Used on **egress-path** electrified locks (e.g., the M62 / V2M1200 "1200s" 1,200 lb magnetic lock on an egress door) so that a power failure can never trap occupants. Releasing on power loss is **necessary but not sufficient** for code compliance — the door must also release on push-to-exit and on fire-alarm activation (see *Sensor-Release*, *push-to-exit*). **Memory hook: fail-SAFE saves people.** It describes *what the lock does on power loss* — it does **not** mean "safe" or "good."
**ES:** `[SME-REVIEW REQUIRED]`
**TL (Tagalog):** `[SME-REVIEW REQUIRED]`

### 2. fail-locked
**EN (canonical):** A locking behavior in which the lock **stays locked on loss of power**. Correct **only** for **non-egress perimeter openings** — e.g., the Securitron GL1-FSM roll-up gate set fail-locked *because a separate compliant man-door is the means of egress*. Setting a fail-locked behavior on a door in the egress path traps occupants and is a safety-veto failure. The door's **egress role decides the fail-state** — never habit, never customer request. (Distinct from *fail-secure*; see below.)
**ES:** `[SME-REVIEW REQUIRED]`
**TL (Tagalog):** `[SME-REVIEW REQUIRED]`

> **fail-secure (clarifying sibling term).** Some hardware/standards say *fail-secure*: the lock **stays latched on power loss** and is the **correct** behavior on **fire-rated doors**, which must positively latch (a mag lock is never correct on a fire-rated door — it defeats latching). **Memory hook: fail-SECURE secures property.** Redex treats *fail-locked* (non-egress perimeter) and *fail-secure* (fire-rated, positively latched) as distinct; the translation layer must preserve the distinction and never collapse fail-safe / fail-locked / fail-secure into one word.

### 3. REX (request-to-exit)
**EN (canonical):** A **request-to-exit** device that tells the access controller a person is leaving from the secure side so the controller does not register a forced-door event. Two forms: a **PIR motion REX** and a **push-button REX**. **A REX that signals the controller is different from a release that cuts lock power directly.** Critically, a **motion REX alone is NOT a code-compliant release** for a mag-lock egress door — the **manual push-to-exit is still required** (NFPA 101 §7.2.1.6.2). Always rendered with the full term **"REX (request-to-exit)"** on first use in a unit.
**ES:** `[SME-REVIEW REQUIRED]`
**TL (Tagalog):** `[SME-REVIEW REQUIRED]`

### 4. free egress
**EN (canonical):** The life-safety principle that an occupant must **always be able to leave** through a door in the means of egress **without a key, special knowledge, tool, or effort beyond a single simple motion** — and without the lock being able to detain them. Free egress is why **life safety overrides security at every egress door**: a customer cannot authorize defeating it, and the AHJ has final say. (The interactive "tap the side that must always allow free egress" check in AC-101 trains the rule that every door has two sides with opposite rules.)
**ES:** `[SME-REVIEW REQUIRED]`
**TL (Tagalog):** `[SME-REVIEW REQUIRED]`

### 5. push-to-exit
**EN (canonical):** The **required manual release button** on a special-locking-arrangement egress door (NFPA 101 §7.2.1.6.2). Per the headline numbers every tech must know cold, it must be mounted **40–48 in. above the floor, within 5 ft of the door, and release the lock for at least 30 seconds (≥30 s) independent of the access system**. It is **mandatory even when a motion REX is present** — a motion REX never replaces it. Wrong height, wrong distance, or a release shorter than 30 s is a safety-veto failure on the AC-203 rubric.
**ES:** `[SME-REVIEW REQUIRED]`
**TL (Tagalog):** `[SME-REVIEW REQUIRED]`

### 6. delayed egress
**EN (canonical):** A special locking arrangement under **NFPA 101 §7.2.1.6.1** that briefly delays exit: the lock **releases within 15 seconds (or 30 seconds where specifically approved) after 15 lbf is applied for no more than 3 seconds**, the release is **irreversible** (re-locking requires manual reset), and the door **releases immediately on fire alarm / sprinkler / detector activation and on power loss**. It also requires an **audible local signal, required signage, and emergency lighting**, is **permitted only in sprinklered/detected buildings**, is **prohibited in High-Hazard occupancies**, and is **restricted (not flatly banned)** in Assembly and Educational occupancies — all verified against the **adopted code edition and the AHJ**. Do not wrongly refuse a delayed-egress door the code allows; do not install one the occupancy forbids.
**ES:** `[SME-REVIEW REQUIRED]`
**TL (Tagalog):** `[SME-REVIEW REQUIRED]`

### 7. Sensor-Release of Electrical Locking Systems (NFPA 101 §7.2.1.6.2)
**EN (canonical):** The NFPA 101 **§7.2.1.6.2** special locking arrangement governing sensor-released electrically locked egress doors. Its required behaviors: a **sensor auto-unlocks** the door on approach from the egress side; a **manual push-to-exit** (40–48 in. / within 5 ft / ≥30 s, independent of the access system) is provided; the lock **releases immediately on loss of power**; the lock **releases on fire-protection-system (fire alarm) activation**; **emergency lighting** is present; and hardware is listed (**UL 294 / UL 1034**). Always rendered with the full title and section number **"Sensor-Release of Electrical Locking Systems (NFPA 101 §7.2.1.6.2)."**
**ES:** `[SME-REVIEW REQUIRED]`
**TL (Tagalog):** `[SME-REVIEW REQUIRED]`

### 8. AHJ (Authority Having Jurisdiction)
**EN (canonical):** The **Authority Having Jurisdiction** — the official, office, or agency (e.g., a local fire marshal or building official) responsible for **enforcing code requirements and approving installations**. The AHJ has **final say**, **local amendments can add requirements**, and the **stricter requirement governs** ("the standard is the floor"). Coordinating with the AHJ and confirming AHJ approval is a sign-off line item on egress work (AC-203/AC-303). Always rendered with the full term **"AHJ (Authority Having Jurisdiction)"** on first use.
**ES:** `[SME-REVIEW REQUIRED]`
**TL (Tagalog):** `[SME-REVIEW REQUIRED]`

### 9. special locking arrangement
**EN (canonical):** An electrified-locking configuration on an egress door governed by **NFPA 101 §7.2.1.6** and its subsections (**§7.2.1.6.1 delayed egress**, **§7.2.1.6.2 sensor-release**). A door with a card reader but **free mechanical egress is a *normal* locking arrangement, not** a special locking arrangement — not every card-reader door is special. Classifying a door correctly ("what kind of door is this?") to the governing section is the first decision in compliant egress design.
**ES:** `[SME-REVIEW REQUIRED]`
**TL (Tagalog):** `[SME-REVIEW REQUIRED]`

### 10. partition
**EN (canonical):** In an intrusion system, a **partition** is an independently armable/disarmable subdivision of one control panel — e.g., a Sales partition and a Stockroom partition on one Qolsys IQ Panel, each with its own arming state and users. **Distinct from a *zone*** (see below): a partition groups zones into a separately controlled area. Confusing zone vs. partition is a flagged top mistake (QA and the call center misread it).
**ES:** `[SME-REVIEW REQUIRED]`
**TL (Tagalog):** `[SME-REVIEW REQUIRED]`

### 11. zone
**EN (canonical):** In an intrusion system, a **zone** is a single detection point or input (a door contact, a PIR, a glassbreak, a 24-hour life-safety device) reported to the panel, each with a **zone type** (perimeter, interior, or 24-hour life-safety). A **life-safety zone is always 24-hour and is never bypassed**. A zone belongs to a *partition* (above). Always keep the **zone vs. partition** distinction explicit.
**ES:** `[SME-REVIEW REQUIRED]`
**TL (Tagalog):** `[SME-REVIEW REQUIRED]`

### 12. supervision
**EN (canonical):** Continuous monitoring of a sensor/connection's health so that a device that **stops reporting is itself alarm-worthy** (a silent supervised sensor may have been defeated). Supervision and **tamper** are **first-class events**, distinct from an alarm: the system distinguishes **alarm vs. trouble vs. tamper**. Most intrusion contacts are **NC/supervised** (normally-closed, end-of-line supervised loop). A supervised release/input on an access controller is similarly monitored for fault. Never treat a supervision/trouble signal as harmless.
**ES:** `[SME-REVIEW REQUIRED]`
**TL (Tagalog):** `[SME-REVIEW REQUIRED]`

### 13. PoE class / type (802.3af / 802.3at / 802.3bt)
**EN (canonical):** **Power over Ethernet** standards and their IEEE designations, classified by **Type**: **802.3af = Type 1** (~15.4 W at the PSE / ~12.95 W at the PD); **802.3at = PoE+ = Type 2** (~30 W / ~25.5 W); **802.3bt = Type 3** (~60 W / ~51 W) and **Type 4** (~90 W / ~71.3 W, 4PPoE). A device is matched to the correct **Type/Class** from its datasheet, and the **port/budget must serve its peak draw with headroom** ("count watts, not ports"; size for peak with ~30% headroom). Note "95–100 W" figures are proprietary, **not IEEE**. PoE powers the *controller/camera*, **not necessarily the lock** (the lock load is powered separately).
**ES:** `[SME-REVIEW REQUIRED]`
**TL (Tagalog):** `[SME-REVIEW REQUIRED]`

### 14. PPF / DORI
**EN (canonical):** **PPF = Pixels Per Foot**, the professional's unit of truth for camera image usefulness at a target distance. It maps to the **DORI** tiers — **D**etection, **O**bservation, **R**ecognition, **I**dentification (increasing pixel density). Redex targets roughly **recognition ~40–60 PPF and identification ~75–100 PPF** (higher at night); frames below the PPF threshold get dropped by analytics (e.g., DragonFruit). "It's 4K, it'll be fine" is a flagged mistake — coverage area, lens, and distance determine PPF, not headline resolution.
**ES:** `[SME-REVIEW REQUIRED]`
**TL (Tagalog):** `[SME-REVIEW REQUIRED]`

### 15. fixture (sanitized)
**EN (canonical):** A **recorded, sanitized fixture** — a snapshot/recording of a real platform surface (Alarm.com Partner Portal flow, OpenEye admin screen, DragonFruit analytics view, IQ-panel/Mercury state) stored as **screenshots + structured JSON state** and **replayed** by a sim engine as a faithful, interactive replica. **No live connection, no production credentials, no real customer PII.** A fixture is **"sanitized" only when all PII has been scrubbed**; `fixture_sets.sanitized = true` is a **hard publish gate** (a published sim may not reference an unsanitized fixture). Captured once by SMEs against test/demo accounts, then scrubbed and SME-accuracy-reviewed. (Distinct from "fixture" in the test-data sense — here it means the recorded device-surface replay asset.)
**ES:** `[SME-REVIEW REQUIRED]`
**TL (Tagalog):** `[SME-REVIEW REQUIRED]`

---

## Implementation notes (for the i18n / authoring goals)

- These 15 terms (plus the *fail-secure* clarifying sibling) live in the **locked glossary table in `packages/i18n`** (CLAUDE.md §3 monorepo layout, §7). The translation layer reads this table as **non-overridable** — a locale JSON cannot supply a different rendering for a glossary key.
- i18n keys for glossary terms follow `CODING_STANDARDS.md` §7 (dot-namespaced, lowercase, stable — keys are contracts). The **glossary key set is itself a contract**: renaming or removing one is a migration, not an in-place edit.
- Each entry's **EN canonical definition is the source a professional translator works from**; the ES/TL fields stay `[SME-REVIEW REQUIRED]` until SME translation + review is complete and recorded in the localization workflow state (wave3 §8.1). A course version is **not "publishable for field"** until its required-locale glossary terms are SME-complete.
- **No machine translation of any safety term**, ever — this rule is restated at the top of this file and enforced by the SME-review localization gate (`AGENT_ROLES_AND_ACCEPTANCE.md` §6 content/fixture SME gate).
