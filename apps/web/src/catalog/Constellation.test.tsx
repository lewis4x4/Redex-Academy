import { initI18n } from '@redex/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogGating, CourseNode } from './catalogSource';
import type { PrereqEdge } from './gating';

// A fixture graph exercising every node state + the boss frame + the centre apex.
const COURSES: CourseNode[] = [
  {
    id: 'f',
    code: 'FND-101',
    title: 'Welcome',
    domain: 'FND',
    tier: 'foundations',
    personas: ['priya'],
    state: 'available',
    isBoss: false,
    firstUnitId: 'u-fnd101',
  },
  {
    id: 'a',
    code: 'AC-201',
    title: 'Single-Door',
    domain: 'AC',
    tier: 'core',
    personas: ['priya'],
    state: 'passed',
    isBoss: false,
    firstUnitId: 'u-ac201',
  },
  {
    id: 'g',
    code: 'AC-203',
    title: 'Mag Locks & Egress',
    domain: 'AC',
    tier: 'core',
    personas: ['priya'],
    state: 'locked',
    isBoss: true,
    firstUnitId: null,
  },
  {
    id: 'i',
    code: 'VID-202',
    title: 'PoE Budget',
    domain: 'VID',
    tier: 'core',
    personas: ['marco'],
    state: 'in_progress',
    isBoss: false,
    firstUnitId: 'u-vid202',
  },
  {
    id: 'm',
    code: 'INT-410',
    title: 'Field Evaluator',
    domain: 'INT',
    tier: 'mastery',
    personas: ['priya'],
    state: 'mastered',
    isBoss: true,
    firstUnitId: 'u-int410',
  },
];
const PREREQS: PrereqEdge[] = [
  { courseId: 'g', requiresCourseId: 'f', kind: 'hard_gate' },
  { courseId: 'g', requiresCourseId: 'a', kind: 'hard_gate' },
];
const GATING: CatalogGating = { courses: COURSES, prereqs: PREREQS };

const enrollSelf = vi.fn(async (_args?: { userId: string; orgId: string; courseId: string }) => {});
const loadCatalogGating = vi.fn(async (): Promise<CatalogGating> => GATING);
vi.mock('./catalogSource', () => ({
  loadCatalogGating: () => loadCatalogGating(),
  enrollSelf: (args: unknown) => enrollSelf(args as never),
}));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    session: {},
    claims: { sub: 'u1', org_id: 'o1', persona: 'priya', roles: ['learner'] },
    loading: false,
  }),
}));

// Import AFTER the mocks are registered.
import { Constellation } from './Constellation';

const node = async (code: string) =>
  (await screen.findByRole('button', { name: new RegExp(code) })) as unknown as SVGGElement;
const xy = (el: Element): { x: number; y: number } => {
  const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(el.getAttribute('transform') ?? '');
  return { x: Number(m?.[1]), y: Number(m?.[2]) };
};

describe('Constellation — radial obsidian-brain', () => {
  beforeEach(() => {
    initI18n();
    enrollSelf.mockClear();
    loadCatalogGating.mockClear();
  });

  it('renders each course as a labelled node carrying its data contracts', async () => {
    render(<Constellation />);
    const fnd = await node('FND-101');
    expect(fnd).toHaveAttribute('data-course', 'FND-101');
    expect(fnd).toHaveAttribute('data-state', 'available');
    expect(fnd).toHaveAttribute('role', 'button');

    const gate = await node('AC-203');
    expect(gate).toHaveAttribute('data-state', 'locked');
    expect(gate).toHaveAttribute('data-boss', 'true');
    // boss/gate wears the heavier amber frame (a rect, not just colour).
    expect(gate.querySelector('rect.stroke-amber-edge, rect.stroke-amber')).not.toBeNull();
  });

  it('lays courses out RADIALLY — domains in different sectors, mastery boss at the apex', async () => {
    render(<Constellation />);
    const fnd = await node('FND-101'); // FND sector = top
    const ac = await node('AC-201'); // AC sector = bottom
    const apex = await node('INT-410'); // mastery boss → dead centre

    // Centre apex sits exactly at the stage centre (1600×900 → 800,450).
    expect(xy(apex)).toEqual({ x: 800, y: 450 });
    // Foundations crowns the top (above centre); AC anchors the bottom (below).
    expect(xy(fnd).y).toBeLessThan(450);
    expect(xy(ac).y).toBeGreaterThan(450);
    // …and it is NOT the old flat grid: the two are on opposite sides of centre.
    expect(Math.sign(xy(fnd).y - 450)).not.toBe(Math.sign(xy(ac).y - 450));
  });

  it('carries state via SHAPE + TEXT, never colour alone (invariant 7)', async () => {
    render(<Constellation />);
    // The spoken state is in every node's accessible name (text carrier).
    expect((await node('FND-101')).getAttribute('aria-label')).toMatch(/Available/i);
    expect((await node('AC-203')).getAttribute('aria-label')).toMatch(/Locked/i);
    expect((await node('VID-202')).getAttribute('aria-label')).toMatch(/In progress/i);
    expect((await node('INT-410')).getAttribute('aria-label')).toMatch(/Mastered/i);
    // …and a distinct glyph SHAPE is drawn (e.g. the available play-triangle).
    expect((await node('FND-101')).querySelector('path.fill-redex')).not.toBeNull();
    // The legend states meaning with shape + text too (5 states + the gate row).
    expect(screen.getByText('Node states')).toBeInTheDocument();
    expect(screen.getByText('Available — start now')).toBeInTheDocument();
    expect(screen.getByText('Mastered')).toBeInTheDocument();
  });

  it('keeps non-dimmed nodes keyboard-focusable and activatable by Enter', async () => {
    render(<Constellation />);
    const fnd = await node('FND-101');
    expect(fnd).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(fnd, { key: 'Enter' });
    // Selecting an available node surfaces the enroll affordance.
    expect(await screen.findByRole('button', { name: /^Enroll$/ })).toBeInTheDocument();
  });

  it('enrolls an available course and blocks a locked gate (M1 done-criteria)', async () => {
    render(<Constellation />);
    fireEvent.click(await node('FND-101'));
    fireEvent.click(await screen.findByRole('button', { name: /^Enroll$/ }));
    expect(enrollSelf).toHaveBeenCalledWith(expect.objectContaining({ courseId: 'f' }));

    // The locked gate offers no enroll — only the unlock hint.
    fireEvent.click(await node('AC-203'));
    expect(screen.getByText(/Pass its prerequisite courses to unlock/i)).toBeInTheDocument();
  });

  it('dims nodes outside an active domain filter', async () => {
    render(<Constellation />);
    const fnd = await node('FND-101');
    expect(fnd.getAttribute('class') ?? '').not.toMatch(/pointer-events-none/);
    // Filter to the AC sector → the FND node dims out and leaves the tab order.
    fireEvent.click(screen.getByRole('button', { name: 'AC' }));
    expect(fnd.getAttribute('class') ?? '').toMatch(/pointer-events-none/);
    expect(fnd).toHaveAttribute('tabindex', '-1');
    // …while an AC node stays active.
    expect((await node('AC-201')).getAttribute('class') ?? '').not.toMatch(/pointer-events-none/);
  });

  it('uses no raw colour hex in the rendered markup (D1 invariant 9)', async () => {
    const { container } = render(<Constellation />);
    await node('FND-101');
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
