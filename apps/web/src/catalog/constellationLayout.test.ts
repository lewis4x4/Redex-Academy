import { describe, expect, it } from 'vitest';
import type { CourseNode } from './catalogSource';
import type { PrereqEdge } from './gating';
import {
  CENTER,
  DOMAIN_ANGLE,
  TIER_RADIUS,
  computeLayout,
  keystoneSourceIds,
  makeStars,
} from './constellationLayout';

// Minimal course factory — only the fields the layout reads.
const course = (
  over: Partial<CourseNode> & Pick<CourseNode, 'id' | 'code' | 'domain' | 'tier'>,
): CourseNode => ({
  title: over.code,
  personas: [],
  state: 'locked',
  isBoss: false,
  firstUnitId: null,
  ...over,
});

const dist = (x: number, y: number) => Math.hypot(x - CENTER.x, y - CENTER.y);
const angleDeg = (x: number, y: number) => (Math.atan2(y - CENTER.y, x - CENTER.x) * 180) / Math.PI;

describe('computeLayout — radial geometry', () => {
  it('places a lone course on its domain angle at its tier radius', () => {
    const fnd = course({ id: 'f', code: 'FND-101', domain: 'FND', tier: 'foundations' });
    const { nodes } = computeLayout([fnd]);
    const n = nodes.find((x) => x.id === 'f')!;
    // Foundations ring radius, FND sector straight up (−90°).
    expect(dist(n.x, n.y)).toBeCloseTo(TIER_RADIUS.foundations, 4);
    expect(n.angleDeg).toBe(DOMAIN_ANGLE.FND);
    expect(n.y).toBeLessThan(CENTER.y); // up = smaller y
    expect(n.x).toBeCloseTo(CENTER.x, 4);
  });

  it('puts inner tiers closer to the centre than outer tiers (Mastery is the core)', () => {
    const radii = (['foundations', 'core', 'advanced', 'mastery'] as const).map((tier) => {
      const { nodes } = computeLayout([
        course({ id: tier, code: `AC-${tier}`, domain: 'AC', tier }),
      ]);
      const n = nodes[0]!;
      return dist(n.x, n.y);
    });
    // strictly decreasing outward→inward
    expect(radii[0]!).toBeGreaterThan(radii[1]!);
    expect(radii[1]!).toBeGreaterThan(radii[2]!);
    expect(radii[2]!).toBeGreaterThan(radii[3]!);
  });

  it('fans multiple courses of one cell across the ~46° sector, centred on the domain angle', () => {
    const list = ['AC-1', 'AC-2', 'AC-3'].map((code) =>
      course({ id: code, code, domain: 'AC', tier: 'core' }),
    );
    const { nodes } = computeLayout(list);
    const angles = nodes.map((n) => n.angleDeg).sort((a, b) => a - b);
    expect(angles[0]!).toBeCloseTo(DOMAIN_ANGLE.AC - 23, 4); // base − span/2
    expect(angles[2]!).toBeCloseTo(DOMAIN_ANGLE.AC + 23, 4); // base + span/2
    // all still on the Core ring
    nodes.forEach((n) => expect(dist(n.x, n.y)).toBeCloseTo(TIER_RADIUS.core, 4));
  });

  it('separates two domains into different angular sectors', () => {
    const fnd = course({ id: 'f', code: 'FND-1', domain: 'FND', tier: 'foundations' });
    const ac = course({ id: 'a', code: 'AC-1', domain: 'AC', tier: 'foundations' });
    const { nodes } = computeLayout([fnd, ac]);
    const af = nodes.find((n) => n.id === 'f')!;
    const aa = nodes.find((n) => n.id === 'a')!;
    expect(angleDeg(af.x, af.y)).toBeCloseTo(DOMAIN_ANGLE.FND, 2);
    expect(angleDeg(aa.x, aa.y)).toBeCloseTo(DOMAIN_ANGLE.AC, 2);
  });

  it('collapses a Mastery-tier boss to the dead-centre apex', () => {
    const apex = course({ id: 'b', code: 'INT-410', domain: 'INT', tier: 'mastery', isBoss: true });
    const { nodes } = computeLayout([apex]);
    const n = nodes.find((x) => x.id === 'b')!;
    expect(n.apex).toBe(true);
    expect(n.x).toBe(CENTER.x);
    expect(n.y).toBe(CENTER.y);
  });

  it('keeps a non-Mastery boss (e.g. AC-203 egress gate) in its sector, not centred', () => {
    const gate = course({ id: 'g', code: 'AC-203', domain: 'AC', tier: 'core', isBoss: true });
    const { nodes } = computeLayout([gate]);
    const n = nodes.find((x) => x.id === 'g')!;
    expect(n.apex).toBe(false);
    expect(dist(n.x, n.y)).toBeCloseTo(TIER_RADIUS.core, 4);
  });

  it('emits rings + domain labels only for tiers/domains present in the data', () => {
    const { rings, domainLabels } = computeLayout([
      course({ id: 'f', code: 'FND-1', domain: 'FND', tier: 'foundations' }),
      course({ id: 'a', code: 'AC-1', domain: 'AC', tier: 'core' }),
    ]);
    expect(rings.map((r) => r.tier).sort()).toEqual(['core', 'foundations']);
    expect(domainLabels.map((l) => l.domain).sort()).toEqual(['AC', 'FND']);
  });

  it('is pure + deterministic — identical input yields identical output', () => {
    const list = [
      course({ id: 'f', code: 'FND-1', domain: 'FND', tier: 'foundations' }),
      course({ id: 'a', code: 'AC-2', domain: 'AC', tier: 'core' }),
      course({ id: 'b', code: 'AC-1', domain: 'AC', tier: 'core' }),
    ];
    expect(computeLayout(list)).toEqual(computeLayout([...list].reverse()));
  });

  it('orders nodes outer-ring→inner-ring then by code (stable a11y reading order)', () => {
    const { nodes } = computeLayout([
      course({ id: '1', code: 'AC-301', domain: 'AC', tier: 'advanced' }),
      course({ id: '2', code: 'FND-101', domain: 'FND', tier: 'foundations' }),
      course({ id: '3', code: 'AC-201', domain: 'AC', tier: 'core' }),
    ]);
    expect(nodes.map((n) => n.code)).toEqual(['FND-101', 'AC-201', 'AC-301']);
  });
});

