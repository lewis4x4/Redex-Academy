import {
  BranchingSim,
  type BranchingInstance,
  loadSpec,
  StateBadge,
  type TelemetrySink,
} from '@redex/sim-engine';
import { branchingExample, type BranchingSpec } from '@redex/sim-schemas';
import { Button, Card, Meter, Modal, ProgressDots, ScreenHead, SimStage } from '@redex/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { supabase } from '../auth/supabaseClient';
import { useSyncState } from '../offline/sync-state';
import { enqueue } from '../offline/sync-queue';
import { enqueueXapi } from '../offline/xapi-queue';
import { SyncStatus } from '../components/SyncStatus';
import { AC203_SIM_DEFINITION_ID, buildAttemptEvents } from './ac203Recording';

type SimLocale = 'en' | 'es';
type RenderMode = 'rich' | 'fallback2d';
type RecordState = 'idle' | 'recording' | 'promoted' | 'pending_offline' | 'blocked';

// The ordered decision nodes (for the progress rail). Pure structural read of the
// committed spec — the runtime path drives the per-step state.
const DECISIONS = ['failstate', 'rex', 'placement', 'firealarm', 'closeout'] as const;
const spec = branchingExample as unknown as BranchingSpec;

/** Subscribe to the headless instance store without importing zustand directly. */
function useInstanceTick(instance: BranchingInstance): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setTick((n) => n + 1); // resync when the instance (locale) changes
    return instance.store.subscribe(() => setTick((n) => n + 1));
  }, [instance]);
  return tick;
}

/** done / fail / current / todo per decision, derived from the runtime path. */
function decisionSteps(instance: BranchingInstance): ('done' | 'fail' | 'current' | 'todo')[] {
  const state = instance.store.getState();
  const taken = new Map(state.path.map((p) => [p.nodeId, p.edgeId]));
  return DECISIONS.map((d) => {
    if (state.currentNodeId === d && !state.complete) return 'current';
    const edgeId = taken.get(d);
    if (!edgeId) return 'todo';
    const node = spec.nodes[d];
    if (!node || node.type === 'terminal') return 'done';
    const edge = node.choices.find((c) => c.id === edgeId);
    const target = edge ? spec.nodes[edge.to] : undefined;
    return target?.type === 'terminal' && target.outcome === 'fail' ? 'fail' : 'done';
  });
}

/** On-brand SVG tableau standing in for the (release-gated) sanitized R2 photo.
 *  Decorative shapes only; the accessible name is the spec's alt text. Token
 *  colours only (no raw hex). */
