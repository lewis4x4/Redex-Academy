import { Button, Card, ErrorState, ProgressBar, ScreenHead, Skeleton } from '@redex/ui';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProgressDotState } from '@redex/ui';
import { useAuth } from '../auth/useAuth';
import { useSyncState } from '../offline/sync-state';
import {
  type CourseEnrollment,
  type CoursePlayerHeader,
  type CourseUnit,
  enrollSelf,
  loadAllUnitsForCourse,
  loadCourseForPlayer,
  loadEnrollmentForCourse,
} from '../catalog/catalogSource';
import { LessonScreen } from '../lessons/LessonScreen';
import { KnowledgeCheck } from '../lessons/KnowledgeCheck';
import { loadLesson, type RenderableItem } from '../lessons/lessonSource';
import { SimUnitScreen, type SimEngineKind } from '../forge/SimUnitScreen';
import { SignoffPrepScreen } from './SignoffPrepScreen';
import { CourseProgressRail, type CourseRailUnit } from './CourseProgressRail';
import {
  loadUnitProgress,
  recordUnitProgress,
  type UnitProgressRow,
  type UnitProgressStatus,
} from './unitProgress';

export interface CoursePlayerScreenProps {
  /** The course id (course.id, NOT the code) to play. */
  courseId: string;
  /** Return to the caller (App → constellation). */
  onExit: () => void;
}

interface PlayerData {
  header: CoursePlayerHeader;
  enrollment: CourseEnrollment | null;
  units: CourseUnit[];
  progress: Map<string, UnitProgressRow>;
}

/** unit_progress status → the rail/dot state (current is overlaid per the cursor). */
function dotForStatus(status: UnitProgressStatus | undefined): ProgressDotState {
  if (status === 'passed') return 'done';
  if (status === 'failed') return 'fail';
  return 'todo';
}

/**
 * CoursePlayerScreen (Phase 2) — the ordinal unit dispatcher that chains AC-203's units
 * into ONE mastery flow: lesson → scenario → sim → signoff_prep → knowledge_check. It
 * resolves the course → its active version → the learner's OWN enrollment (enrolling if
 * the course is available), loads all units in ordinal order + the learner's own
 * unit_progress, and STARTS at the first non-'passed' unit (Continue/resume). A top
 * per-unit progress rail (colorblind-safe) shows every unit's state.
 *
 * MASTERY GATE (Inv. 1/3/5): it NEVER advances past a scenario / sim / knowledge_check
 * except on that renderer's server-verdict pass callback (the renderers enforce the
 * server-only verdict + safety-veto + never-fake-offline; the player only reacts to
 * their onComplete/onPass). lesson + signoff_prep advance freely (educational). It
 * records unit_progress via the offline sync-queue (never competency_state — Inv. 3).
 */
