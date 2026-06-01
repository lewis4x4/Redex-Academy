import {
  BranchingSim,
  DeviceConfigSim,
  type BranchingInstance,
  type DeviceConfigInstance,
  loadSpec,
  StateBadge,
  type TelemetrySink,
} from '@redex/sim-engine';
import { AC203_UNIT_SIMS } from '@redex/sim-schemas';
import { Button, Card, Meter, Modal, ProgressDots, ScreenHead, SimStage } from '@redex/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { supabase } from '../auth/supabaseClient';
import { useSyncState } from '../offline/sync-state';
import { enqueue } from '../offline/sync-queue';
import { enqueueXapi } from '../offline/xapi-queue';
import { SyncStatus } from '../components/SyncStatus';
import { buildAttemptEvents } from './ac203Recording';

type RenderMode = 'rich' | 'fallback2d';
type RecordState =
  | 'idle'
  | 'recording'
  | 'promoted'
  | 'pending_offline'
  | 'pending_server_verify'
  | 'blocked';

/** The supported unit engine kinds in the course-player (scenario = branching). */
export type SimEngineKind = 'branching_scenario' | 'device_config';

/** The committed runtime specs keyed by spec_key (units.content_ref.spec_key). The
 *  course-player resolves the unit's spec from here — no extra DB round-trip. */
const UNIT_SPECS: Record<string, unknown> = AC203_UNIT_SIMS;

/** sim_definitions ids per spec_key (FK on the recorded attempt + the finalize call).
 *  Sourced from seed/0003_ac203_content.sql (kept in sync with the seed rows). */
const SIM_DEFINITION_ID: Record<string, string> = {
  'ac-203/egress-compliant': '000000d1-0000-0000-0000-00000000000e',
  'ac-203/virtual-door-maglock': '000000d1-000e-0000-0000-000000000005',
};

// The ordered branching decision nodes (the AC-203 egress flow), for the progress rail.
const BRANCHING_DECISIONS = ['failstate', 'rex', 'placement', 'firealarm', 'closeout'] as const;

/** Subscribe to the headless instance store without importing zustand directly. */
function useInstanceTick(instance: BranchingInstance | DeviceConfigInstance): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setTick((n) => n + 1); // resync when the instance (locale) changes
    return instance.store.subscribe(() => setTick((n) => n + 1));
  }, [instance]);
  return tick;
}

/** done / fail / current / todo per decision, derived purely from the runtime path +
 *  the final verdict (no spec access needed — works for any branching spec). A
 *  completed run that did NOT pass marks its LAST taken decision as the failure point. */
function branchingSteps(instance: BranchingInstance): ('done' | 'fail' | 'current' | 'todo')[] {
  const state = instance.store.getState();
  const taken = new Set(state.path.map((p) => p.nodeId));
  const lastTaken = state.path.at(-1)?.nodeId ?? null;
  const failed = state.complete && instance.getVerdict().outcome !== 'pass';
  return BRANCHING_DECISIONS.map((d) => {
    if (state.currentNodeId === d && !state.complete) return 'current';
    if (!taken.has(d)) return 'todo';
    return failed && d === lastTaken ? 'fail' : 'done';
  });
}

/** On-brand SVG tableau standing in for the (release-gated) sanitized R2 photo.
 *  Decorative shapes only; the accessible name is the spec's alt text. Token colours. */