function MediaTableau({ kind, label }: { kind: 'door' | 'trapped'; label: string }) {
  return (
    <figure className="m-0 overflow-hidden rounded-card border border-line bg-surface-2">
      <svg viewBox="0 0 320 150" role="img" aria-label={label} className="h-36 w-full">
        <rect x="0" y="0" width="320" height="150" className="fill-surface-3" />
        {/* door frame */}
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
        {/* mag lock at the top */}
        <rect x="150" y="20" width="20" height="10" rx="2" className="fill-redex stroke-red-edge" />
        {/* push-to-exit button */}
        <circle cx="206" cy="84" r="5" className="fill-green stroke-green-edge" />
        {kind === 'trapped' ? (
          // crowd of figures pressed at the door
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

export interface Ac203SimScreenProps {
  /** Return to the Constellation (which re-reads gating → an advanced node shows). */
  onExit: () => void;
}

/**
 * M3 flagship — the AC-203 branching egress-fail simulation. Drives the F5 headless
 * branching engine (loadSpec → BranchingInstance) inside the @redex/ui SimStage:
 * rich bespoke stage + the shared BranchingSim 2D fallback (identical Verdict by
 * construction), colorblind-safe state, reduced-motion-gated, keyboard-navigable,
 * EN/ES. On completion it records the append-only "Do" attempt offline (F4 /sync)
 * and — online, on a true pass — calls the server-authoritative finalize Edge
 * Function to promote competency_state (never a faked pass offline). A wrong
 * life-safety choice vetoes: the post-mortem modal freezes the trap, cites the code
 * line, and drops the learner back to the deciding node.
 */
export function Ac203SimScreen({ onExit }: Ac203SimScreenProps) {
  const { t } = useTranslation();
  const { claims } = useAuth();
  const { online } = useSyncState();
  const [locale, setLocale] = useState<SimLocale>('en');
  const [mode, setMode] = useState<RenderMode>('rich');
  const [lastConsequence, setLastConsequence] = useState<string | null>(null);
  const [record, setRecord] = useState<RecordState>('idle');
  const recordedKeys = useRef<Set<string>>(new Set());

  const instance = useMemo(() => {
    const sink: TelemetrySink = (e) => {
      void enqueueXapi({
        id: e.client_event_uuid,
        statement: e as unknown as Record<string, unknown>,
        device_ts: e.timestamp ?? new Date().toISOString(),
      });
    };
    const sim = loadSpec(branchingExample, {
      locale,
      telemetrySink: sink,
      actor: { homePage: 'https://academy.goredex.com', name: claims?.sub ?? 'anonymous' },
      context: {
        org_id: claims?.org_id,
        sim_definition_id: AC203_SIM_DEFINITION_ID,
        offline: !online,
      },
    });
    if (sim.engineKind !== 'branching_scenario') throw new Error('expected branching');
    return sim;
    // locale recreates the instance (a language switch restarts the run).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useInstanceTick(instance);
  const node = instance.currentNode();
  const complete = instance.isComplete();
  const verdict = complete ? instance.getVerdict() : null;

  // Record the finished attempt (offline-safe) + request server promotion on a pass.
  // Deps are STABLE primitives only — `verdict`/`claims` are freshly-allocated each
  // render, so depending on them would thrash the effect (cancel the in-flight write
  // before it settles). Compute the verdict inside; the key-guard makes it run once.
  const userId = claims?.sub;
  const orgId = claims?.org_id;
  useEffect(() => {
    if (!complete || !userId || !orgId) return;
    const finalVerdict = instance.getVerdict();
    const choices = instance.store.getState().path.map((p) => p.edgeId);
    const key = `${instance.store.getState().terminalId}:${choices.join('>')}`;
    if (recordedKeys.current.has(key)) return;
    recordedKeys.current.add(key);

    let cancelled = false;
    void (async () => {
      setRecord('recording');
      const events = buildAttemptEvents({
        userId,
        orgId,
        simDefinitionId: AC203_SIM_DEFINITION_ID,
        choices,
        verdict: finalVerdict,
        online,
        genUuid: () => globalThis.crypto.randomUUID(),
        now: () => new Date().toISOString(),
      });
      try {
        for (const e of events) await enqueue(e); // append-only Do record (idempotent)
      } catch {
        /* IndexedDB unavailable — telemetry still queued by the engine sink */
      }
      if (cancelled) return;

      const isPass = finalVerdict.outcome === 'pass' && !finalVerdict.safety_veto_triggered;
      if (!isPass) {
        setRecord('blocked'); // a fail/veto never advances the node (blocked-on-fail)
        return;
      }
      if (!online) {
        setRecord('pending_offline'); // never fake a pass offline — promotion waits
        return;
      }
      // Server-authoritative promotion: the Edge Function re-scores from the spec.
      try {
        const { data, error } = await supabase.functions.invoke('finalize-sim-attempt', {
          body: { sim_definition_id: AC203_SIM_DEFINITION_ID, choices },
        });
        const promoted = !error && (data as { outcome?: string } | null)?.outcome === 'pass';
        if (!cancelled) setRecord(promoted ? 'promoted' : 'pending_offline');
      } catch {
        if (!cancelled) setRecord('pending_offline');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [complete, instance, userId, orgId, online]);

  const choose = useCallback(
    (edgeId: string, consequenceKey: string) => {
      setLastConsequence(consequenceKey);
      instance.choose(edgeId);
    },
    [instance],
  );

  const runAgain = useCallback(() => {
    setLastConsequence(null);
    setRecord('idle');
    instance.reset();
  }, [instance]);

  // Post-mortem: replay the (correct) earlier choices to drop back to the deciding
  // node — "back to the decision, not the start" (F5 §7 / experience-design §1.4).
  const returnToDecision = useCallback(
    (decidedAtNode: string) => {
      const priorPath = instance.store.getState().path.slice();
      setLastConsequence(null);
      setRecord('idle');
      instance.reset();
      for (const step of priorPath) {
        if (step.nodeId === decidedAtNode) break;
        instance.choose(step.edgeId);
      }
    },
    [instance],
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

  // ── the rich play stage (drives the same instance the 2D fallback does) ──
  let richStage: React.ReactNode;
  if (!complete && node.type !== 'terminal') {
    richStage = (
      <div className="flex flex-col gap-4 p-5" data-testid="ac203-stage">
        {node.media?.[0] ? (
          <MediaTableau kind="door" label={instance.t(node.media[0].alt_i18n)} />
        ) : null}
        <p className="text-subtitle text-ink" data-testid="node-prompt">
          {instance.t(node.prompt_i18n)}
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
                {instance.t(c.label_i18n)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  } else if (verdict && node.type === 'terminal') {
    richStage = (
      <div className="flex flex-col gap-4 p-5" data-testid="verdict">
        {node.media?.[0] ? (
          <MediaTableau
            kind={verdict.safety_veto_triggered ? 'trapped' : 'door'}
            label={instance.t(node.media[0].alt_i18n)}
          />
        ) : null}
        <StateBadge
          state={node.state ?? verdict.state}
          label={instance.t((node.state ?? verdict.state).label_i18n)}
        />
        <p className="text-body text-ink" data-testid="terminal-text">
          {instance.t(node.outcome_i18n)}
        </p>
        {verdict.safety_veto_triggered && verdict.veto_feedback_i18n ? (
          <p role="alert" data-testid="veto-feedback" className="text-body text-state-veto">
            {instance.t(verdict.veto_feedback_i18n)}
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

  const showPostmortem =
    mode === 'rich' &&
    complete &&
    node.type === 'terminal' &&
    Boolean(node.replay) &&
    Boolean(verdict?.safety_veto_triggered);

  const resultLine =
    record === 'promoted'
      ? t('sim.screen.advanced')
      : record === 'pending_offline'
        ? t('sim.screen.pending_offline')
        : record === 'blocked'
          ? t('sim.screen.blocked')
          : record === 'recording'
            ? t('sim.screen.recording')
            : null;

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="px-8 pt-2">
        <ScreenHead
          eyebrow={t('sim.screen.eyebrow')}
          title={instance.t('sim.ac203.egress-fail.title')}
          subtitle={t('sim.screen.objectives_desc')}
        />
      </div>
      <div className="px-8">
        <SimStage
          toolbar={toolbar}
          stage={
            mode === 'fallback2d' ? (
              <div className="p-4">
                <BranchingSim instance={instance} mode="fallback2d" />
              </div>
            ) : (
              richStage
            )
          }
          objectives={
            <Card
              variant="panel"
              eyebrow={t('sim.screen.objectives')}
              title={t('sim.screen.progress')}
            >
              <div className="flex flex-col gap-3">
                <ProgressDots steps={decisionSteps(instance)} label={t('sim.screen.progress')} />
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

      {showPostmortem && node.type === 'terminal' && node.replay ? (
        <Modal
          open
          onClose={() => returnToDecision(node.replay!.decided_at_node)}
          title={t('sim.screen.postmortem_title')}
        >
          <div className="flex flex-col gap-4" data-testid="postmortem">
            <MediaTableau kind="trapped" label={instance.t('sim.ac203.media.crowd_trapped.alt')} />
            <p className="text-body font-medium text-ink" data-testid="postmortem-overlay">
              {instance.t(node.replay.overlay_i18n)}
            </p>
            <Button
              variant="primary"
              onClick={() => returnToDecision(node.replay!.decided_at_node)}
            >
              {t('sim.screen.return_to_decision')}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
