import {
  Button,
  Card,
  Chip,
  ConstellationFrame,
  EmptyState,
  ErrorState,
  ScreenHead,
  Skeleton,
  Tag,
  cx,
} from '@redex/ui';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import {
  type CatalogGating,
  type CourseNode,
  type Domain,
  enrollSelf,
  loadCatalogGating,
} from './catalogSource';
import type { GatingState } from './gating';

const DOMAINS: Domain[] = ['FND', 'INT', 'ADC', 'AC', 'VID', 'SEC'];
const TIER_ORDER = ['foundations', 'core', 'advanced', 'mastery'] as const;

// Colorblind-safe node presentation: meaning is carried by SHAPE + glyph + the
// text label, never the token hue alone (invariant 7). Mirrors the @redex/ui
// ConstellationFrame legend language; 'passed' adds a ✓ filled node.
const NODE: Record<GatingState, { glyph: string; cls: string; label: string }> = {
  locked: {
    glyph: '🔒',
    cls: 'border-2 border-domain-locked bg-transparent text-ink-dim',
    label: 'Locked',
  },
  available: {
    glyph: '○',
    cls: 'border-2 border-redex bg-transparent text-white shadow-glow',
    label: 'Available',
  },
  in_progress: {
    glyph: '◐',
    cls: 'border border-red-edge bg-red-tint text-white',
    label: 'In progress',
  },
  passed: {
    glyph: '✓',
    cls: 'border-2 border-green-edge bg-green-tint text-state-pass',
    label: 'Passed',
  },
  mastered: { glyph: '◆', cls: 'rotate-45 bg-gold text-black', label: 'Mastered' },
};

interface Positioned extends CourseNode {
  x: number;
  y: number;
}

// Deterministic layered layout: tiers are vertical bands (foundations → mastery),
// courses spread evenly across each band. Pure + stable so the SVG and the a11y
// order never jitter.
function layout(courses: CourseNode[]): { nodes: Positioned[]; width: number; height: number } {
  const byTier = new Map<string, CourseNode[]>();
  for (const c of courses) {
    const list = byTier.get(c.tier) ?? [];
    list.push(c);
    byTier.set(c.tier, list);
  }
  const COL = 168;
  const ROW = 150;
  const PAD = 90;
  const tiers = TIER_ORDER.filter((t) => byTier.has(t));
  const maxRow = Math.max(1, ...tiers.map((t) => (byTier.get(t) ?? []).length));
  const width = PAD * 2 + (maxRow - 1) * COL;
  const height = PAD * 2 + (tiers.length - 1) * ROW;
  const nodes: Positioned[] = [];
  tiers.forEach((tier, ti) => {
    const row = (byTier.get(tier) ?? []).sort((a, b) => a.code.localeCompare(b.code));
    const rowWidth = (row.length - 1) * COL;
    const startX = PAD + (width - PAD * 2 - rowWidth) / 2;
    row.forEach((c, ci) => {
      nodes.push({ ...c, x: startX + ci * COL, y: PAD + ti * ROW });
    });
  });
  return { nodes, width, height };
}

function useCatalogGating(): {
  data: CatalogGating | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const [data, setData] = useState<CatalogGating | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    loadCatalogGating()
      .then((d) => live && setData(d))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [nonce]);
  return { data, loading, error, reload: () => setNonce((n) => n + 1) };
}

