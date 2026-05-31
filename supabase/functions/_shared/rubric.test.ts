// Deno unit test for the §5.4 pass-rule + materializer (no network / no DB).
// Asserts the Edge-Fn layer agrees with the DB trigger (academy.tg_signoff_compute_outcome,
// proven on a live Postgres by supabase/tests/0001_invariants_test.sql) on the SAME cases.
//   deno test --config supabase/functions/deno.json supabase/functions/_shared/rubric.test.ts
import { assert, assertEquals } from '@std/assert';
import {
  computeSignoffOutcome,
  materializeLineItems,
  type RubricLine,
  safetyVetoTriggered,
  type TemplateLine,
} from './rubric.ts';

// A clean all-2s rubric across the four dimensions (one critical-safety line).
const allTwos: RubricLine[] = [
  { dimension: 'safety_compliance', line_item_key: 'ac203.release_on_power_loss', score: 2, is_critical_safety: true },
  { dimension: 'safety_compliance', line_item_key: 'ac203.push_to_exit_30s', score: 2, is_critical_safety: true },
  { dimension: 'technical_execution', line_item_key: 'ac203.tech.fail_safe_wiring', score: 2, is_critical_safety: false },
  { dimension: 'verification_documentation', line_item_key: 'ac203.verify.three_release_modes_logged', score: 2, is_critical_safety: false },
  { dimension: 'independence_judgment', line_item_key: 'ac203.indep.recognize_no_maglock_escalate', score: 2, is_critical_safety: false },
];

Deno.test('all-2s rubric ⇒ pass (mirrors trigger TEST 1)', () => {
  assertEquals(computeSignoffOutcome(allTwos), 'pass');
  assertEquals(safetyVetoTriggered(allTwos), false);
});

Deno.test('a single critical-safety 0 ⇒ non-overridable fail, even with everything else 3 (mirrors trigger TEST 2)', () => {
  const lines = allTwos.map((l) => ({ ...l, score: 3 }));
  lines[0] = { ...lines[0], score: 0 }; // the one safety line = 0 (the veto)
  assertEquals(safetyVetoTriggered(lines), true);
  assertEquals(computeSignoffOutcome(lines), 'fail');
});

Deno.test('no line items ⇒ fail (a sign-off with no rubric can never pass)', () => {
  assertEquals(computeSignoffOutcome([]), 'fail');
});

Deno.test('a non-safety dimension below 2 ⇒ fail, but NOT a safety veto', () => {
  const lines = allTwos.map((l) => ({ ...l }));
  lines[2] = { ...lines[2], score: 1 }; // technical_execution min < 2
  assertEquals(computeSignoffOutcome(lines), 'fail');
  assertEquals(safetyVetoTriggered(lines), false);
});

Deno.test('a critical-safety line at 1 (not 0) ⇒ fail (safety subset < 2) but NOT a veto', () => {
  const lines = allTwos.map((l) => ({ ...l }));
  lines[0] = { ...lines[0], score: 1 };
  assertEquals(computeSignoffOutcome(lines), 'fail');
  assertEquals(safetyVetoTriggered(lines), false); // veto is the 0 case specifically
});

Deno.test('a score of 3 passes (the threshold is ≥2, range is 0..3)', () => {
  assertEquals(computeSignoffOutcome(allTwos.map((l) => ({ ...l, score: 3 }))), 'pass');
});

// ── materialize: template-authoritative dimension + is_critical_safety ──
const templates: TemplateLine[] = [
  { line_item_key: 'ac203.release_on_power_loss', dimension: 'safety_compliance', is_critical_safety: true, ordinal: 1 },
  { line_item_key: 'ac203.tech.fail_safe_wiring', dimension: 'technical_execution', is_critical_safety: false, ordinal: 2 },
];

Deno.test('materialize takes dimension + is_critical_safety from the TEMPLATE, score from the client', () => {
  const r = materializeLineItems(templates, {
    'ac203.release_on_power_loss': 2,
    'ac203.tech.fail_safe_wiring': 2,
  });
  assert(r.ok);
  if (r.ok) {
    const safety = r.lines.find((l) => l.line_item_key === 'ac203.release_on_power_loss')!;
    assertEquals(safety.is_critical_safety, true); // from template, not the client
    assertEquals(safety.dimension, 'safety_compliance');
    assertEquals(computeSignoffOutcome(r.lines), 'pass');
  }
});

Deno.test('a client cannot dodge the veto: a 0 on a template safety line still vetoes after materialize', () => {
  const r = materializeLineItems(templates, {
    'ac203.release_on_power_loss': 0, // the safety line
    'ac203.tech.fail_safe_wiring': 3,
  });
  assert(r.ok);
  if (r.ok) {
    assertEquals(safetyVetoTriggered(r.lines), true);
    assertEquals(computeSignoffOutcome(r.lines), 'fail');
  }
});

Deno.test('materialize rejects a missing score, an out-of-range score, and an unknown key', () => {
  assertEquals(materializeLineItems(templates, { 'ac203.release_on_power_loss': 2 }).ok, false); // missing the tech line
  assertEquals(
    materializeLineItems(templates, { 'ac203.release_on_power_loss': 2, 'ac203.tech.fail_safe_wiring': 4 }).ok,
    false,
  ); // out of range
  assertEquals(
    materializeLineItems(templates, {
      'ac203.release_on_power_loss': 2,
      'ac203.tech.fail_safe_wiring': 2,
      'made.up.key': 2,
    }).ok,
    false,
  ); // unknown key
  assertEquals(materializeLineItems([], {}).ok, false); // no rubric for the course
});
