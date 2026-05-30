import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tooltip, TooltipCode, TooltipHint, TooltipMeta, TooltipTitle } from './Tooltip';

describe('Tooltip', () => {
  it('renders the anchor children and a role="tooltip" bubble carrying the content', () => {
    render(
      <Tooltip open content={<TooltipTitle>Maglock fail-safe</TooltipTitle>}>
        <button type="button">EGRESS.MAGLOCK</button>
      </Tooltip>,
    );
    expect(screen.getByRole('button', { name: 'EGRESS.MAGLOCK' })).toBeInTheDocument();
    const tip = screen.getByRole('tooltip', { hidden: true });
    expect(tip).toHaveTextContent('Maglock fail-safe');
  });

  it('is shown (opacity-100, not aria-hidden) when open and aria-hidden + faded when closed', () => {
    const { rerender } = render(
      <Tooltip open content="visible">
        <span>anchor</span>
      </Tooltip>,
    );
    let tip = screen.getByRole('tooltip', { hidden: true });
    expect(tip).toHaveAttribute('aria-hidden', 'false');
    expect(tip.className).toContain('opacity-100');

    rerender(
      <Tooltip open={false} content="hidden">
        <span>anchor</span>
      </Tooltip>,
    );
    tip = screen.getByRole('tooltip', { hidden: true });
    expect(tip).toHaveAttribute('aria-hidden', 'true');
    expect(tip.className).toContain('opacity-0');
  });

  it('defaults to closed and carries the signature token classes (gradient + redex border + shadow), no raw hex', () => {
    render(
      <Tooltip content="recipe">
        <span>anchor</span>
      </Tooltip>,
    );
    const tip = screen.getByRole('tooltip', { hidden: true });
    expect(tip).toHaveAttribute('aria-hidden', 'true');
    expect(tip.className).toContain('bg-grad-panel');
    expect(tip.className).toContain('border-redex');
    expect(tip.className).toContain('rounded-card');
    expect(tip.className).toContain('max-w-[280px]');
    expect(tip.className).toContain('pointer-events-none');
    // token discipline: no raw hex ever lands in the rendered class list
    expect(tip.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('applies placement classes for a non-default side', () => {
    render(
      <Tooltip open placement="right" content="side">
        <span>anchor</span>
      </Tooltip>,
    );
    const tip = screen.getByRole('tooltip', { hidden: true });
    expect(tip.className).toContain('left-full');
  });

  it('renders the sub-part text styles with no raw hex', () => {
    render(
      <Tooltip
        open
        content={
          <>
            <TooltipCode>AC-203</TooltipCode>
            <TooltipTitle>Access Control</TooltipTitle>
            <TooltipMeta>3 competencies</TooltipMeta>
            <TooltipHint>Locked until prereqs met</TooltipHint>
          </>
        }
      >
        <span>anchor</span>
      </Tooltip>,
    );
    const code = screen.getByText('AC-203');
    const title = screen.getByText('Access Control');
    const meta = screen.getByText('3 competencies');
    const hint = screen.getByText('Locked until prereqs met');
    expect(code.className).toContain('text-redex-bright');
    expect(title.className).toContain('text-body-lg');
    expect(meta.className).toContain('text-ink-muted');
    expect(hint.className).toContain('italic');
    for (const el of [code, title, meta, hint]) {
      expect(el.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });
});