export function Constellation() {
  const { t } = useTranslation();
  const { claims } = useAuth();
  const { data, loading, error, reload } = useCatalogGating();
  const [domainFilter, setDomainFilter] = useState<Set<Domain>>(new Set());
  const [personaLens, setPersonaLens] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);

  const persona = claims?.persona;
  const { nodes, width, height } = useMemo(
    () => (data ? layout(data.courses) : { nodes: [], width: 0, height: 0 }),
    [data],
  );
  const selected = nodes.find((n) => n.id === selectedId) ?? null;
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const isDimmed = useCallback(
    (n: Positioned) => {
      if (domainFilter.size > 0 && !domainFilter.has(n.domain)) return true;
      if (personaLens && persona && !n.personas.includes(persona)) return true;
      return false;
    },
    [domainFilter, personaLens, persona],
  );

  const onEnroll = useCallback(
    async (course: CourseNode) => {
      if (!claims?.sub || !claims.org_id) return;
      setEnrolling(true);
      setEnrollError(null);
      try {
        await enrollSelf({ userId: claims.sub, orgId: claims.org_id, courseId: course.id });
        if (liveRef.current)
          liveRef.current.textContent = t('catalog.enrolled', { code: course.code });
        reload();
      } catch (e: unknown) {
        setEnrollError(e instanceof Error ? e.message : String(e));
      } finally {
        setEnrolling(false);
      }
    },
    [claims, reload, t],
  );

  const lensPanel = (
    <div className="flex flex-col gap-2" role="group" aria-label={t('catalog.filters')}>
      <span className="text-eyebrow uppercase tracking-eyebrow text-ink-muted">
        {t('catalog.domains')}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {DOMAINS.map((d) => (
          <Chip
            key={d}
            selected={domainFilter.has(d)}
            onClick={() =>
              setDomainFilter((prev) => {
                const next = new Set(prev);
                if (next.has(d)) next.delete(d);
                else next.add(d);
                return next;
              })
            }
          >
            {d}
          </Chip>
        ))}
      </div>
      {persona ? (
        <Chip variant="persona" selected={personaLens} onClick={() => setPersonaLens((v) => !v)}>
          {t('catalog.persona_lens', { persona })}
        </Chip>
      ) : null}
    </div>
  );

  let stage: ReactNode;
  if (loading) {
    stage = (
      <div
        className="flex flex-col gap-4 p-8"
        role="status"
        aria-busy="true"
        aria-label={t('catalog.loading')}
      >
        <Skeleton height={28} width="40%" />
        <Skeleton height={180} rounded="card" />
        <Skeleton height={180} rounded="card" />
      </div>
    );
  } else if (error) {
    stage = (
      <div className="p-8">
        <ErrorState
          title={t('catalog.error_title')}
          description={error}
          onRetry={reload}
          retryLabel={t('catalog.retry')}
        />
      </div>
    );
  } else if (!data || data.courses.length === 0) {
    stage = (
      <div className="p-8">
        <EmptyState title={t('catalog.empty_title')} description={t('catalog.empty_desc')} />
      </div>
    );
  } else {
    stage = (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        role="group"
        aria-label={t('catalog.map_label')}
        preserveAspectRatio="xMidYMin meet"
      >
        {/* prereq edges (drawn first, behind nodes) */}
        {data.prereqs.map((e) => {
          const from = byId.get(e.requiresCourseId);
          const to = byId.get(e.courseId);
          if (!from || !to) return null;
          const cleared = from.state === 'passed' || from.state === 'mastered';
          return (
            <line
              key={`${e.requiresCourseId}->${e.courseId}-${e.kind}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className={cx(
                cleared ? 'stroke-red-edge' : 'stroke-line',
                e.kind === 'soft' && 'opacity-40 [stroke-dasharray:4_4]',
              )}
              strokeWidth={cleared ? 2 : 1}
            />
          );
        })}
        {/* nodes */}
        {nodes.map((n) => {
          const p = NODE[n.state];
          const dim = isDimmed(n);
          const sz = n.isBoss ? 30 : 24;
          return (
            <g
              key={n.id}
              transform={`translate(${n.x} ${n.y})`}
              className={cx('cursor-pointer transition-opacity duration-nav', dim && 'opacity-25')}
            >
              <foreignObject x={-sz} y={-sz} width={sz * 2} height={sz * 2 + 26} overflow="visible">
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    data-course={n.code}
                    data-state={n.state}
                    data-boss={n.isBoss || undefined}
                    aria-pressed={selectedId === n.id}
                    aria-label={t('catalog.node_label', {
                      code: n.code,
                      title: n.title,
                      state: p.label,
                      boss: n.isBoss ? t('catalog.boss_suffix') : '',
                    })}
                    onClick={() => {
                      setSelectedId(n.id);
                      setEnrollError(null);
                    }}
                    className={cx(
                      'grid place-items-center rounded-card font-label transition-transform duration-hover hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-redex',
                      p.cls,
                      n.isBoss && 'shadow-glow ring-2 ring-redex ring-offset-2 ring-offset-canvas',
                    )}
                    style={{ width: sz * 2, height: sz * 2 }}
                  >
                    <span aria-hidden="true" className={cx(n.state === 'mastered' && '-rotate-45')}>
                      {n.isBoss ? '⚠' : p.glyph}
                    </span>
                  </button>
                  <span className="whitespace-nowrap text-micro font-label tracking-name text-ink-soft">
                    {n.code}
                  </span>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="px-8 pt-2">
        <ScreenHead
          eyebrow={t('catalog.eyebrow')}
          title={t('catalog.title')}
          accent={t('catalog.title_accent')}
          subtitle={t('catalog.subtitle')}
        />
      </div>
      <p ref={liveRef} role="status" aria-live="polite" className="sr-only" />
      <div className="px-8">
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <ConstellationFrame stage={stage} lensPanel={lensPanel} className="min-h-[28rem]" />
          {selected ? (
            <Card variant="raised" eyebrow={selected.code} title={selected.title}>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag variant="tier">{t(`catalog.tier.${selected.tier}`)}</Tag>
                  <Tag>{selected.domain}</Tag>
                  {selected.isBoss ? <Tag variant="gate">{t('catalog.gate')}</Tag> : null}
                  <span className="text-caption text-ink-muted">{NODE[selected.state].label}</span>
                </div>
                {selected.state === 'available' ? (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={enrolling}
                      onClick={() => void onEnroll(selected)}
                    >
                      {enrolling ? t('catalog.enrolling') : t('catalog.enroll')}
                    </Button>
                    {enrollError ? (
                      <p role="alert" className="text-caption text-state-fail">
                        {enrollError}
                      </p>
                    ) : null}
                  </>
                ) : selected.state === 'locked' ? (
                  <p className="text-body text-ink-muted">{t('catalog.locked_hint')}</p>
                ) : (
                  <p className="text-body text-ink-muted">
                    {t(`catalog.state_hint.${selected.state}`)}
                  </p>
                )}
              </div>
            </Card>
          ) : (
            <Card variant="glass" padding="lg">
              <p className="text-body text-ink-muted">{t('catalog.pick_a_node')}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
