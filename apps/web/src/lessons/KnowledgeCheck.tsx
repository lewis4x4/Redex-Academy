import {
  gradeKnowledgeCheck,
  type ItemResponse,
  type KnowledgeCheckVerdict,
} from '@redex/sim-engine';
import { StatusBadge } from '@redex/ui';
import { useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../auth/supabaseClient';
import { enqueue } from '../offline/sync-queue';
import { buildCheckResponseEvents, type CheckResponse } from './checkRecording';
import type { ItemOption, RenderableItem } from './lessonSource';

export interface KnowledgeCheckProps {
  kcUnitId: string;
  items: RenderableItem[];
  userId: string;
  orgId: string;
  locale?: 'en' | 'es';
  online?: boolean;
  /** Injected for tests/offline. Defaults to crypto.randomUUID + Date.now. */
  genUuid?: () => string;
  now?: () => string;
}

type Answer = {
  choice?: string;
  choices?: string[];
  value?: number;
  order?: string[];
  region?: string;
};
type ServerOutcome = 'pass' | 'retry' | 'pending_offline' | null;

const localized = (item: RenderableItem, locale: string) => {
  const lv = item.locale_variants?.[locale];
  return {
    prompt: lv?.prompt?.text ?? item.prompt.text,
    options: lv?.options ?? item.options,
  };
};

function toResponses(items: RenderableItem[], answers: Record<string, Answer>): CheckResponse[] {
  return items
    .filter((i) => answers[i.id] !== undefined)
    .map((i) => ({ assessmentItemId: i.id, response: answers[i.id] }));
}

/**
 * KnowledgeCheck — the retry-to-mastery check (M2). RENDER-ONLY w.r.t. mastery:
 * it grades LOCALLY (the shared gradeKnowledgeCheck) only for instant pass/retry
 * feedback, records each attempt's responses APPEND-ONLY via the F4 offline queue,
 * then asks the server-only grade-knowledge-check Edge Function for the
 * authoritative verdict. It NEVER writes competency_state (invariant 2/3) and, when
 * offline, shows a "will complete on reconnect" state — never a faked pass (inv. 5).
 * Colorblind-safe: the verdict is a StatusBadge (shape + text + color); inputs are
 * native + labelled (keyboard-navigable).
 */
export function KnowledgeCheck({
  kcUnitId,
  items,
  userId,
  orgId,
  locale = 'en',
  online = true,
  genUuid,
  now,
}: KnowledgeCheckProps): ReactElement {
  const { t } = useTranslation();
  const uuid = genUuid ?? (() => globalThis.crypto.randomUUID());
  const stamp = now ?? (() => new Date().toISOString());

  const [attempt, setAttempt] = useState(1);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [verdict, setVerdict] = useState<KnowledgeCheckVerdict | null>(null);
  const [outcome, setOutcome] = useState<ServerOutcome>(null);
  const [busy, setBusy] = useState(false);

  const setAnswer = (id: string, a: Answer) => setAnswers((prev) => ({ ...prev, [id]: a }));

  const localVerdict = useMemo(
    () => gradeKnowledgeCheck(items, toResponsesAsItemResponses(items, answers, attempt)),
    [items, answers, attempt],
  );

  async function submit() {
    setBusy(true);
    try {
      const responses = toResponses(items, answers);
      const events = buildCheckResponseEvents({
        userId,
        orgId,
        attempt,
        responses,
        genUuid: uuid,
        now: stamp,
      });
      // Record the attempt append-only (offline-tolerant) BEFORE asking the server.
      for (const e of events) await enqueue(e);

      // Local grade drives instant feedback (render-only; not authoritative).
      const local = gradeKnowledgeCheck(items, toResponsesAsItemResponses(items, answers, attempt));
      setVerdict(local);

      // Offline (the prop OR the live browser state): record + show "completes on
      // reconnect", never ask the server, never fake a pass (inv. 5).
      const reachable = online && (typeof navigator === 'undefined' || navigator.onLine);
      if (!reachable) {
        setOutcome('pending_offline');
        return;
      }
      // The server re-derives the authoritative verdict + any competency_state write.
      const { data, error } = await supabase.functions.invoke('grade-knowledge-check', {
        body: { unit_id: kcUnitId },
      });
      if (error) {
        setOutcome('pending_offline');
        return;
      }
      setOutcome((data as { passed?: boolean })?.passed ? 'pass' : 'retry');
    } finally {
      setBusy(false);
    }
  }

  function retry() {
    setAttempt((n) => n + 1);
    setVerdict(null);
    setOutcome(null);
  }

  const showVerdict = verdict !== null && outcome !== null;
  const passed = outcome === 'pass';

  return (
    <section
      data-testid="knowledge-check"
      aria-label={t('kc.aria_label')}
      className="flex flex-col gap-4"
    >
      <ol className="flex flex-col gap-4">
        {items.map((item, idx) => (
          <li
            key={item.id}
            data-item={item.id}
            data-safety={item.is_safety_item}
            className="flex flex-col gap-2"
          >
            <p className="font-label text-body-lg text-white">
              <span aria-hidden="true">{idx + 1}. </span>
              {localized(item, locale).prompt}
              {item.is_safety_item ? (
                <span className="ml-2 text-label uppercase text-redex"> {t('kc.safety_tag')}</span>
              ) : null}
            </p>
            <ItemInput
              item={item}
              locale={locale}
              answer={answers[item.id]}
              disabled={busy || passed}
              onChange={(a) => setAnswer(item.id, a)}
            />
          </li>
        ))}
      </ol>

      {showVerdict ? (
        <div data-testid="kc-verdict" className="flex flex-col gap-2">
          {outcome === 'pending_offline' ? (
            <p role="status" data-token="pending_offline">
              {t('kc.pending_offline')}
            </p>
          ) : (
            <StatusBadge
              kind={passed ? 'pass' : 'fail'}
              label={passed ? t('kc.passed') : t('kc.retry_needed')}
            />
          )}
          {!passed && outcome !== 'pending_offline' ? (
            <p data-testid="kc-retry-hint">
              {t('kc.below_threshold', {
                safety: Math.round((verdict?.safety.threshold ?? 0.9) * 100),
                nonSafety: Math.round((verdict?.nonSafety.threshold ?? 0.8) * 100),
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      {passed ? null : showVerdict ? (
        <button
          type="button"
          data-testid="kc-retry"
          onClick={retry}
          className="self-start rounded-pill border border-line px-4 py-2 font-label text-white hover:bg-surface-hover"
        >
          {t('kc.retry')}
        </button>
      ) : (
        <button
          type="button"
          data-testid="kc-submit"
          disabled={busy}
          onClick={() => void submit()}
          className="self-start rounded-pill border border-redex bg-surface-2 px-4 py-2 font-label text-white hover:bg-surface-hover disabled:opacity-50"
        >
          {t('kc.submit')}
        </button>
      )}
      {/* exposes the local (non-authoritative) computed pass for tests/debug; the
          server verdict drives the real outcome shown above. */}
      <span hidden data-testid="kc-local-pass">
        {String(localVerdict.passed)}
      </span>
    </section>
  );
}

function toResponsesAsItemResponses(
  items: RenderableItem[],
  answers: Record<string, Answer>,
  attempt: number,
): ItemResponse[] {
  return items
    .filter((i) => answers[i.id] !== undefined)
    .map((i) => ({ assessment_item_id: i.id, response: answers[i.id], attempt }));
}

interface ItemInputProps {
  item: RenderableItem;
  locale: string;
  answer: Answer | undefined;
  disabled: boolean;
  onChange: (a: Answer) => void;
}

function ItemInput({ item, locale, answer, disabled, onChange }: ItemInputProps): ReactElement {
  const opts = localized(item, locale).options;
  const choices: ItemOption[] = opts?.choices ?? [];
  const elements: ItemOption[] = opts?.elements ?? [];
  const regions: ItemOption[] = opts?.regions ?? [];

  if (item.kind === 'mcq' || item.kind === 'scenario_branch') {
    return (
      <fieldset className="flex flex-col gap-1" disabled={disabled}>
        {choices.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-body text-ink">
            <input
              type="radio"
              name={item.id}
              value={c.id}
              data-choice={c.id}
              checked={answer?.choice === c.id}
              onChange={() => onChange({ choice: c.id })}
            />
            <span>{c.text}</span>
          </label>
        ))}
      </fieldset>
    );
  }
  if (item.kind === 'multi_select') {
    const selected = answer?.choices ?? [];
    return (
      <fieldset className="flex flex-col gap-1" disabled={disabled}>
        {choices.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-body text-ink">
            <input
              type="checkbox"
              value={c.id}
              data-choice={c.id}
              checked={selected.includes(c.id)}
              onChange={(e) =>
                onChange({
                  choices: e.target.checked
                    ? [...selected, c.id]
                    : selected.filter((x) => x !== c.id),
                })
              }
            />
            <span>{c.text}</span>
          </label>
        ))}
      </fieldset>
    );
  }
  if (item.kind === 'numeric') {
    return (
      <input
        type="number"
        aria-label={localized(item, locale).prompt}
        data-input="numeric"
        disabled={disabled}
        value={answer?.value ?? ''}
        onChange={(e) =>
          onChange({ value: e.target.value === '' ? Number.NaN : Number(e.target.value) })
        }
        className="w-40 rounded-control border border-line bg-surface-2 px-2 py-1 text-ink"
      />
    );
  }
  if (item.kind === 'hotspot') {
    return (
      <div className="flex gap-2" role="group" aria-label={localized(item, locale).prompt}>
        {regions.map((r) => (
          <button
            key={r.id}
            type="button"
            data-region={r.id}
            aria-pressed={answer?.region === r.id}
            disabled={disabled}
            onClick={() => onChange({ region: r.id })}
            className="rounded-control border border-line bg-surface-2 px-3 py-2 text-ink aria-pressed:border-redex hover:bg-surface-hover"
          >
            {r.text}
          </button>
        ))}
      </div>
    );
  }
  // order: click elements in sequence; the chosen order is the answer.
  const chosen = answer?.order ?? [];
  return (
    <div className="flex flex-col gap-1" role="group" aria-label={localized(item, locale).prompt}>
      {elements.map((el) => {
        const pos = chosen.indexOf(el.id);
        return (
          <button
            key={el.id}
            type="button"
            data-element={el.id}
            disabled={disabled}
            onClick={() =>
              onChange({ order: pos >= 0 ? chosen.filter((x) => x !== el.id) : [...chosen, el.id] })
            }
            className="flex items-center gap-2 rounded-control border border-line bg-surface-2 px-3 py-2 text-left text-ink hover:bg-surface-hover"
          >
            <span aria-hidden="true" className="font-label text-redex">
              {pos >= 0 ? pos + 1 : '·'}
            </span>
            <span>{el.text}</span>
          </button>
        );
      })}
    </div>
  );
}
