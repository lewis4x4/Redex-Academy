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
}

export interface CatalogGating {
  courses: CourseNode[];
  prereqs: PrereqEdge[];
}

const academy = () => supabase.schema('academy');

/** Reads the catalog + own progress and resolves every node's gating state. The
 *  catalog is public (status='published'); progress rows are RLS-scoped to the
 *  caller, so an unauthenticated/foreign caller simply gets no progress (roots
 *  available, gated courses locked). Throws on a transport error (surfaced as an
 *  ErrorState by the screen). */
export async function loadCatalogGating(): Promise<CatalogGating> {
  const [coursesRes, prereqRes, unitsRes, compRes, enrollRes, credRes] = await Promise.all([
    academy().from('courses').select('id,code,title,domain,tier,personas,active_version_id,status'),
    academy().from('course_prerequisites').select('course_id,requires_course_id,kind'),
    academy().from('units').select('competency_id,course_version_id'),
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
  for (const u of (unitsRes.data ?? []) as Array<{
    competency_id: string | null;
    course_version_id: string;
  }>) {
    const courseId = versionToCourse.get(u.course_version_id);
    if (!courseId || !u.competency_id) continue;
    const list = grantedCompetencies.get(courseId) ?? [];
    if (!list.includes(u.competency_id)) list.push(u.competency_id);
    grantedCompetencies.set(courseId, list);
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
