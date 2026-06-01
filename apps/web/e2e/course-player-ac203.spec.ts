import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

// Phase 2 — the AC-203 COURSE-PLAYER, end to end. The player chains the course's units
// (lesson → scenario → sim → signoff_prep → knowledge_check) into one mastery flow. No
// live Supabase in CI, so (a) seed a far-future fake session, (b) intercept the academy
// PostgREST reads with a deterministic fixture (incl. the Phase-2 course-player reads:
// the single-enrollment-by-user read with course_version_id + the unit_progress read),
// and (c) intercept the finalize-sim-attempt / grade-knowledge-check Edge Functions. The
// scoring ALGORITHMS + server-authoritative promotion are proven by the unit + Deno
// tests; this proves the WIRING: entry → player → per-kind dispatch → server-verdict gate.

const COMP = '000000c0-0000-0000-0000-00000000000f';
const ROOT1 = '000000c1-0000-0000-0000-0000000000a1';
const ROOT2 = '000000c1-0000-0000-0000-0000000000a2';
const GATE = '000000c1-0000-0000-0000-00000000000e'; // AC-203 course id
const CV = '000000c2-0000-0000-0000-00000000000e'; // AC-203 active/locked version
const ENR_ID = '000000e1-0000-0000-0000-000000000001';
const LESSON = '000000c3-000e-0000-0000-000000000001';
const SCENARIO = '000000c3-000e-0000-0000-000000000002';
const SIM = '000000c3-000e-0000-0000-000000000003';
const SIGNOFF_PREP = '000000c3-000e-0000-0000-000000000004';
const KC = '000000c3-000e-0000-0000-000000000005';

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
    active_version_id: CV,
    status: 'published',
  },
];
const PREREQS = [
  { course_id: GATE, requires_course_id: ROOT1, kind: 'hard_gate' },
  { course_id: GATE, requires_course_id: ROOT2, kind: 'hard_gate' },
];

// The full AC-203 ordinal spine (the course-player loadAllUnitsForCourse read).
const UNITS_FULL = [
  {
    id: LESSON,
    ordinal: 1,
    kind: 'lesson',
    title: 'Mag-Lock Fundamentals',
    competency_id: COMP,
    course_version_id: CV,
    content_ref: { mdx_key: 'ac-203/u1' },
    est_minutes: 50,
  },
  {
    id: SCENARIO,
    ordinal: 2,
    kind: 'scenario',
    title: 'Is This Egress Install Code-Compliant?',
    competency_id: COMP,
    course_version_id: CV,
    content_ref: {
      engine: 'branching_scenario',
      spec_key: 'ac-203/egress-compliant',
      mandatory: true,
      gate: 0.9,
    },
    est_minutes: 45,
  },
  {
    id: SIM,
    ordinal: 3,
    kind: 'sim',
    title: 'Virtual Door — Mag-Lock Build',
    competency_id: COMP,
    course_version_id: CV,
    content_ref: { engine: 'device_config', spec_key: 'ac-203/virtual-door-maglock', gate: 0.9 },
    est_minutes: 60,
  },
  {
    id: SIGNOFF_PREP,
    ordinal: 4,
    kind: 'signoff_prep',
    title: 'Field Sign-Off Prep',
    competency_id: COMP,
    course_version_id: CV,
    content_ref: { course: 'AC-203' },
    est_minutes: 25,
  },
  {
    id: KC,
    ordinal: 5,
    kind: 'knowledge_check',
    title: 'Egress Knowledge Check',
    competency_id: COMP,
    course_version_id: CV,
    content_ref: { item_set: 'ac-203', gate: 0.9 },
    est_minutes: 15,
  },
];
// catalogSource.loadCatalogGating reads a leaner units shape (no content_ref/title).
const UNITS_CATALOG = UNITS_FULL.map((u) => ({
  id: u.id,
  ordinal: u.ordinal,
  kind: u.kind,
  competency_id: u.competency_id,
  course_version_id: u.course_version_id,
}));

