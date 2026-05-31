import { describe, expect, it } from 'vitest';
import type { BranchingSpec } from '../zod/branching.zod';
import { branchingExample } from './examples';

/**
 * Inv. 1 mapping guard (M3). The branching Zod treats edge.verdict.line_item_key as
 * a free string — it is NOT FK-checked against academy.signoff_line_item_templates.
 * A typo'd key validates green here but silently breaks the M6 safety-veto mapping.
 * So we pin every AC-203 verdict key to the keys S1 actually seeded
 * (seed/0001_mvp_slice_seed.sql §AC-203 line items): the 7 critical-safety ⚠ keys
 * (all dimension 'safety_compliance') + the 5 non-critical keys. If S1's keys move,
 * this fails loudly rather than letting the veto mapping rot.
 */

// The 7 ⚠ critical-safety AC-203 line items (is_critical_safety=true, safety_compliance).
const CRITICAL_KEYS = new Set([
  'ac203.release_on_power_loss',
  'ac203.push_to_exit_30s',
  'ac203.release_on_fire_alarm',
  'ac203.pte_mount_40_48in_5ft',
  'ac203.no_maglock_defeat_fire_latch',
  'ac203.emergency_lighting_present',
  'ac203.ahj_confirmed',
]);

// The 5 non-critical AC-203 line items (is_critical_safety=false), with their dimension.
const NONCRITICAL_KEYS = new Map<string, string>([
  ['ac203.tech.fail_safe_wiring', 'technical_execution'],
  ['ac203.tech.rex_fire_terminated', 'technical_execution'],
  ['ac203.tech.supply_battery_sized', 'technical_execution'],
  ['ac203.verify.three_release_modes_logged', 'verification_documentation'],
  ['ac203.indep.recognize_no_maglock_escalate', 'independence_judgment'],
]);

describe('AC-203 branching spec maps to the authoritative S1 rubric keys (Inv 1)', () => {
  const spec = branchingExample as unknown as BranchingSpec;
  const edges = Object.values(spec.nodes).flatMap((n) => (n.type === 'terminal' ? [] : n.choices));

  it('is the AC-203 egress-fail branching spec on the real competency', () => {
    expect(spec.envelope.engine_kind).toBe('branching_scenario');
    expect(spec.envelope.sim_id).toBe('ac203.egress-fail.maglock-door');
    // the real seeded EGRESS.MAGLOCK_FAILSAFE competency (NOT the old placeholder uuid)
    expect(spec.envelope.competency_ids).toContain('000000c0-0000-0000-0000-00000000000f');
  });

  it('every safety_flag edge maps to a seeded ⚠ critical-safety key in safety_compliance', () => {
    const safety = edges.filter((e) => e.safety_flag);
    expect(safety.length).toBeGreaterThanOrEqual(1);
    for (const e of safety) {
      expect(e.verdict?.dimension).toBe('safety_compliance');
      expect(e.verdict?.line_item_key, `edge ${e.id} key`).toBeDefined();
      expect(CRITICAL_KEYS.has(e.verdict?.line_item_key ?? '')).toBe(true);
    }
  });

  it('every non-safety graded edge maps to a seeded key in the matching dimension', () => {
    const graded = edges.filter((e) => !e.safety_flag && e.verdict);
    expect(graded.length).toBeGreaterThanOrEqual(1);
    for (const e of graded) {
      const key = e.verdict?.line_item_key ?? '';
      const dim = e.verdict?.dimension;
      const inCritical = CRITICAL_KEYS.has(key) && dim === 'safety_compliance';
      const inNon = NONCRITICAL_KEYS.get(key) === dim;
      expect(inCritical || inNon, `edge ${e.id} key ${key}/${dim}`).toBe(true);
    }
  });

  it('the scenario exercises a NON-critical (documentation) decision — so a miss can fail WITHOUT a veto', () => {
    const docMiss = edges.some(
      (e) => e.verdict?.line_item_key === 'ac203.verify.three_release_modes_logged',
    );
    expect(docMiss).toBe(true);
  });
});
