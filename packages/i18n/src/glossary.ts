// =============================================================================
// LOCKED bilingual safety glossary — the non-overridable term table.
//
// Authoritative source: SAFETY_GLOSSARY.md (← DECISIONS_LEDGER.md §B). A goal
// MAY NOT localize, paraphrase, abbreviate, or "improve" a glossary TERM; the
// rendering must be identical across the app UI, field docs, and every locale
// (CLAUDE.md §7, CODING_STANDARDS.md §8). Keys are CONTRACTS — rename/remove via
// migration, never in place.
//
// Translation rule (non-negotiable): safety terms are NEVER machine-translated.
// EN canonical is locked; ES and TL renderings stay `[SME-REVIEW REQUIRED]` until
// professional, domain-qualified SME translation + review is recorded. A course
// version is not "publishable for field" until its required-locale glossary terms
// are SME-complete.
// =============================================================================

export const SME_REVIEW_REQUIRED = '[SME-REVIEW REQUIRED]' as const;

export type GlossaryLocale = 'en' | 'es' | 'tl';

export interface GlossaryEntry {
  /** Stable, dot-namespaced contract key (CODING_STANDARDS.md §7). */
  key: string;
  /** The locked rendering per locale. `en` is canonical; `es`/`tl` are SME placeholders. */
  term: Record<GlossaryLocale, string>;
  /** EN canonical meaning — the source a professional translator works from. */
  definitionEn: string;
  /** Always true: the translation layer cannot supply a different rendering. */
  locked: true;
}

const entry = (key: string, enTerm: string, definitionEn: string): GlossaryEntry => ({
  key,
  term: { en: enTerm, es: SME_REVIEW_REQUIRED, tl: SME_REVIEW_REQUIRED },
  definitionEn,
  locked: true,
});

