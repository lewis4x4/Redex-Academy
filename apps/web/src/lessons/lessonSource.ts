// M2 lesson data layer. Reads a lesson unit + (for the course) its knowledge_check
// unit and that course version's gradable assessment_items, all through the academy
// PostgREST schema with the learner's JWT — RLS decides visibility; this layer NEVER
// writes state (competency_state promotion is server-only, invariant 2/3). Mirrors
// catalogSource.ts. The knowledge-check item_set is scoped by course_version_id (the
// item_set spans competencies — e.g. AC-102 OSDP + fail-state items), matching the
// server-side grade-knowledge-check function.
import type { GradableItem } from '@redex/sim-engine';
import { supabase } from '../auth/supabaseClient';

const academy = () => supabase.schema('academy');

/** A choice / element / region option for rendering a knowledge-check item. */
export interface ItemOption {
  id: string;
  text: string;
}
/** A renderable knowledge-check item: the gradable fields + the prompt/options to display. */
export interface RenderableItem extends GradableItem {
  prompt: { text: string };
  options?: { choices?: ItemOption[]; elements?: ItemOption[]; regions?: ItemOption[] };
  /** Per-locale prompt/options overrides (academy.assessment_items.locale_variants). */
  locale_variants?: Record<
    string,
    { prompt?: { text: string }; options?: RenderableItem['options'] }
  >;
}

export interface KnowledgeCheckData {
  /** The knowledge_check unit id (passed to grade-knowledge-check). */
  unitId: string;
  /** The course version's gradable items (open_response excluded — AI-graded, M10). */
  items: RenderableItem[];
  /** Optional author-tightened gate (content_ref.gate); the §C item-level bars still apply. */
  gate?: number;
}

export interface LessonData {
  unitId: string;
  courseVersionId: string;
  title: string;
  /** content_ref.mdx_key → the committed MDX body key. */
  mdxKey: string | null;
  /** The course's knowledge check (null if the course has none, e.g. AC-202). */
  knowledgeCheck: KnowledgeCheckData | null;
}

type UnitRow = {
  id: string;
  course_version_id: string;
  title: string;
  kind: string;
  content_ref: Record<string, unknown> | null;
};
type ItemRow = {
  id: string;
  kind: GradableItem['kind'];
  is_safety_item: boolean;
  mastery_weight: number;
  answer_key: unknown;
  prompt: { text: string };
  options: RenderableItem['options'] | null;
  locale_variants: RenderableItem['locale_variants'] | null;
};

const refStr = (ref: Record<string, unknown> | null, key: string): string | null =>
  ref && typeof ref[key] === 'string' ? (ref[key] as string) : null;
const refNum = (ref: Record<string, unknown> | null, key: string): number | undefined =>
  ref && typeof ref[key] === 'number' ? (ref[key] as number) : undefined;

/**
 * Load everything a lesson screen renders: the lesson unit + (for its course
 * version) the knowledge_check unit and the gradable items. Throws on a transport
 * error (surfaced as an ErrorState by the screen).
 */
export async function loadLesson(unitId: string): Promise<LessonData> {
  const unitRes = await academy()
    .from('units')
    .select('id, course_version_id, title, kind, content_ref')
    .eq('id', unitId)
    .maybeSingle();
  if (unitRes.error) throw new Error(`lesson read failed: ${unitRes.error.message}`);
  if (!unitRes.data) throw new Error('lesson not found');
  const unit = unitRes.data as UnitRow;
  const cvId = unit.course_version_id;

  // The course version's knowledge_check unit (if any) + its gradable item_set.
  const [kcUnitRes, itemsRes] = await Promise.all([
    academy()
      .from('units')
      .select('id, course_version_id, title, kind, content_ref')
      .eq('course_version_id', cvId)
      .eq('kind', 'knowledge_check')
      .maybeSingle(),
    academy()
      .from('assessment_items')
      .select(
        'id, kind, is_safety_item, mastery_weight, answer_key, prompt, options, locale_variants',
      )
      .eq('course_version_id', cvId)
      .neq('kind', 'open_response'),
  ]);
  if (itemsRes.error) throw new Error(`items read failed: ${itemsRes.error.message}`);

  const kcUnit = (kcUnitRes.data as UnitRow | null) ?? null;
  let knowledgeCheck: KnowledgeCheckData | null = null;
  if (kcUnit) {
    const items: RenderableItem[] = ((itemsRes.data as ItemRow[] | null) ?? []).map((r) => ({
      id: r.id,
      kind: r.kind,
      is_safety_item: r.is_safety_item,
      mastery_weight: r.mastery_weight,
      answer_key: r.answer_key,
      prompt: r.prompt ?? { text: '' },
      options: r.options ?? undefined,
      locale_variants: r.locale_variants ?? undefined,
    }));
    knowledgeCheck = { unitId: kcUnit.id, items, gate: refNum(kcUnit.content_ref, 'gate') };
  }

  return {
    unitId: unit.id,
    courseVersionId: cvId,
    title: unit.title,
    mdxKey: refStr(unit.content_ref, 'mdx_key'),
    knowledgeCheck,
  };
}