const LESSON_UNIT_ROW = {
  id: LESSON,
  course_version_id: CV,
  title: 'Mag-Lock Fundamentals',
  kind: 'lesson',
  content_ref: { mdx_key: 'ac-203/u1' },
};
const KC_UNIT_ROW = {
  id: KC,
  course_version_id: CV,
  title: 'Egress Knowledge Check',
  kind: 'knowledge_check',
  content_ref: { item_set: 'ac-203' },
};

const SAFETY_IDS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9'];
const NON_SAFETY_IDS = ['n1', 'n2', 'n3'];
const ITEMS = [
  ...SAFETY_IDS.map((id) => mkItem(id, true)),
  ...NON_SAFETY_IDS.map((id) => mkItem(id, false)),
];
function mkItem(id: string, safety: boolean) {
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

const RUBRIC = [
  {
    line_item_key: 'ac203.release_on_power_loss',
    dimension: 'safety_compliance',
    is_critical_safety: true,
    ordinal: 1,
    label: 'Door releases on power loss',
  },
  {
    line_item_key: 'ac203.push_to_exit_30s',
    dimension: 'safety_compliance',
    is_critical_safety: true,
    ordinal: 2,
    label: 'Releases on push-to-exit for >=30s',
  },
  {
    line_item_key: 'ac203.tech.fail_safe_wiring',
    dimension: 'technical_execution',
    is_critical_safety: false,
    ordinal: 3,
    label: 'Fail-safe wiring correct',
  },
];

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

// The branching egress-pass path (the 5 correct decisions through the AC-203 spec).
const PASS_PATH = ['failsafe', 'pushtoexit', 'mount_reachable', 'facp', 'document'];

interface SeedOpts {
  /** unit ids already 'passed' (the player resumes at the first incomplete). */
  passed?: string[];
}

async function seed(page: Page, opts: SeedOpts = {}) {
  const passed = opts.passed ?? [];
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

  await page.route('**/functions/v1/finalize-sim-attempt', (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: CORS, body: '' });
    return json(route, {
      outcome: 'pass',
      kind: 'pass',
      safety_veto_triggered: false,
      promoted: [COMP],
    });
  });
  await page.route('**/functions/v1/grade-knowledge-check', (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: CORS, body: '' });
    return json(route, { passed: true, promoted: COMP });
  });
  await page.route('**/functions/v1/sync', (route) => json(route, { accepted: [], rejected: [] }));

  const progressRows = passed.map((unit_id) => ({
    unit_id,
    status: 'passed',
    score: 1,
    attempts: 1,
  }));

  await page.route('**/rest/v1/**', (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
    const url = new URL(route.request().url());
    const path = url.pathname;
    const p = url.searchParams;
    if (path.endsWith('/courses')) {
      if (p.get('id'))
        return json(route, COURSES.find((c) => p.get('id')?.includes(c.id)) ?? COURSES[2]);
      return json(route, COURSES);
    }
    if (path.endsWith('/course_prerequisites')) return json(route, PREREQS);
    if (path.endsWith('/assessment_items')) return json(route, ITEMS);
    if (path.endsWith('/signoff_line_item_templates')) return json(route, RUBRIC);
    if (path.endsWith('/units')) {
      if (p.get('id')) return json(route, LESSON_UNIT_ROW); // lesson read by id (maybeSingle)
      if ((p.get('kind') ?? '').includes('knowledge_check')) return json(route, KC_UNIT_ROW);
      // The player's loadAllUnitsForCourse selects content_ref/est_minutes (full shape);
      // catalogSource.loadCatalogGating selects the lean shape. Detect by the select list.
      const select = p.get('select') ?? '';
      if (select.includes('content_ref')) return json(route, UNITS_FULL);
      return json(route, UNITS_CATALOG);
    }
    if (path.endsWith('/enrollments')) {
      if (method === 'POST') return json(route, [{ id: ENR_ID }], 201);
      if (p.get('user_id') && p.get('course_id'))
        return json(route, {
          id: ENR_ID,
          status: 'in_progress',
          course_version_id: CV,
          started_at: '2026-01-01T00:00:00Z',
        });
      return json(route, [
        { course_id: ROOT1, status: 'completed' },
        { course_id: ROOT2, status: 'completed' },
        { course_id: GATE, status: 'in_progress' },
      ]);
    }
    if (path.endsWith('/unit_progress')) return json(route, progressRows);
    if (path.endsWith('/competency_state')) return json(route, []);
    return json(route, []);
  });
}