export const SAFETY_GLOSSARY: readonly GlossaryEntry[] = [
  entry(
    'safety.glossary.fail_safe',
    'fail-safe',
    'A locking behavior in which loss of power releases (unlocks) the lock. Used on egress-path electrified locks so a power failure can never trap occupants. Memory hook: fail-SAFE saves people. It describes what the lock does on power loss — it does NOT mean "safe" or "good".',
  ),
  entry(
    'safety.glossary.fail_locked',
    'fail-locked',
    'A locking behavior in which the lock stays locked on loss of power. Correct ONLY for non-egress perimeter openings (a separate compliant man-door is the means of egress). Fail-locked on an egress-path door traps occupants and is a safety-veto failure. The door’s egress role decides the fail-state — never habit, never customer request.',
  ),
  entry(
    'safety.glossary.fail_secure',
    'fail-secure',
    'The lock stays latched on power loss; correct behavior on fire-rated doors, which must positively latch (a mag lock is never correct on a fire-rated door). Memory hook: fail-SECURE secures property. Distinct from fail-locked — the translation layer must never collapse fail-safe / fail-locked / fail-secure into one word.',
  ),
  entry(
    'safety.glossary.rex',
    'REX (request-to-exit)',
    'A request-to-exit device telling the access controller a person is leaving from the secure side so it does not register a forced-door event (PIR motion REX or push-button REX). A motion REX alone is NOT a code-compliant release for a mag-lock egress door — the manual push-to-exit is still required (NFPA 101 §7.2.1.6.2). Rendered with the full term on first use in a unit.',
  ),
  entry(
    'safety.glossary.free_egress',
    'free egress',
    'The life-safety principle that an occupant must always be able to leave through a means-of-egress door without a key, special knowledge, tool, or effort beyond a single simple motion — and without the lock detaining them. Life safety overrides security at every egress door; a customer cannot authorize defeating it and the AHJ has final say.',
  ),
  entry(
    'safety.glossary.push_to_exit',
    'push-to-exit',
    'The required manual release button on a special-locking-arrangement egress door (NFPA 101 §7.2.1.6.2): mounted 40–48 in. above the floor, within 5 ft of the door, releasing the lock for at least 30 seconds independent of the access system. Mandatory even when a motion REX is present. Wrong height/distance or a release shorter than 30 s is a safety-veto failure.',
  ),
  entry(
    'safety.glossary.delayed_egress',
    'delayed egress',
    'A special locking arrangement under NFPA 101 §7.2.1.6.1: the lock releases within 15 s (or 30 s where specifically approved) after 15 lbf for ≤3 s, the release is irreversible (manual reset to re-lock), and the door releases immediately on fire alarm / sprinkler / detector activation and on power loss. Requires audible local signal, signage, and emergency lighting; permitted only in sprinklered/detected buildings; prohibited in High-Hazard; restricted in Assembly/Educational — all verified against the adopted code edition and the AHJ.',
  ),
  entry(
    'safety.glossary.sensor_release',
    'Sensor-Release of Electrical Locking Systems (NFPA 101 §7.2.1.6.2)',
    'The NFPA 101 §7.2.1.6.2 special locking arrangement for sensor-released electrically locked egress doors: a sensor auto-unlocks on approach from the egress side; a manual push-to-exit (40–48 in. / within 5 ft / ≥30 s, independent of the access system) is provided; the lock releases immediately on power loss and on fire-alarm activation; emergency lighting is present; hardware is listed (UL 294 / UL 1034). Rendered with the full title and section number.',
  ),
  entry(
    'safety.glossary.ahj',
    'AHJ (Authority Having Jurisdiction)',
    'The official, office, or agency responsible for enforcing code requirements and approving installations (e.g., a local fire marshal or building official). The AHJ has final say; local amendments can add requirements; the stricter requirement governs ("the standard is the floor"). Rendered with the full term on first use.',
  ),
  entry(
    'safety.glossary.special_locking_arrangement',
    'special locking arrangement',
    'An electrified-locking configuration on an egress door governed by NFPA 101 §7.2.1.6 and its subsections (§7.2.1.6.1 delayed egress, §7.2.1.6.2 sensor-release). A card-reader door with free mechanical egress is a NORMAL locking arrangement, not a special one — not every card-reader door is special.',
  ),
  entry(
    'safety.glossary.partition',
    'partition',
    'In an intrusion system, an independently armable/disarmable subdivision of one control panel (e.g., a Sales partition and a Stockroom partition on one Qolsys IQ Panel), each with its own arming state and users. Distinct from a zone: a partition groups zones into a separately controlled area.',
  ),
  entry(
    'safety.glossary.zone',
    'zone',
    'In an intrusion system, a single detection point or input (door contact, PIR, glassbreak, 24-hour life-safety device) reported to the panel, each with a zone type (perimeter, interior, or 24-hour life-safety). A life-safety zone is always 24-hour and is never bypassed. A zone belongs to a partition.',
  ),
  entry(
    'safety.glossary.supervision',
    'supervision',
    'Continuous monitoring of a sensor/connection’s health so that a device that stops reporting is itself alarm-worthy. Supervision and tamper are first-class events, distinct from an alarm (the system distinguishes alarm vs. trouble vs. tamper). Most intrusion contacts are NC/supervised. Never treat a supervision/trouble signal as harmless.',
  ),
  entry(
    'safety.glossary.poe_class',
    'PoE class / type (802.3af / 802.3at / 802.3bt)',
    'Power over Ethernet standards by IEEE Type: 802.3af = Type 1 (~15.4 W PSE / ~12.95 W PD); 802.3at = PoE+ = Type 2 (~30 / ~25.5 W); 802.3bt = Type 3 (~60 / ~51 W) and Type 4 (~90 / ~71.3 W, 4PPoE). Match a device to its Type/Class from the datasheet and size the port/budget for peak draw with ~30% headroom. "95–100 W" figures are proprietary, not IEEE. PoE powers the controller/camera, not necessarily the lock.',
  ),
  entry(
    'safety.glossary.ppf_dori',
    'PPF / DORI',
    'PPF = Pixels Per Foot, the unit of truth for camera image usefulness at a target distance, mapping to the DORI tiers — Detection, Observation, Recognition, Identification. Redex targets roughly recognition ~40–60 PPF and identification ~75–100 PPF (higher at night); frames below threshold get dropped by analytics. Coverage area, lens, and distance determine PPF — not headline resolution.',
  ),
  entry(
    'safety.glossary.fixture_sanitized',
    'fixture (sanitized)',
    'A recorded, sanitized snapshot of a real platform surface (Partner Portal flow, OpenEye admin, DragonFruit view, IQ-panel/Mercury state) stored as screenshots + structured JSON state and replayed by a sim engine — no live connection, no production credentials, no real customer PII. "Sanitized" only when all PII is scrubbed; fixture_sets.sanitized = true is a hard publish gate.',
  ),
] as const;

export function getGlossaryKeys(): string[] {
  return SAFETY_GLOSSARY.map((e) => e.key);
}

export function getGlossaryEntry(key: string): GlossaryEntry | undefined {
  return SAFETY_GLOSSARY.find((e) => e.key === key);
}
