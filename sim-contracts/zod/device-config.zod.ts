/**
 * device-config.zod.ts — Zod mirror of schemas/device-config.schema.json (engine #2).
 * Runtime validation for the device-config state-machine engine.
 */
import { z } from "zod";
import { I18nKey, RubricDimension, envelopeForEngine } from "./sim-envelope.zod";

const Device = z
  .object({
    model_i18n: I18nKey.optional(),
    platform_key: z.string().min(1),
    source_citation: z.string().optional(),
  })
  .strict();

const Screen = z
  .object({
    id: z.string().min(1),
    title_i18n: I18nKey,
    fixture_image_r2_key: z.string().optional(),
    field_ids: z.array(z.string()).default([]),
    ordinal: z.number().int().min(0).optional(),
  })
  .strict();

const FieldOption = z
  .object({ value: z.string(), label_i18n: I18nKey })
  .strict();

const Field = z
  .object({
    label_i18n: I18nKey,
    type: z.enum(["enum", "integer", "number", "boolean", "text", "duration_seconds"]),
    options: z.array(FieldOption).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    unit: z.string().optional(),
    default: z.unknown().optional(),
    required_field: z.boolean().default(false),
  })
  .strict();

const AssertionRule = z
  .object({
    id: z.string().min(1),
    description_i18n: I18nKey,
    /**
     * Deterministic predicate string. Grammar whitelist: field('id'), literals,
     * == != > < >= <= && || !, reassigned_before('a','b'), set_before('a','b').
     * Evaluated only by the engine's rule interpreter — never eval().
     */
    expr: z.string().min(1),
    dimension: RubricDimension,
    line_item_key: z.string().optional(),
    weight: z.number().min(0).default(1),
    safety_flag: z.boolean().default(false),
    fail_feedback_i18n: I18nKey,
  })
  .strict()
  // A safety_flag rule must score into safety_compliance (consistent veto + >=90% bar).
  .refine((r) => !r.safety_flag || r.dimension === "safety_compliance", {
    message: "safety_flag rule must use dimension 'safety_compliance'",
    path: ["dimension"],
  });

export const DeviceConfigSpec = z
  .object({
    envelope: envelopeForEngine("device_config"),
    device: Device.optional(),
    screens: z.array(Screen).min(1),
    fields: z.record(Field).refine((f) => Object.keys(f).length >= 1, "at least one field"),
    assertion_rules: z.array(AssertionRule).min(1),
  })
  .strict()
  // Referential integrity: screen field_ids + assertion field('…') refs must exist.
  .superRefine((spec, ctx) => {
    const fieldIds = new Set(Object.keys(spec.fields));
    spec.screens.forEach((s, si) => {
      s.field_ids.forEach((fid, fi) => {
        if (!fieldIds.has(fid)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `screen '${s.id}' references missing field '${fid}'`,
            path: ["screens", si, "field_ids", fi],
          });
        }
      });
    });
    const fieldRefRe = /field\(\s*'([^']+)'\s*\)/g;
    spec.assertion_rules.forEach((r, ri) => {
      let m: RegExpExecArray | null;
      fieldRefRe.lastIndex = 0;
      while ((m = fieldRefRe.exec(r.expr))) {
        if (!fieldIds.has(m[1])) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `assertion '${r.id}' references missing field '${m[1]}'`,
            path: ["assertion_rules", ri, "expr"],
          });
        }
      }
    });
  });
export type DeviceConfigSpec = z.infer<typeof DeviceConfigSpec>;
