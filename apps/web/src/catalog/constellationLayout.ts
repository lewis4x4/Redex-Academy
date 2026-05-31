// Radial "obsidian-brain" geometry for the Constellation skill-map (ported from
// the gold-standard prototype, Redex_Academy_Prototype.html §3). The spec:
//   • Domains are angular SECTORS (FND top, INT the upper-right red spine, … SEC
//     upper-left) — a course's angle comes from its domain, spread within a slice.
//   • Tiers are concentric RINGS — Foundations the outer ring, Mastery the bright
//     core. A Mastery-tier boss collapses to the dead-centre apex (the prototype's
//     INT-410 Field Evaluator).
//   • A cross-domain prerequisite that feeds ≥2 OTHER domains is a "keystone
//     artery" (the prototype's ADC-201) — derived from the graph, not hard-coded.
//
// Everything here is a PURE, DETERMINISTIC function of the catalog input: same
// courses in ⇒ identical geometry out, so the SVG and the a11y reading order never
// jitter between renders (no Math.random, no time). Colour is decided by the
// renderer; this module is pure math, so it holds no hex (the no-raw-hex invariant
// is trivially satisfied here).

import type { CourseNode, Domain, Tier } from './catalogSource';
import type { PrereqEdge } from './gating';

/** SVG user-space centre + viewport (matches the prototype's 1600×900 stage). */
export const CENTER = { x: 800, y: 450 } as const;
export const VIEW = { w: 1600, h: 900 } as const;

// Domain → sector angle in DEGREES (SVG convention: 0°=east, +y points down, so
// −90° is straight up). FND crowns the top; INT (the red integration spine) leans
// upper-right; AC anchors the bottom — identical to the prototype's wheel.
export const DOMAIN_ANGLE: Record<Domain, number> = {
  FND: -90,
  INT: -30,
  ADC: 30,
  AC: 90,
  VID: 150,
  SEC: 210,
};

// Tier → ring radius (px from centre). Foundations is the wide outer ring; each
// step inward is a tier deeper, with Mastery as the tight, bright core.
export const TIER_RADIUS: Record<Tier, number> = {
  foundations: 340,
  core: 260,
  advanced: 182,
  mastery: 108,
};

/** Outer→inner tier order (drives ring draw order + a11y reading order). */
export const TIER_ORDER: readonly Tier[] = ['foundations', 'core', 'advanced', 'mastery'];

/** Courses in one (domain, tier) cell fan across this arc, centred on the angle. */
const SECTOR_SPAN = 46;
/** Domain sector labels sit just outside the Foundations ring. */
const LABEL_RADIUS = 390;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

export interface PositionedNode extends CourseNode {
  x: number;
  y: number;
  /** True for the centre apex (a Mastery-tier boss, e.g. INT-410). */
  apex: boolean;
  /** Resolved sector angle in degrees (0 for the apex). */
  angleDeg: number;
}

export interface DomainLabel {
  domain: Domain;
  x: number;
  y: number;
  angleDeg: number;
}

export interface Ring {
  tier: Tier;
  r: number;
}

export interface Star {
  x: number;
  y: number;
  r: number;
  opacity: number;
  /** Twinkle duration + delay in seconds (decoration only; reduced-motion-guarded). */
  durSec: number;
  delaySec: number;
}

export interface ConstellationGeometry {
  nodes: PositionedNode[];
  domainLabels: DomainLabel[];
  rings: Ring[];
}

// A boss on the innermost (Mastery) ring is the journey apex and sits dead-centre.
// Every other boss keeps its sector seat (and wears the heavier gate frame).
function isApex(c: CourseNode): boolean {
  return c.isBoss && c.tier === 'mastery';
}

/**
 * Assign every course an (x, y): angle from its domain sector (members fanned
 * across a {@link SECTOR_SPAN}° slice, ordered by code so it never jitters), radius
 * from its tier ring. A Mastery-tier boss snaps to the centre apex. Returns the
 * nodes plus the domain labels and tier rings actually present in the data.
 */
