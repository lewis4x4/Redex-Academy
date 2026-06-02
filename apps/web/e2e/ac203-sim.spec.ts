import { expect, test, type Route } from '@playwright/test';

// M3 — the AC-203 branching egress-fail simulation, end to end (the product's first
// playable sim). No live Supabase in CI, so (a) seed a far-future fake session into
// the storage key supabase-js reads (drives the REAL authed shell + Constellation +
// sim screen), and (b) intercept the academy PostgREST reads + the finalize Edge
// Function with a deterministic fixture. This proves the boss-node → play → verdict →
// node-advance wiring in a real browser; the Verdict ALGORITHM is proven exhaustively
// by the unit tests (sim-engine core.test.ts, finalize score.test.ts) and the
// server-authoritative promotion by the Edge Function's deno test.

const COMP = '000000c0-0000-0000-0000-00000000000f'; // EGRESS.MAGLOCK_FAILSAFE
const ROOT1 = '000000c1-0000-0000-0000-0000000000a1'; // FND-101
const ROOT2 = '000000c1-0000-0000-0000-0000000000a2'; // AC-201
const GATE = '000000c1-0000-0000-0000-00000000000e'; // AC-203 (boss)
const GATE_V = '000000c2-0000-0000-0000-00000000000e'; // AC-203 active version

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
    active_version_id: GATE_V,
    status: 'published',
  },
];
const PREREQS = [
  { course_id: GATE, requires_course_id: ROOT1, kind: 'hard_gate' },
  { course_id: GATE, requires_course_id: ROOT2, kind: 'hard_gate' },
];
const ENR_ID = '000000e1-0000-0000-0000-000000000001';
const LESSON = '000000c3-000e-0000-0000-000000000001';
const SCENARIO = '000000c3-000e-0000-0000-000000000002';
const SIM = '000000c3-000e-0000-0000-000000000003';
const SIGNOFF_PREP = '000000c3-000e-0000-0000-000000000004';
const KC = '000000c3-000e-0000-0000-000000000005';

// The full AC-203 ordinal spine (the course-player loadAllUnitsForCourse read, which
// selects content_ref/title/est_minutes) + the lean catalog shape (loadCatalogGating).
const UNITS_FULL = [
  {
    id: LESSON,
    ordinal: 1,
    kind: 'lesson',
    title: 'Mag-Lock Fundamentals',
    competency_id: COMP,
    course_version_id: GATE_V,
    content_ref: { mdx_key: 'ac-203/u1' },
    est_minutes: 50,
  },
  {
    id: SCENARIO,
    ordinal: 2,
    kind: 'scenario',
    title: 'Is This Egress Install Code-Compliant?',
    competency_id: COMP,
    course_version_id: GATE_V,
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
    title: 'Virtual Door Build',
    competency_id: COMP,
    course_version_id: GATE_V,
    content_ref: { engine: 'device_config', spec_key: 'ac-203/virtual-door-maglock', gate: 0.9 },
    est_minutes: 60,
  },
  {
    id: SIGNOFF_PREP,
    ordinal: 4,
    kind: 'signoff_prep',
    title: 'Sign-Off Prep',
    competency_id: COMP,
    course_version_id: GATE_V,
    content_ref: { course: 'AC-203' },
    est_minutes: 25,
  },
  {
    id: KC,
    ordinal: 5,
    kind: 'knowledge_check',
    title: 'Knowledge Check',
    competency_id: COMP,
    course_version_id: GATE_V,
    content_ref: { item_set: 'ac-203' },
    est_minutes: 15,
  },
];
const UNITS_CATALOG = UNITS_FULL.map((u) => ({
  id: u.id,
  ordinal: u.ordinal,
  kind: u.kind,
  competency_id: u.competency_id,
  course_version_id: u.course_version_id,
}));

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

  // `promoted` flips when the finalize Edge Function is invoked on a passing run; the
  // next competency_state read then returns sim_passed → the resolver advances AC-203.
  let promoted = false;
  await page.route('**/functions/v1/finalize-sim-attempt', (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: CORS, body: '' });
    promoted = true;
    return json(route, {
      outcome: 'pass',
      kind: 'pass',
      safety_veto_triggered: false,
      promoted: [COMP],
    });
  });
  await page.route('**/functions/v1/sync', (route) => json(route, { accepted: [], rejected: [] }));

  await page.route('**/rest/v1/**', (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
    const path = new URL(route.request().url()).pathname;
    const p = new URL(route.request().url()).searchParams;
    if (path.endsWith('/courses')) {
      if (p.get('id'))
        return json(route, COURSES.find((c) => p.get('id')?.includes(c.id)) ?? COURSES[2]);
      return json(route, COURSES);
    }
    if (path.endsWith('/course_prerequisites')) return json(route, PREREQS);
    if (path.endsWith('/units')) {
      const select = p.get('select') ?? '';
      return json(route, select.includes('content_ref') ? UNITS_FULL : UNITS_CATALOG);
    }
    if (path.endsWith('/enrollments')) {
      if (method === 'POST') return json(route, [{ id: ENR_ID }], 201);
      if (p.get('user_id') && p.get('course_id'))
        return json(route, {
          id: ENR_ID,
          status: 'in_progress',
          course_version_id: GATE_V,
          started_at: '2026-01-01T00:00:00Z',
        });
      return json(route, [
        { course_id: ROOT1, status: 'completed' },
        { course_id: ROOT2, status: 'completed' },
        { course_id: GATE, status: 'in_progress' },
      ]);
    }
    // The course-player resumes at the first incomplete unit: the lesson is pre-'passed'
    // so the SCENARIO (the branching sim) is the unit on screen.
    if (path.endsWith('/unit_progress'))
      return json(route, [{ unit_id: LESSON, status: 'passed', score: 1, attempts: 1 }]);
    if (path.endsWith('/competency_state'))
      return json(route, promoted ? [{ competency_id: COMP, status: 'sim_passed' }] : []);
    return json(route, []); // credentials, etc.
  });
});

