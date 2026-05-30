import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon, ICON_NAMES } from './Icon';

describe('Icon', () => {
  it('exposes the full registry name set', () => {
    expect(ICON_NAMES).toEqual(['play', 'check', 'store', 'warn', 'bolt']);
  });

  it('renders every registered name as a 24×24 svg with a path (no raw hex)', () => {
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
      expect(svg?.querySelector('path')).not.toBeNull();
      // token discipline: meaning is carried by shape + currentColor, never a raw hex
      expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      unmount();
    }
  });

  it('is decorative (aria-hidden, not focusable) when no title is given', () => {
    const { container } = render(<Icon name="play" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg).not.toHaveAttribute('role');
    // decorative icon is not in the accessibility tree as an image
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('exposes role="img" with an accessible label + <title> when titled', () => {
    render(<Icon name="warn" title="Warning" />);
    const img = screen.getByRole('img', { name: 'Warning' });
    expect(img).toHaveAttribute('aria-label', 'Warning');
    expect(img).not.toHaveAttribute('aria-hidden');
    expect(img.querySelector('title')?.textContent).toBe('Warning');
  });

  it('tints via currentColor — fill icons fill, stroke icons stroke', () => {
    const { container: fillC } = render(<Icon name="bolt" />);
    const fill = fillC.querySelector('svg');
    expect(fill).toHaveAttribute('fill', 'currentColor');
    expect(fill).not.toHaveAttribute('stroke');

    const { container: strokeC } = render(<Icon name="check" />);
    const stroke = strokeC.querySelector('svg');
    expect(stroke).toHaveAttribute('fill', 'none');
    expect(stroke).toHaveAttribute('stroke', 'currentColor');
    expect(stroke).toHaveAttribute('stroke-width', '3');
    expect(stroke).toHaveAttribute('stroke-linecap', 'round');
    expect(stroke).toHaveAttribute('stroke-linejoin', 'round');
  });

  it('honors size (sets width + height) and merges className', () => {
    const { container } = render(<Icon name="store" size={18} className="text-redex-bright" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '18');
    expect(svg).toHaveAttribute('height', '18');
    expect(svg?.getAttribute('class')).toContain('text-redex-bright');
  });
});
