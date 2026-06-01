import { i18n, initI18n } from '@redex/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseUnit } from '../catalog/catalogSource';
import type { UnitProgressRow } from './unitProgress';

// ── Mock the data layer + the heavy per-kind renderers with light stand-ins that
// expose their completion callbacks as buttons. This isolates the player's job:
// load in ordinal order, dispatch by kind, gate advancement, record unit_progress.
const h = vi.hoisted(() => ({
  loadCourseForPlayer: vi.fn(),
  loadEnrollmentForCourse: vi.fn(),
  loadAllUnitsForCourse: vi.fn(),
  enrollSelf: vi.fn(async () => {}),
  loadUnitProgress: vi.fn(),
  recordUnitProgress: vi.fn(async () => ({}) as never),
  loadLesson: vi.fn(),
  online: true,
}));

vi.mock('../catalog/catalogSource', async (orig) => ({
  ...(await orig<typeof import('../catalog/catalogSource')>()),
  loadCourseForPlayer: h.loadCourseForPlayer,
  loadEnrollmentForCourse: h.loadEnrollmentForCourse,
  loadAllUnitsForCourse: h.loadAllUnitsForCourse,
  enrollSelf: h.enrollSelf,
}));
vi.mock('./unitProgress', async (orig) => ({
  ...(await orig<typeof import('./unitProgress')>()),
  loadUnitProgress: h.loadUnitProgress,
  recordUnitProgress: h.recordUnitProgress,
}));
vi.mock('../lessons/lessonSource', async (orig) => ({
  ...(await orig<typeof import('../lessons/lessonSource')>()),
  loadLesson: h.loadLesson,
}));
vi.mock('../offline/sync-state', () => ({ useSyncState: () => ({ online: h.online }) }));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    session: { user: { id: 'u1' } },
    claims: { sub: 'u1', org_id: 'o1' },
    loading: false,
  }),
  signOut: vi.fn(),
}));

// Light stand-ins: each records its props + exposes the completion callback as a button.
vi.mock('../lessons/LessonScreen', () => ({
  LessonScreen: (p: { unitId: string; onExit?: () => void }) => (
    <div data-testid="mock-lesson" data-unit={p.unitId}>
      <button data-testid="lesson-continue" onClick={() => p.onExit?.()}>
        continue
      </button>
    </div>
  ),
}));
vi.mock('../forge/SimUnitScreen', () => ({
  SimUnitScreen: (p: { specKey: string; engineKind: string; onComplete: () => void }) => (
    <div data-testid="mock-sim" data-spec={p.specKey} data-engine={p.engineKind}>
      {/* server pass is the ONLY thing that advances — exposed as an explicit button */}
      <button data-testid="sim-server-pass" onClick={() => p.onComplete()}>
        server pass
      </button>
    </div>
  ),
}));
vi.mock('../lessons/KnowledgeCheck', () => ({
  KnowledgeCheck: (p: { kcUnitId: string; items: unknown[]; onPass?: () => void }) => (
    <div data-testid="mock-kc" data-kc-unit={p.kcUnitId} data-items={p.items.length}>
      <button data-testid="kc-server-pass" onClick={() => p.onPass?.()}>
        kc pass
      </button>
    </div>
  ),
}));
vi.mock('./SignoffPrepScreen', () => ({
  SignoffPrepScreen: (p: { courseId: string; onComplete: () => void }) => (
    <div data-testid="mock-signoff-prep" data-course={p.courseId}>
      <button data-testid="signoff-done" onClick={() => p.onComplete()}>
        done
      </button>
    </div>
  ),
}));

import { CoursePlayerScreen } from './CoursePlayerScreen';

const COURSE_ID = '000000c1-0000-0000-0000-00000000000e';
const CV = '000000c2-0000-0000-0000-00000000000e';
const ENR = 'enr-1';

const UNITS: CourseUnit[] = [
  {
    id: 'u1',
    ordinal: 1,
    kind: 'lesson',
    title: 'Lesson',
    competencyId: 'c',
    estMinutes: 50,
    contentRef: { mdx_key: 'ac-203/u1' },
    engine: null,
    specKey: null,
  },
  {
    id: 'u2',
    ordinal: 2,
    kind: 'scenario',
    title: 'Scenario',
    competencyId: 'c',
    estMinutes: 45,
    contentRef: {},
    engine: 'branching_scenario',
    specKey: 'ac-203/egress-compliant',
  },
  {
    id: 'u3',
    ordinal: 3,
    kind: 'sim',
    title: 'Virtual Door',
    competencyId: 'c',
    estMinutes: 60,
    contentRef: {},
    engine: 'device_config',
    specKey: 'ac-203/virtual-door-maglock',
  },
  {
    id: 'u4',
    ordinal: 4,
    kind: 'signoff_prep',
    title: 'Sign-off Prep',
    competencyId: 'c',
    estMinutes: 25,
    contentRef: {},
    engine: null,
    specKey: null,
  },
  {
    id: 'u5',
    ordinal: 5,
    kind: 'knowledge_check',
    title: 'Knowledge Check',
    competencyId: 'c',
    estMinutes: 15,
    contentRef: { item_set: 'ac-203' },
    engine: null,
    specKey: null,
  },
];

function setProgress(passed: string[]): Map<string, UnitProgressRow> {
  const m = new Map<string, UnitProgressRow>();
  for (const id of passed) m.set(id, { status: 'passed', score: 1, attempts: 1 });
  return m;
}

