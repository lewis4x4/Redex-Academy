// Deno unit test for the server-side knowledge-check scorer (no network / no DB).
// Proves (1) the gate math (safety >=90%, non-safety >=80%) and (2) that this Deno
// mirror agrees BYTE-FOR-BYTE with the browser scorer (packages/sim-engine) on
// shared fixtures — so the client's instant pass/retry feedback can never disagree
// with the server-authoritative verdict.
//   deno test --config supabase/functions/deno.json supabase/functions/grade-knowledge-check/grade-kc.test.ts
import { assert, assertEquals } from '@std/assert';
import { type GradableItem, gradeKnowledgeCheck, type ItemResponse } from './grade-kc.ts';
import { gradeKnowledgeCheck as clientGrade } from '../../../packages/sim-engine/src/knowledge-check/grade-kc.ts';

const mcq = (id: string, safety: boolean, correct: string): GradableItem => ({
  id,
  kind: 'mcq',
  is_safety_item: safety,
  mastery_weight: 1,
  answer_key: { correct },
});
const resp = (id: string, choice: string, attempt = 1): ItemResponse => ({
  assessment_item_id: id,
  response: { choice },
  attempt,
});

// 2 safety + 5 non-safety items.
const items: GradableItem[] = [
  mcq('s1', true, 'a'),
  mcq('s2', true, 'a'),
  mcq('n1', false, 'a'),
  mcq('n2', false, 'a'),
  mcq('n3', false, 'a'),
  mcq('n4', false, 'a'),
  mcq('n5', false, 'a'),
];
const allCorrect = items.map((i) => resp(i.id, 'a'));

Deno.test('all correct → pass (safety 100%, non-safety 100%)', () => {
  const v = gradeKnowledgeCheck(items, allCorrect);
  assertEquals(v.passed, true);
});

Deno.test('one wrong safety item (50% < 90%) → BLOCKED even with perfect non-safety', () => {
  const r = allCorrect.map((x) => (x.assessment_item_id === 's1' ? resp('s1', 'b') : x));
  const v = gradeKnowledgeCheck(items, r);
  assertEquals(v.safety.passed, false);
  assertEquals(v.passed, false);
});

Deno.test('non-safety at exactly 80% passes; below 80% blocks', () => {
  const oneWrong = allCorrect.map((x) => (x.assessment_item_id === 'n1' ? resp('n1', 'b') : x));
  assertEquals(gradeKnowledgeCheck(items, oneWrong).passed, true); // 4/5 = 80%
  const twoWrong = oneWrong.map((x) => (x.assessment_item_id === 'n2' ? resp('n2', 'b') : x));
  assertEquals(gradeKnowledgeCheck(items, twoWrong).nonSafety.passed, false); // 3/5 = 60%
});

Deno.test('retry: the latest attempt per item is authoritative', () => {
  const v = gradeKnowledgeCheck(items, [...allCorrect, resp('s1', 'b', 1), resp('s1', 'a', 2)]);
  assertEquals(v.passed, true);
});

Deno.test('LOCKSTEP: the Deno mirror agrees byte-for-byte with the browser scorer', () => {
  // a mixed fixture: one safety wrong, two non-safety wrong, plus a retry
  const mixed = [
    resp('s1', 'a'),
    resp('s2', 'b'),
    resp('n1', 'a'),
    resp('n2', 'b'),
    resp('n3', 'b'),
    resp('n4', 'a'),
    resp('n5', 'a'),
    resp('s2', 'a', 2), // retry fixes s2
  ];
  const server = gradeKnowledgeCheck(items, mixed);
  const client = clientGrade(items as never, mixed as never);
  assertEquals(JSON.stringify(server), JSON.stringify(client));
  assert(!server.passed); // n2 + n3 wrong → non-safety 60% < 80%
});
