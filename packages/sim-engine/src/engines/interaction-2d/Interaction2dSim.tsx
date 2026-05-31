import { Fragment, type ReactElement } from 'react';
import { useStore } from 'zustand';
import { StateBadge } from '../../colorblind/StateBadge';
import { type RenderMode, SimFrame } from '../../fallback-2d/Schematic';
import type { Interaction2dInstance, ItemAnswer } from './core';

// Dark-theme control styling (token classes) so native <select>s clear WCAG AA
// contrast — the browser-default light-grey bg under the app's light ink fails axe.
const CONTROL = 'rounded-control border border-line bg-surface-2 px-2 py-1 text-ink';

export interface Interaction2dSimProps {
  instance: Interaction2dInstance;
  mode?: RenderMode;
}

/**
 * Engine #5 renderer. Each item renders native, keyboard-navigable, gloved-friendly
 * controls (no mouse-only drag): drag-label/match use labelled <select>s, sort uses
 * move up/down buttons, hotspot uses toggle buttons (aria-pressed). Submit → the
 * colorblind-safe Verdict + per-item diagnostic feedback. One instance, identical
 * Verdict in rich or 2D-fallback mode.
 */
export function Interaction2dSim({ instance, mode = 'rich' }: Interaction2dSimProps): ReactElement {
  const st = useStore(instance.store);
  const t = (k: string) => instance.t(k);
  const spec = instance.spec;
  const title = t(instance.envelope.title_i18n);
  const verdict = st.complete ? instance.getVerdict() : null;

  const renderItem = (item: Interaction2dInstance['spec']['items'][number]): ReactElement => {
    const answer: ItemAnswer | undefined = instance.answerFor(item.id);

    if (item.kind === 'drag-label' || item.kind === 'label') {
      const placed = (answer as Record<string, string>) ?? {};
      return (
        <div data-item={item.id} className="flex flex-col gap-2">
          <p data-testid={`prompt-${item.id}`}>{t(item.prompt_i18n)}</p>
          {item.labels.map((lab) => {
            const lbl = t(lab.text_i18n);
            return (
              <label key={lab.id} className="flex items-center gap-2">
                <span>{lbl}</span>
                <select
                  aria-label={lbl}
                  data-label={lab.id}
                  className={CONTROL}
                  value={placed[lab.id] ?? ''}
                  disabled={st.complete}
                  onChange={(e) => instance.place(item.id, lab.id, e.target.value)}
                >
                  <option value="" disabled>
                    —
                  </option>
                  {item.regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label_i18n ? t(r.label_i18n) : r.id}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      );
    }

    if (item.kind === 'match') {
      const matched = (answer as Record<string, string>) ?? {};
      return (
        <div data-item={item.id} className="flex flex-col gap-2">
          <p data-testid={`prompt-${item.id}`}>{t(item.prompt_i18n)}</p>
          {item.left.map((l) => {
            const lbl = t(l.text_i18n);
            return (
              <label key={l.id} className="flex items-center gap-2">
                <span>{lbl}</span>
                <select
                  aria-label={lbl}
                  data-left={l.id}
                  className={CONTROL}
                  value={matched[l.id] ?? ''}
                  disabled={st.complete}
                  onChange={(e) => instance.place(item.id, l.id, e.target.value)}
                >
                  <option value="" disabled>
                    —
                  </option>
                  {item.right.map((r) => (
                    <option key={r.id} value={r.id}>
                      {t(r.text_i18n)}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      );
    }

    if (item.kind === 'sort') {
      const order = (answer as string[]) ?? item.elements.map((e) => e.id);
      const move = (idx: number, delta: number) => {
        const next = order.slice();
        const j = idx + delta;
        if (j < 0 || j >= next.length) return;
        [next[idx], next[j]] = [next[j]!, next[idx]!];
        instance.setOrder(item.id, next);
      };
      return (
        <div data-item={item.id} className="flex flex-col gap-2">
          <p data-testid={`prompt-${item.id}`}>{t(item.prompt_i18n)}</p>
          <ol data-testid={`order-${item.id}`} className="flex flex-col gap-1">
            {order.map((eid, i) => {
              const el = item.elements.find((e) => e.id === eid);
              return (
                <li key={eid} data-pos={i} className="flex items-center gap-2">
                  <span className="flex-1">{el ? t(el.text_i18n) : eid}</span>
                  <button
                    type="button"
                    aria-label={`Move ${eid} up`}
                    data-up={eid}
                    className={CONTROL}
                    disabled={st.complete || i === 0}
                    onClick={() => move(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${eid} down`}
                    data-down={eid}
                    className={CONTROL}
                    disabled={st.complete || i === order.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      );
    }

    // hotspot
    const tapped = (answer as string[]) ?? [];
    return (
      <div data-item={item.id} className="flex flex-col gap-2">
        <p data-testid={`prompt-${item.id}`}>{t(item.prompt_i18n)}</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t(item.prompt_i18n)}>
          {item.regions.map((r) => {
            const on = tapped.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                data-region={r.id}
                aria-pressed={on}
                disabled={st.complete}
                onClick={() => instance.tap(item.id, r.id)}
                className={`rounded-control border px-3 py-2 ${on ? 'border-redex bg-surface-hover' : 'border-line'}`}
              >
                {r.label_i18n ? t(r.label_i18n) : r.id}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <SimFrame mode={mode} title={title}>
      {spec.background?.alt_i18n ? (
        <figure data-testid="i2d-background" className="rounded-card border border-line p-3">
          <figcaption className="text-caption text-ink-muted">
            {t(spec.background.alt_i18n)}
          </figcaption>
        </figure>
      ) : null}

      <div className="flex flex-col gap-4">
        {spec.items.map((it) => (
          <Fragment key={it.id}>{renderItem(it)}</Fragment>
        ))}
      </div>

      {!st.complete ? (
        <button
          type="button"
          data-testid="i2d-submit"
          onClick={() => instance.submit()}
          className="rounded-control border border-line px-3 py-2 hover:bg-surface-hover"
        >
          {t('sim.common.action.submit')}
        </button>
      ) : verdict ? (
        <div className="flex flex-col gap-2" data-testid="i2d-verdict">
          <StateBadge state={verdict.state} label={t(verdict.state.label_i18n)} />
          {verdict.safety_veto_triggered && verdict.veto_feedback_i18n ? (
            <p role="alert" data-testid="veto-feedback">
              {t(verdict.veto_feedback_i18n)}
            </p>
          ) : null}
          {verdict.failed.map((f) =>
            f.feedback_i18n ? (
              <p key={f.ref} data-fail={f.ref}>
                {t(f.feedback_i18n)}
              </p>
            ) : null,
          )}
        </div>
      ) : null}
    </SimFrame>
  );
}
