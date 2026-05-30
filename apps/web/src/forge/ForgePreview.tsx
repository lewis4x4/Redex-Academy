import { BranchingSim, DeviceConfigSim, loadSpec, type TelemetrySink } from '@redex/sim-engine';
import { aeroFixture, branchingExample, deviceConfigExample } from '@redex/sim-schemas';
import { useMemo, type ReactElement } from 'react';
import { enqueueXapi } from '../offline/xapi-queue';

/**
 * The Forge preview/sandbox (F5 §6) — renders a reference sim in the real browser
 * (the M9 authoring harness will reuse this path). It wires the sim's xAPI
 * telemetry sink to F4's OFFLINE Dexie queue, so running a sim here actually queues
 * statements offline (flushed via /sync) — the F4↔F5 contract, live. Public route
 * (no auth) so the authoring preview works standalone. ?sim= and ?mode= select.
 */
export function ForgePreview(): ReactElement {
  const params = new URLSearchParams(window.location.search);
  const which = params.get('sim') === 'device-config' ? 'device-config' : 'branching';
  const mode = params.get('mode') === 'fallback2d' ? 'fallback2d' : 'rich';

  const instance = useMemo(() => {
    const sink: TelemetrySink = (e) => {
      void enqueueXapi({
        id: e.client_event_uuid,
        statement: e as unknown as Record<string, unknown>,
        device_ts: e.timestamp ?? new Date().toISOString(),
      });
    };
    return which === 'device-config'
      ? loadSpec(deviceConfigExample, {
          telemetrySink: sink,
          fixture: aeroFixture,
          context: { offline: true },
        })
      : loadSpec(branchingExample, { telemetrySink: sink, context: { offline: true } });
  }, [which]);

  return (
    <main className="min-h-screen bg-canvas p-6 text-ink">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <h1 className="text-title font-bold text-redex">Forge preview — {which}</h1>
        {instance.engineKind === 'branching_scenario' ? (
          <BranchingSim instance={instance} mode={mode} />
        ) : (
          <DeviceConfigSim instance={instance} mode={mode} />
        )}
      </div>
    </main>
  );
}
