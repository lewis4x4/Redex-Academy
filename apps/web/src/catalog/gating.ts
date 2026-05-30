// M1 prerequisite-gating resolver.
//
// Resolves every catalog course to a skill-tree node state for the current
// learner. The AUTHORITATIVE inputs live in Postgres and are read under RLS
// (own competency_state / enrollments / credentials + the public catalog) — this
// is a pure, read-only DERIVATION of that truth: it writes nothing and cannot be
// used to fake state (the client has no write grant on competency_state /
// credentials — Inv. 2/3). The server-side Postgres equivalent (the eventual
// authoritative home, to apply when a schema change is in scope) is preserved
// verbatim in docs/m1-server-resolver/course_gating.sql, and this module mirrors
// its precedence exactly (proven by docs/m1-server-resolver/course_gating_test.sql
// and the parity cases in gating.test.ts).
//
// Two prerequisite kinds are honored (M1 §1):
//   1. course-edge `hard_gate` prereqs — every required course must be cleared.
//   2. credential-held prereqs — every required badge_class must be held active.
// `soft` prereqs are advisory and NEVER gate.

/** Skill-tree node states (mirrors @redex/ui ConstellationNodeState; 'boss' is a
 *  UI overlay derived from the prereq graph, not a resolver state). */
export type GatingState = 'locked' | 'available' | 'in_progress' | 'passed' | 'mastered';

/** academy.competency_status */
export type CompetencyStatus = 'none' | 'in_progress' | 'sim_passed' | 'field_proven' | 'expired';
/** academy.enrollment_status */
export type EnrollmentStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'recert_required'
  | 'waived_rpl';
/** academy.prereq_kind */
export type PrereqKind = 'hard_gate' | 'soft';

export interface PrereqEdge {
  courseId: string;
  requiresCourseId: string;
  kind: PrereqKind;
}

export interface CredentialPrereq {
  courseId: string;
  requiresBadgeClassId: string;
}

/** Everything the resolver needs — assembled from RLS-scoped Supabase reads (see
 *  catalog data layer) or supplied as fixtures in tests. All "my*" inputs are the
 *  current learner's own rows only. */
export interface GatingInput {
  /** Every published course id to resolve. */
  courseIds: readonly string[];
  /** Course-edge prerequisites (both kinds; soft is ignored for gating). */
  prereqs: readonly PrereqEdge[];
  /** Credential-held prerequisites (empty for the MVP slice; path is test-covered). */
  credentialPrereqs?: readonly CredentialPrereq[];
  /** courseId → the competency ids the course's active version grants. */
  grantedCompetencies: ReadonlyMap<string, readonly string[]>;
  /** competencyId → the learner's status for it (own rows). */
  myCompetencyState: ReadonlyMap<string, CompetencyStatus>;
  /** courseId → the learner's enrollment status (own rows). */
  myEnrollments: ReadonlyMap<string, EnrollmentStatus>;
  /** badge_class ids the learner holds an ACTIVE credential for (own rows). */
  myHeldBadgeClassIds: ReadonlySet<string>;
}

const CLEARED_COMPETENCY: ReadonlySet<CompetencyStatus> = new Set<CompetencyStatus>([
  'sim_passed',
  'field_proven',
]);

/** A granted competency is field_proven (Evaluator-signed) ⇒ the course is mastered. */
function isMastered(courseId: string, input: GatingInput): boolean {
  const comps = input.grantedCompetencies.get(courseId);
  if (!comps) return false;
  return comps.some((c) => input.myCompetencyState.get(c) === 'field_proven');
}

/** Cleared = the learner has passed the course: enrollment completed, OR a granted
 *  competency is sim_passed/field_proven. Used for prerequisite satisfaction. */
function isCleared(courseId: string, input: GatingInput): boolean {
  if (input.myEnrollments.get(courseId) === 'completed') return true;
  const comps = input.grantedCompetencies.get(courseId);
  if (!comps) return false;
  return comps.some((c) => {
    const s = input.myCompetencyState.get(c);
    return s !== undefined && CLEARED_COMPETENCY.has(s);
  });
}

/** Resolve one course's gating state. Precedence: mastered > passed > in_progress
 *  > available > locked (identical to the server-side SQL resolver). */
export function resolveCourseGatingState(courseId: string, input: GatingInput): GatingState {
  if (isMastered(courseId, input)) return 'mastered';
  if (isCleared(courseId, input)) return 'passed';
  if (input.myEnrollments.get(courseId) === 'in_progress') return 'in_progress';

  const hardGatesCleared = input.prereqs
    .filter((e) => e.courseId === courseId && e.kind === 'hard_gate')
    .every((e) => isCleared(e.requiresCourseId, input));

  const credentialsHeld = (input.credentialPrereqs ?? [])
    .filter((e) => e.courseId === courseId)
    .every((e) => input.myHeldBadgeClassIds.has(e.requiresBadgeClassId));

  return hardGatesCleared && credentialsHeld ? 'available' : 'locked';
}

/** Resolve gating for every course id. Returns courseId → GatingState. */
export function resolveCourseGating(input: GatingInput): Map<string, GatingState> {
  const out = new Map<string, GatingState>();
  for (const id of input.courseIds) out.set(id, resolveCourseGatingState(id, input));
  return out;
}

/** A course is a "boss"/hard-gate capstone node if it has ≥2 hard_gate prereqs and
 *  no course depends on it within the loaded graph (a leaf gate, e.g. AC-203).
 *  Pure graph derivation for the UI's heavier frame + ⚠ marker. */
export function isBossNode(courseId: string, prereqs: readonly PrereqEdge[]): boolean {
  const hardIn = prereqs.filter((e) => e.courseId === courseId && e.kind === 'hard_gate').length;
  const isLeaf = !prereqs.some((e) => e.requiresCourseId === courseId);
  return hardIn >= 2 && isLeaf;
}
