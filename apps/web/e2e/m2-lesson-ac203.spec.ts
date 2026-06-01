import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Route } from '@playwright/test';

// M2 — the FLAGSHIP AC-203 MDX lesson with an embedded retry-to-mastery knowledge
// check, end to end. Mirrors m2-lesson.spec.ts (AC-101) exactly, adapted to AC-203:
// the 4 embedded interaction_2d sims, and the real 12-item check (9 safety + 3
// non-safety). No live Supabase in CI, so (a) seed a far-future fake session, (b)
// intercept the academy PostgREST reads (units + assessment_items) with a
// deterministic fixture, and (c) intercept the grade-knowledge-check Edge Function.
// The gate ALGORITHM (safety ≥90% / non-safety ≥80%, split by is_safety_item) is
// proven exhaustively by the unit + Deno tests; this proves the wiring: render →
// answer → blocked on a safety miss → retry → pass, plus the EN↔ES toggle and the
// offline path.

const LESSON_UNIT = '000000c3-000e-0000-0000-000000000001'; // AC-203 u1 (mdx_key ac-203/u1)
const KC_UNIT = '000000c3-000e-0000-0000-000000000005';
const CV = '000000c2-0000-0000-0000-00000000000e'; // AC-203 active version
const COMP = '000000c0-0000-0000-0000-00000000000f';

const LESSON_UNIT_ROW = {
  id: LESSON_UNIT,
  course_version_id: CV,
  title: 'Mag Locks, REX & Basic Egress Wiring',
  kind: 'lesson',
  content_ref: { mdx_key: 'ac-203/u1' },
};
const KC_UNIT_ROW = {
  id: KC_UNIT,
  course_version_id: CV,
  title: 'Egress Wiring Knowledge Check',
  kind: 'knowledge_check',
  content_ref: { item_set: 'ac-203' },
};

// AC-203's real check is 12 items: 9 safety + 3 non-safety; correct answer is 'a' for all.
const SAFETY_IDS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9'];
const NON_SAFETY_IDS = ['n1', 'n2', 'n3'];
const ITEMS = [
  ...SAFETY_IDS.map((id) => mk(id, true)),
  ...NON_SAFETY_IDS.map((id) => mk(id, false)),
];
function mk(id: string, safety: boolean) {
  return {
    id,
    kind: 'mcq',
    is_safety_item: safety,
    mastery_weight: 1,
    answer_key: { correct: 'a' },
    prompt: { text: `Question ${id}` },
    options: {
      choices: [
        { id: 'a', text: 'Correct' },
        { id: 'b', text: 'Wrong' },
      ],
    },
    locale_variants: {},
  };
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
};
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const b64url = (o: unknown) =>
      btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const claims = {
      sub: '00000000-0000-0000-0000-0000000000c3',
      org_id: '00000000-0000-0000-0000-0000000000a1',
      roles: ['learner'],
      persona: 'priya',
    };
    const token = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(claims)}.sig`;
    window.localStorage.setItem(
      'sb-localhost-auth-token',
      JSON.stringify({
        access_token: token,
        refresh_token: 'fake',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: 4102444800,
        user: {
          id: claims.sub,
          aud: 'authenticated',
          role: 'authenticated',
          email: 't@e.co',
          app_metadata: {},
          user_metadata: {},
          created_at: '2026-01-01T00:00:00.000Z',
        },
      }),
    );
  });

  // The server-only verdict (grade-knowledge-check): the FIRST graded attempt (the
  // safety miss) is not-passed; the retry passes. Responses are recorded via /sync
  // (Dexie → Edge Function), never a direct PostgREST POST, so we drive the verdict
  // off the invocation count — the server re-derives authoritatively in production.
  let gradeCalls = 0;
  await page.route('**/functions/v1/grade-knowledge-check', (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: CORS, body: '' });
    gradeCalls += 1;
    const passed = gradeCalls >= 2;
    return json(route, { passed, promoted: passed ? COMP : null });
  });
  await page.route('**/functions/v1/sync', (route) => json(route, { accepted: [], rejected: [] }));

  await page.route('**/rest/v1/**', (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
    const url = new URL(route.request().url());
    const path = url.pathname;
    const q = url.search;
    if (path.endsWith('/assessment_items')) return json(route, ITEMS);
    if (path.endsWith('/units')) {
      if (q.includes('knowledge_check')) return json(route, KC_UNIT_ROW); // maybeSingle
      return json(route, LESSON_UNIT_ROW); // maybeSingle by id
    }
    if (path.endsWith('/competency_state')) return json(route, []);
    return json(route, []);
  });
});

// The paced step runner shows ONE step at a time. Opening the lesson lands on step 1
// ("Two locks, opposite rules" — its embedded mag-vs-strike <Sim> + the safety <Callout>).
const openLesson = async (page: import('@playwright/test').Page) => {
  await page.goto(`/?screen=lesson&unit=${LESSON_UNIT}`);
  await expect(page.getByTestId('step-content')).toHaveAttribute('data-step', '1');
};

// Walk Next from any step until the terminal Knowledge-check step is on screen. The KC
// is the last of the 7 `## ` sections, so we never need more than 6 clicks; loop on the
// observable KC instead of a hard count so it stays robust to step-count changes.
const walkToKnowledgeCheck = async (page: import('@playwright/test').Page) => {
  const kc = page.getByTestId('knowledge-check');
  for (let i = 0; i < 8 && (await kc.count()) === 0; i += 1) {
    await page.getByTestId('lesson-next').click();
  }
  await expect(kc).toBeVisible();
};