async function openSim(page: import('@playwright/test').Page) {
  // Phase 2: the branching scenario is reached by PROGRESSING through the course-player
  // (the standalone ?screen=sim entry is retired). The lesson is pre-'passed' (see the
  // unit_progress mock), so the player resumes directly on the SCENARIO unit.
  await page.goto('/?screen=constellation');
  await expect(page.getByTestId('shell')).toHaveText('dense'); // past the auth gate
  const gate = page.locator('[data-course="AC-203"]');
  await expect(gate).toHaveAttribute('data-state', 'in_progress'); // enrolled boss node
  await gate.click();
  const open = page.getByTestId('open-course');
  await expect(open).toBeVisible();
  await open.click();
  await expect(page.getByTestId('node-prompt')).toBeVisible(); // the scenario unit mounted
}

test('progressing → correct egress build PASSES (server-authoritative) and advances the unit', async ({
  page,
}) => {
  await openSim(page);
  for (const choice of ['failsafe', 'pushtoexit', 'mount_reachable', 'facp', 'document']) {
    await page.locator(`[data-choice="${choice}"]`).click();
  }
  // server-authoritative promotion ran → the player ADVANCES to the next unit (the
  // device_config virtual-door build). The scenario screen unmounts on advance, so the
  // advance itself is the proof (the transient pass badge / 'promoted' record-state are
  // exercised in the unit tests).
  await expect(page.locator('[data-screen="wiring"]')).toBeVisible();
});

test('a wrong life-safety choice VETOES, blocks the unit, and shows the coded post-mortem', async ({
  page,
}) => {
  await openSim(page);
  await page.locator('[data-choice="faillocked"]').click(); // fail-locked egress = the life-safety trap

  const badge = page.getByTestId('verdict').getByRole('status');
  await expect(badge).toHaveAttribute('data-token', 'safety_veto');
  await expect(badge).toHaveAttribute('data-shape', 'octagon'); // shape, not colour alone
  await expect(page.getByTestId('veto-feedback')).toBeVisible();

  // the post-mortem cites the governing code line and drops back to the deciding node
  const overlay = page.getByTestId('postmortem-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText('NFPA 101 §7.2.1.6.2');
  await expect(page.getByTestId('record-state')).toHaveAttribute('data-record', 'blocked');

  await page.getByRole('button', { name: /Return to the decision/i }).click();
  await expect(page.getByTestId('node-prompt')).toBeVisible(); // back at the decision, re-choosable
  await expect(page.locator('[data-choice="failsafe"]')).toBeVisible();

  // a veto never advances the unit (still the scenario, no device_config build mounted)
  await expect(page.locator('[data-screen="wiring"]')).toHaveCount(0);
});

test('OFFLINE: a finished run queues + shows "completes on reconnect" and never fakes a pass', async ({
  page,
  context,
}) => {
  await openSim(page);
  await context.setOffline(true);
  for (const choice of ['failsafe', 'pushtoexit', 'mount_reachable', 'facp', 'document']) {
    await page.locator(`[data-choice="${choice}"]`).click();
  }
  // the attempt is recorded locally, but NO pass is granted offline (server-only promotion)
  await expect(page.getByTestId('record-state')).toHaveAttribute('data-record', 'pending_offline');
  const status = page.getByLabel('Sync status');
  await expect(status).toHaveAttribute('data-sync', 'offline');
  await expect(status).toContainText('will complete on reconnect');

  // the unit did NOT advance — promotion waits for the server (no device_config build)
  await expect(page.locator('[data-screen="wiring"]')).toHaveCount(0);
});
