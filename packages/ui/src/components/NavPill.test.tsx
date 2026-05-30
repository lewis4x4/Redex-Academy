import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NavPill } from './NavPill';

describe('NavPill', () => {
  it('renders a native button with its label and a default type of button', () => {
    render(<NavPill>Courses</NavPill>);
    const btn = screen.getByRole('button', { name: 'Courses' });
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('is not current by default (no aria-current, no active token classes)', () => {
    render(<NavPill>Courses</NavPill>);
    const btn = screen.getByRole('button', { name: 'Courses' });
    expect(btn).not.toHaveAttribute('aria-current');
    expect(btn.className).not.toContain('bg-red-tint');
  });

  it('marks the active pill aria-current="page" and carries the active token classes (not raw hex)', () => {
    render(<NavPill active>Dashboard</NavPill>);
    const btn = screen.getByRole('button', { name: 'Dashboard' });
    expect(btn).toHaveAttribute('aria-current', 'page');
    // active recipe: red tint fill + red edge + soft glow + white text (§5.4)
    expect(btn.className).toContain('bg-red-tint');
    expect(btn.className).toContain('border-red-edge');
    expect(btn.className).toContain('shadow-glow-soft');
    // colorblind/token discipline: no raw hex ever lands in the rendered class list
    expect(btn.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('renders the 6px currentColor dot as decorative', () => {
    render(<NavPill>Sims</NavPill>);
    const btn = screen.getByRole('button', { name: 'Sims' });
    const dot = btn.querySelector('span.bg-current');
    expect(dot).not.toBeNull();
    expect(dot).toHaveAttribute('aria-hidden', 'true');
    expect(dot?.className).toContain('rounded-full');
  });

  it('renders a leading icon aria-hidden (decorative)', () => {
    render(<NavPill leftIcon={<svg data-testid="ic" />}>Profile</NavPill>);
    expect(screen.getByTestId('ic').parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('is disabled-aware', () => {
    render(<NavPill disabled>Locked</NavPill>);
    expect(screen.getByRole('button', { name: 'Locked' })).toBeDisabled();
  });
});