test('the runner renders MDX step-by-step: step 1 has the embedded 2D sim, the last step has the check', async ({
  page,
}) => {
  await openLesson(page);
  // Step 1 is "Two locks, opposite rules": the safety <Callout> + the mag-vs-strike <Sim>.
  await expect(page.getByRole('note').first()).toHaveAttribute('data-tone', 'safety'); // <Callout tone="safety">
  // The embedded ac-203/* specs are all interaction_2d (in M2_AC_SPECS) → they mount the
  // Interaction2dSim engine (i2d-submit), NEVER sim-missing / sim-unsupported — on any step.
  await expect(page.getByTestId('sim-missing')).toHaveCount(0);
  await expect(page.getByTestId('sim-unsupported')).toHaveCount(0);
  await expect(page.getByTestId('i2d-submit').first()).toBeVisible(); // step-1 <Sim> mounted
  // the embedded sim is framed by the SimulatorPanel centerpiece
  await expect(page.getByTestId('simulator-panel').first()).toBeVisible();
  // the KC is the terminal step, not on screen yet
  await expect(page.getByTestId('knowledge-check')).toHaveCount(0);
  // walk Next to the terminal Knowledge-check step
  await walkToKnowledgeCheck(page);
  await expect(page.getByTestId('lesson-next')).toHaveText('Continue the course');
  // no sim placeholder appeared anywhere along the walk
  await expect(page.getByTestId('sim-missing')).toHaveCount(0);
  await expect(page.getByTestId('sim-unsupported')).toHaveCount(0);
});

test('retry-to-mastery: a safety miss is BLOCKED; fixing it PASSES', async ({ page }) => {
  await openLesson(page);
  await walkToKnowledgeCheck(page);
  const kc = page.getByTestId('knowledge-check');
  // miss one safety item (s1 = 'b'), everything else correct → safety 8/9 = 88.9% < 90%
  await kc.locator('[data-item="s1"] [data-choice="b"]').click();
  for (const id of [...SAFETY_IDS.slice(1), ...NON_SAFETY_IDS])
    await kc.locator(`[data-item="${id}"] [data-choice="a"]`).click();
  await page.getByTestId('kc-submit').click();
  await expect(page.getByTestId('kc-verdict')).toContainText('retry');
  await expect(page.getByTestId('kc-local-pass')).toHaveText('false'); // the real gate blocked it
  await expect(page.getByTestId('kc-retry')).toBeVisible();

  // retry: fix the safety answer → all correct → passes
  await page.getByTestId('kc-retry').click();
  await kc.locator('[data-item="s1"] [data-choice="a"]').click();
  await page.getByTestId('kc-submit').click();
  await expect(page.getByTestId('kc-verdict')).toContainText('Mastered');
});

