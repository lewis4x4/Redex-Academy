import {
  aeroFixture,
  branchingExample,
  calculatorExample,
  deviceConfigExample,
  interaction2dExample,
} from '@redex/sim-schemas';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BranchingSim } from './engines/branching/BranchingSim';
import type { BranchingInstance } from './engines/branching/core';
import { DeviceConfigSim } from './engines/device-config/DeviceConfigSim';
import type { DeviceConfigInstance } from './engines/device-config/core';
import { Interaction2dSim } from './engines/interaction-2d/Interaction2dSim';
import type { Interaction2dInstance } from './engines/interaction-2d/core';
import { CalculatorSim } from './engines/calculator/CalculatorSim';
import type { CalculatorInstance } from './engines/calculator/core';
import { loadSpec } from './loadSpec';

const det = {
  genUuid: () => '00000000-0000-4000-8000-000000000000',
  now: () => '2026-05-29T00:00:00.000Z',
};

const branchingSim = (): BranchingInstance => {
  const s = loadSpec(branchingExample, det);
  if (s.engineKind !== 'branching_scenario') throw new Error('expected branching');
  return s;
};
const deviceSim = (): DeviceConfigInstance => {
  const s = loadSpec(deviceConfigExample, { ...det, fixture: aeroFixture });
  if (s.engineKind !== 'device_config') throw new Error('expected device_config');
  return s;
};
const interaction2dSim = (): Interaction2dInstance => {
  const s = loadSpec(interaction2dExample, det);
  if (s.engineKind !== 'interaction_2d') throw new Error('expected interaction_2d');
  return s;
};
const calculatorSim = (): CalculatorInstance => {
  const s = loadSpec(calculatorExample, det);
  if (s.engineKind !== 'calculator') throw new Error('expected calculator');
  return s;
};

