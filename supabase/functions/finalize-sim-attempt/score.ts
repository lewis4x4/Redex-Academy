// ============================================================================
// supabase/functions/finalize-sim-attempt/score.ts  (Deno)
//
// SERVER-SIDE re-scorer for the branching engine (M3 / invariant 3). It re-derives
// the Verdict from the AUTHORITATIVE spec (read from academy.sim_definitions) and
// the learner's recorded choice path — the client's posted outcome is NEVER
// trusted. This is the spec-level mirror of:
//   * packages/sim-engine/src/engines/branching/core.ts  (choose → RubricResult)
//   * packages/sim-engine/src/verdict/verdict.ts          (computeVerdict + veto)
// KEEP IN LOCKSTEP with those two files (the same pattern as
// supabase/functions/sync/sync.schema.ts mirroring @redex/sync-core). The shared
// branching.test.ts in @redex/sim-engine and score.test.ts here pin the agreement.
//
// A single safety_flag branch ⇒ non-overridable safety veto (ledger §B / inv 1):
// it can never be outscored, exactly as in the browser engine and the DB rule.
// ============================================================================

export interface BranchingEdge {
  id: string;
  to: string;
  score_delta?: number;
  safety_flag?: boolean;
  verdict?: { dimension: string; line_item_key: string };
}

export interface BranchingNode {
  type: 'situation' | 'prompt' | 'terminal';
  choices?: BranchingEdge[];
  outcome?: 'pass' | 'fail';
  safety_veto?: boolean;
}

export interface BranchingScoring {
  pass_threshold: number;
  safety_pass_threshold: number;
  veto_on_any_safety_failure: boolean;
}

export interface BranchingSpecLike {
  envelope: { scoring: BranchingScoring; competency_ids: string[] };
  start: string;
  nodes: Record<string, BranchingNode>;
}

interface RubricResult {
  dimension: string;
  safety_flag: boolean;
  awarded: number;
  max: number;
  passed: boolean;
}

export interface ServerVerdict {
  kind: 'pass' | 'fail' | 'safety_veto';
  outcome: 'pass' | 'fail';
  safety_veto_triggered: boolean;
  score: { scaled: number; raw: number; max: number };
  safety_score: number;
  /** The node the path ended on (must be a terminal for a complete attempt). */
  terminal_id: string | null;
  complete: boolean;
}

const sum = (rs: RubricResult[], k: 'awarded' | 'max') => rs.reduce((a, r) => a + r[k], 0);
// No items in a subset ⇒ that gate is vacuously satisfied (scaled 1) — matches verdict.ts.
const scaled = (rs: RubricResult[]) => {
  const max = sum(rs, 'max');
  return max <= 0 ? 1 : Math.max(0, Math.min(1, sum(rs, 'awarded') / max));
};

/**
 * Walk the branching graph along `choices` (ordered edge ids) and recompute the
 * Verdict server-side. Throws on an invalid path (unknown node/edge, choosing at a
 * terminal) — a malformed path is a rejected finalize, never a silent pass.
 */
export function scoreBranching(spec: BranchingSpecLike, choices: string[]): ServerVerdict {
  const results: RubricResult[] = [];
  let nodeId = spec.start;

  for (const edgeId of choices) {
    const node = spec.nodes[nodeId];
    if (!node) throw new Error(`finalize: node '${nodeId}' not found`);
    if (node.type === 'terminal') throw new Error('finalize: choice after a terminal');
    const edge = (node.choices ?? []).find((c) => c.id === edgeId);
    if (!edge) throw new Error(`finalize: no choice '${edgeId}' at '${nodeId}'`);

    // Mirror core.ts: a result is recorded only for a graded edge (has verdict) or a
    // safety_flag edge; a safety_flag edge ALWAYS fails (never inferred from delta).
    if (edge.verdict || edge.safety_flag) {
      const delta = edge.score_delta ?? 0;
      const passed = edge.safety_flag ? false : delta >= 0;
      const max = Math.abs(delta) || 1;
      const dimension = edge.safety_flag
        ? 'safety_compliance'
        : (edge.verdict?.dimension ?? 'technical_execution');
      results.push({
        dimension,
        safety_flag: Boolean(edge.safety_flag),
        awarded: passed ? max : 0,
        max,
        passed,
      });
    }
    nodeId = edge.to;
  }

  const terminal = spec.nodes[nodeId];
  const complete = terminal?.type === 'terminal';
  const forceSafetyVeto = complete && terminal.safety_veto === true;

  const safetySubset = results.filter((r) => r.dimension === 'safety_compliance');
  const nonSafety = results.filter((r) => r.dimension !== 'safety_compliance');
  const failedSafety = results.filter((r) => r.safety_flag && !r.passed);
  const nonSafetyScaled = scaled(nonSafety);
  const safetyScaled = scaled(safetySubset);
  const score = { scaled: nonSafetyScaled, raw: sum(nonSafety, 'awarded'), max: sum(nonSafety, 'max') };

  if (forceSafetyVeto || (spec.envelope.scoring.veto_on_any_safety_failure && failedSafety.length > 0)) {
    return {
      kind: 'safety_veto',
      outcome: 'fail',
      safety_veto_triggered: true,
      score,
      safety_score: safetyScaled,
      terminal_id: complete ? nodeId : null,
      complete,
    };
  }

  const pass =
    complete &&
    nonSafetyScaled >= spec.envelope.scoring.pass_threshold &&
    safetyScaled >= spec.envelope.scoring.safety_pass_threshold;

  return {
    kind: pass ? 'pass' : 'fail',
    outcome: pass ? 'pass' : 'fail',
    safety_veto_triggered: false,
    score,
    safety_score: safetyScaled,
    terminal_id: complete ? nodeId : null,
    complete,
  };
}
