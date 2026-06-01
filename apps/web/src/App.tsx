import { hasRole, personaShell } from '@redex/auth';
import { AppShell, Button, NavPill, StatusBadge } from '@redex/ui';
import { useTranslation } from 'react-i18next';
import { LoginPage } from './auth/components/LoginPage';
import { RoleGate } from './auth/components/RoleGate';
import { signOut, useAuth } from './auth/useAuth';
import { Constellation } from './catalog/Constellation';
import { CatalogScreen } from './catalog/CatalogScreen';
import { HomeScreen } from './home/HomeScreen';
import { SyncStatus } from './components/SyncStatus';
import { CoursePlayerScreen } from './course-player/CoursePlayerScreen';
import { SignoffScreen } from './features/signoff/SignoffScreen';
import { BackpackScreen } from './features/backpack/BackpackScreen';
import { LessonScreen } from './lessons/LessonScreen';
import { useAppRoute } from './navigation';

/**
 * Auth-aware shell (F3) re-skinned on the D1 design system, carrying the F4
 * offline-sync indicator and the M1 Constellation — the learner home. Logged out
 * → the dark/red SSO login. Logged in → the @redex/ui AppShell with
 * persona-adaptive DENSITY (Marco = field, large-touch; Priya/Dana = dense), the
 * prerequisite-gated skill-map (M1), and a role-gated supervisory section
 * (permissions from the `roles` claim) — persona drives density, roles drive
 * permissions, never conflated. SyncStatus keeps queued/refused offline work
 * UNMISSABLE (INT-102). Renders entirely on tokens.
 */
