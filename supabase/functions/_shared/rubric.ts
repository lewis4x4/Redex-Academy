// ============================================================================
// supabase/functions/_shared/rubric.ts  (Deno) — M6
//
// The §5.4 sign-off pass-rule + the template→line-item materializer. This is the
// EDGE-FUNCTION layer of the three-layer safety veto (DB trigger + Edge Fn + UI).
//
// computeSignoffOutcome MIRRORS the DB trigger academy.tg_signoff_compute_outcome
// (migrations/0001 §12a) EXACTLY — KEEP IN LOCKSTEP. The trigger is the trust
// boundary: if this function and the trigger ever disagree, the trigger WINS by
// rejecting the write (it raises check_violation when status='signed' but the
// rubric is not a pass). This function recomputing it is required defense-in-depth,
// never the sole gate.
//
// The pass rule (ledger §B / CLAUDE.md invariant 1), non-overridable:
//   pass  ⟺  there is ≥1 line item
//            AND every is_critical_safety line scores ≥ 2  (and none scores 0)
//            AND every PRESENT dimension's MIN score ≥ 2
//   a single is_critical_safety line scoring 0 ⇒ fail, dominating everything.
// ============================================================================

export type SignoffDimension =
  | 'safety_compliance'
  | 'technical_execution'
  | 'verification_documentation'
  | 'independence_judgment';

export type SignoffOutcome = 'pass' | 'fail';

export interface RubricLine {
  dimension: SignoffDimension;
  line_item_key: string;
  score: number; // 0..3
  is_critical_safety: boolean;
}

/** A row from academy.signoff_line_item_templates (the canonical per-course rubric). */
export interface TemplateLine {
  line_item_key: string;
  dimension: SignoffDimension;
  is_critical_safety: boolean;
  ordinal: number;
}

/**
 * Compute the sign-off outcome from the scored line items — the EXACT mirror of
 * academy.tg_signoff_compute_outcome. A single critical-safety 0 vetoes (fail),
 * non-overridable; otherwise pass iff every dimension MIN ≥2 and every safety line ≥2.
 * No line items ⇒ fail (a sign-off with no rubric can never pass).
 */
export function computeSignoffOutcome(lines: readonly RubricLine[]): SignoffOutcome {
  if (lines.length === 0) return 'fail';

  const safety = lines.filter((l) => l.is_critical_safety);
  const hasSafetyZero = safety.some((l) => l.score === 0);
  if (hasSafetyZero) return 'fail'; // the veto dominates everything

  const allSafetyOk = safety.every((l) => l.score >= 2); // vacuously true if no safety lines

  // every PRESENT dimension's MIN score ≥ 2
  const minByDim = new Map<SignoffDimension, number>();
  for (const l of lines) {
    const prev = minByDim.get(l.dimension);
    minByDim.set(l.dimension, prev === undefined ? l.score : Math.min(prev, l.score));
  }
  const allDimsOk = [...minByDim.values()].every((m) => m >= 2);

  return allSafetyOk && allDimsOk ? 'pass' : 'fail';
}

/** True iff a single critical-safety line scored 0 (the dominating veto). */
export function safetyVetoTriggered(lines: readonly RubricLine[]): boolean {
  return lines.some((l) => l.is_critical_safety && l.score === 0);
}

export type MaterializeResult =
  | { ok: true; lines: RubricLine[] }
  | { ok: false; reason: string };

/**
 * Materialize signoff_line_items from the course's TEMPLATE rows, applying the
 * evaluator's submitted scores by line_item_key. dimension + is_critical_safety
 * come from the TEMPLATE (authoritative) — NEVER from the client — so a client can
 * neither drop a critical-safety line nor unflag it (the veto cannot be dodged).
 * Requires a valid 0..3 score for EVERY template line; rejects unknown keys.
 */
export function materializeLineItems(
  templates: readonly TemplateLine[],
  scoresByKey: Record<string, number>,
): MaterializeResult {
  if (templates.length === 0) return { ok: false, reason: 'no_rubric_for_course' };

  const templateKeys = new Set(templates.map((t) => t.line_item_key));
  for (const key of Object.keys(scoresByKey)) {
    if (!templateKeys.has(key)) return { ok: false, reason: `unknown_line_item:${key}` };
  }

  const lines: RubricLine[] = [];
  for (const t of templates) {
    const score = scoresByKey[t.line_item_key];
    if (score === undefined || score === null) {
      return { ok: false, reason: `missing_score:${t.line_item_key}` };
    }
    if (!Number.isInteger(score) || score < 0 || score > 3) {
      return { ok: false, reason: `score_out_of_range:${t.line_item_key}` };
    }
    // dimension + is_critical_safety are TEMPLATE-authoritative (never client).
    lines.push({
      line_item_key: t.line_item_key,
      dimension: t.dimension,
      is_critical_safety: t.is_critical_safety,
      score,
    });
  }
  return { ok: true, lines };
}
