// ============================================================================
// grade-kc.ts (Deno) — VERBATIM mirror of packages/sim-engine/src/knowledge-check/
// grade-kc.ts. Kept in lockstep (the score.ts <-> verdict.ts pattern): the client
// grades locally for instant pass/retry feedback; THIS copy is what the server-only
// grade-knowledge-check function re-derives the authoritative verdict from. The
// grade-kc.test.ts in this dir asserts byte-for-byte agreement with the client
// scorer on shared fixtures, so the two can never silently drift.
//
// Item-level §C gate: split by is_safety_item, safety >= 90%, non-safety >= 80%,
// pass only when BOTH clear. open_response is AI-graded (M10) and excluded.
// ============================================================================

export type AssessmentKind =
  | 'mcq'
  | 'multi_select'
  | 'numeric'
  | 'open_response'
  | 'order'
  | 'hotspot'
  | 'scenario_branch';

export const AUTO_GRADED_KINDS: readonly AssessmentKind[] = [
  'mcq',
  'multi_select',
  'numeric',
  'order',
  'hotspot',
  'scenario_branch',
];

export const SAFETY_THRESHOLD = 0.9;
export const NON_SAFETY_THRESHOLD = 0.8;

export interface GradableItem {
  id: string;
  kind: AssessmentKind;
  is_safety_item: boolean;
  mastery_weight: number;
  answer_key: unknown;
}

export interface ItemResponse {
  assessment_item_id: string;
  response: unknown;
  attempt: number;
}

export interface SubsetScore {
  weightedCorrect: number;
  weightedTotal: number;
  fraction: number;
  itemCount: number;
  threshold: number;
  passed: boolean;
}

export interface KnowledgeCheckVerdict {
  safety: SubsetScore;
  nonSafety: SubsetScore;
  passed: boolean;
  perItem: { id: string; is_safety_item: boolean; correct: boolean; answered: boolean }[];
}

export interface GradeOptions {
  safetyThreshold?: number;
  nonSafetyThreshold?: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const sameSet = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  return b.every((x) => sa.has(x)) && a.every((x) => new Set(b).has(x));
};

const sameOrder = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

const asStringArray = (v: unknown): string[] | null =>
  Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null;

export function gradeItem(item: GradableItem, response: unknown): boolean {
  const key = item.answer_key;
  if (!isRecord(key)) return false;

  switch (item.kind) {
    case 'mcq':
    case 'scenario_branch': {
      const choice = isRecord(response) ? response.choice : undefined;
      return typeof key.correct === 'string' && choice === key.correct;
    }
    case 'multi_select': {
      const correct = asStringArray(key.correct);
      const chosen = isRecord(response) ? asStringArray(response.choices) : null;
      return correct !== null && chosen !== null && sameSet(correct, chosen);
    }
    case 'numeric': {
      const val = isRecord(response) ? response.value : undefined;
      if (typeof val !== 'number' || Number.isNaN(val)) return false;
      if (typeof key.min === 'number' && typeof key.max === 'number') {
        return val >= key.min && val <= key.max;
      }
      if (typeof key.value === 'number') {
        const tol = typeof key.tolerance === 'number' ? key.tolerance : 0;
        return Math.abs(val - key.value) <= tol;
      }
      return false;
    }
    case 'order': {
      const correct = asStringArray(key.order);
      const got = isRecord(response) ? asStringArray(response.order) : null;
      return correct !== null && got !== null && sameOrder(correct, got);
    }
    case 'hotspot': {
      const region = isRecord(response) ? response.region : undefined;
      return typeof key.region === 'string' && region === key.region;
    }
    case 'open_response':
      return false;
    default:
      return false;
  }
}

function latestPerItem(responses: ItemResponse[]): Map<string, ItemResponse> {
  const out = new Map<string, ItemResponse>();
  for (const r of responses) {
    const prev = out.get(r.assessment_item_id);
    if (!prev || r.attempt >= prev.attempt) out.set(r.assessment_item_id, r);
  }
  return out;
}

function scoreSubset(
  items: GradableItem[],
  latest: Map<string, ItemResponse>,
  threshold: number,
): { subset: SubsetScore; perItem: KnowledgeCheckVerdict['perItem'] } {
  let weightedCorrect = 0;
  let weightedTotal = 0;
  const perItem: KnowledgeCheckVerdict['perItem'] = [];
  for (const item of items) {
    const weight = item.mastery_weight > 0 ? item.mastery_weight : 1;
    weightedTotal += weight;
    const r = latest.get(item.id);
    const answered = r !== undefined;
    const correct = answered && gradeItem(item, r.response);
    if (correct) weightedCorrect += weight;
    perItem.push({ id: item.id, is_safety_item: item.is_safety_item, correct, answered });
  }
  const fraction = weightedTotal === 0 ? 1 : weightedCorrect / weightedTotal;
  return {
    subset: {
      weightedCorrect,
      weightedTotal,
      fraction,
      itemCount: items.length,
      threshold,
      passed: fraction >= threshold,
    },
    perItem,
  };
}

export function gradeKnowledgeCheck(
  items: GradableItem[],
  responses: ItemResponse[],
  opts: GradeOptions = {},
): KnowledgeCheckVerdict {
  const safetyThreshold = opts.safetyThreshold ?? SAFETY_THRESHOLD;
  const nonSafetyThreshold = opts.nonSafetyThreshold ?? NON_SAFETY_THRESHOLD;
  const gradable = items.filter((i) => i.kind !== 'open_response');
  const latest = latestPerItem(responses);

  const safetyItems = gradable.filter((i) => i.is_safety_item);
  const nonSafetyItems = gradable.filter((i) => !i.is_safety_item);

  const safety = scoreSubset(safetyItems, latest, safetyThreshold);
  const nonSafety = scoreSubset(nonSafetyItems, latest, nonSafetyThreshold);

  return {
    safety: safety.subset,
    nonSafety: nonSafety.subset,
    passed: safety.subset.passed && nonSafety.subset.passed,
    perItem: [...safety.perItem, ...nonSafety.perItem],
  };
}
