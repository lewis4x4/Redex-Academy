import { type Interaction2dSpec, interaction2dExample, validateSpec } from '@redex/sim-schemas';
import type { XapiTelemetryEvent } from '@redex/sim-schemas';
import { describe, it, expect } from 'vitest';
import { createInteraction2dSim } from './core';

const SPEC = validateSpec(interaction2dExample) as unknown as Interaction2dSpec;

function harness(spec: Interaction2dSpec = SPEC) {
  const events: XapiTelemetryEvent[] = [];
  let n = 0;
  const inst = createInteraction2dSim(spec, {
    telemetrySink: (e) => {
      events.push(e);
    },
    genUuid: () => `uuid-${n++}`,
    now: () => '2026-05-31T00:00:00.000Z',
  });
  return { inst, events };
}

/** Answer every item correctly from its answer_key. */
function answerAllCorrect(inst: ReturnType<typeof harness>['inst'], spec = SPEC) {
  for (const item of spec.items) {
    if (item.kind === 'drag-label' || item.kind === 'label' || item.kind === 'match') {
      for (const [k, v] of Object.entries(item.answer_key as Record<string, string>)) {
        inst.place(item.id, k, v);
      }
    } else if (item.kind === 'sort') {
      inst.setOrder(item.id, item.answer_key as string[]);
    } else if (item.kind === 'hotspot') {
      for (const r of item.answer_key as string[]) inst.tap(item.id, r);
    }
  }
}

describe('interaction-2d engine — drag-label / match / hotspot', () => {
  it('all items correct → PASS', () => {
    const { inst } = harness();
    answerAllCorrect(inst);
    const v = inst.submit();
    expect(v.outcome).toBe('pass');
    expect(v.safety_veto_triggered).toBe(false);
  });

  it('tapping the WRONG egress side (the safety_flag hotspot) → SAFETY VETO', () => {
    const { inst } = harness();
    // label + match correct, but choose the secured (wrong) side for free egress
    inst.place('label-anatomy', 'l-strike', 'r-strike');
    inst.place('label-anatomy', 'l-hinge', 'r-hinge');
    inst.place('label-anatomy', 'l-rex', 'r-rex');
    inst.place('match-spec', 'm-prox', 'm-wiegand');
    inst.place('match-spec', 'm-maglock', 'm-failsafe');
    inst.tap('egress-hotspot', 'h-secure'); // WRONG — must be the free-egress side
    const v = inst.submit();
    expect(v.kind).toBe('safety_veto');
    expect(v.safety_veto_triggered).toBe(true);
    expect(v.outcome).toBe('fail');
  });

  it('a wrong non-safety item (with safety correct) → FAIL, not veto', () => {
    const { inst } = harness();
    // get the label item wrong; match + egress correct
    inst.place('label-anatomy', 'l-strike', 'r-hinge'); // wrong
    inst.place('match-spec', 'm-prox', 'm-wiegand');
    inst.place('match-spec', 'm-maglock', 'm-failsafe');
    inst.tap('egress-hotspot', 'h-egress'); // safety correct
    const v = inst.submit();
    expect(v.safety_veto_triggered).toBe(false);
    expect(v.outcome).toBe('fail'); // technical 1/2 = 0.5 < 0.8
  });

  it('emits attempted → answered → completed (+ triggeredSafetyVeto on a wrong safety item)', () => {
    const { inst, events } = harness();
    inst.tap('egress-hotspot', 'h-secure');
    inst.submit();
    const verbs = events.map((e) => e.verb.id);
    expect(verbs[0]).toContain('attempted');
    expect(verbs).toContain('http://adlnet.gov/expapi/verbs/answered');
    expect(verbs.some((v) => v.includes('triggered-safety-veto'))).toBe(true);
    expect(verbs.some((v) => v.includes('completed'))).toBe(true);
  });
});

describe('interaction-2d engine — sort kind', () => {
  const sortSpec = validateSpec({
    envelope: SPEC.envelope,
    items: [
      {
        id: 'access-event',
        kind: 'sort',
        prompt_i18n: 'sim.ac101.order.prompt',
        feedback_i18n: 'sim.ac101.order.feedback',
        scoring: { weight: 1, dimension: 'technical_execution', safety_flag: false },
        elements: [
          { id: 'present', text_i18n: 'sim.ac101.order.present' },
          { id: 'read', text_i18n: 'sim.ac101.order.read' },
          { id: 'grant', text_i18n: 'sim.ac101.order.grant' },
          { id: 'unlock', text_i18n: 'sim.ac101.order.unlock' },
        ],
        answer_key: ['present', 'read', 'grant', 'unlock'],
      },
    ],
  }) as unknown as Interaction2dSpec;

  it('correct order → PASS; wrong order → FAIL', () => {
    const ok = harness(sortSpec);
    ok.inst.setOrder('access-event', ['present', 'read', 'grant', 'unlock']);
    expect(ok.inst.submit().outcome).toBe('pass');

    const bad = harness(sortSpec);
    bad.inst.setOrder('access-event', ['unlock', 'grant', 'read', 'present']);
    expect(bad.inst.submit().outcome).toBe('fail');
  });
});