export function computeLayout(courses: readonly CourseNode[]): ConstellationGeometry {
  // Group by domain|tier so we can fan a cell's members across its arc.
  const groups = new Map<string, CourseNode[]>();
  for (const c of courses) {
    const key = `${c.domain}|${c.tier}`;
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }

  const nodes: PositionedNode[] = [];
  for (const [key, members] of groups) {
    const [dom, tier] = key.split('|') as [Domain, Tier];
    const base = DOMAIN_ANGLE[dom];
    const r = TIER_RADIUS[tier];
    // Stable in-cell order so positions are reproducible.
    const ordered = [...members].sort((a, b) => a.code.localeCompare(b.code));
    const n = ordered.length;
    ordered.forEach((c, i) => {
      if (isApex(c)) {
        nodes.push({ ...c, x: CENTER.x, y: CENTER.y, apex: true, angleDeg: 0 });
        return;
      }
      // Centre a lone member on the domain angle; otherwise spread across the slice.
      const a = n > 1 ? base - SECTOR_SPAN / 2 + (SECTOR_SPAN * i) / (n - 1) : base;
      const rad = toRad(a);
      nodes.push({
        ...c,
        x: CENTER.x + r * Math.cos(rad),
        y: CENTER.y + r * Math.sin(rad),
        apex: false,
        angleDeg: a,
      });
    });
  }

  // Deterministic draw + a11y order: outer ring → inner ring, then by code.
  nodes.sort(
    (a, b) =>
      TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || a.code.localeCompare(b.code),
  );

  // Labels + rings only for domains/tiers actually represented in the data.
  const presentDomains = new Set(courses.map((c) => c.domain));
  const domainLabels: DomainLabel[] = (Object.keys(DOMAIN_ANGLE) as Domain[])
    .filter((d) => presentDomains.has(d))
    .map((d) => {
      const rad = toRad(DOMAIN_ANGLE[d]);
      return {
        domain: d,
        x: CENTER.x + LABEL_RADIUS * Math.cos(rad),
        y: CENTER.y + LABEL_RADIUS * Math.sin(rad),
        angleDeg: DOMAIN_ANGLE[d],
      };
    });

  const presentTiers = new Set(courses.map((c) => c.tier));
  const rings: Ring[] = TIER_ORDER.filter((t) => presentTiers.has(t)).map((tier) => ({
    tier,
    r: TIER_RADIUS[tier],
  }));

  return { nodes, domainLabels, rings };
}

/**
 * Identify "keystone artery" sources: a hard-gate prerequisite whose dependents
 * span ≥2 OTHER domains (the cross-domain load-bearing node — the prototype's
 * ADC-201). Pure graph derivation; lights the animated artery edges in the UI.
 */
export function keystoneSourceIds(
  courses: readonly CourseNode[],
  prereqs: readonly PrereqEdge[],
): Set<string> {
  const domainOf = new Map(courses.map((c) => [c.id, c.domain]));
  const crossDomains = new Map<string, Set<Domain>>();
  for (const e of prereqs) {
    if (e.kind !== 'hard_gate') continue;
    const srcDom = domainOf.get(e.requiresCourseId);
    const dstDom = domainOf.get(e.courseId);
    if (!srcDom || !dstDom || srcDom === dstDom) continue;
    const set = crossDomains.get(e.requiresCourseId) ?? new Set<Domain>();
    set.add(dstDom);
    crossDomains.set(e.requiresCourseId, set);
  }
  const out = new Set<string>();
  for (const [id, doms] of crossDomains) if (doms.size >= 2) out.add(id);
  return out;
}

// mulberry32 — a tiny, fast, deterministic PRNG. Seeding it (instead of
// Math.random) keeps the starfield stable across every render and in tests, so the
// background never re-scatters mid-session and snapshots stay reproducible.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic faint starfield for the canvas backdrop. Decorative only (the
 * group is aria-hidden in the renderer); the seed defaults to a fixed value so the
 * sky is identical every render.
 */
export function makeStars(count = 90, seed = 0x52656458): Star[] {
  const rnd = mulberry32(seed);
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Number((rnd() * VIEW.w).toFixed(1)),
      y: Number((rnd() * VIEW.h).toFixed(1)),
      r: Number((rnd() * 1.4 + 0.3).toFixed(2)),
      opacity: Number((rnd() * 0.35 + 0.05).toFixed(2)),
      durSec: Number((rnd() * 4 + 3).toFixed(1)),
      delaySec: Number((rnd() * 4).toFixed(1)),
    });
  }
  return stars;
}
