import { describe, expect, it } from 'vitest';
import {
  AUTO_GRADED_KINDS,
  type GradableItem,
  gradeItem,
  gradeKnowledgeCheck,
  type ItemResponse,
} from './grade-kc';

// Item builders — the answer_key shapes mirror the seeded assessment content.
const mcq = (id: string, safety: boolean, correct: string, w = 1): GradableItem => ({
  id,
  kind: 'mcq',
  is_safety_item: safety,
  mastery_weight: w,
  answer_key: { correct },
});
const numeric = (id: string, safety: boolean, value: number): GradableItem => ({
  id,
  kind: 'numeric',
  is_safety_item: safety,
  mastery_weight: 1,
  answer_key: { value },
});
const resp = (id: string, response: unknown, attempt = 1): ItemResponse => ({
  assessment_item_id: id,
  response,
  attempt,
});

describe('gradeItem — per-kind auto-grading (fail-closed)', () => {
  it('mcq / scenario_branch: exact choice', () => {
    expect(gradeItem(mcq('a', false, 'opt2'), { choice: 'opt2' })).toBe(true);
    expect(gradeItem(mcq('a', false, 'opt2'), { choice: 'opt1' })).toBe(false);
    expect(gradeItem({ ...mcq('a', false, 'x'), kind: 'scenario_branch' }, { choice: 'x' })).toBe(
      true,
    );
  });
  it('multi_select: set equality (order-independent)', () => {
    const item: GradableItem = {
      id: 'm',
      kind: 'multi_select',
      is_safety_item: false,
      mastery_weight: 1,
      answer_key: { correct: ['a', 'b', 'c'] },
    };
    expect(gradeItem(item, { choices: ['c', 'a', 'b'] })).toBe(true);
    expect(gradeItem(item, { choices: ['a', 'b'] })).toBe(false);
    expect(gradeItem(item, { choices: ['a', 'b', 'c', 'd'] })).toBe(false);
  });
  it('numeric: exact value and range', () => {
    expect(gradeItem(numeric('n', true, 100), { value: 100 })).toBe(true);
    expect(gradeItem(numeric('n', true, 100), { value: 99 })).toBe(false);
    const range: GradableItem = {
      id: 'r',
      kind: 'numeric',
      is_safety_item: true,
      mastery_weight: 1,
      answer_key: { min: 40, max: 48 },
    };
    expect(gradeItem(range, { value: 44 })).toBe(true);
    expect(gradeItem(range, { value: 39 })).toBe(false);
  });
  it('order: exact sequence; hotspot: region', () => {
    const ord: GradableItem = {
      id: 'o',
      kind: 'order',
      is_safety_item: false,
      mastery_weight: 1,
      answer_key: { order: ['x', 'y', 'z'] },
    };
    expect(gradeItem(ord, { order: ['x', 'y', 'z'] })).toBe(true);
    expect(gradeItem(ord, { order: ['x', 'z', 'y'] })).toBe(false);
    const hs: GradableItem = {
      id: 'h',
      kind: 'hotspot',
      is_safety_item: true,
      mastery_weight: 1,
      answer_key: { region: 'h-egress' },
    };
    expect(gradeItem(hs, { region: 'h-egress' })).toBe(true);
    expect(gradeItem(hs, { region: 'h-secure' })).toBe(false);
  });
  it('fail-closed: missing/garbage response or answer_key is incorrect, never throws', () => {
    expect(gradeItem(mcq('a', false, 'x'), undefined)).toBe(false);
    expect(gradeItem(mcq('a', false, 'x'), { nope: 1 })).toBe(false);
    expect(gradeItem({ ...mcq('a', false, 'x'), answer_key: null }, { choice: 'x' })).toBe(false);
    expect(gradeItem({ ...mcq('a', false, 'x'), kind: 'open_response' }, { choice: 'x' })).toBe(
      false,
    );
  });
});

