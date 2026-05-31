import { Meter } from '@redex/ui';
import type { ReactElement } from 'react';
import { useStore } from 'zustand';
import { StateBadge } from '../../colorblind/StateBadge';
import { type RenderMode, SimFrame } from '../../fallback-2d/Schematic';
import type { CalculatorInstance } from './core';

// Dark-theme control styling (token classes) so native <select>/<input number> clear
// WCAG AA contrast — the browser-default light-grey bg under the app's light ink fails axe.
const CONTROL = 'rounded-control border border-line bg-surface-2 px-2 py-1 text-ink';

export interface CalculatorSimProps {
  instance: CalculatorInstance;
  mode?: RenderMode;
}

/**
 * Engine #6 renderer. Typed input controls (native, labelled, keyboard-navigable),
 * a live colorblind-safe budget meter (@redex/ui Meter: numeric value + tone word,
 * never color alone), and a submit → Verdict with per-threshold diagnostic feedback.
 * The deterministic compute lives in the headless core; this only renders it.
 */
export function CalculatorSim({ instance, mode = 'rich' }: CalculatorSimProps): ReactElement {
  const st = useStore(instance.store);
  const t = (k: string) => instance.t(k);
  const spec = instance.spec;
  const title = t(instance.envelope.title_i18n);

  let result: number | null = null;
  try {
    result = instance.compute();
  } catch {
    result = null; // inputs incomplete — guidance shown below
  }

  const bands = result === null ? [] : instance.matchedBands();
  const tone = bands.some((b) => b.band === 'fail')
    ? 'over'
    : bands.some((b) => b.band === 'warn')
      ? 'warn'
      : 'ok';
  const meter = spec.meter;
  const meterValue =
    meter && result !== null ? (result - meter.min) / (meter.max - meter.min || 1) : 0;
  const resultUnit = meter?.unit ?? spec.result_unit ?? '';

  const verdict = st.complete ? instance.getVerdict() : null;

  return (
    <SimFrame mode={mode} title={title}>
      <div className="flex flex-col gap-3" data-testid="calculator-inputs">
        {Object.entries(spec.inputs).map(([id, input]) => {
          const label = t(input.label_i18n) + (input.unit ? ` (${input.unit})` : '');
          const val = st.inputs[id];
          if (input.type === 'enum') {
            return (
              <label key={id} className="flex flex-col gap-1">
                <span>{label}</span>
                <select
                  aria-label={label}
                  data-input={id}
                  className={CONTROL}
                  value={typeof val === 'string' ? val : ''}
                  disabled={st.complete}
                  onChange={(e) => instance.setInput(id, e.target.value)}
                >
                  <option value="" disabled>
                    —
                  </option>
                  {(input.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {t(o.label_i18n)}
                    </option>
                  ))}
                </select>
              </label>
            );
          }
          if (input.type === 'boolean') {
            return (
              <label key={id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  aria-label={label}
                  data-input={id}
                  checked={val === true}
                  disabled={st.complete}
                  onChange={(e) => instance.setInput(id, e.target.checked)}
                />
                <span>{label}</span>
              </label>
            );
          }
          return (
            <label key={id} className="flex flex-col gap-1">
              <span>{label}</span>
              <input
                type="number"
                aria-label={label}
                data-input={id}
                className={CONTROL}
                value={val == null ? '' : String(val)}
                min={input.min}
                max={input.max}
                step={input.step}
                disabled={st.complete}
                onChange={(e) =>
                  instance.setInput(id, e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            </label>
          );
        })}
      </div>

      {meter ? (
        <div className="flex flex-col gap-1" data-testid="calculator-meter">
          <span className="text-label">{t(meter.label_i18n)}</span>
          <Meter
            value={meterValue}
            tone={tone}
            ariaLabel={t(meter.label_i18n)}
            label={result === null ? '—' : `${Number(result.toFixed(2))} ${resultUnit}`.trim()}
          />
        </div>
      ) : (
        <p data-testid="calculator-result">
          {result === null
            ? t('sim.calculator.set_inputs')
            : `${Number(result.toFixed(2))} ${resultUnit}`.trim()}
        </p>
      )}

      {!st.complete ? (
        <button
          type="button"
          data-testid="calculator-submit"
          disabled={result === null}
          onClick={() => instance.submit()}
          className="rounded-control border border-line px-3 py-2 hover:bg-surface-hover"
        >
          {t('sim.common.action.submit')}
        </button>
      ) : verdict ? (
        <div className="flex flex-col gap-2" data-testid="calculator-verdict">
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
