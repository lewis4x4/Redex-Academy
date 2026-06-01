// M1 catalog data layer. Reads the published catalog (cross-tenant readable) plus
// the current learner's OWN progress rows (RLS-scoped: own competency_state /
// enrollments / credentials) and assembles the gating resolver input. All reads
// go through the `academy` PostgREST schema with the learner's JWT — the server
// (RLS) decides what is visible; this layer never writes state.

import { supabase } from '../auth/supabaseClient';
import {
  type CompetencyStatus,
  type CredentialPrereq,
  type EnrollmentStatus,
  type GatingState,
  type PrereqEdge,
  type PrereqKind,
  resolveCourseGating,
} from './gating';

export type Domain = 'FND' | 'INT' | 'ADC' | 'AC' | 'VID' | 'SEC';
export type Tier = 'foundations' | 'core' | 'advanced' | 'mastery';
export type Persona = 'nova' | 'marco' | 'priya' | 'dana';

/** A catalog node ready for the skill-tree, with its resolved gating state. */
export interface CourseNode {
  id: string;
  code: string;
  title: string;
  domain: Domain;
  tier: Tier;
  personas: Persona[];
  state: GatingState;
  /** AC-203-style hard-gate capstone (heavier frame + ⚠ in the UI). */
  isBoss: boolean;
  /** The id of this course's FIRST lesson unit (lowest ordinal, kind='lesson') —
   *  where "Start"/"Continue" sends the learner. null if the course has no lesson. */
  firstUnitId: string | null;
}

export interface CatalogGating {
  courses: CourseNode[];
  prereqs: PrereqEdge[];
}

/** academy.unit_kind — the canonical ordinal unit kinds (matches the migration enum). */
export type UnitKind =
  | 'lesson'
  | 'sim'
  | 'scenario'
  | 'knowledge_check'
  | 'video'
  | 'checklist'
  | 'signoff_prep';

/** One unit in a course version's ordinal sequence (the course-player's spine). The
 *  content_ref is parsed into the engine/spec_key the player dispatches on. */
export interface CourseUnit {
  id: string;
  ordinal: number;
  kind: UnitKind;
  title: string;
  competencyId: string | null;
  estMinutes: number | null;
  /** Raw content_ref jsonb (mdx_key / engine / spec_key / gate / mandatory / …). */
  contentRef: Record<string, unknown>;
  /** content_ref.engine (e.g. 'branching_scenario' | 'device_config') if present. */
  engine: string | null;
  /** content_ref.spec_key (e.g. 'ac-203/egress-compliant') if present. */
  specKey: string | null;
}

/** The learner's OWN enrollment in a course (RLS-scoped own read). Carries the LOCKED
 *  course_version_id so the player resumes that version, never a newer one. */
export interface CourseEnrollment {
  id: string;
  status: EnrollmentStatus;
  courseVersionId: string;
  startedAt: string | null;
}

const academy = () => supabase.schema('academy');

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const refString = (ref: Record<string, unknown>, key: string): string | null =>
  typeof ref[key] === 'string' ? (ref[key] as string) : null;

/**
 * Load every unit of a course VERSION in ordinal order — the canonical
 * lesson → scenario → sim → signoff_prep → knowledge_check spine the course-player
 * walks. RLS-safe: published catalog (units) is cross-tenant readable, exactly like
 * loadCatalogGating's units read. Throws on a transport error (surfaced by the screen).
 */
export async function loadAllUnitsForCourse(courseVersionId: string): Promise<CourseUnit[]> {
  const { data, error } = await academy()
    .from('units')
    .select('id, ordinal, kind, title, content_ref, competency_id, est_minutes')
    .eq('course_version_id', courseVersionId)
    .order('ordinal', { ascending: true });
  if (error) throw new Error(`units read failed: ${error.message}`);
  return (
    (data ?? []) as Array<{
      id: string;
      ordinal: number | null;
      kind: string;
      title: string;
      content_ref: Record<string, unknown> | null;
      competency_id: string | null;
      est_minutes: number | null;
    }>
  ).map((u) => {
    const contentRef = asRecord(u.content_ref);
    return {
      id: u.id,
      ordinal: u.ordinal ?? 0,
      kind: u.kind as UnitKind,
      title: u.title,
      competencyId: u.competency_id,
      estMinutes: u.est_minutes,
      contentRef,
      engine: refString(contentRef, 'engine'),
      specKey: refString(contentRef, 'spec_key'),
    };
  });
}

