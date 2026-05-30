import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SignoffForm, SIGNOFF_DIMENSIONS } from './SignoffForm';

describe('SignoffForm', () => {
  it('renders a labelled form region with all four fixed §5.4 dimension headers', () => {
    render(<SignoffForm />);
    const form = screen.getByRole('form', { name: 'Evaluator sign-off rubric' });
    expect(form).toBeInTheDocument();
    // The four rubric dimensions are FIXED section headers (invariant 1) — always present.
    for (const { label } of SIGNOFF_DIMENSIONS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(SIGNOFF_DIMENSIONS.map((d) => d.key)).toEqual([
      'safety_compliance',
      'technical_execution',
      'verification_documentation',
      'independence_judgment',
    ]);
    // token discipline: no raw hex lands in the rendered tree
    expect(form.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('shows the on-brand placeholder in every dimension when no slots are supplied', () => {
    render(<SignoffForm />);
    // One EmptyState (role=status) per fixed dimension.
    expect(screen.getAllByRole('status')).toHaveLength(SIGNOFF_DIMENSIONS.length);
    expect(screen.getAllByText('Awaiting rubric items')).toHaveLength(SIGNOFF_DIMENSIONS.length);
  });

  it('renders the per-dimension lineItems + scoreControl slots and drops the placeholder', () => {
    render(
      <SignoffForm
        dimensions={{
          safety_compliance: {
            lineItems: <div>maglock fail-safe check</div>,
            scoreControl: <div>safety score control</div>,
          },
        }}
      />,
    );
    expect(screen.getByText('maglock fail-safe check')).toBeInTheDocument();
    expect(screen.getByText('safety score control')).toBeInTheDocument();
    // The filled dimension no longer shows its placeholder; the other three still do.
    expect(screen.getAllByRole('status')).toHaveLength(SIGNOFF_DIMENSIONS.length - 1);
    // The fieldset is keyed by the fixed dimension key for M6 to target.
    const form = screen.getByRole('form');
    expect(form.querySelector('[data-dimension="safety_compliance"]')).not.toBeNull();
  });

  it('renders the header, evidence, and submit slots when provided', () => {
    render(
      <SignoffForm
        header={<div>candidate: Nova · job #4821</div>}
        evidence={<div>3 photos attached</div>}
        submit={<button>Sign off</button>}
      />,
    );
    expect(screen.getByText('candidate: Nova · job #4821')).toBeInTheDocument();
    expect(screen.getByText('3 photos attached')).toBeInTheDocument();
    expect(screen.getByText('Field evidence')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign off' })).toBeInTheDocument();
  });

  it('omits the optional header / evidence / submit slots when not provided', () => {
    render(<SignoffForm />);
    expect(screen.queryByText('Field evidence')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('uses a custom form label and merges className + forwards its ref to the form', () => {
    const ref = createRef<HTMLFormElement>();
    render(<SignoffForm ref={ref} className="custom-x" formLabel="Recert sign-off" />);
    expect(ref.current).toBeInstanceOf(HTMLFormElement);
    const form = screen.getByRole('form', { name: 'Recert sign-off' });
    expect(form.className).toContain('custom-x');
  });
});
