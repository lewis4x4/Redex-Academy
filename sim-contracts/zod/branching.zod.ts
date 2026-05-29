/**
 * branching.zod.ts — Zod mirror of schemas/branching.schema.json (engine #1).
 * Runtime validation for the branching scenario engine. See the JSON Schema for
 * the authoritative authoring contract.
 */
import { z } from "zod";
import { I18nKey, RubricDimension, ColorblindSafeState, envelopeForEngine } from "./sim-envelope.zod";

const MediaRef = z
  .object({
    r2_key: z.string().min(1),
    kind: z.enum(["image", "video", "audio", "schematic"]),
    alt_i18n: I18nKey,
  })
  .strict();

const VerdictMapping = z
  .object({ dimension: RubricDimension, line_item_key: z.string().min(1) })
  .strict();

const Edge = z
  .object({
    id: z.string().min(1),
    label_i18n: I18nKey,
    to: z.string().min(1),
    consequence_i18n: I18nKey,
    score_delta: z.number().default(0),
    safety_flag: z.boolean().default(false),
    is_safety_decision: z.boolean().default(false),
    verdict: VerdictMapping.optional(),
  })
  .strict()
  // A safety_flag edge must be a safety decision (so veto wording + >=90% bar engage).
  .refine((e) => !e.safety_flag || e.is_safety_decision === true, {
    message: "safety_flag edge must also set is_safety_decision: true",
    path: ["is_safety_decision"],
  });

const PromptNodeShape = z
  .object({
    prompt_i18n: I18nKey,
    media: z.array(MediaRef).default([]),
    is_safety_decision: z.boolean().default(false),
    choices: z.array(Edge).min(2),
  });

const Replay = z
  .object({
    freeze_node: z.string().min(1),
    decided_at_node: z.string().min(1),
    overlay_i18n: I18nKey,
  })
  .strict();

/**
 * Discriminated union on `type`. Branches must be plain ZodObjects with a literal
 * discriminator (no .refine() wrapper) — the cross-field rule "safety_veto =>
 * outcome must be fail" is enforced in BranchingSpec.superRefine below.
 */
const Node = z.discriminatedUnion("type", [
  PromptNodeShape.extend({ type: z.literal("situation") }).strict(),
  PromptNodeShape.extend({ type: z.literal("prompt") }).strict(),
  z
    .object({
      type: z.literal("terminal"),
      outcome: z.enum(["pass", "fail"]),
      safety_veto: z.boolean().default(false),
      outcome_i18n: I18nKey,
      media: z.array(MediaRef).default([]),
      state: ColorblindSafeState.optional(),
      replay: Replay.optional(),
    })
    .strict(),
]);

export const BranchingSpec = z
  .object({
    envelope: envelopeForEngine("branching_scenario"),
    start: z.string().min(1),
    nodes: z.record(Node),
  })
  .strict()
  // Referential integrity: start + every edge target must exist; the graph must be >=2 nodes.
  .superRefine((spec, ctx) => {
    const ids = new Set(Object.keys(spec.nodes));
    if (ids.size < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "a scenario needs >= 2 nodes", path: ["nodes"] });
    }
    if (!ids.has(spec.start)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `start '${spec.start}' is not a node`, path: ["start"] });
    }
    for (const [nid, node] of Object.entries(spec.nodes)) {
      if (node.type !== "terminal") {
        node.choices.forEach((c: z.infer<typeof Edge>, i: number) => {
          if (!ids.has(c.to)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `node '${nid}' choice '${c.id}' points to missing node '${c.to}'`,
              path: ["nodes", nid, "choices", i, "to"],
            });
          }
        });
      } else {
        // Cross-field rule: a safety_veto terminal must be a fail.
        if (node.safety_veto && node.outcome !== "fail") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `terminal '${nid}' sets safety_veto:true but outcome is '${node.outcome}' (must be 'fail')`,
            path: ["nodes", nid, "outcome"],
          });
        }
        if (node.replay) {
          for (const ref of [node.replay.freeze_node, node.replay.decided_at_node]) {
            if (!ids.has(ref)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `terminal '${nid}' replay references missing node '${ref}'`,
                path: ["nodes", nid, "replay"],
              });
            }
          }
        }
      }
    }
  });
export type BranchingSpec = z.infer<typeof BranchingSpec>;