describe('renderers: rich + 2D fallback drive the same instance (identical Verdict)', () => {
  it('branching rich render: wrong fail-locked choice shows the safety-veto terminal', () => {
    const sim = branchingSim();
    const { container } = render(<BranchingSim instance={sim} mode="rich" />);
    // start node is `failstate`: the fail-locked choice is the wrong life-safety branch
    fireEvent.click(container.querySelector('[data-choice="faillocked"]')!);
    // colorblind-safe: state carried by shape + text, not color alone
    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('data-token', 'safety_veto');
    expect(badge).toHaveAttribute('data-shape', 'octagon');
    expect(badge.textContent).toContain('SAFETY STOP');
    expect(screen.getByTestId('veto-feedback')).toBeInTheDocument();
    expect(screen.getByTestId('postmortem-replay')).toBeInTheDocument();
  });

  it('2D fallback is a first-class path: SAME Verdict token as rich for the same input', () => {
    const drive = (mode: 'rich' | 'fallback2d') => {
      const sim = branchingSim();
      const { container } = render(<BranchingSim instance={sim} mode={mode} />);
      fireEvent.click(container.querySelector('[data-choice="faillocked"]')!);
      const frame = container.querySelector('[data-render-mode]')!;
      expect(frame).toHaveAttribute('data-render-mode', mode);
      const badge = within(container).getByRole('status');
      return { token: badge.getAttribute('data-token'), verdict: sim.getVerdict() };
    };
    const rich = drive('rich');
    const fb = drive('fallback2d');
    expect(rich.token).toBe(fb.token);
    expect(rich.verdict.outcome).toBe(fb.verdict.outcome);
    expect(rich.verdict.safety_veto_triggered).toBe(fb.verdict.safety_veto_triggered);
  });

  it('branching is keyboard-navigable: choices are native buttons with accessible names', () => {
    const sim = branchingSim();
    render(<BranchingSim instance={sim} mode="rich" />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    expect(buttons.every((b) => (b.textContent ?? '').trim().length > 0)).toBe(true);
  });

  it('device-config render: screen nav works; a fail-locked egress lock submits to a safety veto', () => {
    const sim = deviceSim();
    const { container } = render(<DeviceConfigSim instance={sim} mode="rich" />);
    // The device UI is screen-based: only the current screen's fields are shown.
    // Set the egress lock wrong on the wiring screen (a single safety failure vetoes).
    fireEvent.change(container.querySelector('[data-field="lock_output_mode"]')!, {
      target: { value: 'fail_locked' },
    });
    // Screen navigation is functional (move to the portal screen and back).
    fireEvent.click(container.querySelector('[data-screen="portal"]')!);
    expect(container.querySelector('[data-field="cloud_added"]')).not.toBeNull();
    fireEvent.click(container.querySelector('[data-screen="wiring"]')!);
    fireEvent.click(screen.getByTestId('submit'));
    const badge = within(screen.getByTestId('verdict')).getByRole('status');
    expect(badge).toHaveAttribute('data-token', 'safety_veto');
    expect(badge).toHaveAttribute('data-shape', 'octagon');
    expect(screen.getByTestId('veto-feedback')).toBeInTheDocument();
  });

  // ── Engine #5 — 2D-interaction (F5b) ───────────────────────────────────────
  it('interaction-2d render: all items correct → PASS (keyboard-native controls)', () => {
    const sim = interaction2dSim();
    const { container } = render(<Interaction2dSim instance={sim} mode="rich" />);
    // native <select>s + buttons — keyboard-navigable, gloved-friendly (no mouse drag)
    const setSel = (attr: string, id: string, val: string) =>
      fireEvent.change(container.querySelector(`[${attr}="${id}"]`)!, { target: { value: val } });
    setSel('data-label', 'l-strike', 'r-strike');
    setSel('data-label', 'l-hinge', 'r-hinge');
    setSel('data-label', 'l-rex', 'r-rex');
    setSel('data-left', 'm-prox', 'm-wiegand');
    setSel('data-left', 'm-maglock', 'm-failsafe');
    fireEvent.click(container.querySelector('[data-region="h-egress"]')!);
    fireEvent.click(screen.getByTestId('i2d-submit'));
    const badge = within(screen.getByTestId('i2d-verdict')).getByRole('status');
    expect(badge).toHaveAttribute('data-token', 'pass'); // shape + text + color
    expect(badge).toHaveAttribute('data-shape', 'check');
  });

  it('interaction-2d render: tapping the WRONG egress side → safety-veto', () => {
    const sim = interaction2dSim();
    const { container } = render(<Interaction2dSim instance={sim} mode="rich" />);
    const hotspot = container.querySelector('[data-region="h-secure"]')!;
    expect(hotspot).toHaveAttribute('aria-pressed', 'false'); // toggle state exposed to AT
    fireEvent.click(hotspot);
    expect(container.querySelector('[data-region="h-secure"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByTestId('i2d-submit'));
    const badge = within(screen.getByTestId('i2d-verdict')).getByRole('status');
    expect(badge).toHaveAttribute('data-token', 'safety_veto');
    expect(screen.getByTestId('veto-feedback')).toBeInTheDocument();
  });

  // ── Engine #6 — calculator (F5b) ───────────────────────────────────────────
  it('calculator render: default inputs PASS; the budget meter shows the numeric value (colorblind-safe)', () => {
    const sim = calculatorSim();
    render(<CalculatorSim instance={sim} mode="rich" />);
    // colorblind-safe: a role=meter that shows the NUMERIC value, never color alone
    const meter = screen.getByRole('meter');
    expect(meter.textContent ?? '').toMatch(/11\.76/);
    fireEvent.click(screen.getByTestId('calculator-submit'));
    const badge = within(screen.getByTestId('calculator-verdict')).getByRole('status');
    expect(badge).toHaveAttribute('data-token', 'pass');
  });

  it('calculator render: a long, thin run drops below hold voltage → safety-veto', () => {
    const sim = calculatorSim();
    const { container } = render(<CalculatorSim instance={sim} mode="rich" />);
    fireEvent.change(container.querySelector('[data-input="length_ft"]')!, {
      target: { value: '500' },
    });
    fireEvent.change(container.querySelector('[data-input="ohms_per_1000ft"]')!, {
      target: { value: '6.4' },
    });
    fireEvent.click(screen.getByTestId('calculator-submit'));
    const badge = within(screen.getByTestId('calculator-verdict')).getByRole('status');
    expect(badge).toHaveAttribute('data-token', 'safety_veto');
    expect(screen.getByTestId('veto-feedback')).toBeInTheDocument();
  });
});
