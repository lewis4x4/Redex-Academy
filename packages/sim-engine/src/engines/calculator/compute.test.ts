import { describe, it, expect } from 'vitest';
import { runCompute, compareThreshold, COMPUTE_INPUTS } from './compute';

describe('calculator compute registry — deterministic + unit-checked', () => {
  it('poe_power_budget: headroom = budget·(1−derate) − count·draw', () => {
    expect(
      runCompute('poe_power_budget', { budget_w: 130, device_count: 4, draw_per_device_w: 25.5 }),
    ).toBeCloseTo(28);
    // 10% derate: 130*0.9 − 4*25.5 = 117 − 102 = 15
    expect(
      runCompute('poe_power_budget', {
        budget_w: 130,
        device_count: 4,
        draw_per_device_w: 25.5,
        derate_pct: 10,
      }),
    ).toBeCloseTo(15);
  });

  it('voltage_drop_will_it_hold: V_load = V − I·(2·len/1000·Ω/1000ft)', () => {
    // 12V, 0.5A, 150ft, 1.6Ω/1000ft → drop 0.24 → 11.76V
    expect(
      runCompute('voltage_drop_will_it_hold', {
        v_supply: 12,
        current_a: 0.5,
        length_ft: 150,
        ohms_per_1000ft: 1.6,
      }),
    ).toBeCloseTo(11.76);
    // long/thin run drops below the lock's hold voltage: 500ft @ 6.4Ω → 3.2V drop → 8.8V
    expect(
      runCompute('voltage_drop_will_it_hold', {
        v_supply: 12,
        current_a: 0.5,
        length_ft: 500,
        ohms_per_1000ft: 6.4,
      }),
    ).toBeCloseTo(8.8);
  });

  it('ppf_dori: pixels per foot = h_res / scene_width_ft', () => {
    expect(runCompute('ppf_dori', { h_res_px: 1920, scene_width_ft: 24 })).toBeCloseTo(80);
  });

  it('storage_retention: days = usable_bits / bits_per_day', () => {
    // 8TB, 4 cams, 4 Mbps, 24h → (8·8e12)/(4·4e6·24·3600) = 6.4e13 / 1.3824e12 ≈ 46.3 days
    expect(
      runCompute('storage_retention', {
        capacity_tb: 8,
        camera_count: 4,
        bitrate_mbps: 4,
        recording_hours_per_day: 24,
      }),
    ).toBeCloseTo(46.296, 2);
  });

  it('is DETERMINISTIC — same inputs → byte-identical output, repeatedly', () => {
    const inputs = { v_supply: 12, current_a: 0.5, length_ft: 150, ohms_per_1000ft: 1.6 };
    const runs = Array.from({ length: 5 }, () => runCompute('voltage_drop_will_it_hold', inputs));
    expect(new Set(runs).size).toBe(1);
  });

  it('FAILS CLOSED on a missing/NaN input (never guesses)', () => {
    expect(() =>
      runCompute('voltage_drop_will_it_hold', { v_supply: 12, current_a: 0.5, length_ft: 150 }),
    ).toThrow(/ohms_per_1000ft/);
    expect(() => runCompute('ppf_dori', { h_res_px: 1920, scene_width_ft: 0 })).toThrow();
    expect(() =>
      runCompute('poe_power_budget', { budget_w: NaN, device_count: 1, draw_per_device_w: 1 }),
    ).toThrow();
  });

  it('documents the required input ids per compute_ref', () => {
    expect(COMPUTE_INPUTS.voltage_drop_will_it_hold).toContain('ohms_per_1000ft');
    expect(COMPUTE_INPUTS.poe_power_budget).toContain('budget_w');
  });
});

describe('compareThreshold — total + pure', () => {
  it('handles all ops incl. between', () => {
    expect(compareThreshold(11.76, '>=', 11.4)).toBe(true);
    expect(compareThreshold(8.8, '<', 10.5)).toBe(true);
    expect(compareThreshold(8.8, '<', 8.8)).toBe(false);
    expect(compareThreshold(5, 'between', 1, 10)).toBe(true);
    expect(compareThreshold(11, 'between', 1, 10)).toBe(false);
    expect(compareThreshold(5, 'between', 1)).toBe(false); // missing value_high
  });
});
