// Deno unit test for the server-side branching re-scorer (no network / no DB).
// Runs against the COMMITTED AC-203 spec so the server Verdict provably agrees with
// the browser engine (packages/sim-engine) for the pass / non-veto-fail / veto cases.
//   deno test --config supabase/functions/deno.json supabase/functions/finalize-sim-attempt/score.test.ts
import { assert, assertEquals } from '@std/assert';
import { type BranchingSpecLike, scoreBranching } from './score.ts';
import ac203 from '../../../packages/sim-schemas/examples/ac203-egress-fail.branching.json' with {
  type: 'json',
};

const spec = ac203 as unknown as BranchingSpecLike;

Deno.test('AC-203: the correct path PASSES (no veto)', () => {
  const v = scoreBranching(spec, ['failsafe', 'pushtoexit', 'mount_reachable', 'facp', 'document']);
  assertEquals(v.outcome, 'pass');
  assertEquals(v.kind, 'pass');
  assertEquals(v.safety_veto_triggered, false);
  assertEquals(v.terminal_id, 'pass');
});

Deno.test('AC-203: a NON-critical documentation miss FAILS but does NOT veto', () => {
  const v = scoreBranching(spec, ['failsafe', 'pushtoexit', 'mount_reachable', 'facp', 'packup']);
  assertEquals(v.outcome, 'fail');
  assertEquals(v.kind, 'fail');
  assertEquals(v.safety_veto_triggered, false); // a docs miss is not a life-safety trap
  assertEquals(v.safety_score, 1); // every safety line passed
  assert(v.score.scaled < 0.8); // non-safety below threshold
});

Deno.test('AC-203: a fail-locked egress choice triggers a non-overridable SAFETY VETO', () => {
  const v = scoreBranching(spec, ['faillocked']);
  assertEquals(v.kind, 'safety_veto');
  assertEquals(v.outcome, 'fail');
  assertEquals(v.safety_veto_triggered, true);
});

Deno.test('AC-203: a mid-path safety miss (motion-only) also vetoes', () => {
  const v = scoreBranching(spec, ['failsafe', 'motiononly']);
  assertEquals(v.safety_veto_triggered, true);
  assertEquals(v.outcome, 'fail');
});

Deno.test('finalize rejects an impossible path rather than inventing a pass', () => {
  let threw = false;
  try {
    scoreBranching(spec, ['failsafe', 'nope-not-an-edge']);
  } catch {
    threw = true;
  }
  assert(threw);
});

Deno.test('an incomplete path (never reaches a terminal) is not a pass', () => {
  const v = scoreBranching(spec, ['failsafe']); // stops at `rex`, mid-graph
  assertEquals(v.complete, false);
  assertEquals(v.outcome, 'fail');
});
