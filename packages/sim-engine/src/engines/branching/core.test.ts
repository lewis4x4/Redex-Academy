import { branchingExample, XapiTelemetryEvent } from '@redex/sim-schemas';
import type { BranchingSpec, XapiTelemetryEvent as XapiEvent } from '@redex/sim-schemas';
import { describe, expect, it } from 'vitest';
import { loadSpec } from '../../loadSpec';
import { createBranchingSim } from './core';

function makeSim() {
  let n = 0;
  const events: XapiEvent[] = [];
  const sim = loadSpec(branchingExample, {
    telemetrySink: (e) => {
      events.push(e);
    },
    genUuid: () => `00000000-0000-4000-8000-${String(n++).padStart(12, '0')}`,
    now: () => '2026-05-29T00:00:00.000Z',
    context: { offline: true, org_id: '00000000-0000-0000-0000-0000000000a1' },
  });
  if (sim.engineKind !== 'branching_scenario') throw new Error('expected branching');
  return { sim, events };
}

// The committed AC-203 flagship graph (start = failstate):
//   failstate → rex → placement → firealarm → closeout → pass
// with a safety-veto trap off each safety decision and a non-veto docs fail off closeout.
describe('engine #1 branching — AC-203 egress-fail runs end-to-end', () => {
  it('the correct egress path → PASS, no safety veto', () => {
    const { sim, events } = makeSim();
    sim.choose('failsafe'); // releases on power loss
    sim.choose('pushtoexit'); // manual push-to-exit present (≥30s)
    sim.choose('mount_reachable'); // push-to-exit reachable (40–48in / ≤5ft)
    sim.choose('facp'); // releases on fire alarm
    sim.choose('document'); // tested + logged + AHJ
    expect(sim.isComplete()).toBe(true);
    const v = sim.getVerdict();
    expect(v.outcome).toBe('pass');
    expect(v.kind).toBe('pass');
    expect(v.safety_veto_triggered).toBe(false);
    expect(v.state.token).toBe('pass');
    // every emitted statement carries a client_event_uuid
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => typeof e.client_event_uuid === 'string')).toBe(true);
    // and they are valid envelope statements
    for (const e of events) expect(() => XapiTelemetryEvent.parse(e)).not.toThrow();
  });

  it('the wrong fail-locked choice → SAFETY VETO fail + trapped-occupants terminal', () => {
    const { sim, events } = makeSim();
    sim.choose('faillocked'); // safety_flag edge → trapped_lock terminal
    expect(sim.isComplete()).toBe(true);
    expect(sim.currentNode().type).toBe('terminal');
    const v = sim.getVerdict();
    expect(v.kind).toBe('safety_veto');
    expect(v.outcome).toBe('fail');
    expect(v.safety_veto_triggered).toBe(true);
    // the veto cannot be retroactively passed; a triggered-safety-veto statement fired
    const verbs = events.map((e) => e.verb.id);
    expect(verbs).toContain('https://academy.goredex.com/xapi/verbs/triggered-safety-veto');
    expect(verbs).toContain('http://adlnet.gov/expapi/verbs/completed');
    // the completion result maps the veto to sim_attempts.safety_veto_triggered
    const completed = events.find((e) => e.verb.id.endsWith('/completed'));
    expect(
      completed?.result?.extensions?.['https://academy.goredex.com/xapi/ext/safety_veto_triggered'],
    ).toBe(true);
  });

  it('a NON-critical miss (skip documentation) → plain FAIL, NO veto', () => {
    // All four life-safety decisions correct, but the verification/documentation
    // step is skipped: the non-safety subset drops below pass_threshold → fail,
    // yet NO safety_flag fired, so it is NOT a veto (kind 'fail', not 'safety_veto').
    const { sim } = makeSim();
    sim.choose('failsafe');
    sim.choose('pushtoexit');
    sim.choose('mount_reachable');
    sim.choose('facp');
    sim.choose('packup'); // verification_documentation miss (not a life-safety trap)
    expect(sim.isComplete()).toBe(true);
    const v = sim.getVerdict();
    expect(v.outcome).toBe('fail');
    expect(v.kind).toBe('fail');
    expect(v.safety_veto_triggered).toBe(false); // a docs miss never vetoes
    expect(v.safety_score).toBe(1); // every safety line passed
    expect(v.score.scaled).toBeLessThan(0.8); // non-safety failed the threshold
  });

  it('a wrong choice mid-path (motion only) also vetoes at its trap terminal', () => {
    const { sim } = makeSim();
    sim.choose('failsafe');
    sim.choose('motiononly'); // safety_flag → trapped_motion
    expect(sim.getVerdict().safety_veto_triggered).toBe(true);
  });

  it('refuses a choice after completion (no re-scoring a finished attempt)', () => {
    const { sim } = makeSim();
    sim.choose('faillocked');
    expect(() => sim.choose('failsafe')).toThrow(/already complete/);
  });
});

