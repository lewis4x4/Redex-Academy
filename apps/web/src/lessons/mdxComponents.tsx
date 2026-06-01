import {
  CalculatorSim,
  type CalculatorInstance,
  Interaction2dSim,
  type Interaction2dInstance,
  loadSpec,
  type TelemetrySink,
} from '@redex/sim-engine';
import { Callout, Checklist, SimulatorPanel, TechValue } from '@redex/ui';
import { M2_AC_SPECS } from '@redex/sim-schemas';
import { useMemo, type ComponentPropsWithoutRef, type ReactElement } from 'react';
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
  // The engine renderer is unchanged (scoring / safety-veto / verdict role="status" /
  // i2d-submit testid all intact); SimulatorPanel is a DOM-only frame that elevates it
  // to the step's centerpiece. No vertical margin — the step container supplies the gap.
  if (instance.engineKind === 'interaction_2d') {
    return (
      <SimulatorPanel>
        <Interaction2dSim instance={instance as Interaction2dInstance} mode={mode} />
      </SimulatorPanel>
    );
  }
  if (instance.engineKind === 'calculator') {
    return (
      <SimulatorPanel>
        <CalculatorSim instance={instance as CalculatorInstance} mode={mode} />
      </SimulatorPanel>
    );
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

// ── v2 prose elements ────────────────────────────────────────────────────────
// The lesson MDX is NOT rewritten — its visual bar comes from how the default markdown
// elements RENDER (CLAUDE.md: content is not reimplemented). These map the raw HTML the
// MDX compiler emits to the v2 design tokens: headings → Archivo (font-display), body →
// the relaxed reading rhythm + off-white ink, **strong** → the pure-white keyword
// emphasis (.kw), and inline `code` → the gold-mono <TechValue> (so every `24V`/`0V`/`NC`
// in the copy renders as the warm-gold technical value). Token classes only — no raw hex.

function P(props: ComponentPropsWithoutRef<'p'>): ReactElement {
  return <p {...props} className="text-prose leading-reading text-ink" />;
}

function H2(props: ComponentPropsWithoutRef<'h2'>): ReactElement {
  return <h2 {...props} className="mt-2 font-display font-bold text-title text-ink-strong" />;
}

function H3(props: ComponentPropsWithoutRef<'h3'>): ReactElement {
  return <h3 {...props} className="mt-1 font-display font-nav text-subtitle text-ink-strong" />;
}

function Strong(props: ComponentPropsWithoutRef<'strong'>): ReactElement {
  // The v2 `.kw` keyword highlight: pure-white emphasis lifted out of the off-white body.
  return <strong {...props} className="font-nav text-ink-strong" />;
}

function Em(props: ComponentPropsWithoutRef<'em'>): ReactElement {
  return <em {...props} className="text-ink-strong" />;
}

// `ul`/`ol`/`li` are NOT overridden with JS classes (one shared `<li>` can't tell its
// parent apart). Their v2 look — disc bullets for `ul`, the `.seq` editorial sequence
// (rounded-square mono index badge + per-row divider) for `ol` — is driven by the scoped
// `.rdx-lesson-prose` CSS in @redex/ui (styles/lesson-prose.css), so the bullet vs.
// numbered distinction is made by the real `ul > li` / `ol > li` selector. Content is
// unchanged; the authored "Follow the power" ordered list renders AS the Sequence.

/** The MDX component contract (M2 task 1): the embeddable components an MDX lesson
 *  may reference, PLUS the v2 prose element overrides (headings → font-display, body →
 *  relaxed reading rhythm, **strong** → keyword emphasis, inline `code` → gold-mono
 *  TechValue). Lists get the `.seq`/disc treatment from the scoped lesson-prose CSS.
 *  Pure primitives (Callout, Checklist) come from @redex/ui; the data-bound ones (Sim,
 *  KnowledgeCheck, Media) are wired here to the slice data. */
export const mdxComponents = {
  Sim,
  Media,
  KnowledgeCheck: KnowledgeCheckEmbed,
  Callout,
  Checklist,
  // v2 prose treatment for the default markdown elements (content unchanged).
  p: P,
  h2: H2,
  h3: H3,
  strong: Strong,
  em: Em,
  // inline `code` (e.g. `24V`) → the gold-mono technical value.
  code: TechValue,
};
