import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal, Scrim } from './Modal';

/**
 * A trigger + Modal harness exercising the focus-trap lifecycle: a real trigger
 * button opens the dialog (so we can assert focus RETURNS to it on close), and the
 * dialog holds two focusable controls so Tab-wrapping can be observed.
 */
function ModalHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Sign-off">
        <button type="button">First action</button>
        <button type="button">Last action</button>
      </Modal>
    </>
  );
}

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

  it('moves focus to the dialog card on open (no focusable content → container)', () => {
    render(
      <Modal open onClose={() => {}} title="Backpack">
        contents
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('moves focus to the first focusable control inside the dialog on open', () => {
    render(<ModalHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }));
    expect(screen.getByRole('button', { name: 'First action' })).toHaveFocus();
  });

  it('traps Tab from the last focusable, wrapping to the first', () => {
    render(<ModalHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }));
    const last = screen.getByRole('button', { name: 'Last action' });
    // Move focus to the last focusable, then Tab → should wrap to the first.
    last.focus();
    expect(last).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'First action' })).toHaveFocus();
  });

  it('traps Shift+Tab from the first focusable, wrapping to the last', () => {
    render(<ModalHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }));
    const first = screen.getByRole('button', { name: 'First action' });
    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Last action' })).toHaveFocus();
  });

  it('restores focus to the trigger when closed via Escape', () => {
    render(<ModalHarness />);
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    // fireEvent.click does not move DOM focus in jsdom the way a real click does,
    // so focus the trigger first — this is the element the trap must restore to.
    trigger.focus();
    fireEvent.click(trigger);
    // Focus is inside the dialog now…
    expect(screen.getByRole('button', { name: 'First action' })).toHaveFocus();
    // Escape closes; the focus trap restores focus to the trigger.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
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
