import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal, Scrim } from './Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Backpack">
        contents
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders an aria-modal dialog labelled by its title', () => {
    render(
      <Modal open onClose={() => {}} title="Backpack">
        <p>Your gear</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Backpack' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Your gear')).toBeInTheDocument();
  });

  it('moves focus to the dialog card on open', () => {
    render(
      <Modal open onClose={() => {}} title="Backpack">
        contents
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Backpack">
        contents
      </Modal>,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the scrim is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open onClose={onClose} title="Backpack">
        contents
      </Modal>,
    );
    // The scrim is the first child div inside the fixed overlay (before the card).
    const scrim = container.querySelector('.bg-scrim-modal');
    expect(scrim).not.toBeNull();
    fireEvent.click(scrim as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('carries the panel/shadow token classes and no raw hex', () => {
    render(
      <Modal open onClose={() => {}} title="Backpack">
        contents
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('bg-grad-panel');
    expect(dialog.className).toContain('shadow-modal');
    expect(dialog.className).toContain('rounded-panel');
    // token discipline: no raw hex ever lands in the rendered class list
    expect(dialog.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});

describe('Scrim', () => {
  it('renders the modal variant tint by default', () => {
    const { container } = render(<Scrim data-testid="scrim" />);
    const scrim = container.firstElementChild as HTMLElement;
    expect(scrim.className).toContain('bg-scrim-modal');
    expect(scrim.className).toContain('backdrop-blur-[6px]');
    expect(scrim.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('renders the drawer variant tint (lighter, no blur)', () => {
    const { container } = render(<Scrim variant="drawer" />);
    const scrim = container.firstElementChild as HTMLElement;
    expect(scrim.className).toContain('bg-scrim-drawer');
    expect(scrim.className).not.toContain('backdrop-blur');
    expect(scrim.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('merges a custom className and spreads rest props', () => {
    const onClick = vi.fn();
    const { container } = render(<Scrim className="custom-x" onClick={onClick} />);
    const scrim = container.firstElementChild as HTMLElement;
    expect(scrim.className).toContain('custom-x');
    fireEvent.click(scrim);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
