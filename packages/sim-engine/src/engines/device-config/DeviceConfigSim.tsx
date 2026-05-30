import type { ReactElement } from 'react';
import { useStore } from 'zustand';
import { StateBadge } from '../../colorblind/StateBadge';
import { type RenderMode, SimFrame } from '../../fallback-2d/Schematic';
import type { DeviceConfigInstance } from './core';

export interface DeviceConfigSimProps {
  instance: DeviceConfigInstance;
  mode?: RenderMode;
}

/**
 * Engine #2 renderer. A simulated device UI over the sanitized fixture replica
 * (NEVER a live API): a screen navigator + form controls per screen, a submit that
 * evaluates the assertion rules, and the colorblind-safe Verdict + per-rule
 * diagnostic feedback. All controls are native (labelled, keyboard-navigable).
 */
export function DeviceConfigSim({
  instance,
  mode = 'rich',
}: DeviceConfigSimProps): ReactElement | null {
  const st = useStore(instance.store);
  const t = (k: string) => instance.t(k);
  const spec = instance.spec;
  const screen = spec.screens.find((s) => s.id === st.currentScreenId) ?? spec.screens[0];
  if (!screen) return null;
  const title = t(instance.envelope.title_i18n);

  const renderField = (fid: string): ReactElement | null => {
    const f = spec.fields[fid];
    if (!f) return null;
    const val = st.fields[fid];
    const label = t(f.label_i18n);
    if (f.type === 'enum') {
      return (
        <label className="flex flex-col gap-1">
          <span>{label}</span>
          <select
            aria-label={label}
            data-field={fid}
            value={typeof val === 'string' ? val : ''}
            disabled={st.complete}
            onChange={(e) => instance.setField(fid, e.target.value)}
          >
            <option value="" disabled>
              —
            </option>
            {(f.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.label_i18n)}
              </option>
            ))}
          </select>
        </label>
      );
    }
    if (f.type === 'boolean') {
      return (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            aria-label={label}
            data-field={fid}
            checked={val === true}
            disabled={st.complete}
            onChange={(e) => instance.setField(fid, e.target.checked)}
          />
          <span>{label}</span>
        </label>
      );
    }
    return (
      <label className="flex flex-col gap-1">
        <span>{label}</span>
        <input
          type={f.type === 'text' ? 'text' : 'number'}
          aria-label={label}
          data-field={fid}
          value={val == null ? '' : String(val)}
          disabled={st.complete}
          onChange={(e) =>
            instance.setField(fid, f.type === 'text' ? e.target.value : Number(e.target.value))
          }
        />
      </label>
    );
  };

  const imageKey = instance.screenImageKey(screen.id);

  return (
    <SimFrame mode={mode} title={title}>
      <nav aria-label="Screens" className="flex flex-wrap gap-2">
        {spec.screens.map((s) => (
          <button
            key={s.id}
            type="button"
            data-screen={s.id}
            aria-current={s.id === screen.id ? 'page' : undefined}
            onClick={() => instance.navigate(s.id)}
            className="rounded-control border border-line px-2 py-1 text-caption aria-[current=page]:bg-redex aria-[current=page]:text-white"
          >
            {t(s.title_i18n)}
          </button>
        ))}
      </nav>

      {imageKey ? (
        <p data-screen-image={imageKey} className="font-mono text-caption text-ink-muted">
          [fixture replica: {imageKey}]
        </p>
      ) : null}

      <fieldset className="flex flex-col gap-3 border-0 p-0">
        <legend className="font-medium">{t(screen.title_i18n)}</legend>
        {screen.field_ids.map((fid) => (
          <div key={fid}>{renderField(fid)}</div>
        ))}
      </fieldset>

      {!st.complete ? (
        <button
          type="button"
          data-testid="submit"
          onClick={() => instance.submit()}
          className="self-start rounded-control bg-redex px-4 py-2 text-white"
        >
          {t('sim.common.action.submit')}
        </button>
      ) : (
        <Verdict instance={instance} />
      )}
    </SimFrame>
  );
}

function Verdict({ instance }: { instance: DeviceConfigInstance }): ReactElement {
  const t = (k: string) => instance.t(k);
  const v = instance.getVerdict();
  return (
    <div data-testid="verdict" className="flex flex-col gap-2">
      <StateBadge state={v.state} label={t(v.state.label_i18n)} />
      {v.safety_veto_triggered && v.veto_feedback_i18n ? (
        <p role="alert" data-testid="veto-feedback">
          {t(v.veto_feedback_i18n)}
        </p>
      ) : null}
      {v.failed.length > 0 ? (
        <ul className="list-disc pl-5">
          {v.failed.map((r) =>
            r.feedback_i18n ? (
              <li key={r.ref} data-failed={r.ref}>
                {t(r.feedback_i18n)}
              </li>
            ) : null,
          )}
        </ul>
      ) : null}
    </div>
  );
}