describe('gradeKnowledgeCheck — item-level §C gate (safety ≥90%, non-safety ≥80%)', () => {
  // 2 safety items + 5 non-safety items. All-correct baseline.
  const items: GradableItem[] = [
    mcq('s1', true, 'a'),
    mcq('s2', true, 'a'),
    mcq('n1', false, 'a'),
    mcq('n2', false, 'a'),
    mcq('n3', false, 'a'),
    mcq('n4', false, 'a'),
    mcq('n5', false, 'a'),
  ];
  const allCorrect = items.map((i) => resp(i.id, { choice: 'a' }));

  it('100% safety + 100% non-safety → pass', () => {
    const v = gradeKnowledgeCheck(items, allCorrect);
    expect(v.passed).toBe(true);
    expect(v.safety.fraction).toBe(1);
    expect(v.nonSafety.fraction).toBe(1);
  });

  it('one wrong safety item (50% < 90%) → BLOCKED even with perfect non-safety', () => {
    const r = allCorrect.map((x) =>
      x.assessment_item_id === 's1' ? resp('s1', { choice: 'b' }) : x,
    );
    const v = gradeKnowledgeCheck(items, r);
    expect(v.safety.passed).toBe(false);
    expect(v.passed).toBe(false);
  });

  it('one wrong non-safety item (80% == threshold) → still passes (≥, inclusive)', () => {
    const r = allCorrect.map((x) =>
      x.assessment_item_id === 'n1' ? resp('n1', { choice: 'b' }) : x,
    );
    const v = gradeKnowledgeCheck(items, r);
    expect(v.nonSafety.fraction).toBeCloseTo(0.8);
    expect(v.nonSafety.passed).toBe(true);
    expect(v.passed).toBe(true);
  });

  it('two wrong non-safety (60% < 80%) → blocked even with perfect safety', () => {
    const r = allCorrect.map((x) =>
      x.assessment_item_id === 'n1' || x.assessment_item_id === 'n2'
        ? resp(x.assessment_item_id, { choice: 'b' })
        : x,
    );
    const v = gradeKnowledgeCheck(items, r);
    expect(v.nonSafety.passed).toBe(false);
    expect(v.passed).toBe(false);
  });

  it('retry: the LATEST attempt per item is authoritative', () => {
    const v = gradeKnowledgeCheck(items, [
      ...allCorrect,
      resp('s1', { choice: 'b' }, 1), // earlier wrong attempt is ignored
      resp('s1', { choice: 'a' }, 2), // latest correct
    ]);
    expect(v.passed).toBe(true);
  });

  it('mastery_weight is respected in the weighted fraction', () => {
    // one heavy safety item (weight 9) correct + one light (weight 1) wrong → 90% → pass
    const weighted: GradableItem[] = [mcq('s1', true, 'a', 9), mcq('s2', true, 'a', 1)];
    const v = gradeKnowledgeCheck(weighted, [
      resp('s1', { choice: 'a' }),
      resp('s2', { choice: 'b' }),
    ]);
    expect(v.safety.fraction).toBeCloseTo(0.9);
    expect(v.safety.passed).toBe(true);
  });

  it('open_response items are excluded from the auto-graded subsets', () => {
    const withOpen: GradableItem[] = [
      ...items,
      {
        id: 'open',
        kind: 'open_response',
        is_safety_item: false,
        mastery_weight: 1,
        answer_key: null,
      },
    ];
    const v = gradeKnowledgeCheck(withOpen, allCorrect);
    expect(v.perItem.find((p) => p.id === 'open')).toBeUndefined();
    expect(v.passed).toBe(true);
  });

  it('a subset with no items is vacuously satisfied', () => {
    const nonSafetyOnly = items.filter((i) => !i.is_safety_item);
    const v = gradeKnowledgeCheck(nonSafetyOnly, allCorrect);
    expect(v.safety.itemCount).toBe(0);
    expect(v.safety.passed).toBe(true);
    expect(v.passed).toBe(true);
  });

  it('AUTO_GRADED_KINDS excludes open_response', () => {
    expect(AUTO_GRADED_KINDS).not.toContain('open_response');
    expect(AUTO_GRADED_KINDS).toContain('mcq');
  });
});
