import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SlideOver } from './SlideOver';

/**
 * A trigger + SlideOver harness exercising the focus-trap lifecycle: a real trigger
 * button opens the panel (so we can assert focus RETURNS to it on close). The panel
 * already contains a focusable Close button, so opening moves focus INTO the panel.
 */
function SlideOverHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open panel
      </button>
      <SlideOver open={open} onClose={() => setOpen(false)} title="Course detail">
        <button type="button">Body action</button>
      </SlideOver>
    </>
  );
}

describe('SlideOver', () => {
  it('renders a labelled modal dialog with its title and panel transform classes', () => {
    render(
      <SlideOver open onClose={() => {}} title="Course detail">
        <p>Body</p>
      </SlideOver>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Course detail' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // open => slid in (translate-x-0) + signature slide transition
    expect(dialog.className).toContain('translate-x-0');
    expect(dialog.className).toContain('duration-slideover');
    expect(dialog.className).toContain('ease-slide');
    // token discipline: no raw hex ever lands in the rendered class list
    expect(dialog.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('is off-screen, hidden, and non-interactive when closed', () => {
    const { container } = render(
      <SlideOver open={false} onClose={() => {}} title="Course detail">
        content
      </SlideOver>,
    );
    // aria-hidden removes the dialog from the a11y tree, so query the element directly.
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog).toHaveAttribute('aria-hidden', 'true');
    expect(dialog?.className).toContain('translate-x-full');
    expect(dialog?.className).toContain('pointer-events-none');
  });

  it('closes on Escape when open', () => {
    const onClose = vi.fn();
    render(
      <SlideOver open onClose={onClose} title="Course detail">
        content
      </SlideOver>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on Escape when already closed', () => {
    const onClose = vi.fn();
    render(
      <SlideOver open={false} onClose={onClose} title="Course detail">
        content
      </SlideOver>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes via the close button (accessible name)', () => {
    const onClose = vi.fn();
    render(
      <SlideOver open onClose={onClose} title="Course detail">
        content
      </SlideOver>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders a default drawer scrim that closes on click and carries the scrim token (not raw hex)', () => {
    const onClose = vi.fn();
    const { container } = render(
      <SlideOver open onClose={onClose} title="Course detail">
        content
      </SlideOver>,
    );
    const scrim = container.querySelector('[aria-hidden="true"].bg-scrim-drawer');
    expect(scrim).not.toBeNull();
    expect(scrim?.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    fireEvent.click(scrim as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('suppresses the built-in scrim when scrim={false}', () => {
    const { container } = render(
      <SlideOver open onClose={() => {}} title="Course detail" scrim={false}>
        content
      </SlideOver>,
    );
    expect(container.querySelector('.bg-scrim-drawer')).toBeNull();
  });

  it('renders a caller-supplied scrim node instead of the default', () => {
    render(
      <SlideOver
        open
        onClose={() => {}}
        title="Course detail"
        scrim={<div data-testid="custom-scrim" />}
      >
        content
      </SlideOver>,
    );
    expect(screen.getByTestId('custom-scrim')).toBeInTheDocument();
  });

  it('moves focus INTO the panel on open (first focusable: the close button)', () => {
    render(<SlideOverHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open panel' }));
    // The first focusable descendant is the panel's Close button.
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('restores focus to the trigger when the panel closes', () => {
    render(<SlideOverHarness />);
    const trigger = screen.getByRole('button', { name: 'Open panel' });
    // fireEvent.click does not move DOM focus in jsdom the way a real click does,
    // so focus the trigger first — this is the element the trap must restore to.
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    // Close via the panel's close button; focus returns to the trigger.
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(trigger).toHaveFocus();
  });
});