/** A course's player-relevant header: title, code, the published active version, and
 *  its catalog status (so the player can enrollSelf only on an available/published course). */
export interface CoursePlayerHeader {
  id: string;
  code: string;
  title: string;
  activeVersionId: string | null;
  status: string;
}

/**
 * Load a single course's header for the course-player (RLS: published catalog is
 * cross-tenant readable). Returns null if the course id is not visible/published.
 * Throws on a transport error.
 */
export async function loadCourseForPlayer(courseId: string): Promise<CoursePlayerHeader | null> {
  const { data, error } = await academy()
    .from('courses')
    .select('id, code, title, active_version_id, status')
    .eq('id', courseId)
    .maybeSingle();
  if (error) throw new Error(`course read failed: ${error.message}`);
  if (!data) return null;
  const row = data as {
    id: string;
    code: string;
    title: string;
    active_version_id: string | null;
    status: string;
  };
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    activeVersionId: row.active_version_id,
    status: row.status,
  };
}

/**
 * Load the learner's OWN enrollment for a course (RLS own-read on enrollments). Returns
 * null when the learner has no enrollment yet (the player may then enrollSelf if the
 * course is available). Resolves the LOCKED course_version_id so a mid-course learner
 * stays on their enrolled version (course-version affinity), never shifted to a newly
 * published active version. Throws on a transport error.
 */
export async function loadEnrollmentForCourse(
  userId: string,
  courseId: string,
): Promise<CourseEnrollment | null> {
  const { data, error } = await academy()
    .from('enrollments')
    .select('id, status, course_version_id, started_at, user_id, course_id')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle();
  if (error) throw new Error(`enrollment read failed: ${error.message}`);
  if (!data) return null;
  const row = data as {
    id: string;
    status: EnrollmentStatus;
    course_version_id: string;
    started_at: string | null;
  };
  return {
    id: row.id,
    status: row.status,
    courseVersionId: row.course_version_id,
    startedAt: row.started_at,
  };
}

/** Reads the catalog + own progress and resolves every node's gating state. The
 *  catalog is public (status='published'); progress rows are RLS-scoped to the
 *  caller, so an unauthenticated/foreign caller simply gets no progress (roots
 *  available, gated courses locked). Throws on a transport error (surfaced as an
 *  ErrorState by the screen). */