function MediaTableau({ kind, label }: { kind: 'door' | 'trapped'; label: string }) {
  return (
    <figure className="m-0 overflow-hidden rounded-card border border-line bg-surface-2">
      <svg viewBox="0 0 320 150" role="img" aria-label={label} className="h-36 w-full">
        <rect x="0" y="0" width="320" height="150" className="fill-surface-3" />
        <rect
          x="120"
          y="24"
          width="80"
          height="110"
          rx="3"
          className={
            kind === 'trapped' ? 'fill-veto-tint stroke-veto-edge' : 'fill-surface-1 stroke-line'
          }
          strokeWidth="2"
        />
        <rect x="150" y="20" width="20" height="10" rx="2" className="fill-redex stroke-red-edge" />
        <circle cx="206" cy="84" r="5" className="fill-green stroke-green-edge" />
        {kind === 'trapped' ? (
          <g className="fill-ink-muted">
            <circle cx="150" cy="96" r="9" />
            <circle cx="170" cy="100" r="9" />
            <circle cx="136" cy="104" r="8" />
            <rect x="132" y="112" width="56" height="26" rx="6" />
          </g>
        ) : (
          <circle cx="160" cy="92" r="10" className="fill-ink-muted" />
        )}
      </svg>
      <figcaption className="px-3 py-2 text-caption text-ink-muted">{label}</figcaption>
    </figure>
  );
}

export interface SimUnitScreenProps {
  /** The unit being rendered (for telemetry context; not strictly required). */
  unitId?: string;
  /** content_ref.spec_key — resolves the committed runtime spec + sim_definition_id. */
  specKey: string;
  /** content_ref.engine — 'branching_scenario' (scenario) | 'device_config' (sim). */
  engineKind: SimEngineKind;
  /** Course-player title override; defaults to the spec's own title. */
  title?: string;
  /** Called ONLY on a true, server-verified (branching) / locally-verified (device_config)
   *  pass — never on a fail/veto and never on an offline gate. Advances the unit. */
  onComplete: () => void;
  /** Return to the caller (course-player → constellation, or the player's exit). */
  onExit: () => void;
}

/**
 * SimUnitScreen — the generalized Forge unit renderer (Phase 2). Dispatches by
 * engineKind: a branching_scenario (the AC-203 egress decision tree, the rich bespoke
 * stage + the BranchingSim 2D fallback) or a device_config build (the DeviceConfigSim
 * form). It records the append-only "Do" attempt (F4 /sync) and gates advancement on a
 * SERVER verdict for branching (finalize-sim-attempt re-scores from the spec) — never a
 * faked pass offline (Inv. 5). A fail / safety-veto is BLOCKED and never advances
 * (Inv. 1). The server verdict + safety-veto path is UNCHANGED from M3.
 *
 * device_config NOTE (open question — see the report): finalize-sim-attempt is
 * branching-only today (it rejects kind != 'branching_scenario' with unsupported_kind).
 * The device_config engine runs the SAME real scoring + safety-veto Verdict locally, so
 * a fail/veto still blocks; on a true LOCAL pass the unit advances with a clearly-labeled
 * "pending server verification on reconnect" note. We do NOT fabricate a server pass —
 * extending finalize-sim-attempt to re-score device_config is a documented follow-up.
 */
