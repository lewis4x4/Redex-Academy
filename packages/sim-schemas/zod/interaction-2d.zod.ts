/**
 * interaction-2d.zod.ts — Zod mirror of schemas/interaction-2d.schema.json (engine #5).
 * Runtime validation for the declarative 2D-interaction engine.
 */
import { z } from 'zod';
import { I18nKey, RubricDimension, envelopeForEngine } from './sim-envelope.zod';

const Background = z
  .object({
    r2_key: z.string().optional(),
    schematic_id: z.string().optional(),
    alt_i18n: I18nKey,
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
  })
  .strict();

const Rect = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).strict();

const Region = z
  .object({
    id: z.string().min(1),
    label_i18n: I18nKey.optional(),
    shape: z.enum(['rect', 'polygon']),
    rect: Rect.optional(),
    points: z
      .array(z.tuple([z.number(), z.number()]))
      .min(3)
      .optional(),
  })
  .strict()
  .refine((r) => (r.shape === 'rect' ? !!r.rect : !!r.points), {
    message: 'rect shapes need `rect`; polygon shapes need `points`',
  });

const ItemScoring = z
  .object({
    weight: z.number().min(0).default(1),
    dimension: RubricDimension,
    line_item_key: z.string().optional(),
    safety_flag: z.boolean().default(false),
  })
  .strict()
  .refine((s) => !s.safety_flag || s.dimension === 'safety_compliance', {
    message: "safety_flag item must use dimension 'safety_compliance'",
    path: ['dimension'],
  });

const TextEntry = z.object({ id: z.string().min(1), text_i18n: I18nKey }).strict();

const base = {
  id: z.string().min(1),
  prompt_i18n: I18nKey,
  scoring: ItemScoring,
  feedback_i18n: I18nKey,
};

const DragLabelItem = z
  .object({
    ...base,
    kind: z.enum(['drag-label', 'label']),
    regions: z.array(Region).min(1),
    labels: z.array(TextEntry).min(1),
    answer_key: z.record(z.string()).refine((m) => Object.keys(m).length >= 1),
  })
  .strict();

const MatchItem = z
  .object({
    ...base,
    kind: z.literal('match'),
    left: z.array(TextEntry).min(1),
    right: z.array(TextEntry).min(1),
    answer_key: z.record(z.string()).refine((m) => Object.keys(m).length >= 1),
  })
  .strict();

const SortItem = z
  .object({
    ...base,
    kind: z.literal('sort'),
    elements: z.array(TextEntry).min(2),
    answer_key: z.array(z.string()).min(2),
  })
  .strict();

const HotspotItem = z
  .object({
    ...base,
    kind: z.literal('hotspot'),
    regions: z.array(Region).min(1),
    answer_key: z.array(z.string()).min(1),
  })
  .strict();

const Item = z.discriminatedUnion('kind', [
  DragLabelItem.extend({ kind: z.literal('drag-label') }),
  DragLabelItem.extend({ kind: z.literal('label') }),
  MatchItem,
  SortItem,
  HotspotItem,
]);

export const Interaction2dSpec = z
  .object({
    envelope: envelopeForEngine('interaction_2d'),
    background: Background.optional(),
    items: z.array(Item).min(1),
  })
  .strict()
  // Answer-key referential integrity per item kind.
  .superRefine((spec, ctx) => {
    spec.items.forEach((it, i) => {
      const at = (p: (string | number)[], message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ['items', i, ...p] });
      if (it.kind === 'drag-label' || it.kind === 'label') {
        const labelIds = new Set(it.labels.map((l) => l.id));
        const regionIds = new Set(it.regions.map((r) => r.id));
        for (const [lid, rid] of Object.entries(it.answer_key)) {
          if (!labelIds.has(lid)) at(['answer_key', lid], `answer_key key '${lid}' is not a label`);
          if (!regionIds.has(rid as string))
            at(['answer_key', lid], `answer_key value '${rid}' is not a region`);
        }
      } else if (it.kind === 'match') {
        const L = new Set(it.left.map((x) => x.id));
        const R = new Set(it.right.map((x) => x.id));
        for (const [l, r] of Object.entries(it.answer_key)) {
          if (!L.has(l)) at(['answer_key', l], `answer_key key '${l}' is not in left`);
          if (!R.has(r as string)) at(['answer_key', l], `answer_key value '${r}' is not in right`);
        }
      } else if (it.kind === 'sort') {
        const E = new Set(it.elements.map((x) => x.id));
        it.answer_key.forEach((eid, k) => {
          if (!E.has(eid)) at(['answer_key', k], `answer_key entry '${eid}' is not an element`);
        });
      } else if (it.kind === 'hotspot') {
        const RG = new Set(it.regions.map((r) => r.id));
        it.answer_key.forEach((rid, k) => {
          if (!RG.has(rid)) at(['answer_key', k], `answer_key entry '${rid}' is not a region`);
        });
      }
    });
  });
export type Interaction2dSpec = z.infer<typeof Interaction2dSpec>;
