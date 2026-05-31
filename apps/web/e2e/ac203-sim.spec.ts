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
// AC-203's active version grants the EGRESS competency → flipping it to sim_passed advances the node.
const UNITS = [{ competency_id: COMP, course_version_id: GATE_V }];

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
    if (path.endsWith('/courses')) return json(route, COURSES);
    if (path.endsWith('/course_prerequisites')) return json(route, PREREQS);
    if (path.endsWith('/units')) return json(route, UNITS);
    if (path.endsWith('/enrollments')) {
      if (method === 'POST')
        return json(route, [{ id: '000000e1-0000-0000-0000-000000000001' }], 201);
      return json(route, [
        { course_id: ROOT1, status: 'completed' },
        { course_id: ROOT2, status: 'completed' },
        { course_id: GATE, status: 'in_progress' },
      ]);
    }
    if (path.endsWith('/competency_state'))
      return json(route, promoted ? [{ competency_id: COMP, status: 'sim_passed' }] : []);
    return json(route, []); // credentials, etc.
  });
});

async function openSim(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByTestId('shell')).toHaveText('dense'); // past the auth gate
  const gate = page.locator('[data-course="AC-203"]');
  await expect(gate).toHaveAttribute('data-state', 'in_progress'); // enrolled boss node
  await gate.click();
  const open = page.getByTestId('open-sim');
  await expect(open).toBeVisible();
  await open.click();
  await expect(page.getByTestId('node-prompt')).toBeVisible(); // sim screen mounted
}

test('boss node → correct egress build PASSES and the Constellation node advances', async ({
  page,
}) => {
  await openSim(page);
  for (const choice of ['failsafe', 'pushtoexit', 'mount_reachable', 'facp', 'document']) {
    await page.locator(`[data-choice="${choice}"]`).click();
  }
  const badge = page.getByTestId('verdict').getByRole('status');
  await expect(badge).toHaveAttribute('data-token', 'pass');
  // server-authoritative promotion ran → the screen reports the node advanced
  await expect(page.getByTestId('record-state')).toHaveAttribute('data-record', 'promoted');

  // back to the map → the resolver re-reads competency_state → AC-203 is now passed
  await page.getByTestId('exit-sim').click();
  await expect(page.locator('[data-course="AC-203"]')).toHaveAttribute('data-state', 'passed');
});

test('a wrong life-safety choice VETOES, blocks the node, and shows the coded post-mortem', async ({
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

  // a veto never advances the node
  await page.getByTestId('exit-sim').click();
  await expect(page.locator('[data-course="AC-203"]')).toHaveAttribute('data-state', 'in_progress');
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

  // back online + to the map → the node did NOT advance (promotion waits for the server)
  await context.setOffline(false);
  await page.getByTestId('exit-sim').click();
  await expect(page.locator('[data-course="AC-203"]')).toHaveAttribute('data-state', 'in_progress');
});