const openFromCatalog = async (page: Page) => {
  await page.goto('/?screen=catalog');
  const card = page.locator('[data-course="AC-203"]');
  await expect(card).toHaveAttribute('data-state', 'in_progress');
  await card.getByTestId('open-course').click();
};

test('Catalog → screen=course-player (NOT screen=sim); the rail shows all 5 units', async ({
  page,
}) => {
  await seed(page);
  await openFromCatalog(page);
  await expect(page).toHaveURL(/screen=course-player/);
  await expect(page).not.toHaveURL(/screen=sim/);
  await expect(page.getByTestId('course-player')).toBeVisible();
  await expect(page.getByTestId('course-rail').locator('li')).toHaveCount(5);
});

test('Home spotlight → the AC-203 course-player', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  const resume = page.getByRole('button', { name: /Resume AC-203/i });
  await expect(resume).toBeVisible();
  await resume.click();
  await expect(page).toHaveURL(/screen=course-player/);
  await expect(page.getByTestId('course-player')).toBeVisible();
});

test('Constellation → the AC-203 course-player (single open-course CTA; no open-sim)', async ({
  page,
}) => {
  await seed(page);
  await page.goto('/?screen=constellation');
  await expect(page.getByTestId('shell')).toHaveText('dense');
  await page.locator('[data-course="AC-203"]').click();
  const open = page.getByTestId('open-course');
  await expect(open).toBeVisible();
  await expect(page.getByTestId('open-sim')).toHaveCount(0);
  await open.click();
  await expect(page).toHaveURL(/screen=course-player/);
  await expect(page.getByTestId('course-player')).toBeVisible();
});

test('resumes at the lesson, then "Continue the course" advances to the scenario', async ({
  page,
}) => {
  await seed(page);
  await openFromCatalog(page);
  // resumes at the ordinal-1 lesson (paced runner, step 1, embedded sim)
  await expect(page.getByTestId('step-content')).toHaveAttribute('data-step', '1');
  await expect(page.getByTestId('i2d-submit').first()).toBeVisible();
  // walk Next to the last step → "Continue the course" advances the unit
  const next = page.getByTestId('lesson-next');
  for (let i = 0; i < 10 && (await next.textContent()) !== 'Continue the course'; i += 1)
    await next.click();
  await expect(next).toHaveText('Continue the course');
  await next.click();
  // now on the scenario (branching) unit — its first decision prompt is on screen
  await expect(page.getByTestId('node-prompt')).toBeVisible();
  await expect(page.locator('[data-choice="failsafe"]')).toBeVisible();
});

test('scenario PASS → finalize-sim-attempt called → advances to the device_config sim', async ({
  page,
}) => {
  let finalizeCalled = false;
  await seed(page, { passed: [LESSON] }); // resume directly at the scenario
  await page.route('**/functions/v1/finalize-sim-attempt', (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: CORS, body: '' });
    finalizeCalled = true;
    return json(route, {
      outcome: 'pass',
      kind: 'pass',
      safety_veto_triggered: false,
      promoted: [COMP],
    });
  });
  await openFromCatalog(page);
  await expect(page.getByTestId('node-prompt')).toBeVisible(); // the scenario unit
  for (const choice of PASS_PATH) await page.locator(`[data-choice="${choice}"]`).click();
  // the server verdict pass promotes + ADVANCES to the device_config sim build (the
  // scenario screen unmounts on advance, so we assert the advance itself, not its
  // transient 'promoted' record-state).
  await expect(page.getByTestId('submit')).toBeVisible();
  await expect(page.locator('[data-screen="wiring"]')).toBeVisible();
  expect(finalizeCalled).toBe(true);
});

