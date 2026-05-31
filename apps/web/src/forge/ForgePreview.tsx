import {
  BranchingSim,
  CalculatorSim,
  DeviceConfigSim,
  Interaction2dSim,
  loadSpec,
  type TelemetrySink,
} from '@redex/sim-engine';
import {
  aeroFixture,
  branchingExample,
  calculatorExample,
  deviceConfigExample,
  interaction2dExample,
} from '@redex/sim-schemas';
import { useMemo, type ReactElement } from 'react';
import { enqueueXapi } from '../offline/xapi-queue';

const SIMS = {
  branching: branchingExample,
  'device-config': deviceConfigExample,
  'interaction-2d': interaction2dExample,
  calculator: calculatorExample,
} as const;
type Which = keyof typeof SIMS;

/**
 * The Forge preview/sandbox (F5 §6, extended for F5b's engines #5/#6) — renders a
 * reference sim in the real browser (the M9 authoring harness reuses this path). It
 * wires the sim's xAPI telemetry sink to F4's OFFLINE Dexie queue, so running a sim
 * here actually queues statements offline (flushed via /sync) — the F4↔F5 contract,
 * live. Public route (no auth). ?sim= selects the engine, ?mode= the render mode.
 */
export function ForgePreview(): ReactElement {
  const params = new URLSearchParams(window.location.search);
  const simParam = params.get('sim');
  const which: Which = simParam && simParam in SIMS ? (simParam as Which) : 'branching';
  const mode = params.get('mode') === 'fallback2d' ? 'fallback2d' : 'rich';

  const instance = useMemo(() => {
    const sink: TelemetrySink = (e) => {
      void enqueueXapi({
        id: e.client_event_uuid,
        statement: e as unknown as Record<string, unknown>,
        device_ts: e.timestamp ?? new Date().toISOString(),
      });
    };
    // device-config replays a sanitized fixture; the others take none.
    const opts =
      which === 'device-config'
        ? { telemetrySink: sink, fixture: aeroFixture, context: { offline: true } }
        : { telemetrySink: sink, context: { offline: true } };
    return loadSpec(SIMS[which], opts);
  }, [which]);

  return (
    <main className="min-h-screen bg-canvas p-6 text-ink">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <h1 className="text-title font-bold text-redex">Forge preview — {which}</h1>
        {instance.engineKind === 'branching_scenario' ? (
          <BranchingSim instance={instance} mode={mode} />
        ) : instance.engineKind === 'device_config' ? (
          <DeviceConfigSim instance={instance} mode={mode} />
        ) : instance.engineKind === 'interaction_2d' ? (
          <Interaction2dSim instance={instance} mode={mode} />
        ) : (
          <CalculatorSim instance={instance} mode={mode} />
        )}
      </div>
    </main>
  );
}