describe('keystoneSourceIds — cross-domain artery', () => {
  const courses = [
    course({ id: 'adc', code: 'ADC-201', domain: 'ADC', tier: 'core' }),
    course({ id: 'ac', code: 'AC-201', domain: 'AC', tier: 'core' }),
    course({ id: 'sec', code: 'SEC-205', domain: 'SEC', tier: 'core' }),
    course({ id: 'adc2', code: 'ADC-202', domain: 'ADC', tier: 'core' }),
  ];

  it('flags a node feeding ≥2 OTHER domains as a keystone', () => {
    const prereqs: PrereqEdge[] = [
      { courseId: 'ac', requiresCourseId: 'adc', kind: 'hard_gate' }, // ADC→AC
      { courseId: 'sec', requiresCourseId: 'adc', kind: 'hard_gate' }, // ADC→SEC
      { courseId: 'adc2', requiresCourseId: 'adc', kind: 'hard_gate' }, // ADC→ADC (same, ignored)
    ];
    expect([...keystoneSourceIds(courses, prereqs)]).toEqual(['adc']);
  });

  it('does NOT flag a node feeding only one other domain', () => {
    const prereqs: PrereqEdge[] = [{ courseId: 'ac', requiresCourseId: 'adc', kind: 'hard_gate' }];
    expect(keystoneSourceIds(courses, prereqs).size).toBe(0);
  });

  it('ignores soft prereqs', () => {
    const prereqs: PrereqEdge[] = [
      { courseId: 'ac', requiresCourseId: 'adc', kind: 'soft' },
      { courseId: 'sec', requiresCourseId: 'adc', kind: 'soft' },
    ];
    expect(keystoneSourceIds(courses, prereqs).size).toBe(0);
  });
});

describe('makeStars — deterministic starfield', () => {
  it('produces a stable set for a fixed seed (no jitter between renders)', () => {
    expect(makeStars(20, 123)).toEqual(makeStars(20, 123));
  });

  it('produces the requested count within the viewport bounds', () => {
    const stars = makeStars(40);
    expect(stars).toHaveLength(40);
    for (const s of stars) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(1600);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(900);
      expect(s.opacity).toBeGreaterThan(0);
    }
  });

  it('varies with the seed', () => {
    expect(makeStars(10, 1)).not.toEqual(makeStars(10, 2));
  });
});
