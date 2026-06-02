import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  ScreenHead,
  SignoffForm,
  type SignoffDimensionKey,
  Skeleton,
  StatusBadge,
  TechValue,
} from '@redex/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSyncState } from '../../offline/sync-state';
import { SyncStatus } from '../../components/SyncStatus';
import {
  AC203_COMPETENCY_ID,
  AC203_COURSE_ID,
  type FinalizeResult,
  finalizeSignoff,
  loadRubricTemplate,
  previewOutcome,
  type RubricTemplateLine,
} from './signoffSource';

const DIMENSION_ORDER: SignoffDimensionKey[] = [
  'safety_compliance',
  'technical_execution',
  'verification_documentation',
  'independence_judgment',
];

/** Accessible 0–3 score control (no @redex/ui 0–3 primitive exists). Token classes
 *  only; colorblind-safe (number + selected ring, never colour alone). */
function ScoreControl({
  lineKey,
  value,
  onChange,
}: {
  lineKey: string;
  value: number | undefined;
  onChange: (n: number) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Score 0 to 3"
      className="flex gap-1.5"
      data-score-for={lineKey}
    >
      {[0, 1, 2, 3].map((n) => {
        const selected = value === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={selected}
            data-score={n}
            onClick={() => onChange(n)}
            className={
              'h-9 w-9 rounded-control border text-body font-bold transition-colors duration-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-redex ' +
              (selected
                ? 'border-redex bg-redex text-white shadow-glow-soft'
                : 'border-line bg-surface-1 text-ink hover:bg-surface-hover')
            }
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

export interface SignoffScreenProps {
  onExit: () => void;
}

/**
 * M6 — the Evaluator field sign-off ("Prove one"). The evaluator scores the §5.4
 * rubric (materialized from academy.signoff_line_item_templates, 0–3 per line, the
 * 4 dimensions), binds the Work OS job, and finalizes through the SERVER-AUTHORITATIVE
 * finalize-signoff Edge Function. The UI veto (layer 3, UX only) previews the verdict
 * and BLOCKS signing-as-pass through a critical-safety 0 — but the DB trigger + the
 * Edge Function are the real, non-overridable boundaries. Finalize is server-only:
 * offline it is disabled with a "completes on reconnect" state (never fake a pass).
 * Built on @redex/ui SignoffForm + tokens (no raw hex), colorblind-safe, EN/ES.
 */
export function SignoffScreen({ onExit }: SignoffScreenProps) {
  const { t } = useTranslation();
  const { online } = useSyncState();

  const [templates, setTemplates] = useState<RubricTemplateLine[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [candidateId, setCandidateId] = useState('');
  const [jobId, setJobId] = useState('');
  const [evidenceRef, setEvidenceRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<FinalizeResult | null>(null);
  const signoffId = useRef<string>(globalThis.crypto.randomUUID());

  const reload = useCallback(() => {
    setLoadError(null);
    setTemplates(null);
    loadRubricTemplate(AC203_COURSE_ID)
      .then(setTemplates)
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(reload, [reload]);

  const setScore = useCallback((key: string, n: number) => {
    setResult(null);
    setScores((prev) => ({ ...prev, [key]: n }));
  }, []);

  const scoredLines = useMemo(
    () =>
      (templates ?? [])
        .filter((l) => scores[l.line_item_key] !== undefined)
        .map((l) => ({
          dimension: l.dimension,
          is_critical_safety: l.is_critical_safety,
          score: scores[l.line_item_key]!,
        })),
    [templates, scores],
  );
  const allScored =
    templates != null && templates.length > 0 && scoredLines.length === templates.length;
  const preview = useMemo(() => previewOutcome(scoredLines), [scoredLines]);

  const canFinalize =
    allScored && candidateId.trim() !== '' && jobId.trim() !== '' && online && !submitting;

  const onFinalize = useCallback(async () => {
    if (!canFinalize || !templates) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await finalizeSignoff({
        signoff_id: signoffId.current,
        candidate_user_id: candidateId.trim(),
        course_id: AC203_COURSE_ID,
        competency_id: AC203_COMPETENCY_ID,
        work_os_job_id: jobId.trim(),
        scores,
        evidence: evidenceRef.trim()
          ? [{ kind: 'workos_doc', work_os_ref: evidenceRef.trim() }]
          : undefined,
      });
      setResult(res);
    } catch (e) {
      setResult({
        signoff_id: signoffId.current,
        status: 'error',
        outcome: null,
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSubmitting(false);
    }
  }, [canFinalize, templates, candidateId, jobId, scores, evidenceRef]);

  // Build the four fixed-dimension slots for SignoffForm.
  const dimensions = useMemo(() => {
    const out: Partial<Record<SignoffDimensionKey, { lineItems: React.ReactNode }>> = {};
    if (!templates) return out;
    for (const key of DIMENSION_ORDER) {
      const lines = templates.filter((l) => l.dimension === key);
      if (lines.length === 0) continue;
      out[key] = {
        lineItems: (
          <ul className="flex flex-col gap-3" aria-label={t(`signoff.dim.${key}`)}>
            {lines.map((l) => {
              const v = scores[l.line_item_key];
              const isVetoed = l.is_critical_safety && v === 0;
              return (
                <li
                  key={l.line_item_key}
                  data-line={l.line_item_key}
                  data-critical={l.is_critical_safety || undefined}
                  className={
                    'flex flex-col gap-2.5 rounded-control border p-3.5 ' +
                    (isVetoed ? 'border-veto-edge bg-veto-tint' : 'border-line bg-surface-1')
                  }
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* v2 line-item label: the Archivo display heading on ink-strong. */}
                      <span className="font-display text-body-lg font-nav text-ink-strong">
                        {l.label}
                      </span>
                      {l.is_critical_safety ? (
                        <StatusBadge kind="safety_veto" label={t('signoff.critical_safety')} />
                      ) : null}
                    </div>
                    {/* The rubric line key as a gold-mono technical value. */}
                    <TechValue className="text-caption">{l.line_item_key}</TechValue>
                  </div>
                  <ScoreControl
                    lineKey={l.line_item_key}
                    value={v}
                    onChange={(n) => setScore(l.line_item_key, n)}
                  />
                </li>
              );
            })}
          </ul>
        ),
      };
    }
    return out;
  }, [templates, scores, t, setScore]);

  // ── result / preview banner ──
  const resultBanner = result
    ? (() => {
        if (result.error) return <StatusBadge kind="fail" label={t('signoff.result.error')} />;
        if (result.status === 'signed' && result.outcome === 'pass')
          return <StatusBadge kind="pass" label={t('signoff.result.promoted')} />;
        if (result.safety_veto_triggered)
          return <StatusBadge kind="safety_veto" label={t('signoff.result.vetoed')} />;
        return <StatusBadge kind="fail" label={t('signoff.result.failed')} />;
      })()
    : null;

  let body: React.ReactNode;
  if (loadError) {
    body = (
      <ErrorState
        title={t('signoff.load_error')}
        description={loadError}
        onRetry={reload}
        retryLabel={t('signoff.retry')}
      />
    );
  } else if (!templates) {
    body = (
      <div
        className="flex flex-col gap-3"
        role="status"
        aria-busy="true"
        aria-label={t('signoff.loading')}
      >
        <Skeleton height={120} rounded="card" />
        <Skeleton height={120} rounded="card" />
      </div>
    );
  } else {
    body = (
      <SignoffForm
        header={
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-eyebrow uppercase tracking-eyebrow text-ink-muted">
                  {t('signoff.candidate_label')}
                </span>
                <Input
                  data-testid="candidate-input"
                  value={candidateId}
                  onChange={(e) => setCandidateId(e.target.value)}
                  placeholder={t('signoff.candidate_ph')}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-eyebrow uppercase tracking-eyebrow text-ink-muted">
                  {t('signoff.job_label')}
                </span>
                <Input
                  data-testid="job-input"
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  placeholder={t('signoff.job_ph')}
                />
              </label>
            </div>
            <p className="text-caption text-ink-muted">{t('signoff.subtitle')}</p>
          </div>
        }
        dimensions={dimensions}
        evidence={
          <label className="flex flex-col gap-1">
            <span className="font-mono text-eyebrow uppercase tracking-eyebrow text-ink-muted">
              {t('signoff.evidence_label')}
            </span>
            <Input
              data-testid="evidence-input"
              value={evidenceRef}
              onChange={(e) => setEvidenceRef(e.target.value)}
              placeholder={t('signoff.evidence_ph')}
            />
          </label>
        }
        submit={
          <div className="flex flex-col gap-3" data-testid="finalize-panel">
            {/* Layer-3 UI veto: preview the verdict; a critical-safety 0 cannot be signed as a pass. */}
            <div
              className="flex flex-wrap items-center gap-2"
              data-testid="verdict-preview"
              data-outcome={
                allScored ? (preview.safetyVeto ? 'safety_veto' : preview.outcome) : 'incomplete'
              }
            >
              <span className="font-mono text-eyebrow uppercase tracking-eyebrow text-ink-muted">
                {t('signoff.preview_label')}
              </span>
              {!allScored ? (
                <span className="text-body text-ink-muted">{t('signoff.preview.incomplete')}</span>
              ) : preview.safetyVeto ? (
                <StatusBadge kind="safety_veto" label={t('signoff.preview.veto')} />
              ) : (
                <StatusBadge
                  kind={preview.outcome === 'pass' ? 'pass' : 'fail'}
                  label={t(`signoff.preview.${preview.outcome}`)}
                />
              )}
            </div>
            {allScored && preview.safetyVeto ? (
              <p role="alert" data-testid="veto-banner" className="text-body text-state-veto">
                {t('signoff.veto_banner')}
              </p>
            ) : null}
            {!online ? (
              <p className="text-caption text-state-pending">{t('signoff.offline_block')}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                disabled={!canFinalize}
                data-testid="finalize"
                onClick={() => void onFinalize()}
              >
                {submitting
                  ? t('signoff.finalizing')
                  : allScored && (preview.outcome === 'fail' || preview.safetyVeto)
                    ? t('signoff.record_fail')
                    : t('signoff.finalize')}
              </Button>
              <Button variant="ghost" size="sm" data-testid="exit-signoff" onClick={onExit}>
                {t('signoff.back')}
              </Button>
            </div>
            {result ? (
              <div
                className="flex items-center gap-2"
                data-testid="result"
                data-status={result.status}
                data-outcome={result.outcome ?? ''}
                aria-live="polite"
              >
                {resultBanner}
                {result.reason ? (
                  <span className="text-caption text-ink-muted">{result.reason}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="px-8 pt-2">
        <ScreenHead
          eyebrow={t('signoff.eyebrow')}
          title={t('signoff.title')}
          subtitle={t('signoff.subtitle')}
        />
      </div>
      <div className="px-8">
        <SyncStatus />
      </div>
      <div className="px-8">
        {templates && templates.length === 0 ? (
          <EmptyState title={t('signoff.empty_title')} description={t('signoff.empty_desc')} />
        ) : (
          body
        )}
      </div>
    </div>
  );
}
