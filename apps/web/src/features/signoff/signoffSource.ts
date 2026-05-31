// M6 sign-off data layer + the UI-side veto PREVIEW (layer 3 of the three-layer
// safety veto — UX only; the DB trigger + the finalize-signoff Edge Function are the
// real boundaries). Reads the per-course rubric template (RLS-readable catalog),
// previews the outcome with the SAME rule the trigger/Edge-Fn use, and invokes the
// service-role finalize. NEVER finalizes on the client — invariant 3.

import { supabase } from '../../auth/supabaseClient';

export type SignoffDimension =
  | 'safety_compliance'
  | 'technical_execution'
  | 'verification_documentation'
  | 'independence_judgment';

/** A rubric template line (academy.signoff_line_item_templates) — the catalog. */
export interface RubricTemplateLine {
  line_item_key: string;
  dimension: SignoffDimension;
  is_critical_safety: boolean;
  ordinal: number;
  label: string;
}

export interface ScoredLine {
  dimension: SignoffDimension;
  is_critical_safety: boolean;
  score: number; // 0..3
}

export type SignoffOutcome = 'pass' | 'fail';

/**
 * The UI veto PREVIEW — a faithful copy of academy.tg_signoff_compute_outcome (and
 * _shared/rubric.computeSignoffOutcome): pass iff ≥1 line AND every present
 * dimension's MIN ≥2 AND every critical-safety line ≥2; a single critical-safety 0
 * vetoes. This is layer 3 (UX) — it shows the evaluator the verdict before they
 * submit and BLOCKS signing-as-pass through a veto; the server recomputes + is
 * authoritative (a client can never sign through a 0 here).
 */
export function previewOutcome(lines: readonly ScoredLine[]): {
  outcome: SignoffOutcome;
  safetyVeto: boolean;
} {
  if (lines.length === 0) return { outcome: 'fail', safetyVeto: false };
  const safety = lines.filter((l) => l.is_critical_safety);
  const safetyVeto = safety.some((l) => l.score === 0);
  if (safetyVeto) return { outcome: 'fail', safetyVeto: true };
  const allSafetyOk = safety.every((l) => l.score >= 2);
  const minByDim = new Map<SignoffDimension, number>();
  for (const l of lines) {
    const prev = minByDim.get(l.dimension);
    minByDim.set(l.dimension, prev === undefined ? l.score : Math.min(prev, l.score));
  }
  const allDimsOk = [...minByDim.values()].every((m) => m >= 2);
  return { outcome: allSafetyOk && allDimsOk ? 'pass' : 'fail', safetyVeto: false };
}

const academy = () => supabase.schema('academy');

/** Load a course's §5.4 rubric template lines (catalog SELECT to authenticated). */
export async function loadRubricTemplate(courseId: string): Promise<RubricTemplateLine[]> {
  const { data, error } = await academy()
    .from('signoff_line_item_templates')
    .select('line_item_key,dimension,is_critical_safety,ordinal,label')
    .eq('course_id', courseId)
    .order('ordinal', { ascending: true });
  if (error) throw new Error(`rubric load failed: ${error.message}`);
  return (data ?? []) as RubricTemplateLine[];
}

export interface FinalizeInput {
  signoff_id: string; // client-generated stable id (idempotent finalize)
  candidate_user_id: string;
  course_id: string;
  competency_id: string;
  work_os_job_id: string;
  scores: Record<string, number>;
  evidence?: { kind: string; work_os_ref: string }[];
}

export interface FinalizeResult {
  signoff_id: string;
  status: string;
  outcome: SignoffOutcome | null;
  safety_veto_triggered?: boolean;
  promoted?: boolean;
  error?: string;
  reason?: string;
}

/**
 * Invoke the SERVER-AUTHORITATIVE finalize-signoff Edge Function (service-role).
 * The only path that can sign + promote competency. Never call this offline
 * (the screen gates on connectivity) — finalize is server-only (invariant 3/5).
 */
export async function finalizeSignoff(input: FinalizeInput): Promise<FinalizeResult> {
  const { data, error } = await supabase.functions.invoke('finalize-signoff', {
    body: { action: 'finalize', ...input },
  });
  if (error)
    return { signoff_id: input.signoff_id, status: 'error', outcome: null, error: error.message };
  return data as FinalizeResult;
}

/** The signable AC-203 course + its competency (the M6 flagship; M-series adds more). */
export const AC203_COURSE_ID = '000000c1-0000-0000-0000-00000000000e';
export const AC203_COMPETENCY_ID = '000000c0-0000-0000-0000-00000000000f';
