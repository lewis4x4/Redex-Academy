import { describe, expect, it, vi } from 'vitest';

// A tiny PostgREST query-builder stub: each from(table) call returns a chainable
// builder; the terminal is maybeSingle() (single row) or the thenable (a list). We
// route by table + the filters applied so loadLesson's two reads resolve correctly.
const h = vi.hoisted(() => ({
  unitById: null as Record<string, unknown> | null,
  kcUnit: null as Record<string, unknown> | null,
  items: [] as Record<string, unknown>[],
}));

function makeBuilder(table: string) {
  const filters: Record<string, string> = {};
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: (col: string, val: string) => {
      filters[col] = val;
      return builder;
    },
    neq: () => builder,
    maybeSingle: async () => {
      if (table === 'units' && filters.id) return { data: h.unitById, error: null };
      if (table === 'units' && filters.kind === 'knowledge_check')
        return { data: h.kcUnit, error: null };
      return { data: null, error: null };
    },
    // assessment_items resolves via the thenable (a list, no maybeSingle)
    then: (resolve: (r: { data: unknown; error: null }) => void) =>
      resolve({ data: h.items, error: null }),
  };
  return builder;
}

vi.mock('../auth/supabaseClient', () => ({
  supabase: { schema: () => ({ from: (t: string) => makeBuilder(t) }) },
}));

import { loadLesson } from './lessonSource';

const CV = '000000c2-0000-0000-0000-00000000000e';
const KC_UNIT = '000000c3-000e-0000-0000-000000000005';

describe('loadLesson — knowledge-check resolution (the course-player KC reuse)', () => {
  it('returns knowledgeCheck.items for a unit whose OWN kind is knowledge_check', async () => {
    // The open question: the course-player calls loadLesson(kcUnitId). loadLesson reads
    // the unit by id (any kind), then resolves the KC unit + items by course_version_id —
    // so a KC-kind unit id still yields the knowledgeCheck (it has no mdx_key).
    h.unitById = {
      id: KC_UNIT,
      course_version_id: CV,
      title: 'Mag-Lock, REX & Egress Knowledge Check',
      kind: 'knowledge_check',
      content_ref: { item_set: 'ac-203', gate: 0.9 },
    };
    h.kcUnit = {
      id: KC_UNIT,
      course_version_id: CV,
      title: 'Mag-Lock, REX & Egress Knowledge Check',
      kind: 'knowledge_check',
      content_ref: { item_set: 'ac-203', gate: 0.9 },
    };
    h.items = [
      {
        id: 'a5-1',
        kind: 'mcq',
        is_safety_item: true,
        mastery_weight: 1,
        answer_key: { correct: 'a' },
        prompt: { text: 'A mag lock holds the door shut by…' },
        options: { choices: [{ id: 'a', text: 'being powered' }] },
        locale_variants: {},
      },
      {
        id: 'a5-3',
        kind: 'mcq',
        is_safety_item: false,
        mastery_weight: 1,
        answer_key: { correct: 'a' },
        prompt: { text: 'The Black lead lands on…' },
        options: { choices: [{ id: 'a', text: '24V supply' }] },
        locale_variants: {},
      },
    ];

    const lesson = await loadLesson(KC_UNIT);
    expect(lesson.unitId).toBe(KC_UNIT);
    expect(lesson.courseVersionId).toBe(CV);
    // KC units carry no mdx_key (they are not MDX bodies)
    expect(lesson.mdxKey).toBeNull();
    // the knowledgeCheck IS returned, scoped by course_version_id (the gotcha path)
    expect(lesson.knowledgeCheck).not.toBeNull();
    expect(lesson.knowledgeCheck?.unitId).toBe(KC_UNIT);
    expect(lesson.knowledgeCheck?.items).toHaveLength(2);
    expect(lesson.knowledgeCheck?.gate).toBe(0.9);
    // both safety + non-safety items are present (the split mastery bars are exercised)
    expect(lesson.knowledgeCheck?.items.some((i) => i.is_safety_item)).toBe(true);
    expect(lesson.knowledgeCheck?.items.some((i) => !i.is_safety_item)).toBe(true);
  });
});