export function SimUnitScreen({
  unitId,
  specKey,
  engineKind,
  title,
  onComplete,
  onExit,
}: SimUnitScreenProps) {
  const { t } = useTranslation();
  const { claims } = useAuth();
  const { online } = useSyncState();
  const [locale, setLocale] = useState<'en' | 'es'>('en');
  const [mode, setMode] = useState<RenderMode>('rich');
  const [lastConsequence, setLastConsequence] = useState<string | null>(null);
  const [record, setRecord] = useState<RecordState>('idle');
  const recordedKeys = useRef<Set<string>>(new Set());

  const simDefinitionId = SIM_DEFINITION_ID[specKey] ?? '';

  const instance = useMemo(() => {
    const sink: TelemetrySink = (e) => {
      void enqueueXapi({
        id: e.client_event_uuid,
        statement: e as unknown as Record<string, unknown>,
        device_ts: e.timestamp ?? new Date().toISOString(),
      });
    };
    const spec = UNIT_SPECS[specKey];
    if (!spec) throw new Error(`unknown sim spec_key '${specKey}'`);
    const sim = loadSpec(spec, {
      locale,
      telemetrySink: sink,
      actor: { homePage: 'https://academy.goredex.com', name: claims?.sub ?? 'anonymous' },
      context: { org_id: claims?.org_id, sim_definition_id: simDefinitionId, offline: !online },
    });
    if (sim.engineKind !== engineKind)
      throw new Error(`spec '${specKey}' is ${sim.engineKind}, expected ${engineKind}`);
    return sim as BranchingInstance | DeviceConfigInstance;
    // locale recreates the instance (a language switch restarts the run).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specKey, engineKind, locale]);

  useInstanceTick(instance);
  const complete = instance.isComplete();
  const verdict = complete ? instance.getVerdict() : null;

  // Record the finished attempt (offline-safe) + request server promotion on a pass.
  // Stable primitive deps only (verdict/claims are freshly-allocated each render).
  const userId = claims?.sub;
  const orgId = claims?.org_id;
  useEffect(() => {
    if (!complete || !userId || !orgId) return;
    const finalVerdict = instance.getVerdict();
    // Build the recorded "choices" path: branching = the edge ids; device_config =
    // the field edit order (telemetry of what the learner configured).
    const choices =
      instance.engineKind === 'branching_scenario'
        ? instance.store.getState().path.map((p) => p.edgeId)
        : instance.store.getState().editOrder;
    const key = `${specKey}:${choices.join('>')}:${finalVerdict.outcome}`;
    if (recordedKeys.current.has(key)) return;
    recordedKeys.current.add(key);

    let cancelled = false;
    void (async () => {
      setRecord('recording');
      // Record the append-only "Do" attempt (idempotent). Branching encodes the choice
      // path; device_config records a summary attempt (its score IS the local verdict).
      const events = buildAttemptEvents({
        userId,
        orgId,
        simDefinitionId,
        choices: choices.length > 0 ? choices : ['submit'],
        verdict: finalVerdict,
        online,
        genUuid: () => globalThis.crypto.randomUUID(),
        now: () => new Date().toISOString(),
      });
      try {
        for (const e of events) await enqueue(e);
      } catch {
        /* IndexedDB unavailable — telemetry still queued by the engine sink */
      }
      if (cancelled) return;

      const isPass = finalVerdict.outcome === 'pass' && !finalVerdict.safety_veto_triggered;
      if (!isPass) {
        setRecord('blocked'); // a fail/veto never advances the unit (Inv. 1)
        return;
      }
      if (!online) {
        setRecord('pending_offline'); // never fake a pass offline (Inv. 5) — promotion waits
        return;
      }
      if (instance.engineKind === 'branching_scenario') {
        // Server-authoritative promotion: the Edge Function re-scores from the spec.
        try {
          const { data, error } = await supabase.functions.invoke('finalize-sim-attempt', {
            body: { sim_definition_id: simDefinitionId, choices },
          });
          const promoted = !error && (data as { outcome?: string } | null)?.outcome === 'pass';
          if (cancelled) return;
          if (promoted) {
            setRecord('promoted');
            onComplete(); // advance ONLY on the server verdict pass
          } else {
            setRecord('pending_offline');
          }
        } catch {
          if (!cancelled) setRecord('pending_offline');
        }
      } else {
        // device_config: finalize-sim-attempt cannot re-score this kind yet. The engine
        // ran the REAL local Verdict (incl. safety-veto), so a pass advances the unit
        // with a clear "pending server verification on reconnect" note — NOT a faked
        // server pass. (Extending the Edge Function is a documented follow-up.)
        if (cancelled) return;
        setRecord('pending_server_verify');
        onComplete();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, instance, userId, orgId, online, specKey, simDefinitionId]);

  const runAgain = useCallback(() => {
    setLastConsequence(null);
    setRecord('idle');
    instance.reset();
  }, [instance]);

  const resolvedTitle = title ?? instance.t(instance.envelope.title_i18n);

  // ── Branching (scenario) rich stage — preserves the M3 AC-203 stage + testids ──
  const branching = instance.engineKind === 'branching_scenario' ? instance : null;
  const device = instance.engineKind === 'device_config' ? instance : null;

  const choose = useCallback(
    (edgeId: string, consequenceKey: string) => {
      setLastConsequence(consequenceKey);
      branching?.choose(edgeId);
    },
    [branching],
  );

  const returnToDecision = useCallback(
    (decidedAtNode: string) => {
      if (!branching) return;
      const priorPath = branching.store.getState().path.slice();
      setLastConsequence(null);
      setRecord('idle');
      branching.reset();
      for (const step of priorPath) {
        if (step.nodeId === decidedAtNode) break;
        branching.choose(step.edgeId);
      }
    },
    [branching],
  );

  const toolbar = (
    <>
      <Button variant="secondary" size="sm" data-testid="exit-sim" onClick={onExit}>
        ← {t('sim.screen.back')}
      </Button>
      <span
        className="ml-auto flex items-center gap-1.5"
        role="group"
        aria-label={t('sim.screen.lang')}
      >
        <Button
          variant={locale === 'en' ? 'primary' : 'ghost'}
          size="sm"
          aria-pressed={locale === 'en'}
          onClick={() => setLocale('en')}
        >
          EN
        </Button>
        <Button
          variant={locale === 'es' ? 'primary' : 'ghost'}
          size="sm"
          aria-pressed={locale === 'es'}
          onClick={() => setLocale('es')}
        >
          ES
        </Button>
      </span>
      <span className="flex items-center gap-1.5" role="group" aria-label="Render mode">
        <Button
          variant={mode === 'rich' ? 'primary' : 'ghost'}
          size="sm"
          aria-pressed={mode === 'rich'}
          onClick={() => setMode('rich')}
        >
          {t('sim.screen.mode_rich')}
        </Button>
        <Button
          variant={mode === 'fallback2d' ? 'primary' : 'ghost'}
          size="sm"
          data-testid="mode-2d"
          aria-pressed={mode === 'fallback2d'}
          onClick={() => setMode('fallback2d')}
        >
          {t('sim.screen.mode_2d')}
        </Button>
      </span>
    </>
  );

  let stage: React.ReactNode = null;
  if (branching) {
    const node = branching.currentNode();
    if (mode === 'fallback2d') {
      stage = (
        <div className="p-4">
          <BranchingSim instance={branching} mode="fallback2d" />
        </div>
      );
    } else if (!complete && node.type !== 'terminal') {
      stage = (
        <div className="flex flex-col gap-4 p-5" data-testid="ac203-stage">
          {node.media?.[0] ? (
            <MediaTableau kind="door" label={branching.t(node.media[0].alt_i18n)} />
          ) : null}
          <p className="text-subtitle text-ink" data-testid="node-prompt">
            {branching.t(node.prompt_i18n)}
          </p>
          <ul className="flex flex-col gap-2" aria-label="Choices">
            {node.choices.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  data-choice={c.id}
                  data-safety-decision={c.is_safety_decision || undefined}
                  onClick={() => choose(c.id, c.consequence_i18n)}
                  className="w-full rounded-control border border-line bg-surface-1 px-4 py-3 text-left text-body text-ink transition-colors duration-hover hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-redex"
                >
                  {branching.t(c.label_i18n)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      );
    } else if (verdict && node.type === 'terminal') {
      stage = (
        <div className="flex flex-col gap-4 p-5" data-testid="verdict">
          {node.media?.[0] ? (
            <MediaTableau
              kind={verdict.safety_veto_triggered ? 'trapped' : 'door'}
              label={branching.t(node.media[0].alt_i18n)}
            />
          ) : null}
          <StateBadge
            state={node.state ?? verdict.state}
            label={branching.t((node.state ?? verdict.state).label_i18n)}
          />
          <p className="text-body text-ink" data-testid="terminal-text">
            {branching.t(node.outcome_i18n)}
          </p>
          {verdict.safety_veto_triggered && verdict.veto_feedback_i18n ? (
            <p role="alert" data-testid="veto-feedback" className="text-body text-state-veto">
              {branching.t(verdict.veto_feedback_i18n)}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={runAgain}>
              {t('sim.screen.run_again')}
            </Button>
            <Button variant="ghost" size="sm" onClick={onExit}>
              {t('sim.screen.back')}
            </Button>
          </div>
        </div>
      );
    }
  } else if (device) {
    stage = (
      <div className="p-5">
        <DeviceConfigSim instance={device} mode={mode} />
      </div>
    );
  }

  const showPostmortem =
    branching != null &&
    mode === 'rich' &&
    complete &&
    branching.currentNode().type === 'terminal' &&
    Boolean((branching.currentNode() as { replay?: unknown }).replay) &&
    Boolean(verdict?.safety_veto_triggered);

  const resultLine =
    record === 'promoted'
      ? t('sim.screen.advanced')
      : record === 'pending_server_verify'
        ? t('course.sim_pending_verify', {
            defaultValue: 'Build complete — your work is recorded.',
          })
        : record === 'pending_offline'
          ? t('sim.screen.pending_offline')
          : record === 'blocked'
            ? t('sim.screen.blocked')
            : record === 'recording'
              ? t('sim.screen.recording')
              : null;

  const railSteps = branching
    ? branchingSteps(branching)
    : ([complete ? (verdict && verdict.outcome === 'pass' ? 'done' : 'fail') : 'current'] as (
        | 'done'
        | 'fail'
        | 'current'
        | 'todo'
      )[]);

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="px-8 pt-2">
        <ScreenHead
          eyebrow={t('sim.screen.eyebrow')}
          title={resolvedTitle}
          subtitle={t('sim.screen.objectives_desc')}
        />
      </div>
      <div className="px-8">
        <SimStage
          toolbar={toolbar}
          stage={stage}
          objectives={
            <Card
              variant="panel"
              eyebrow={t('sim.screen.objectives')}
              title={t('sim.screen.progress')}
            >
              <div className="flex flex-col gap-3">
                <ProgressDots steps={railSteps} label={t('sim.screen.progress')} />
                <p className="text-caption text-ink-muted">{t('sim.screen.objectives_desc')}</p>
              </div>
            </Card>
          }
          feedback={
            <Card variant="panel" title={t('sim.screen.feedback')}>
              <p className="text-body text-ink" data-testid="live-feedback" aria-live="polite">
                {lastConsequence ? instance.t(lastConsequence) : t('sim.screen.feedback_idle')}
              </p>
            </Card>
          }
          telemetry={
            <Card variant="panel" title={t('sim.screen.result')}>
              <div className="flex flex-col gap-3">
                <Meter
                  value={verdict ? verdict.safety_score : 1}
                  tone={!verdict || verdict.safety_score >= 0.9 ? 'ok' : 'over'}
                  ariaLabel={t('sim.screen.safety_meter')}
                  label={t('sim.screen.safety_meter')}
                />
                {resultLine ? (
                  <p
                    className="text-caption text-ink-soft"
                    data-testid="record-state"
                    data-record={record}
                    aria-live="polite"
                  >
                    {resultLine}
                  </p>
                ) : null}
                <SyncStatus />
              </div>
            </Card>
          }
        />
      </div>

      {showPostmortem && branching
        ? (() => {
            const node = branching.currentNode() as {
              type: 'terminal';
              replay?: { decided_at_node: string; overlay_i18n: string };
            };
            if (!node.replay) return null;
            return (
              <Modal
                open
                onClose={() => returnToDecision(node.replay!.decided_at_node)}
                title={t('sim.screen.postmortem_title')}
              >
                <div className="flex flex-col gap-4" data-testid="postmortem">
                  <MediaTableau
                    kind="trapped"
                    label={branching.t('sim.ac203.media.crowd_trapped.alt')}
                  />
                  <p className="text-body font-medium text-ink" data-testid="postmortem-overlay">
                    {branching.t(node.replay.overlay_i18n)}
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => returnToDecision(node.replay!.decided_at_node)}
                  >
                    {t('sim.screen.return_to_decision')}
                  </Button>
                </div>
              </Modal>
            );
          })()
        : null}
      {unitId ? <span hidden data-testid="sim-unit-id" data-unit={unitId} /> : null}
    </div>
  );
}