export function CoursePlayerScreen({ courseId, onExit }: CoursePlayerScreenProps): ReactElement {
  const { t } = useTranslation();
  const { session, claims } = useAuth();
  const { online } = useSyncState();
  const userId = session?.user.id;
  // Stable primitives only (claims is a freshly-allocated object each render — depending
  // on it would re-run the init effect forever, resetting data to the loading frame).
  const claimSub = claims?.sub;
  const claimOrg = claims?.org_id;
  const orgId = claimOrg ?? '';

  // `t` changes identity on every locale toggle; hold it in a ref so the LOAD effect
  // depends only on stable ids (a locale flip must not re-run init / reset progress).
  const tRef = useRef(t);
  tRef.current = t;

  const [data, setData] = useState<PlayerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  // The KC unit's items (loaded lazily via loadLesson when the cursor reaches it).
  const [kcItems, setKcItems] = useState<RenderableItem[] | null>(null);
  const [kcUnitId, setKcUnitId] = useState<string | null>(null);

  // ── Init: resolve course → version → own enrollment → units → own progress. ──
  useEffect(() => {
    let live = true;
    setError(null);
    setData(null);
    setCurrent(0);
    (async () => {
      try {
        if (!userId) return;
        const header = await loadCourseForPlayer(courseId);
        if (!live) return;
        if (!header) {
          setError(tRef.current('course.not_found', { defaultValue: 'Course not found.' }));
          return;
        }
        // Resume the learner's own enrollment; enroll if none and the course is published.
        let enrollment = await loadEnrollmentForCourse(userId, courseId);
        if (!enrollment && header.status === 'published' && claimSub && claimOrg) {
          try {
            await enrollSelf({ userId: claimSub, orgId: claimOrg, courseId });
            enrollment = await loadEnrollmentForCourse(userId, courseId);
          } catch {
            /* enrollment write can fail (RLS / offline) — still play the (published) content */
          }
        }
        if (!live) return;
        // Course-version affinity: load the ENROLLMENT's locked version when enrolled,
        // else the catalog active version (a not-yet-enrolled preview).
        const versionId = enrollment?.courseVersionId ?? header.activeVersionId;
        if (!versionId) {
          setError(
            tRef.current('course.no_version', {
              defaultValue: 'This course has no published version.',
            }),
          );
          return;
        }
        const units = await loadAllUnitsForCourse(versionId);
        if (!live) return;
        const progress = enrollment
          ? await loadUnitProgress(enrollment.id)
          : new Map<string, UnitProgressRow>();
        if (!live) return;
        setData({ header, enrollment, units, progress });
        // Start at the first non-'passed' unit (Continue resumes at the first incomplete).
        const firstIncomplete = units.findIndex((u) => progress.get(u.id)?.status !== 'passed');
        setCurrent(firstIncomplete === -1 ? Math.max(0, units.length - 1) : firstIncomplete);
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      live = false;
    };
  }, [courseId, userId, claimSub, claimOrg]);

  const units = useMemo(() => data?.units ?? [], [data]);
  const unit = units[current];

  // Load the KC items when the cursor lands on a knowledge_check unit. loadLesson
  // resolves the KC item_set by course_version_id (the gotcha-confirmed path), so it
  // returns knowledgeCheck.items for a unit whose own kind is knowledge_check.
  useEffect(() => {
    let live = true;
    if (!unit || unit.kind !== 'knowledge_check') {
      setKcItems(null);
      setKcUnitId(null);
      return;
    }
    setKcItems(null);
    loadLesson(unit.id)
      .then((lesson) => {
        if (!live) return;
        setKcItems(lesson.knowledgeCheck?.items ?? []);
        setKcUnitId(lesson.knowledgeCheck?.unitId ?? unit.id);
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [unit]);

  // advanceUnit — record the finished unit's completion (unit_progress, NEVER
  // competency_state) then move the cursor forward. Called by the per-kind renderers:
  // freely for lesson/signoff_prep; ONLY on a server-verdict pass for scenario/sim/KC.
  const advanceUnit = useCallback(
    (finished: CourseUnit, status: UnitProgressStatus, score?: number) => {
      const enrollment = data?.enrollment;
      // Mirror locally so the rail + resume reflect it immediately (offline-tolerant).
      setData((prev) =>
        prev
          ? {
              ...prev,
              progress: new Map(prev.progress).set(finished.id, {
                status,
                score: score ?? prev.progress.get(finished.id)?.score ?? null,
                attempts: (prev.progress.get(finished.id)?.attempts ?? 0) + 1,
              }),
            }
          : prev,
      );
      if (enrollment && orgId) {
        void recordUnitProgress({
          enrollmentId: enrollment.id,
          unitId: finished.id,
          orgId,
          status,
          score,
          attempts: (data?.progress.get(finished.id)?.attempts ?? 0) + 1,
        }).catch(() => {
          /* a refused/illegal write surfaces via SyncStatus rejectedCount, never silent */
        });
      }
      setCurrent((c) => Math.min(c + 1, units.length - 1));
    },
    [data, orgId, units.length],
  );

  const railUnits: CourseRailUnit[] = useMemo(
    () =>
      units.map((u, i): CourseRailUnit => {
        const status = data?.progress.get(u.id)?.status;
        const base = dotForStatus(status);
        const state: ProgressDotState = i === current && base !== 'done' ? 'current' : base;
        return { id: u.id, label: u.title, state };
      }),
    [units, data, current],
  );

  const passedCount = railUnits.filter((u) => u.state === 'done').length;

  // ── Loading / error frames (stable testid). ──
  if (error) {
    return (
      <div data-testid="course-player" className="flex flex-col gap-5 pb-10">
        <div className="px-8 pt-2">
          <ErrorState
            title={t('course.error_title', { defaultValue: "Couldn't load this course" })}
            description={error}
          />
          <div className="mt-4">
            <Button variant="secondary" size="sm" onClick={onExit}>
              {t('sim.screen.back')}
            </Button>
          </div>
        </div>
      </div>
    );
  }
  if (!data || !unit) {
    return (
      <div data-testid="course-player" className="flex flex-col gap-5 pb-10">
        <div className="flex flex-col gap-3 px-8 pt-6" data-testid="course-player-loading">
          <Skeleton height="2rem" width="40%" />
          <Skeleton height="10rem" />
        </div>
      </div>
    );
  }

  // ── Per-kind dispatch. The mastery gate lives in WHEN each renderer calls back. ──
  let body: ReactElement;
  switch (unit.kind) {
    case 'lesson':
    case 'video':
    case 'checklist':
      // Educational: the lesson runner's "Continue the course" (onExit) advances freely.
      body = (
        <LessonScreen
          key={unit.id}
          unitId={unit.id}
          online={online}
          onExit={() => advanceUnit(unit, 'passed')}
        />
      );
      break;
    case 'scenario':
    case 'sim':
      // MASTERY GATE: SimUnitScreen calls onComplete ONLY on a server-verified (branching)
      // / locally-verified-pending (device_config) pass — never on fail/veto/offline.
      body = (
        <SimUnitScreen
          key={unit.id}
          unitId={unit.id}
          specKey={unit.specKey ?? ''}
          engineKind={(unit.engine as SimEngineKind) ?? 'branching_scenario'}
          title={unit.title}
          onComplete={() => advanceUnit(unit, 'passed', 1)}
          onExit={onExit}
        />
      );
      break;
    case 'knowledge_check':
      // MASTERY GATE: KnowledgeCheck.onPass fires ONLY on the server verdict pass.
      body =
        kcItems == null ? (
          <div className="flex flex-col gap-3 px-8" data-testid="kc-loading">
            <Skeleton height="2rem" width="50%" />
            <Skeleton height="8rem" />
          </div>
        ) : (
          <div className="px-8">
            <Card variant="panel" padding="lg">
              <KnowledgeCheck
                key={unit.id}
                kcUnitId={kcUnitId ?? unit.id}
                items={kcItems}
                userId={userId ?? ''}
                orgId={orgId}
                online={online}
                onPass={() => advanceUnit(unit, 'passed', 1)}
              />
            </Card>
          </div>
        );
      break;
    case 'signoff_prep':
      // Informational (NOT a gate): advances freely on "I'm ready".
      body = (
        <SignoffPrepScreen
          key={unit.id}
          courseId={data.header.id}
          onComplete={() => advanceUnit(unit, 'passed')}
          onExit={onExit}
        />
      );
      break;
    default:
      body = (
        <div className="px-8">
          <ErrorState
            title={t('course.unknown_unit', { defaultValue: 'Unsupported unit' })}
            description={String(unit.kind)}
          />
        </div>
      );
  }

  return (
    <div
      data-testid="course-player"
      data-unit-kind={unit.kind}
      className="flex flex-col gap-5 pb-10"
    >
      <div className="px-8 pt-2">
        <ScreenHead
          eyebrow={t('course.eyebrow', {
            defaultValue: '{{code}} · Egress hard gate',
            code: data.header.code,
          })}
          title={data.header.title}
          actions={
            <Button variant="secondary" size="sm" data-testid="course-exit" onClick={onExit}>
              {t('course.exit', { defaultValue: 'Exit course' })}
            </Button>
          }
        />
      </div>
      <div className="flex flex-col gap-2 px-8">
        <div className="flex items-center justify-between gap-4">
          <CourseProgressRail
            units={railUnits}
            label={t('course.progress', { defaultValue: 'Course progress' })}
          />
          <span className="text-caption text-ink-muted" data-testid="course-progress-count">
            {t('course.progress_count', {
              defaultValue: '{{done}} of {{total}} units',
              done: passedCount,
              total: units.length,
            })}
          </span>
        </div>
        <ProgressBar
          value={units.length > 0 ? passedCount / units.length : 0}
          label={t('course.progress', { defaultValue: 'Course progress' })}
        />
      </div>
      {body}
    </div>
  );
}
