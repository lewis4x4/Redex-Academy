import { describe, expect, it } from 'vitest';
// The REAL committed AC-203 u1 body (raw), so the splitter is proven against the
// authored source of truth, not a fixture.
import u1Raw from './content/ac-203/u1.mdx?raw';
import { splitMdxByHeadings } from './lessonSteps';

describe('splitMdxByHeadings (AC-203 u1)', () => {
  const steps = splitMdxByHeadings(u1Raw);

  it('yields exactly 7 steps from the 7 `## ` sections (the `# ` title + intro is excluded)', () => {
    expect(steps).toHaveLength(7);
    expect(steps.map((s) => s.ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('uses the `## ` heading text as each step title (not the `# ` lesson title)', () => {
    expect(steps[0]!.title).toBe('Two locks, opposite rules');
    expect(steps[6]!.title).toBe('Knowledge check');
    // the level-1 title line never becomes a step title
    expect(steps.some((s) => s.title.startsWith('Mag Locks'))).toBe(false);
  });

  it('keeps the section bodies intact: step 1 has the mag-vs-strike Sim', () => {
    expect(steps[0]!.rawMdx).toContain('<Sim spec="ac-203/mag-vs-strike-pick"');
  });

  it('flags only the terminal step as the knowledge check', () => {
    const last = steps[steps.length - 1]!;
    expect(last.rawMdx).toContain('<KnowledgeCheck');
    expect(last.hasKnowledgeCheck).toBe(true);
    // no earlier step claims the KC
    expect(steps.slice(0, -1).every((s) => !s.hasKnowledgeCheck)).toBe(true);
  });

  it('excludes the `# ` title / `## ` heading lines from every step body', () => {
    for (const s of steps) {
      expect(s.rawMdx).not.toMatch(/^# /m);
      expect(s.rawMdx).not.toMatch(/^## /m);
    }
  });
});
