import type { ReactElement } from 'react';
import { useStore } from 'zustand';
import { StateBadge } from '../../colorblind/StateBadge';
import { type RenderMode, SimFrame } from '../../fallback-2d/Schematic';
import type { BranchingInstance } from './core';

export interface BranchingSimProps {
  instance: BranchingInstance;
  /** 'rich' (default) or 'fallback2d' — both drive the same instance (identical Verdict). */
  mode?: RenderMode;
}

/**
 * Engine #1 renderer. A React tree over the scenario graph: prompt + choice
 * buttons at each node; at a terminal, the outcome narration + the colorblind-safe
 * StateBadge (+ the egress post-mortem replay overlay on a safety veto). Choices
 * are native buttons (keyboard-navigable); state is shape+text, never color alone.
 */
export function BranchingSim({ instance, mode = 'rich' }: BranchingSimProps): ReactElement {
  useStore(instance.store); // re-render on graph state changes
  const t = (k: string) => instance.t(k);
  const node = instance.currentNode();
  const title = t(instance.envelope.title_i18n);

  if (node.type === 'terminal') {
    const verdict = instance.getVerdict();
    const token = node.state ?? verdict.state;
    return (
      <SimFrame mode={mode} title={title}>
        <p data-testid="terminal-text">{t(node.outcome_i18n)}</p>
        <StateBadge state={token} label={t(token.label_i18n)} />
        {verdict.safety_veto_triggered && verdict.veto_feedback_i18n ? (
          <p role="alert" data-testid="veto-feedback">
            {t(verdict.veto_feedback_i18n)}
          </p>
        ) : null}
        {node.replay ? (
          <div data-testid="postmortem-replay" className="mt-2 border-l-4 border-red-edge pl-3">
            <p className="font-medium">{t(node.replay.overlay_i18n)}</p>
            <button type="button" onClick={() => instance.reset()}>
              {t('sim.common.action.retry')}
            </button>
          </div>
        ) : null}
      </SimFrame>
    );
  }

  return (
    <SimFrame mode={mode} title={title}>
      <p data-testid="node-prompt">{t(node.prompt_i18n)}</p>
      <ul className="flex flex-col gap-2" aria-label="Choices">
        {instance.choices().map((c) => (
          <li key={c.id}>
            <button
              type="button"
              data-choice={c.id}
              data-safety-decision={c.is_safety_decision || undefined}
              onClick={() => instance.choose(c.id)}
              className="w-full rounded-control border border-line px-3 py-2 text-left hover:bg-surface-hover"
            >
              {c.label}
            </button>
          </li>
        ))}
      </ul>
    </SimFrame>
  );
}
