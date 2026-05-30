import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input, Select, Textarea } from './Input';

describe('Input', () => {
  it('renders a labelled text input wired via htmlFor/id', () => {
    render(<Input label="Site name" />);
    // Found by its accessible name => the <label> is correctly associated.
    const field = screen.getByRole('textbox', { name: 'Site name' });
    expect(field.tagName).toBe('INPUT');
    expect(field).toHaveAttribute('type', 'text');
    // The visible <label> points at the generated field id.
    const label = screen.getByText('Site name');
    expect(label).toHaveAttribute('for', field.id);
  });

  it('honors an explicit id and accepts aria-label without a visible label', () => {
    render(<Input id="email" aria-label="Email address" type="email" />);
    const field = screen.getByRole('textbox', { name: 'Email address' });
    expect(field).toHaveAttribute('id', 'email');
    expect(field).toHaveAttribute('type', 'email');
    // No visible <label> rendered when only aria-label is supplied.
    expect(screen.queryByText('Email address')).toBeNull();
  });

  it('is disabled-aware and carries the on-brand token classes (not raw hex)', () => {
    render(<Input label="Locked" disabled />);
    const field = screen.getByRole('textbox', { name: 'Locked' });
    expect(field).toBeDisabled();
    expect(field.className).toContain('bg-panel-2');
    expect(field.className).toContain('focus:border-redex');
    expect(field.className).toContain('focus:shadow-glow-soft');
    // token discipline: no raw hex ever lands in the rendered class list
    expect(field.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});

describe('Select', () => {
  it('renders a labelled native select with its options', () => {
    render(
      <Select label="Domain">
        <option value="ac">Access Control</option>
        <option value="vid">Video</option>
      </Select>,
    );
    const field = screen.getByRole('combobox', { name: 'Domain' });
    expect(field.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'Access Control' })).toBeInTheDocument();
    expect(field.className).toContain('bg-panel-2');
    expect(field.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});

describe('Textarea', () => {
  it('renders a labelled native textarea with a default row count', () => {
    render(<Textarea label="Notes" />);
    const field = screen.getByRole('textbox', { name: 'Notes' });
    expect(field.tagName).toBe('TEXTAREA');
    expect(field).toHaveAttribute('rows', '4');
    expect(field.className).toContain('resize-y');
    expect(field.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('respects a forwarded ref', () => {
    let captured: HTMLTextAreaElement | null = null;
    render(<Textarea label="Bio" ref={(node) => (captured = node)} />);
    expect(captured).not.toBeNull();
    expect((captured as unknown as HTMLTextAreaElement).tagName).toBe('TEXTAREA');
  });
});
