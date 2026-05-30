/**
 * Preview / sandbox harness (F5 §6). M9 authoring uses this to render ANY valid
 * spec; it validates against the published JSON-Schema/Zod contract BEFORE load and
 * surfaces a clear error for an invalid spec (rather than rendering garbage). A
 * thin wrapper over loadSpec that separates "is this spec valid?" from "run it".
 */
import { validateSpec } from '@redex/sim-schemas';
import type { LoadSpecOptions } from '../api';
import { type AnySimInstance, loadSpec } from '../loadSpec';

export type PreviewResult = { ok: true; instance: AnySimInstance } | { ok: false; error: string };

/** Validate-then-load. Returns a typed error for an invalid spec (never throws). */
export function previewSpec(spec: unknown, opts: LoadSpecOptions = {}): PreviewResult {
  try {
    validateSpec(spec); // explicit gate first → clear authoring error
    return { ok: true, instance: loadSpec(spec, opts) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** True iff the spec passes the published contract (cheap validity check for M9). */
export function isValidSpec(spec: unknown): boolean {
  try {
    validateSpec(spec);
    return true;
  } catch {
    return false;
  }
}
