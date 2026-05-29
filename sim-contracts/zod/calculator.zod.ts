/**
 * calculator.zod.ts — Zod mirror of schemas/calculator.schema.json (engine #6).
 * Runtime validation for the parametric calculator engine. The compute path is
 * deterministic + unit-checked + LLM-free: compute_ref names a registered formula;
 * the spec never carries executable math.
 */
import { z } from "zod";
import { I18nKey, RubricDimension, ColorblindSafeState, envelopeForEngine } from "./sim-envelope.zod";

/** The registered, deterministic formulas the engine implements. */
export const ComputeRef = z.enum([
  "poe_power_budget",
  "voltage_drop_will_it_hold",
  "ppf_dori",
  "storage_retention",
]);
export type ComputeRef = z.infer<typeof ComputeRef>;

const InputOption = z.object({ value: z.string(), label_i18n: I18nKey }).strict();

const Input = z
  .object({
    label_i18n: I18nKey,
    type: z.enum(["number", "integer", "enum", "boolean"]),
    unit: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
    default: z.unknown().optional(),
    options: z.array(InputOption).optional(),
  })
  .strict()
  // number/integer inputs must declare a unit (deterministic + unit-checked).
  .refine((i) => !(i.type === "number" || i.type === "integer") || !!i.unit, {
    message: "number/integer inputs must declare a `unit`",
    path: ["unit"],
  })
  .refine((i) => i.type !== "enum" || (i.options?.length ?? 0) > 0, {
    message: "enum inputs must declare `options`",
    path: ["options"],
  });

const Threshold = z
  .object({
    id: z.string().min(1),
    band: z.enum(["pass", "warn", "fail"]),
    op: z.enum([">=", ">", "<=", "<", "==", "between"]),
    value: z.number(),
    value_high: z.number().optional(),
    dimension: RubricDimension,
    line_item_key: z.string().optional(),
    safety_flag: z.boolean().default(false),
    feedback_i18n: I18nKey,
    state: ColorblindSafeState.optional(),
  })
  .strict()
  .refine((t) => !t.safety_flag || t.dimension === "safety_compliance", {
    message: "safety_flag threshold must use dimension 'safety_compliance'",
    path: ["dimension"],
  })
  .refine((t) => t.op !== "between" || typeof t.value_high === "number", {
    message: "op 'between' requires `value_high`",
    path: ["value_high"],
  });

const Meter = z
  .object({
    label_i18n: I18nKey,
    min: z.number(),
    max: z.number(),
    unit: z.string().optional(),
    // Always show the numeric value — colorblind-safety (never color-only fill).
    show_numeric_value: z.literal(true).default(true),
    band_markers: z
      .array(z.object({ at: z.number(), state: ColorblindSafeState }).strict())
      .default([]),
  })
  .strict();

export const CalculatorSpec = z
  .object({
    envelope: envelopeForEngine("calculator"),
    inputs: z.record(Input).refine((i) => Object.keys(i).length >= 1, "at least one input"),
    compute_ref: ComputeRef,
    result_unit: z.string().min(1).optional(),
    thresholds: z.array(Threshold).min(1),
    meter: Meter.optional(),
  })
  // Allow the documentary $computeContract note in example specs without failing strict().
  .passthrough();
export type CalculatorSpec = z.infer<typeof CalculatorSpec>;
