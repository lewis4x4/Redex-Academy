/**
 * fixture-set.zod.ts — Zod mirror of schemas/fixture-set.schema.json (F5 §11).
 *
 * The R2 manifest a replay engine (#2 device_config, #4 panel_state_machine)
 * loads to drive a FAITHFUL interactive replica of a sanitized recorded device
 * session — NEVER a live API (invariant 6). `source` mirrors academy.fixture_source;
 * `sanitized: true` is the publish gate (DB trigger tg_block_unsanitized_fixture).
 */
import { z } from 'zod';

/** MUST equal academy.fixture_source (migrations/0001_init_academy.sql). */
export const FixtureSource = z.enum([
  'adc_portal',
  'openeye',
  'iq_panel',
  'mercury',
  'dragonfruit',
]);
export type FixtureSource = z.infer<typeof FixtureSource>;

const Rect = z
  .object({
    x: z.number().min(0),
    y: z.number().min(0),
    w: z.number().positive(),
    h: z.number().positive(),
  })
  .strict();

const Hotspot = z
  .object({
    id: z.string().min(1),
    rect: Rect,
    action: z.enum(['navigate', 'set_field']),
    to_screen: z.string().optional(),
    field_id: z.string().optional(),
  })
  .strict();

const FieldMapEntry = z
  .object({
    field_id: z.string().min(1),
    label: z.string().optional(),
    kind: z.enum(['enum', 'integer', 'number', 'boolean', 'text', 'duration_seconds']),
    options: z.array(z.string()).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    recorded_value: z.unknown().optional(),
  })
  .strict();

const Screen = z
  .object({
    id: z.string().min(1),
    ordinal: z.number().int().min(0),
    title: z.string().optional(),
    image_r2_key: z.string().min(1),
    hotspots: z.array(Hotspot).default([]),
    field_map: z.array(FieldMapEntry).default([]),
  })
  .strict();

const SemVer = z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/, 'must be MAJOR.MINOR.PATCH');

export const FixtureSetManifest = z
  .object({
    manifest_version: SemVer,
    fixture_id: z.string().min(3),
    source: FixtureSource,
    label: z.string().optional(),
    version: z.string().min(1),
    sanitized: z.boolean(),
    synthetic: z.boolean().default(false),
    source_citation: z.string().optional(),
    platform_key: z.string().min(1),
    platform_manifest_surface: z.string().optional(),
    screens: z.array(Screen).min(1),
  })
  // tolerate $comment / $schema editor meta keys
  .passthrough()
  .superRefine((m, ctx) => {
    const screenIds = new Set(m.screens.map((s) => s.id));
    const fieldIds = new Set(m.screens.flatMap((s) => s.field_map.map((f) => f.field_id)));
    m.screens.forEach((s, si) => {
      s.hotspots.forEach((h, hi) => {
        if (h.action === 'navigate' && (!h.to_screen || !screenIds.has(h.to_screen))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `hotspot '${h.id}' navigates to missing screen '${String(h.to_screen)}'`,
            path: ['screens', si, 'hotspots', hi, 'to_screen'],
          });
        }
        if (h.action === 'set_field' && (!h.field_id || !fieldIds.has(h.field_id))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `hotspot '${h.id}' sets missing field '${String(h.field_id)}'`,
            path: ['screens', si, 'hotspots', hi, 'field_id'],
          });
        }
      });
    });
  });
export type FixtureSetManifest = z.infer<typeof FixtureSetManifest>;

/** A published sim may only load a sanitized fixture (invariant 6 publish gate). */
export function assertFixtureLoadable(m: FixtureSetManifest): void {
  if (m.sanitized !== true) {
    throw new Error(
      `fixture '${m.fixture_id}' is not sanitized — refusing to load (invariant 6 publish gate)`,
    );
  }
}