describe('engine #1 defense-in-depth: the veto holds even if a malformed spec slips past validation', () => {
  // The schema now REJECTS a verdict-less safety_flag edge, but the engine must
  // ALSO be safe by construction: a safety_flag edge ALWAYS becomes a safety
  // result, and a terminal authored safety_veto:true forces the veto. (Built via
  // createBranchingSim directly, bypassing validateSpec, to exercise the engine.)
  const evilSpec = {
    envelope: branchingExample.envelope,
    start: 'q',
    nodes: {
      q: {
        type: 'prompt',
        prompt_i18n: 'sim.ac203.egress-fail.node.failstate.prompt',
        media: [],
        is_safety_decision: true,
        choices: [
          {
            id: 'wrong',
            label_i18n: 'sim.ac203.egress-fail.choice.faillocked.label',
            to: 'trap',
            consequence_i18n: 'sim.ac203.egress-fail.choice.faillocked.consequence',
            score_delta: -3,
            safety_flag: true, // NO verdict mapping — the old bypass
            is_safety_decision: true,
          },
          {
            id: 'right',
            label_i18n: 'sim.ac203.egress-fail.choice.failsafe.label',
            to: 'ok',
            consequence_i18n: 'sim.ac203.egress-fail.choice.failsafe.consequence',
            score_delta: 3,
            safety_flag: false,
            is_safety_decision: true,
          },
        ],
      },
      trap: {
        type: 'terminal',
        outcome: 'fail',
        safety_veto: true,
        outcome_i18n: 'sim.ac203.egress-fail.terminal.trapped_lock.text',
        media: [],
      },
      ok: {
        type: 'terminal',
        outcome: 'pass',
        safety_veto: false,
        outcome_i18n: 'sim.ac203.egress-fail.terminal.pass.text',
        media: [],
      },
    },
  } as unknown as BranchingSpec;

  it('a verdict-less safety_flag edge into a safety_veto terminal STILL vetoes (no silent pass)', () => {
    const sim = createBranchingSim(evilSpec);
    sim.choose('wrong');
    const v = sim.getVerdict();
    expect(v.kind).toBe('safety_veto');
    expect(v.outcome).toBe('fail');
    expect(v.safety_veto_triggered).toBe(true);
  });

  it('a flagged wrong edge with score_delta>=0 into a NON-veto terminal STILL vetoes (passed forced false)', () => {
    // Worst case: no terminal safety_veto signal AND a non-negative delta — the veto
    // must come purely from the engine forcing a safety_flag edge to fail.
    const s = JSON.parse(JSON.stringify(evilSpec));
    s.nodes.q.choices[0].score_delta = 0; // author error on the flagged edge
    s.nodes.trap.safety_veto = false; // and no terminal veto signal
    const sim = createBranchingSim(s as unknown as BranchingSpec);
    sim.choose('wrong');
    const v = sim.getVerdict();
    expect(v.safety_veto_triggered).toBe(true);
    expect(v.outcome).toBe('fail');
  });
});
