/**
 * sim-envelope.zod.ts
 *
 * Zod mirror of shared/sim-envelope.schema.json — the COMMON envelope every
 * Redex sim spec embeds (ledger §E). The runtime (packages/sim-engine) validates
 * specs against these at load (`loadSpec`); the JSON Schemas are the published
 * authoring/CI contract and these Zod schemas are the runtime guard. The two MUST
 * stay in lockstep (a CI test asserts they agree; if they ever diverge, the JSON
 * Schema is authoritative for authors and this file is fixed to match).
 *
 * This file carries, in one place:
 *   - engine_kind (= academy.sim_kind Postgres enum values),
 *   - the i18n string-key layer,
 *   - the scoring + safety-veto hook (mirrors academy.tg_signoff_compute_outcome),
 *   - the xAPI telemetry event contract (with client_event_uuid for idempotent sync),
 *   - the colorblind-safe state contract (shape + text + color, never color alone).
 */
import { z } from "zod";

/**
 * engine_kind — MUST equal the academy.sim_kind Postgres enum values in
 * migrations/0001_init_academy.sql (sim_definitions.kind). Keep in sync via a
 * migration + typegen, never hand-drift.
 */
export const EngineKind = z.enum([
  "branching_scenario",
  "device_config",
  "webgl_install",
  "panel_state_machine",
  "interaction_2d",
  "calculator",
]);
export type EngineKind = z.infer<typeof EngineKind>;

/** i18n string key into packages/i18n. Never raw display text. */
export const I18nKey = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, "i18n key must be dotted lowercase tokens");
export type I18nKey = z.infer<typeof I18nKey>;

/** A competency UUID (academy.competencies.id). */
export const CompetencyId = z.string().uuid();

/** The four §5.4 rubric dimensions (academy.signoff_dimension). */
export const RubricDimension = z.enum([
  "safety_compliance",
  "technical_execution",
  "verification_documentation",
  "independence_judgment",
]);
export type RubricDimension = z.infer<typeof RubricDimension>;

/**
 * Colorblind-safe state token (invariant 7). State is NEVER color alone: `shape`
 * and `label_i18n` are load-bearing; `color_role` is advisory.
 */
export const ColorblindSafeState = z
  .object({
    token: z.enum(["pass", "fail", "warn", "neutral", "safety_veto"]),
    shape: z.enum(["check", "cross", "triangle", "octagon", "circle", "square", "diamond"]),
    label_i18n: I18nKey,
    color_role: z.enum(["success", "danger", "warning", "info", "muted"]).optional(),
  })
  .strict();
export type ColorblindSafeState = z.infer<typeof ColorblindSafeState>;

/**
 * The scoring + safety-veto hook. Spec-level mirror of the DB safety rule
 * (ledger §B / invariant 1): a single safety-flagged failure vetoes a pass,
 * non-overridable. The shared Verdict service reads this so behavior + feedback
 * wording is identical across all six engines.
 */
export const SafetyVetoHook = z
  .object({
    pass_threshold: z.number().min(0).max(1).default(0.8),
    safety_pass_threshold: z.number().min(0).max(1).default(0.9),
    veto_on_any_safety_failure: z.boolean().default(true),
    veto_feedback_i18n: I18nKey.optional(),
    veto_state: ColorblindSafeState.optional(),
  })
  .strict();
export type SafetyVetoHook = z.infer<typeof SafetyVetoHook>;

const XAPI_EXT = {
  safetyVeto: "https://academy.goredex.com/xapi/ext/safety_veto_triggered",
  orgId: "https://academy.goredex.com/xapi/ext/org_id",
  simDefId: "https://academy.goredex.com/xapi/ext/sim_definition_id",
  offlineOrigin: "https://academy.goredex.com/xapi/ext/offline_origin",
  engineKind: "https://academy.goredex.com/xapi/ext/engine_kind",
} as const;
export { XAPI_EXT };

/**
 * The xAPI telemetry event contract. The shared emitter (F5) constructs these,
 * queues them offline (Dexie), and flushes via F4. client_event_uuid is THE
 * idempotency key (ledger §G) → maps to sim_telemetry_events.client_event_uuid
 * (UNIQUE; /sync is ON CONFLICT DO NOTHING). result.extensions[safety_veto] maps
 * to sim_attempts.safety_veto_triggered. Authoritative mastery is server-side
 * (invariant 4 — never fake a pass offline).
 */
export const XapiTelemetryEvent = z
  .object({
    client_event_uuid: z.string().uuid(),
    actor: z
      .object({
        objectType: z.literal("Agent").optional(),
        account: z
          .object({ homePage: z.string().url(), name: z.string() })
          .strict(),
      })
      .strict(),
    verb: z
      .object({ id: z.string().url(), display: z.record(z.string()).optional() })
      .strict(),
    object: z
      .object({
        id: z.string().url(),
        objectType: z.enum(["Activity"]).optional(),
        definition: z
          .object({
            type: z.string().url().optional(),
            name: z.record(z.string()).optional(),
          })
          .passthrough()
          .optional(),
      })
      .strict(),
    result: z
      .object({
        success: z.boolean().optional(),
        completion: z.boolean().optional(),
        score: z
          .object({
            scaled: z.number().min(-1).max(1).optional(),
            raw: z.number().optional(),
            min: z.number().optional(),
            max: z.number().optional(),
          })
          .strict()
          .optional(),
        response: z.string().optional(),
        extensions: z.record(z.unknown()).optional(),
      })
      .strict()
      .optional(),
    context: z
      .object({
        registration: z.string().uuid().optional(),
        extensions: z.record(z.unknown()).optional(),
      })
      .strict()
      .optional(),
    timestamp: z.string().datetime({ offset: true }).optional(),
  })
  .strict();
export type XapiTelemetryEvent = z.infer<typeof XapiTelemetryEvent>;

const SemVer = z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/, "must be MAJOR.MINOR.PATCH");
const LocaleTag = z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/);

/**
 * The embedded common header. Every engine spec includes this under `envelope`.
 * Engine specs further pin engine_kind to their own value (see each engine zod).
 */
export const SimEnvelope = z
  .object({
    spec_version: SemVer,
    sim_id: z
      .string()
      .min(3)
      .regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/, "sim_id must be dotted/dashed lowercase"),
    engine_kind: EngineKind,
    title_i18n: I18nKey,
    competency_ids: z.array(CompetencyId).min(1),
    locales: z
      .array(LocaleTag)
      .min(1)
      .refine((ls) => ls.includes("en"), "locales must include 'en'")
      .default(["en", "es"]),
    i18n_string_keys: z.array(I18nKey).default([]),
    scoring: SafetyVetoHook,
    emits_verbs: z
      .array(z.string().url())
      .default([
        "http://adlnet.gov/expapi/verbs/attempted",
        "http://adlnet.gov/expapi/verbs/answered",
        "http://adlnet.gov/expapi/verbs/completed",
        "https://academy.goredex.com/xapi/verbs/triggered-safety-veto",
      ]),
    state_tokens: z.array(ColorblindSafeState).default([]),
    fixture_set_ref: z.string().nullable().default(null),
    offline_cacheable: z.boolean().default(true),
  })
  .strict();
export type SimEnvelope = z.infer<typeof SimEnvelope>;

/**
 * Builds an envelope schema pinned to a specific engine_kind (used by each engine
 * spec so a branching spec cannot claim engine_kind: 'calculator', etc.).
 */
export function envelopeForEngine<K extends EngineKind>(kind: K) {
  return SimEnvelope.extend({ engine_kind: z.literal(kind) });
}