test('EN↔ES locale toggle (on the KC step) flips the check chrome; the step still renders', async ({
  page,
}) => {
  await openLesson(page);
  await walkToKnowledgeCheck(page);
  await expect(page.getByTestId('kc-submit')).toHaveText('Check answers');
  await page.getByTestId('lesson-locale-toggle').click();
  // the header toggle re-evaluates the CURRENT step → the check chrome flips to ES
  await expect(page.getByTestId('kc-submit')).toHaveText('Comprobar respuestas');
  await expect(page.getByTestId('step-content')).toBeVisible();
});

test('OFFLINE: a submitted check queues + shows "completes on reconnect", never a faked pass', async ({
  page,
  context,
}) => {
  await openLesson(page);
  await walkToKnowledgeCheck(page);
  await context.setOffline(true);
  const kc = page.getByTestId('knowledge-check');
  for (const id of [...SAFETY_IDS, ...NON_SAFETY_IDS])
    await kc.locator(`[data-item="${id}"] [data-choice="a"]`).click();
  await page.getByTestId('kc-submit').click();
  await expect(page.getByTestId('kc-verdict')).toContainText('offline'); // pending, not a pass
});

test('a11y: a teaching step AND the KC step have no axe violations; the rail is keyboard-navigable', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); // sample the final, fully-opaque paint
  await openLesson(page);

  // (1) axe on a TEACHING step (step 1 — the embedded sim + safety Callout + the rail).
  await expect(page.getByTestId('i2d-submit').first()).toBeVisible();
  const teaching = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(teaching.violations).toEqual([]);

  // The outline rail is a semantic nav>ol>li>button — colorblind-safe state (number +
  // glyph + color + aria), the active step carries aria-current="page".
  const rail = page.getByRole('navigation', { name: 'In this lesson' });
  await expect(rail).toBeVisible();
  await expect(rail.locator('button[aria-current="page"]')).toHaveAttribute('data-step', '1');

  // (2) the rail is keyboard-operable: walk to the KC step, then Tab to a completed
  // rail step and Enter to JUMP back to it — proving the rail buttons are real, focusable
  // controls (not color-only, not div-onclick).
  await walkToKnowledgeCheck(page);
  const step1Button = rail.locator('button[data-step="1"]');
  await step1Button.focus();
  await expect(step1Button).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('step-content')).toHaveAttribute('data-step', '1');

  // (3) axe on the KC step itself (the radio inputs + verdict StatusBadge).
  await walkToKnowledgeCheck(page);
  await expect(page.getByTestId('knowledge-check')).toBeVisible();
  const kcAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(kcAxe.violations).toEqual([]);
});

// ── ROUTING (Phase 2: the course-player entry-point unification) ─────────────
// Opening AC-203 from any entry point (Home spotlight, Catalog card, Constellation
// boss node) must land on the COURSE-PLAYER (?screen=course-player&course=<id>) — NOT
// the legacy ?screen=sim, and NOT a bare lesson route. The player resolves the first
// incomplete unit (the ordinal-1 lesson) and renders the LessonScreen runner inside
// the player frame, so we still see step-content + the embedded 2D sim. The progress
// rail shows all the course's units. The legacy ?screen=sim&course=AC-203 no longer
// auto-routes (the inSim branch is deleted). These tests merge this file's LESSON
// mocking with the catalog mocking (courses / prereqs / the units LIST / competency_state
// / enrollments) PLUS the Phase-2 course-player reads (the single-enrollment-by-user
// read carrying course_version_id, and the unit_progress read).