describe('CoursePlayerScreen — ordinal dispatcher + mastery gate', () => {
  beforeEach(() => {
    initI18n('en');
    void i18n.changeLanguage('en');
    h.online = true;
    vi.clearAllMocks();
    h.loadCourseForPlayer.mockResolvedValue({
      id: COURSE_ID,
      code: 'AC-203',
      title: 'Mag Locks, REX & Egress',
      activeVersionId: CV,
      status: 'published',
    });
    h.loadEnrollmentForCourse.mockResolvedValue({
      id: ENR,
      status: 'in_progress',
      courseVersionId: CV,
      startedAt: null,
    });
    h.loadAllUnitsForCourse.mockResolvedValue(UNITS);
    h.loadUnitProgress.mockResolvedValue(new Map());
    h.loadLesson.mockResolvedValue({
      unitId: 'u5',
      courseVersionId: CV,
      title: 'Knowledge Check',
      mdxKey: null,
      knowledgeCheck: { unitId: 'u5', items: [{ id: 'q1' }, { id: 'q2' }] },
    });
  });

  it('loads units for the ENROLLMENT version and starts at the first non-passed unit (the lesson)', async () => {
    render(<CoursePlayerScreen courseId={COURSE_ID} onExit={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('mock-lesson')).toBeInTheDocument());
    // version affinity: it loaded the enrollment's locked version, not just the active.
    expect(h.loadAllUnitsForCourse).toHaveBeenCalledWith(CV);
    expect(screen.getByTestId('mock-lesson')).toHaveAttribute('data-unit', 'u1');
    // the rail shows all 5 units
    expect(screen.getByTestId('course-rail').querySelectorAll('li')).toHaveLength(5);
  });

  it('resumes at the first incomplete unit (lesson passed → starts on the scenario)', async () => {
    h.loadUnitProgress.mockResolvedValue(setProgress(['u1']));
    render(<CoursePlayerScreen courseId={COURSE_ID} onExit={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('mock-sim')).toBeInTheDocument());
    // the scenario unit (branching) is dispatched, not the lesson
    expect(screen.getByTestId('mock-sim')).toHaveAttribute('data-engine', 'branching_scenario');
    expect(screen.getByTestId('mock-sim')).toHaveAttribute('data-spec', 'ac-203/egress-compliant');
  });

  it('lesson advances freely on continue + records unit_progress passed via the queue', async () => {
    render(<CoursePlayerScreen courseId={COURSE_ID} onExit={() => {}} />);
    await screen.findByTestId('mock-lesson');
    fireEvent.click(screen.getByTestId('lesson-continue'));
    // advances to the scenario
    await waitFor(() => expect(screen.getByTestId('mock-sim')).toBeInTheDocument());
    expect(h.recordUnitProgress).toHaveBeenCalledWith(
      expect.objectContaining({ enrollmentId: ENR, unitId: 'u1', orgId: 'o1', status: 'passed' }),
    );
  });

  it('MASTERY GATE: a scenario does NOT advance until its server-pass callback fires', async () => {
    h.loadUnitProgress.mockResolvedValue(setProgress(['u1']));
    render(<CoursePlayerScreen courseId={COURSE_ID} onExit={() => {}} />);
    await screen.findByTestId('mock-sim');
    // still on the scenario; no advance has happened (no server pass yet)
    expect(screen.getByTestId('mock-sim')).toHaveAttribute('data-engine', 'branching_scenario');
    expect(h.recordUnitProgress).not.toHaveBeenCalled();
    // the server verdict pass advances to the device_config sim unit
    fireEvent.click(screen.getByTestId('sim-server-pass'));
    await waitFor(() =>
      expect(screen.getByTestId('mock-sim')).toHaveAttribute('data-engine', 'device_config'),
    );
    expect(h.recordUnitProgress).toHaveBeenCalledWith(
      expect.objectContaining({ unitId: 'u2', status: 'passed' }),
    );
  });

  it('reaches signoff_prep then the KC, reusing loadLesson(kcUnit).knowledgeCheck.items', async () => {
    h.loadUnitProgress.mockResolvedValue(setProgress(['u1', 'u2', 'u3']));
    render(<CoursePlayerScreen courseId={COURSE_ID} onExit={() => {}} />);
    // starts on signoff_prep (u4)
    await screen.findByTestId('mock-signoff-prep');
    expect(screen.getByTestId('mock-signoff-prep')).toHaveAttribute('data-course', COURSE_ID);
    fireEvent.click(screen.getByTestId('signoff-done')); // informational → advances freely
    // now the KC unit — items came from loadLesson(kcUnitId).knowledgeCheck.items
    await waitFor(() => expect(screen.getByTestId('mock-kc')).toBeInTheDocument());
    expect(h.loadLesson).toHaveBeenCalledWith('u5');
    expect(screen.getByTestId('mock-kc')).toHaveAttribute('data-items', '2');
    expect(screen.getByTestId('mock-kc')).toHaveAttribute('data-kc-unit', 'u5');
    // the KC also gates: only its server pass records progress
    fireEvent.click(screen.getByTestId('kc-server-pass'));
    expect(h.recordUnitProgress).toHaveBeenCalledWith(
      expect.objectContaining({ unitId: 'u5', status: 'passed' }),
    );
  });

  it('enrolls when there is no enrollment yet (published course), then loads progress', async () => {
    h.loadEnrollmentForCourse
      .mockResolvedValueOnce(null) // first read: not enrolled
      .mockResolvedValueOnce({
        id: ENR,
        status: 'in_progress',
        courseVersionId: CV,
        startedAt: null,
      });
    render(<CoursePlayerScreen courseId={COURSE_ID} onExit={() => {}} />);
    await screen.findByTestId('mock-lesson');
    expect(h.enrollSelf).toHaveBeenCalledWith({ userId: 'u1', orgId: 'o1', courseId: COURSE_ID });
  });
});
