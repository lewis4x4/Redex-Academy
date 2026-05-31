import {
  CalculatorSim,
  type CalculatorInstance,
  Interaction2dSim,
  type Interaction2dInstance,
  loadSpec,
  type TelemetrySink,
} from '@redex/sim-engine';
import { Callout, Checklist } from '@redex/ui';
import { M2_AC_SPECS } from '@redex/sim-schemas';
import { useMemo, type ReactElement } from 'react';
import { enqueueXapi } from '../offline/xapi-queue';
import { KnowledgeCheck } from './KnowledgeCheck';
import { useLessonCtx } from './LessonContext';

type SpecKey = keyof typeof M2_AC_SPECS;

const telemetrySink: TelemetrySink = (e) => {
  void enqueueXapi({
    id: e.client_event_uuid,
    statement: e as unknown as Record<string, unknown>,
    device_ts: e.timestamp ?? new Date().toISOString(),
  });
};

/** `<Sim spec="ac-101/anatomy-of-a-door" />` — loads a committed slice spec by key
 *  and renders the F5b engine (interaction_2d / calculator). The spec is bundled
 *  (the published sim_definition mirrors it for the server finalize path). The sim
 *  renders + scores client-side (Verdict); competency promotion stays server-only. */
function Sim({
  spec,
  mode = 'rich',
}: {
  spec: string;
  mode?: 'rich' | 'fallback2d';
}): ReactElement {
  const instance = useMemo(() => {
    const def = M2_AC_SPECS[spec as SpecKey];
    if (!def) return null;
    return loadSpec(def, { telemetrySink, context: { offline: true } });
  }, [spec]);

  if (!instance) {
    return (
      <p role="alert" data-testid="sim-missing">
        Unknown sim spec: {spec}
      </p>
    );
  }
  if (instance.engineKind === 'interaction_2d') {
    return <Interaction2dSim instance={instance as Interaction2dInstance} mode={mode} />;
  }
  if (instance.engineKind === 'calculator') {
    return <CalculatorSim instance={instance as CalculatorInstance} mode={mode} />;
  }
  return (
    <p role="alert" data-testid="sim-unsupported">
      This lesson embeds only 2D-interaction and calculator sims.
    </p>
  );
}

/** `<Media r2Key=… kind="image" alt=… />` — references R2/Stream media by key (the
 *  asset is served by the edge/CDN; here we render an accessible figure). Video is
 *  never inlined/precached (F4) — opt-in download lives in offline/field-pack. */
function Media({
  r2Key,
  kind = 'image',
  alt,
  caption,
}: {
  r2Key: string;
  kind?: 'image' | 'video';
  alt: string;
  caption?: string;
}): ReactElement {
  return (
    <figure
      data-testid="media"
      data-r2-key={r2Key}
      data-kind={kind}
      className="flex flex-col gap-1"
    >
      <div
        role="img"
        aria-label={alt}
        className="flex min-h-24 items-center justify-center rounded-card border border-line bg-surface-2 text-ink-soft"
      >
        <span className="text-label uppercase tracking-wide">{kind}</span>
      </div>
      {caption ? <figcaption className="text-label text-ink-soft">{caption}</figcaption> : null}
    </figure>
  );
}

/** `<KnowledgeCheck/>` — resolves the lesson's pre-loaded check from context so the
 *  author just writes the tag. Renders nothing if the course has no knowledge check. */
function KnowledgeCheckEmbed(): ReactElement | null {
  const { lesson, userId, orgId, locale, online } = useLessonCtx();
  if (!lesson.knowledgeCheck) return null;
  return (
    <KnowledgeCheck
      kcUnitId={lesson.knowledgeCheck.unitId}
      items={lesson.knowledgeCheck.items}
      userId={userId}
      orgId={orgId}
      locale={locale}
      online={online}
    />
  );
}

/** The MDX component contract (M2 task 1): the embeddable components an MDX lesson
 *  may reference. Pure primitives (Callout, Checklist) come from @redex/ui; the
 *  data-bound ones (Sim, KnowledgeCheck, Media) are wired here to the slice data. */
export const mdxComponents = {
  Sim,
  Media,
  KnowledgeCheck: KnowledgeCheckEmbed,
  Callout,
  Checklist,
};