export async function loadCatalogGating(): Promise<CatalogGating> {
  const [coursesRes, prereqRes, unitsRes, compRes, enrollRes, credRes] = await Promise.all([
    academy().from('courses').select('id,code,title,domain,tier,personas,active_version_id,status'),
    academy().from('course_prerequisites').select('course_id,requires_course_id,kind'),
    academy().from('units').select('id,ordinal,kind,competency_id,course_version_id'),
    academy().from('competency_state').select('competency_id,status'),
    academy().from('enrollments').select('course_id,status'),
    academy().from('credentials').select('badge_class_id,status'),
  ]);
  for (const r of [coursesRes, prereqRes, unitsRes, compRes, enrollRes, credRes]) {
    if (r.error) throw new Error(`catalog read failed: ${r.error.message}`);
  }

  type CourseRow = {
    id: string;
    code: string;
    title: string;
    domain: Domain;
    tier: Tier;
    personas: Persona[] | null;
    active_version_id: string | null;
    status: string;
  };
  const courseRows = ((coursesRes.data ?? []) as CourseRow[]).filter(
    (c) => c.status === 'published',
  );

  const prereqs: PrereqEdge[] = (
    (prereqRes.data ?? []) as Array<{
      course_id: string;
      requires_course_id: string;
      kind: string;
    }>
  ).map((e) => ({
    courseId: e.course_id,
    requiresCourseId: e.requires_course_id,
    kind: e.kind as PrereqKind,
  }));

  // courseId → competency ids the active version's units grant.
  const versionToCourse = new Map<string, string>();
  for (const c of courseRows)
    if (c.active_version_id) versionToCourse.set(c.active_version_id, c.id);
  const grantedCompetencies = new Map<string, string[]>();
  // courseId → its first lesson unit (lowest ordinal among kind='lesson'). This is
  // where Start/Continue sends the learner, so a course never dead-ends.
  const firstLessonByCourse = new Map<string, { id: string; ordinal: number }>();
  for (const u of (unitsRes.data ?? []) as Array<{
    id: string;
    ordinal: number | null;
    kind: string;
    competency_id: string | null;
    course_version_id: string;
  }>) {
    const courseId = versionToCourse.get(u.course_version_id);
    if (!courseId) continue;
    if (u.competency_id) {
      const list = grantedCompetencies.get(courseId) ?? [];
      if (!list.includes(u.competency_id)) list.push(u.competency_id);
      grantedCompetencies.set(courseId, list);
    }
    if (u.kind === 'lesson') {
      const ord = u.ordinal ?? Number.MAX_SAFE_INTEGER;
      const cur = firstLessonByCourse.get(courseId);
      if (!cur || ord < cur.ordinal) firstLessonByCourse.set(courseId, { id: u.id, ordinal: ord });
    }
  }

  const myCompetencyState = new Map<string, CompetencyStatus>();
  for (const r of (compRes.data ?? []) as Array<{
    competency_id: string;
    status: CompetencyStatus;
  }>)
    myCompetencyState.set(r.competency_id, r.status);

  const myEnrollments = new Map<string, EnrollmentStatus>();
  for (const r of (enrollRes.data ?? []) as Array<{ course_id: string; status: EnrollmentStatus }>)
    myEnrollments.set(r.course_id, r.status);

  const myHeldBadgeClassIds = new Set<string>();
  for (const r of (credRes.data ?? []) as Array<{ badge_class_id: string; status: string }>)
    if (r.status === 'active') myHeldBadgeClassIds.add(r.badge_class_id);

  // No credential-prereq table in the MVP slice; the resolver supports the path
  // (gating.ts / gating.test.ts) for post-slice credential gates.
  const credentialPrereqs: CredentialPrereq[] = [];

  const courseIds = courseRows.map((c) => c.id);
  const gating = resolveCourseGating({
    courseIds,
    prereqs,
    credentialPrereqs,
    grantedCompetencies,
    myCompetencyState,
    myEnrollments,
    myHeldBadgeClassIds,
  });

  const hardGateInDegree = (id: string) =>
    prereqs.filter((e) => e.courseId === id && e.kind === 'hard_gate').length;
  const isDependedUpon = (id: string) => prereqs.some((e) => e.requiresCourseId === id);

  const courses: CourseNode[] = courseRows.map((c) => ({
    id: c.id,
    code: c.code,
    title: c.title,
    domain: c.domain,
    tier: c.tier,
    personas: c.personas ?? [],
    state: gating.get(c.id) ?? 'locked',
    isBoss: hardGateInDegree(c.id) >= 2 && !isDependedUpon(c.id),
    firstUnitId: firstLessonByCourse.get(c.id)?.id ?? null,
  }));

  return { courses, prereqs };
}

/** Self-enroll in an `available` course (RLS-permitted own write; never touches
 *  competency_state — Inv. 2). Returns the new enrollment id. Throws on failure
 *  (e.g. RLS rejects a locked course). */
export async function enrollSelf(params: {
  userId: string;
  orgId: string;
  courseId: string;
}): Promise<void> {
  const { error } = await academy().from('enrollments').insert({
    user_id: params.userId,
    org_id: params.orgId,
    course_id: params.courseId,
    enrolled_via: 'self',
    status: 'in_progress',
  });
  if (error) throw new Error(`enroll failed: ${error.message}`);
}
