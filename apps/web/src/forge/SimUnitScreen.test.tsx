import 'fake-indexeddb/auto';
import { i18n, initI18n } from '@redex/i18n';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Drive the screen via a CONTROLLABLE fake instance (mock loadSpec) + light engine
// renderers — so we test SimUnitScreen's gating logic (when it calls onComplete /
// finalize), not the engine internals (proven elsewhere). The finalize Edge Function
// invoke is mocked to assert the server-authoritative branching path + that
// device_config never calls it (it can't re-score that kind yet).
type Verdict = {
  outcome: 'pass' | 'fail';
  safety_veto_triggered: boolean;
  score: { scaled: number };
  safety_score: number;
  state: { token: string; shape: string; label_i18n: string; color_role: string };
};

const h = vi.hoisted(() => ({
  online: true,
  engineKind: 'branching_scenario' as 'branching_scenario' | 'device_config',
  verdict: null as Verdict | null,
  invoke: vi.fn(async () => ({ data: { outcome: 'pass' }, error: null })),
  enqueue: vi.fn(async () => {}),
}));

function makeInstance() {
  const state = { complete: true, path: [], editOrder: [] as string[] };
  const store = {
    getState: () => state,
    subscribe: () => () => {},
  };
  return {
    engineKind: h.engineKind,
    envelope: { title_i18n: 'sim.ac203.egress-fail.title' },
    store,
    isComplete: () => state.complete,
    getVerdict: (): Verdict =>
      h.verdict ?? {
        outcome: 'pass',
        safety_veto_triggered: false,
        score: { scaled: 1 },
        safety_score: 1,
        state: {
          token: 'pass',
          shape: 'check',
          label_i18n: 'sim.common.state.pass',
          color_role: 'success',
        },
      },
    currentNode: () => ({ type: 'terminal', outcome_i18n: 'x', state: undefined }),
    reset: () => {},
    t: (k: string) => k,
  };
}

vi.mock('@redex/sim-engine', () => ({
  loadSpec: () => makeInstance(),
  BranchingSim: () => <div data-testid="branching-render" />,
  DeviceConfigSim: () => <div data-testid="device-render" />,
  StateBadge: () => <span role="status" />,
}));
vi.mock('@redex/sim-schemas', () => ({
  AC203_UNIT_SIMS: { 'ac-203/egress-compliant': {}, 'ac-203/virtual-door-maglock': {} },
}));
vi.mock('../offline/sync-state', () => ({ useSyncState: () => ({ online: h.online }) }));
vi.mock('../offline/sync-queue', () => ({ enqueue: h.enqueue }));
vi.mock('../offline/xapi-queue', () => ({ enqueueXapi: vi.fn(async () => {}) }));
vi.mock('../components/SyncStatus', () => ({
  SyncStatus: () => <div data-testid="sync-status" />,
}));
vi.mock('../auth/supabaseClient', () => ({ supabase: { functions: { invoke: h.invoke } } }));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    session: { user: { id: 'u1' } },
    claims: { sub: 'u1', org_id: 'o1' },
    loading: false,
  }),
}));

import { SimUnitScreen } from './SimUnitScreen';

const pass: Verdict = {
  outcome: 'pass',
  safety_veto_triggered: false,
  score: { scaled: 1 },
  safety_score: 1,
  state: {
    token: 'pass',
    shape: 'check',
    label_i18n: 'sim.common.state.pass',
    color_role: 'success',
  },
};
const veto: Verdict = {
  outcome: 'fail',
  safety_veto_triggered: true,
  score: { scaled: 0 },
  safety_score: 0,
  state: {
    token: 'safety_veto',
    shape: 'octagon',
    label_i18n: 'sim.common.state.safety_stop',
    color_role: 'danger',
  },
};

describe('SimUnitScreen — server-verdict gating + safety veto', () => {
  beforeEach(() => {
    initI18n('en');
    void i18n.changeLanguage('en');
    h.online = true;
    h.engineKind = 'branching_scenario';
    h.verdict = null;
    h.invoke.mockClear();
    h.enqueue.mockClear();
  });

  it('branching pass ONLINE: calls finalize-sim-attempt then advances (onComplete)', async () => {
    h.engineKind = 'branching_scenario';
    h.verdict = pass;
    const onComplete = vi.fn();
    render(
      <SimUnitScreen
        specKey="ac-203/egress-compliant"
        engineKind="branching_scenario"
        onComplete={onComplete}
        onExit={() => {}}
      />,
    );
    await waitFor(() =>
      expect(h.invoke).toHaveBeenCalledWith('finalize-sim-attempt', expect.anything()),
    );
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('record-state')).toHaveAttribute('data-record', 'promoted');
  });

  it('a safety veto is BLOCKED: never advances, never calls finalize', async () => {
    h.engineKind = 'branching_scenario';
    h.verdict = veto;
    const onComplete = vi.fn();
    render(
      <SimUnitScreen
        specKey="ac-203/egress-compliant"
        engineKind="branching_scenario"
        onComplete={onComplete}
        onExit={() => {}}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('record-state')).toHaveAttribute('data-record', 'blocked'),
    );
    expect(h.invoke).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('OFFLINE: a passing run shows pending_offline and never advances / never fakes a pass', async () => {
    h.engineKind = 'branching_scenario';
    h.verdict = pass;
    h.online = false;
    const onComplete = vi.fn();
    render(
      <SimUnitScreen
        specKey="ac-203/egress-compliant"
        engineKind="branching_scenario"
        onComplete={onComplete}
        onExit={() => {}}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('record-state')).toHaveAttribute('data-record', 'pending_offline'),
    );
    expect(h.invoke).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('device_config pass ONLINE: advances on the LOCAL verdict (pending server verify), no finalize call', async () => {
    h.engineKind = 'device_config';
    h.verdict = pass;
    const onComplete = vi.fn();
    render(
      <SimUnitScreen
        specKey="ac-203/virtual-door-maglock"
        engineKind="device_config"
        onComplete={onComplete}
        onExit={() => {}}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('record-state')).toHaveAttribute(
        'data-record',
        'pending_server_verify',
      ),
    );
    // finalize-sim-attempt is branching-only → never called for device_config
    expect(h.invoke).not.toHaveBeenCalled();
    // but the local engine ran the real Verdict (incl. safety-veto) → a true pass advances
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('device_config VETO ONLINE: blocked, never advances (the local safety-veto still gates)', async () => {
    h.engineKind = 'device_config';
    h.verdict = veto;
    const onComplete = vi.fn();
    render(
      <SimUnitScreen
        specKey="ac-203/virtual-door-maglock"
        engineKind="device_config"
        onComplete={onComplete}
        onExit={() => {}}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('record-state')).toHaveAttribute('data-record', 'blocked'),
    );
    expect(onComplete).not.toHaveBeenCalled();
  });
});
