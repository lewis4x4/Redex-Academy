import { Button, Card, ErrorState, ScreenHead, Skeleton, Tag } from '@redex/ui';
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  loadRubricTemplate,
  type RubricTemplateLine,
  type SignoffDimension,
} from '../features/signoff/signoffSource';

export interface SignoffPrepScreenProps {
  /** The course id whose §5.4 rubric template lines are shown (catalog-readable). */
  courseId: string;
  /** Called when the learner has reviewed the prep — records unit_progress + advances. */
  onComplete: () => void;
  /** Optional back affordance (course-player → exit). */
  onExit?: () => void;
}

const DIM_KEY: Record<SignoffDimension, string> = {
  safety_compliance: 'signoff.dim.safety_compliance',
  technical_execution: 'signoff.dim.technical_execution',
  verification_documentation: 'signoff.dim.verification_documentation',
  independence_judgment: 'signoff.dim.independence_judgment',
};

/**
 * SignoffPrepScreen — the course-player's `signoff_prep` unit. INFORMATIONAL, NOT a
 * gate: it shows the learner the EXACT rubric they will be scored on at the real field
 * sign-off, so there are no surprises. It does NOT call an Edge Function and does NOT
 * promote competency — the evaluator's M6 finalize-signoff is the real, server-only
 * field gate (Inv. 3). It does NOT render the evaluator's role-gated SignoffScreen.
 *
 * On "I'm ready" the course-player records unit_progress(status='passed') (educational)
 * and advances. The rubric is read from academy.signoff_line_item_templates (catalog,
 * RLS-readable) via loadRubricTemplate.
 */
export function SignoffPrepScreen({
  courseId,
  onComplete,
  onExit,
}: SignoffPrepScreenProps): ReactElement {
  const { t } = useTranslation();
  const [lines, setLines] = useState<RubricTemplateLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setError(null);
    setLines(null);
    loadRubricTemplate(courseId)
      .then((rows) => live && setLines(rows))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [courseId]);

  const head = (
    <div className="px-8 pt-2">
      <ScreenHead
        eyebrow={t('course.signoff_prep.eyebrow', {
          defaultValue: 'Field sign-off prep · Egress hard gate',
        })}
        title={t('course.signoff_prep.title', { defaultValue: 'What your evaluator will check' })}
        subtitle={t('course.signoff_prep.subtitle', {
          defaultValue:
            'This is the exact rubric. A single 0 on any critical-safety line is an automatic fail — there is no override.',
        })}
      />
    </div>
  );

  if (error) {
    return (
      <div data-testid="signoff-prep" className="flex flex-col gap-5 pb-10">
        {head}
        <div className="px-8">
          <ErrorState
            title={t('course.signoff_prep.error', { defaultValue: "Couldn't load the rubric" })}
            description={error}
          />
        </div>
      </div>
    );
  }
  if (!lines) {
    return (
      <div data-testid="signoff-prep" className="flex flex-col gap-5 pb-10">
        {head}
        <div className="flex flex-col gap-3 px-8" data-testid="signoff-prep-loading">
          <Skeleton height="2rem" width="50%" />
          <Skeleton height="8rem" />
        </div>
      </div>
    );
  }

  const sorted = [...lines].sort((a, b) => a.ordinal - b.ordinal);

  return (
    <div data-testid="signoff-prep" className="flex flex-col gap-5 pb-10">
      {head}
      <div className="px-8">
        <Card variant="panel" padding="lg">
          <ol className="flex flex-col gap-3">
            {sorted.map((l) => (
              <li
                key={l.line_item_key}
                data-line={l.line_item_key}
                data-critical={l.is_critical_safety || undefined}
                className="flex items-start justify-between gap-4 border-b border-line pb-3 last:border-b-0"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-body text-ink-strong">{l.label}</span>
                  <span className="text-caption font-mono uppercase tracking-eyebrow text-ink-muted">
                    {t(DIM_KEY[l.dimension])}
                  </span>
                </div>
                {l.is_critical_safety ? (
                  <Tag variant="gate">
                    {t('course.signoff_prep.critical', { defaultValue: 'Critical safety' })}
                  </Tag>
                ) : null}
              </li>
            ))}
          </ol>
        </Card>
      </div>
      <div className="flex items-center gap-3 px-8">
        {onExit ? (
          <Button variant="secondary" size="sm" onClick={onExit}>
            {t('sim.screen.back')}
          </Button>
        ) : null}
        <Button variant="primary" data-testid="signoff-prep-done" onClick={onComplete}>
          {t('course.signoff_prep.done', { defaultValue: "I'm ready — continue" })}
        </Button>
      </div>
    </div>
  );
}
