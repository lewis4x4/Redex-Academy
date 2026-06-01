import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LessonOutlineRail, type LessonOutlineStep } from './LessonOutlineRail';

const HEX = /#[0-9a-fA-F]{3,8}/;

const STEPS: LessonOutlineStep[] = [
  { id: '1', label: 'Two locks, opposite rules', sub: 'Why the mag is dangerous' },
  { id: '2', label: 'No power, no hold' },
  { id: '3', label: 'How people get out' },
  { id: '4', label: 'Knowledge check' },
];

describe('LessonOutlineRail', () => {
  it('is a semantic nav>ol>li so AT announces the step count + each position', () => {
    render(<LessonOutlineRail steps={STEPS} current={1} furthestReached={1} onStep={vi.fn()} />);
    const nav = screen.getByRole('navigation', { name: 'In this lesson' });
    const list = within(nav).getByRole('list');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(4);
  });

  it('derives done / active / todo per step (number + glyph + color + aria, never color alone)', () => {
    render(<LessonOutlineRail steps={STEPS} current={1} furthestReached={1} onStep={vi.fn()} />);
    const [done, active, todo] = screen.getAllByRole('button') as HTMLElement[];
    // step 0: done → green ✓ glyph, no aria-current
    expect(done).toHaveAttribute('data-state', 'done');
    expect(within(done!).getByText('✓')).toBeInTheDocument();
    expect(done).not.toHaveAttribute('aria-current');
    expect(done).toHaveAccessibleName(/Step 1, done/);
    // step 1: active → aria-current=page, red dot showing the number
    expect(active).toHaveAttribute('data-state', 'active');
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active).toHaveAccessibleName(/Step 2, current/);
    // step 2/3: todo → outlined number, not started
    expect(todo).toHaveAttribute('data-state', 'todo');
    expect(todo).toHaveAccessibleName(/Step 3, not started/);
  });

  it('makes only steps at or before furthestReached clickable', async () => {
    const onStep = vi.fn();
    render(<LessonOutlineRail steps={STEPS} current={1} furthestReached={1} onStep={onStep} />);
    const [reached, , beyond1, beyond2] = screen.getAllByRole('button') as HTMLElement[];
    // a reached step (done) is enabled and jumps
    expect(reached).not.toBeDisabled();
    reached!.click();
    expect(onStep).toHaveBeenCalledWith(0);
    // a step beyond furthestReached is disabled and never fires
    expect(beyond1).toBeDisabled();
    expect(beyond2).toBeDisabled();
    onStep.mockClear();
    beyond2!.click();
    expect(onStep).not.toHaveBeenCalled();
  });

  it('renders the optional sub-line and the eyebrow heading, with no raw hex', () => {
    const { container } = render(
      <LessonOutlineRail
        steps={STEPS}
        current={1}
        furthestReached={1}
        onStep={vi.fn()}
        ariaLabel="In this lesson"
      />,
    );
    expect(screen.getByText('Why the mag is dangerous')).toBeInTheDocument();
    // tokens only — no raw hex leaks into the rail markup
    expect(container.innerHTML).not.toMatch(HEX);
    // colorblind-safe carriers are present: green for the done step, red-tint for active
    expect(container.innerHTML).toContain('border-green');
    expect(container.innerHTML).toContain('bg-red-tint');
  });
});