const GATE = '000000c1-0000-0000-0000-00000000000e'; // AC-203 course id
const ROOT1 = '000000c1-0000-0000-0000-0000000000a1'; // FND-101
const ROOT2 = '000000c1-0000-0000-0000-0000000000a2'; // AC-201
const ENR_ID = '000000e1-0000-0000-0000-000000000001'; // AC-203 enrollment id

const COURSES = [
  {
    id: ROOT1,
    code: 'FND-101',
    title: 'Welcome',
    domain: 'FND',
    tier: 'foundations',
    personas: ['priya'],
    active_version_id: '000000c2-0000-0000-0000-0000000000a1',
    status: 'published',
  },
  {
    id: ROOT2,
    code: 'AC-201',
    title: 'Single-Door',
    domain: 'AC',
    tier: 'core',
    personas: ['priya'],
    active_version_id: '000000c2-0000-0000-0000-0000000000a2',
    status: 'published',
  },
  {
    id: GATE,
    code: 'AC-203',
    title: 'Mag Locks, REX & Egress',
    domain: 'AC',
    tier: 'core',
    personas: ['priya'],
    active_version_id: CV, // AC-203 active version → maps the units below to AC-203
    status: 'published',
  },
];
const PREREQS = [
  { course_id: GATE, requires_course_id: ROOT1, kind: 'hard_gate' },
  { course_id: GATE, requires_course_id: ROOT2, kind: 'hard_gate' },
];
// The catalog LIST / course-player units. The ordinal-1 lesson (LESSON_UNIT) is the
// lowest-ordinal kind='lesson'; the KC unit is ordinal 2. Carries content_ref/title/
// est_minutes so the course-player's loadAllUnitsForCourse maps them (the lesson's
// mdx_key resolves to the real ac-203/u1 body).
const UNITS_LIST = [
  {
    id: LESSON_UNIT,
    ordinal: 1,
    kind: 'lesson',
    title: 'Mag Locks, REX & Basic Egress Wiring',
    competency_id: COMP,
    course_version_id: CV,
    content_ref: { mdx_key: 'ac-203/u1' },
    est_minutes: 50,
  },
  {
    id: KC_UNIT,
    ordinal: 2,
    kind: 'knowledge_check',
    title: 'Egress Wiring Knowledge Check',
    competency_id: COMP,
    course_version_id: CV,
    content_ref: { item_set: 'ac-203' },
    est_minutes: 15,
  },
];