test('a scenario SAFETY VETO is blocked and never advances (the mastery gate holds)', async ({
  page,
}) => {
  await seed(page, { passed: [LESSON] });
  await openFromCatalog(page);
  await expect(page.getByTestId('node-prompt')).toBeVisible();
  await page.locator('[data-choice="faillocked"]').click(); // the life-safety trap
  const badge = page.getByTestId('verdict').getByRole('status');
  await expect(badge).toHaveAttribute('data-token', 'safety_veto');
  await expect(page.getByTestId('veto-feedback')).toBeVisible();
  await expect(page.getByTestId('record-state')).toHaveAttribute('data-record', 'blocked');
  // it did NOT advance — still the scenario, no device_config sim mounted
  await expect(page.locator('[data-screen="wiring"]')).toHaveCount(0);
});

test('OFFLINE: a passing scenario shows pending + never fakes a pass / never advances', async ({
  page,
  context,
}) => {
  await seed(page, { passed: [LESSON] });
  await openFromCatalog(page);
  await expect(page.getByTestId('node-prompt')).toBeVisible();
  await context.setOffline(true);
  for (const choice of PASS_PATH) await page.locator(`[data-choice="${choice}"]`).click();
  // never a faked pass offline (Inv. 5) — pending, and the unit does NOT advance
  await expect(page.getByTestId('record-state')).toHaveAttribute('data-record', 'pending_offline');
  await expect(page.locator('[data-screen="wiring"]')).toHaveCount(0);
});

test('signoff_prep is informational + the KC reuses the lesson item path', async ({ page }) => {
  await seed(page, { passed: [LESSON, SCENARIO, SIM] }); // resume at signoff_prep
  await openFromCatalog(page);
  // signoff_prep shows the rubric (NOT the evaluator's gate) + advances freely
  await expect(page.getByTestId('signoff-prep')).toBeVisible();
  await expect(page.locator('[data-line="ac203.release_on_power_loss"]')).toBeVisible();
  await page.getByTestId('signoff-prep-done').click();
  // now the KC unit (items via loadLesson(kcUnit).knowledgeCheck.items)
  await expect(page.getByTestId('knowledge-check')).toBeVisible();
});

test('the legacy ?screen=sim&course=AC-203 deep link no longer auto-routes', async ({ page }) => {
  await seed(page);
  await page.goto('/?screen=sim&course=AC-203');
  await expect(page.getByTestId('ac203-stage')).toHaveCount(0);
  await expect(page.getByTestId('node-prompt')).toHaveCount(0);
  await expect(page.getByTestId('course-player')).toHaveCount(0);
  await expect(page.getByTestId('shell')).toBeVisible(); // falls through to Home
});

test('a11y: the course-player frame + the progress rail pass axe and are colorblind-safe', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, { passed: [LESSON] }); // a stable non-lesson unit (the scenario) on screen
  await openFromCatalog(page);
  await expect(page.getByTestId('node-prompt')).toBeVisible();
  // the rail is a labelled nav>ol>li, each unit pip carries a per-unit aria-label
  const rail = page.getByTestId('course-rail');
  await expect(rail).toHaveAttribute('aria-label', /Course progress/i);
  const firstPip = rail.locator('li').first();
  await expect(firstPip).toHaveAttribute('aria-label', /Unit 1 of 5:/);
  await expect(firstPip).toHaveAttribute('data-state', 'done'); // lesson passed → glyph+state, not colour alone
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});
