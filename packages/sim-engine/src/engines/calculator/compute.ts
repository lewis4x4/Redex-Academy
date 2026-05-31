/**
 * Engine #6 — the deterministic calculator formula registry (F5b). The spec NEVER
 * carries executable math: it names a `compute_ref` here, and these vetted, pure,
 * unit-checked functions do the computation. NO network, NO LLM, NO Date/random —
 * same inputs → same output (the determinism invariant). Each function reads the
 * named inputs it documents (the spec's input ids must match), validates they are
 * finite, and FAILS CLOSED (throws) on a missing/NaN input rather than guessing.
 *
 * Constants are pinned here so the registry id fixes the exact math (the
 * $computeContract note in a spec documents them for authors).
 */
import type { ComputeRef } from '@redex/sim-schemas';

export type Inputs = Record<string, number | string | boolean>;

function num(inputs: Inputs, key: string): number {
  const v = inputs[key];
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) throw new Error(`calculator: input '${key}' must be a finite number`);
  return n;
}

/** Required input ids per compute_ref (the authoring contract; surfaced in errors). */
export const COMPUTE_INPUTS: Record<ComputeRef, readonly string[]> = {
  poe_power_budget: ['budget_w', 'device_count', 'draw_per_device_w'], // + optional derate_pct
  voltage_drop_will_it_hold: ['v_supply', 'current_a', 'length_ft', 'ohms_per_1000ft'],
  ppf_dori: ['h_res_px', 'scene_width_ft'],
  storage_retention: ['capacity_tb', 'camera_count', 'bitrate_mbps', 'recording_hours_per_day'], // + optional usable_pct
};

/**
 * PoE power-budget headroom (W). available = budget·(1 − derate%); needed =
 * count·draw; headroom = available − needed. ≥ 0 ⇒ the run fits the budget.
 */
function poePowerBudget(i: Inputs): number {
  const budget = num(i, 'budget_w');
  const count = num(i, 'device_count');
  const draw = num(i, 'draw_per_device_w');
  const derate = 'derate_pct' in i ? num(i, 'derate_pct') : 0;
  const available = budget * (1 - derate / 100);
  return available - count * draw;
}

/**
 * Voltage-drop "will it hold" — voltage at the load (V) over a round-trip home-run.
 * Vdrop = I · R, R = 2·(length_ft/1000)·ohms_per_1000ft; V_load = V_supply − Vdrop.
 * Below a lock's min holding voltage the mag lock chatters / may not hold (AC-202).
 */
function voltageDropWillItHold(i: Inputs): number {
  const v = num(i, 'v_supply');
  const amps = num(i, 'current_a');
  const lengthFt = num(i, 'length_ft');
  const ohmsPer1000 = num(i, 'ohms_per_1000ft');
  if (lengthFt < 0 || ohmsPer1000 < 0 || amps < 0) {
    throw new Error('calculator: voltage_drop inputs (length/ohms/current) must be ≥ 0');
  }
  const rTotal = 2 * (lengthFt / 1000) * ohmsPer1000;
  const vDrop = amps * rTotal;
  return v - vDrop;
}

/** PPF (pixels per foot) at the scene: horizontal resolution / scene width (ft). */
function ppfDori(i: Inputs): number {
  const hres = num(i, 'h_res_px');
  const widthFt = num(i, 'scene_width_ft');
  if (widthFt <= 0) throw new Error('calculator: ppf_dori scene_width_ft must be > 0');
  return hres / widthFt;
}

/**
 * Storage-retention (days). days = usable_capacity_bits / bits_per_day, where
 * usable_capacity_bits = capacity_tb·8e12·(usable%/100) and bits_per_day =
 * camera_count·bitrate_mbps·1e6·hours_per_day·3600. (TB = 1e12 bytes; Mbps = 1e6 b/s.)
 */
function storageRetention(i: Inputs): number {
  const capacityTb = num(i, 'capacity_tb');
  const cameras = num(i, 'camera_count');
  const mbps = num(i, 'bitrate_mbps');
  const hoursPerDay = num(i, 'recording_hours_per_day');
  const usablePct = 'usable_pct' in i ? num(i, 'usable_pct') : 100;
  const bitsPerDay = cameras * mbps * 1e6 * hoursPerDay * 3600;
  if (bitsPerDay <= 0) throw new Error('calculator: storage_retention bits/day must be > 0');
  const usableBits = capacityTb * 8e12 * (usablePct / 100);
  return usableBits / bitsPerDay;
}

const REGISTRY: Record<ComputeRef, (i: Inputs) => number> = {
  poe_power_budget: poePowerBudget,
  voltage_drop_will_it_hold: voltageDropWillItHold,
  ppf_dori: ppfDori,
  storage_retention: storageRetention,
};

/** Run a registered deterministic computation. Pure + unit-checked + LLM-free. */
export function runCompute(ref: ComputeRef, inputs: Inputs): number {
  const fn = REGISTRY[ref];
  if (!fn) throw new Error(`calculator: no registered computation '${ref}'`);
  const out = fn(inputs);
  if (!Number.isFinite(out)) throw new Error(`calculator: '${ref}' produced a non-finite result`);
  return out;
}

export type ThresholdOp = '>=' | '>' | '<=' | '<' | '==' | 'between';

/** Compare a computed result against a threshold band. Pure + total. */
export function compareThreshold(
  result: number,
  op: ThresholdOp,
  value: number,
  valueHigh?: number,
): boolean {
  switch (op) {
    case '>=':
      return result >= value;
    case '>':
      return result > value;
    case '<=':
      return result <= value;
    case '<':
      return result < value;
    case '==':
      return result === value;
    case 'between':
      return valueHigh !== undefined && result >= value && result <= valueHigh;
    default:
      return false;
  }
}