test.describe('AC-203 entry points land on the course-player, not the legacy sim route', () => {
  test.beforeEach(async ({ page }) => {
    // Supersede the top-level `**/rest/v1/**` handler with one that ALSO serves the
    // catalog + the Phase-2 course-player reads. The session seed, the
    // grade-knowledge-check fn, and /sync from the outer beforeEach are reused as-is.
    await page.route('**/rest/v1/**', (route) => {
      const method = route.request().method();
      if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
      const url = new URL(route.request().url());
      const path = url.pathname;
      const params = url.searchParams;
      if (path.endsWith('/courses')) {
        // The course-player reads ONE course by id (maybeSingle) for its header.
        if (params.get('id'))
          return json(route, COURSES.find((c) => params.get('id')?.includes(c.id)) ?? COURSES[2]);
        return json(route, COURSES);
      }
      if (path.endsWith('/course_prerequisites')) return json(route, PREREQS);
      if (path.endsWith('/assessment_items')) return json(route, ITEMS);
      if (path.endsWith('/units')) {
        // DUAL-PURPOSE dispatch by the request's query params:
        //  • lesson read by id  → the single lesson unit (maybeSingle)
        //  • the knowledge_check → the single KC unit (maybeSingle)
        //  • neither (no filter) → the units LIST (catalog + the course-player spine)
        if (params.get('id')) return json(route, LESSON_UNIT_ROW);
        if ((params.get('kind') ?? '').includes('knowledge_check')) return json(route, KC_UNIT_ROW);
        return json(route, UNITS_LIST);
      }
      if (path.endsWith('/enrollments')) {
        if (method === 'POST') return json(route, [{ id: ENR_ID }], 201);
        // The course-player reads the OWN enrollment by user_id+course_id (maybeSingle)
        // → a single object carrying the locked course_version_id (version affinity).
        if (params.get('user_id') && params.get('course_id'))
          return json(route, {
            id: ENR_ID,
            status: 'in_progress',
            course_version_id: CV,
            started_at: '2026-01-01T00:00:00Z',
          });
        // The catalog list read (course_id + status, no maybeSingle).
        return json(route, [
          { course_id: ROOT1, status: 'completed' },
          { course_id: ROOT2, status: 'completed' },
          { course_id: GATE, status: 'in_progress' },
        ]);
      }
      // The course-player's own unit_progress read (by enrollment_id) — none passed yet,
      // so the player resumes at the ordinal-1 lesson.
      if (path.endsWith('/unit_progress')) return json(route, []);
      if (path.endsWith('/competency_state')) return json(route, []);
      return json(route, []); // credentials, etc.
    });
  });

  // "We landed on the course-player at the lesson" — the player frame is mounted and the
  // first incomplete unit (the ordinal-1 lesson) renders its paced runner with the
  // embedded 2D sim, and we are NOT on the legacy standalone sim screen.
  const expectOnPlayerLesson = async (page: import('@playwright/test').Page) => {
    await expect(page).toHaveURL(/screen=course-player/);
    await expect(page.getByTestId('course-player')).toBeVisible();
    // the per-unit progress rail shows the course's units
    await expect(page.getByTestId('course-rail').locator('li').first()).toBeVisible();
    // the lesson runner is mounted inside the player, on step 1 with its embedded sim
    await expect(page.getByTestId('step-content')).toHaveAttribute('data-step', '1');
    await expect(page.getByTestId('i2d-submit').first()).toBeVisible();
    await expect(page.getByTestId('sim-missing')).toHaveCount(0);
    await expect(page.getByTestId('sim-unsupported')).toHaveCount(0);
    // we are NOT on the standalone branching sim screen
    await expect(page.getByTestId('node-prompt')).toHaveCount(0);
  };

  test('Home → the AC-203 course-player (the spotlight Resume action)', async ({ page }) => {
    await page.goto('/'); // Home is the default screen
    const resume = page.getByRole('button', { name: /Resume AC-203/i });
    await expect(resume).toBeVisible();
    await resume.click();
    await expectOnPlayerLesson(page);
  });

  test('Catalog → the AC-203 course-player (open-course on the card)', async ({ page }) => {
    await page.goto('/?screen=catalog');
    const card = page.locator('[data-course="AC-203"]');
    await expect(card).toHaveAttribute('data-state', 'in_progress'); // enrolled → Open renders
    await card.getByTestId('open-course').click();
    await expectOnPlayerLesson(page);
  });

  test('Constellation → the AC-203 course-player (the single open-course CTA)', async ({
    page,
  }) => {
    await page.goto('/?screen=constellation');
    await expect(page.getByTestId('shell')).toHaveText('dense'); // past the auth gate
    const node = page.locator('[data-course="AC-203"]');
    await expect(node).toHaveAttribute('data-state', 'in_progress'); // enrolled boss node
    await node.click();
    const open = page.getByTestId('open-course');
    await expect(open).toBeVisible();
    // the legacy SECONDARY open-sim affordance is GONE (unified to the course-player)
    await expect(page.getByTestId('open-sim')).toHaveCount(0);
    await open.click();
    await expectOnPlayerLesson(page);
  });

  test('the legacy ?screen=sim&course=AC-203 deep link no longer auto-routes to the sim', async ({
    page,
  }) => {
    await page.goto('/?screen=sim&course=AC-203');
    // The inSim branch is deleted: the standalone sim does NOT mount.
    await expect(page.getByTestId('node-prompt')).toHaveCount(0);
    await expect(page.getByTestId('ac203-stage')).toHaveCount(0);
    // It falls through to the default Home dashboard (a known screen renders).
    await expect(page.getByTestId('shell')).toBeVisible();
  });
});
