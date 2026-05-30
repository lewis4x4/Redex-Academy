import { describe, expect, it } from 'vitest';
import {
  type CredentialPrereq,
  type GatingInput,
  type PrereqEdge,
  isBossNode,
  resolveCourseGating,
} from './gating';

// Mirrors docs/m1-server-resolver/course_gating_test.sql (the proven server-side
// resolver) — same graph, same expectations. A=root, B=root, GATE requires A+B
// (hard), SOFT requires Y (soft, must NOT gate), Y=root, INP=root, CRED needs a
// credential.
const COURSE_IDS = ['A', 'B', 'GATE', 'SOFT', 'Y', 'INP', 'CRED'] as const;
const PREREQS: PrereqEdge[] = [
  { courseId: 'GATE', requiresCourseId: 'A', kind: 'hard_gate' },
  { courseId: 'GATE', requiresCourseId: 'B', kind: 'hard_gate' },
  { courseId: 'SOFT', requiresCourseId: 'Y', kind: 'soft' },
];
const CRED_PREREQS: CredentialPrereq[] = [{ courseId: 'CRED', requiresBadgeClassId: 'badge-1' }];
const GRANTED = new Map<string, string[]>([
  ['A', ['cA']],
  ['B', ['cB']],
  ['Y', ['cY']],
]);

function input(over: Partial<GatingInput> = {}): GatingInput {
  return {
    courseIds: COURSE_IDS,
    prereqs: PREREQS,
    credentialPrereqs: CRED_PREREQS,
    grantedCompetencies: GRANTED,
    myCompetencyState: new Map(),
    myEnrollments: new Map(),
    myHeldBadgeClassIds: new Set(),
    ...over,
  };
}

describe('M1 prerequisite-gating resolver (parity with the server-side SQL)', () => {
  it('TEST 1: roots are available; a hard-gate is locked; a soft prereq never gates; a credential gate is locked', () => {
    const g = resolveCourseGating(input());
    expect(g.get('A')).toBe('available');
    expect(g.get('B')).toBe('available');
    expect(g.get('GATE')).toBe('locked');
    expect(g.get('SOFT')).toBe('available'); // soft prereq is advisory, not a gate
    expect(g.get('CRED')).toBe('locked');
  });

  it('TEST 2: field_proven ⇒ mastered, sim_passed ⇒ passed, and clearing both prereqs unlocks the gate', () => {
    const g = resolveCourseGating(
      input({
        myCompetencyState: new Map([
          ['cA', 'field_proven'],
          ['cB', 'sim_passed'],
        ]),
      }),
    );
    expect(g.get('A')).toBe('mastered');
    expect(g.get('B')).toBe('passed');
    expect(g.get('GATE')).toBe('available');
  });

  it('TEST 2b: enrollment completed also clears a prereq (no competency row needed)', () => {
    const g = resolveCourseGating(
      input({
        myEnrollments: new Map([
          ['A', 'completed'],
          ['B', 'completed'],
        ]),
      }),
    );
    expect(g.get('A')).toBe('passed');
    expect(g.get('GATE')).toBe('available');
  });

  it('TEST 2c: only ONE prereq cleared keeps the gate locked', () => {
    const g = resolveCourseGating(input({ myCompetencyState: new Map([['cA', 'field_proven']]) }));
    expect(g.get('GATE')).toBe('locked');
  });

  it('TEST 3: an in_progress enrollment resolves to in_progress', () => {
    const g = resolveCourseGating(input({ myEnrollments: new Map([['INP', 'in_progress']]) }));
    expect(g.get('INP')).toBe('in_progress');
  });

  it('TEST 4: a credential-held prereq gates — locked without, available once held', () => {
    expect(resolveCourseGating(input()).get('CRED')).toBe('locked');
    const held = resolveCourseGating(input({ myHeldBadgeClassIds: new Set(['badge-1']) }));
    expect(held.get('CRED')).toBe('available');
  });

  it('TEST 5: cleared/mastered take precedence over the gate computation', () => {
    // Even with prereqs unmet, if the course itself is cleared it reads passed/mastered.
    const g = resolveCourseGating(
      input({
        grantedCompetencies: new Map([...GRANTED, ['GATE', ['cGate']]]),
        myCompetencyState: new Map([['cGate', 'field_proven']]),
      }),
    );
    expect(g.get('GATE')).toBe('mastered');
  });

  it('TEST 6: pure function — two independent learners resolve independently (no shared state)', () => {
    const learnerCleared = resolveCourseGating(
      input({
        myCompetencyState: new Map([
          ['cA', 'field_proven'],
          ['cB', 'field_proven'],
        ]),
      }),
    );
    const freshLearner = resolveCourseGating(input());
    expect(learnerCleared.get('GATE')).toBe('available');
    expect(freshLearner.get('GATE')).toBe('locked'); // unaffected by the other input
  });

  it('isBossNode: a leaf with ≥2 hard-gate prereqs is a boss/capstone (AC-203-style)', () => {
    expect(isBossNode('GATE', PREREQS)).toBe(true);
    expect(isBossNode('A', PREREQS)).toBe(false); // root, depended-upon
    expect(isBossNode('SOFT', PREREQS)).toBe(false); // only a soft prereq
  });
});