export default function App() {
  const { t } = useTranslation();
  const { session, claims, loading } = useAuth();
  const { route, navigate } = useAppRoute();

  if (loading) {
    return (
      <main className="rdx-scope flex min-h-screen items-center justify-center bg-canvas text-white">
        <p role="status" className="text-ink-muted">
          {t('app.loading')}
        </p>
      </main>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  // persona → shell DENSITY only (never permissions).
  const density = personaShell(claims?.persona);

  // Phase 2 — the course-player: one mastery flow that chains a course's units
  // (lesson → scenario → sim → signoff_prep → knowledge_check), entered from any
  // course entry point as ?screen=course-player&course=<courseId>. This SUPERSEDES the
  // legacy ?screen=sim AC-203 entry (deleted): the sim is now reached only by
  // progressing through the course.
  const inCoursePlayer = route.screen === 'course-player' && route.course != null;
  // M6 — the Evaluator field sign-off, an auth-gated in-app screen entered from the
  // evaluator section (?screen=signoff). Gated to the 'evaluator' role (RLS is the
  // real boundary; this only hides UI). The signoff itself authorizes server-side.
  const inSignoff = route.screen === 'signoff' && claims != null && hasRole(claims, 'evaluator');
  // M7 — the Digital Backpack: the learner's issued credentials (skill → tier
  // stack), each with its public hosted verifiable URL. Read-only (issuance is
  // server-only); RLS scopes the read to the signed-in learner's own credentials.
  const inBackpack = route.screen === 'backpack';
  // M2 — an MDX lesson + retry-to-mastery knowledge check, entered with a unit id.
  const inLesson = route.screen === 'lesson' && route.unit != null;
  // The Catalog — a flat, list view of the published courses, on its OWN screen so
  // the "Catalog" nav pill lands somewhere visibly distinct from the Home map.
  const inCatalog = route.screen === 'catalog';
  // M1 — the Constellation skill-map, now its OWN sub-page (no longer the home).
  const inConstellation = route.screen === 'constellation';

  return (
    <AppShell
      density={density}
      proofPoints={0}
      onBackpack={() => navigate({ screen: 'backpack', course: null })}
      screenKey={
        inCoursePlayer
          ? 'course-player'
          : inSignoff
            ? 'signoff'
            : inBackpack
              ? 'backpack'
              : inLesson
                ? 'lesson'
                : inCatalog
                  ? 'catalog'
                  : inConstellation
                    ? 'constellation'
                    : 'home'
      }
      nav={
        <>
          {/* Three distinct destinations: Home = the personalized dashboard
              (default route), Catalog = the flat course list, Constellation = the
              skill-map. Each pill goes somewhere visibly different. */}
          <NavPill
            active={
              !inCoursePlayer &&
              !inSignoff &&
              !inBackpack &&
              !inLesson &&
              !inCatalog &&
              !inConstellation
            }
            onClick={() => navigate({ screen: null, course: null, unit: null })}
          >
            Home
          </NavPill>
          <NavPill
            active={inCatalog}
            onClick={() => navigate({ screen: 'catalog', course: null, unit: null })}
          >
            Catalog
          </NavPill>
          <NavPill
            active={inConstellation}
            onClick={() => navigate({ screen: 'constellation', course: null, unit: null })}
          >
            Constellation
          </NavPill>
        </>
      }
      actions={
        <Button variant="secondary" size="sm" onClick={() => void signOut()}>
          Sign out
        </Button>
      }
    >
      {inCoursePlayer ? (
        // The course-player chains the course's units into one mastery flow. It is the
        // single entry for ALL courses (the player resolves the first incomplete unit).
        // On exit, return to the Constellation so the learner sees the node's new state.
        <CoursePlayerScreen
          courseId={route.course as string}
          onExit={() => navigate({ screen: 'constellation', course: null, unit: null })}
        />
      ) : inLesson ? (
        <LessonScreen
          unitId={route.unit as string}
          onExit={() => navigate({ screen: null, course: null, unit: null })}
        />
      ) : inSignoff ? (
        <SignoffScreen onExit={() => navigate({ screen: null, course: null })} />
      ) : inBackpack ? (
        <div className="px-8 pt-2 pb-10">
          <BackpackScreen recipientUserId={session.user.id} />
        </div>
      ) : inCatalog ? (
        <CatalogScreen />
      ) : inConstellation ? (
        <div className="flex flex-col gap-5 pb-10">
          <div className="px-8 pt-2">
            <SyncStatus />
          </div>

          {/* M1 — the prerequisite-gated skill-map, now its own sub-page. */}
          <Constellation />

          <section aria-label="Session" className="px-8 text-caption text-ink-muted">
            {t('app.shell_density')}:{' '}
            <span data-testid="shell" className="font-label text-ink-soft">
              {density}
            </span>
            {claims?.persona ? ` · ${claims.persona}` : ''}
          </section>
        </div>
      ) : (
        <div className="flex flex-col gap-5 pb-10">
          <div className="px-8 pt-2">
            <SyncStatus />
          </div>

          {/* The personalized welcome dashboard (the default landing screen). */}
          <HomeScreen />

          {/* M6 — the Evaluator "Prove one" field sign-off entry (role-gated). */}
          <RoleGate claims={claims} anyOf={['evaluator']}>
            <section aria-label="Evaluator tools" className="flex items-center gap-3 px-8">
              <span className="text-body text-ink-muted">{t('signoff.entry_label')}</span>
              <Button
                variant="primary"
                size="sm"
                data-testid="open-signoff"
                onClick={() => navigate({ screen: 'signoff', course: null })}
              >
                {t('signoff.entry_cta')}
              </Button>
            </section>
          </RoleGate>

          <RoleGate claims={claims} anyOf={['manager', 'org_admin', 'exec']}>
            <section aria-label="Manager tools" className="flex items-center gap-3 px-8">
              <span className="text-body text-ink-muted">{t('app.supervisory')}</span>
              <StatusBadge kind="pending" label={t('app.manager_dashboard')} />
            </section>
          </RoleGate>

          <section aria-label="Session" className="px-8 text-caption text-ink-muted">
            {t('app.shell_density')}:{' '}
            <span data-testid="shell" className="font-label text-ink-soft">
              {density}
            </span>
            {claims?.persona ? ` · ${claims.persona}` : ''}
          </section>
        </div>
      )}
    </AppShell>
  );
}
