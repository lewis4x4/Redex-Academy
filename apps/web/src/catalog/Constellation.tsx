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
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import {
  type CatalogGating,
  type CourseNode,
  type Domain,
  enrollSelf,
  loadCatalogGating,
} from './catalogSource';
import {
  CENTER,
  type PositionedNode,
  VIEW,
  computeLayout,
  keystoneSourceIds,
  makeStars,
} from './constellationLayout';
import type { GatingState } from './gating';

const DOMAINS: Domain[] = ['FND', 'INT', 'ADC', 'AC', 'VID', 'SEC'];

// Static (Tailwind-JIT-visible) domain → token classes. The literal strings let
// the JIT emit the `fill-domain-*` / `stroke-domain-*` utilities (a computed
// `stroke-domain-${d}` would be pruned). Hue is the SECTOR's identity colour —
// the colorblind-safe carrier of state is shape + glyph + label, never hue.
const DOMAIN_STROKE: Record<Domain, string> = {
  FND: 'stroke-domain-fnd',
  INT: 'stroke-domain-int',
  ADC: 'stroke-domain-adc',
  AC: 'stroke-domain-ac',
  VID: 'stroke-domain-vid',
  SEC: 'stroke-domain-sec',
};
const DOMAIN_FILL: Record<Domain, string> = {
  FND: 'fill-domain-fnd',
  INT: 'fill-domain-int',
  ADC: 'fill-domain-adc',
  AC: 'fill-domain-ac',
  VID: 'fill-domain-vid',
  SEC: 'fill-domain-sec',
};

// Per-state node visuals. Each state is colorblind-safe by construction: a DISTINCT
// SHAPE/glyph + the code label + the spoken state in the aria-label carry meaning;
// the token hue is advisory (invariant 7). All colours are token classes / CSS
// vars — never a raw hex (D1 invariant 9).
interface NodeVisual {
  /** Ring fill + stroke token classes. */
  ring: string;
  /** stroke-dasharray attribute (locked reads as "not yet"). */
  dash?: string;
  /** drop-shadow glow colour (a CSS var, applied inline). */
  glowVar?: string;
  /** Pulse the whole node (reduced-motion-guarded utility). */
  pulse?: boolean;
  /** Code-label fill — AA-contrast on the dark canvas. */
  labelClass: string;
  strokeWidth: number;
}
const NODE_VISUAL: Record<GatingState, NodeVisual> = {
  locked: {
    ring: 'fill-surface-2 stroke-domain-locked',
    dash: '3 3',
    labelClass: 'fill-ink-muted',
    strokeWidth: 2,
  },
  available: {
    ring: 'fill-red-tint-soft stroke-redex',
    glowVar: 'var(--red)',
    labelClass: 'fill-ink-soft',
    strokeWidth: 2,
  },
  in_progress: {
    ring: 'fill-red-tint stroke-redex-bright',
    pulse: true,
    labelClass: 'fill-ink-soft',
    strokeWidth: 2.5,
  },
  passed: {
    ring: 'fill-green-tint stroke-green-edge',
    glowVar: 'var(--green)',
    labelClass: 'fill-ink-soft',
    strokeWidth: 2,
  },
  mastered: {
    ring: 'fill-redex stroke-gold',
    glowVar: 'var(--gold)',
    labelClass: 'fill-ink-soft',
    strokeWidth: 2,
  },
};

// Star path helper (cx,cy, outer, inner, points) — for the mastery badge + boss crown.
function starPath(cx: number, cy: number, outer: number, inner: number, points: number): string {
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / points - Math.PI / 2;
    d += `${i === 0 ? 'M' : 'L'}${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)} `;
  }
  return `${d}Z`;
}

// The colorblind-safe glyph for each state (distinct SHAPE, not colour). aria-hidden
// — the state is spoken via the node's aria-label.
function StateGlyph({ state, r }: { state: GatingState; r: number }): ReactNode {
  if (state === 'locked') {
    return (
      <g aria-hidden="true">
        <rect x={-4} y={-2} width={8} height={7} rx={1.5} className="fill-ink-muted" />
        <path
          d="M -2.5 -2 v -2 a 2.5 2.5 0 0 1 5 0 v 2"
          fill="none"
          className="stroke-ink-muted"
          strokeWidth={1.4}
        />
      </g>
    );
  }
  if (state === 'available') {
    return <path aria-hidden="true" d="M -3 -4 L 4 0 L -3 4 Z" className="fill-redex" />;
  }
  if (state === 'in_progress') {
    return (
      <path
        aria-hidden="true"
        d={`M 0 -${r - 5} A ${r - 5} ${r - 5} 0 0 1 ${r - 5} 0`}
        fill="none"
        className="stroke-redex-bright"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    );
  }
  if (state === 'passed') {
    return (
      <path
        aria-hidden="true"
        d="M -5 0 L -1.5 4 L 5.5 -4"
        fill="none"
        className="stroke-state-pass"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  // mastered: white check + a gold badge-star above the ring.
  return (
    <g aria-hidden="true">
      <path
        d="M -5 0 L -1.5 4 L 5.5 -4"
        fill="none"
        className="stroke-white"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={starPath(0, -r - 7, 5, 2.2, 5)}
        className="fill-gold stroke-white"
        strokeWidth={0.4}
      />
    </g>
  );
}

type Positioned = PositionedNode;

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

// Deterministic, stable starfield (seeded once — never re-scatters on re-render).
const STARS = makeStars();

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
  const svgRef = useRef<SVGSVGElement>(null);

  const persona = claims?.persona;

  const { nodes, domainLabels, rings } = useMemo(
    () => (data ? computeLayout(data.courses) : { nodes: [], domainLabels: [], rings: [] }),
    [data],
  );
  const keystones = useMemo(
    () => (data ? keystoneSourceIds(data.courses, data.prereqs) : new Set<string>()),
    [data],
  );
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  // ── Pan & zoom over the SVG viewBox (an enhancement; the default box shows the
  // whole map, so keyboard users never need it — they tab the nodes directly). ──
  const [vb, setVb] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 0,
    y: 0,
    w: VIEW.w,
    h: VIEW.h,
  });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const resetView = useCallback(() => setVb({ x: 0, y: 0, w: VIEW.w, h: VIEW.h }), []);

  const onPointerDown = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    // Don't pan when grabbing a node — let the node handle the click.
    if ((e.target as Element).closest('[data-course]')) return;
    drag.current = { x: e.clientX, y: e.clientY };
    svgRef.current?.setPointerCapture?.(e.pointerId);
  }, []);
  const onPointerMove = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    const el = svgRef.current;
    if (!drag.current || !el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    setVb((v) => {
      const dx = (e.clientX - drag.current!.x) * (v.w / rect.width);
      const dy = (e.clientY - drag.current!.y) * (v.h / rect.height);
      drag.current = { x: e.clientX, y: e.clientY };
      return { ...v, x: v.x - dx, y: v.y - dy };
    });
  }, []);
  const onPointerUp = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    drag.current = null;
    svgRef.current?.releasePointerCapture?.(e.pointerId);
  }, []);

  // Wheel zoom toward the cursor — a NON-passive native listener so we can
  // preventDefault the page scroll (React's onWheel is passive).
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      setVb((v) => {
        const newW = Math.min(
          VIEW.w * 1.6,
          Math.max(VIEW.w * 0.45, v.w * (e.deltaY > 0 ? 1.08 : 0.92)),
        );
        const newH = newW * (VIEW.h / VIEW.w);
        const mx = v.x + ((e.clientX - rect.left) / rect.width) * v.w;
        const my = v.y + ((e.clientY - rect.top) / rect.height) * v.h;
        return {
          x: mx - (mx - v.x) * (newW / v.w),
          y: my - (my - v.y) * (newH / v.h),
          w: newW,
          h: newH,
        };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [data]);

  const isDimmed = useCallback(
    (n: Positioned) => {
      if (domainFilter.size > 0 && !domainFilter.has(n.domain) && !n.apex) return true;
      if (personaLens && persona && !n.personas.includes(persona)) return true;
      return false;
    },
    [domainFilter, personaLens, persona],
  );
  const isDomainDimmed = useCallback(
    (d: Domain) => domainFilter.size > 0 && !domainFilter.has(d),
    [domainFilter],
  );

  const stateLabel = useCallback((s: GatingState) => t(`catalog.state.${s}`), [t]);

  const selectNode = useCallback((n: Positioned) => {
    setSelectedId(n.id);
    setEnrollError(null);
  }, []);

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
      <button
        type="button"
        onClick={resetView}
        className="self-start text-micro font-label uppercase tracking-label text-ink-muted underline-offset-2 hover:text-ink-soft hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-redex"
      >
        {t('catalog.reset_view')}
      </button>
    </div>
  );

  // ── Constellation node-state legend (colorblind-safe: shape + text, per screen). ──
  const legend = (
    <div className="flex flex-col gap-2">
      <p className="text-eyebrow font-label uppercase tracking-eyebrow text-redex-bright">
        {t('catalog.legend_title')}
      </p>
      <ul className="flex flex-col gap-1.5">
        {(['locked', 'available', 'in_progress', 'passed', 'mastered'] as GatingState[]).map(
          (s) => (
            <li key={s} className="flex items-center gap-2">
              <svg
                viewBox="-16 -16 32 32"
                width={16}
                height={16}
                aria-hidden="true"
                className="shrink-0"
              >
                <circle
                  r={13}
                  className={cx(NODE_VISUAL[s].ring)}
                  strokeWidth={NODE_VISUAL[s].strokeWidth}
                  strokeDasharray={NODE_VISUAL[s].dash}
                />
                <StateGlyph state={s} r={13} />
              </svg>
              <span className="text-label text-ink-soft">{stateLabel(s)}</span>
            </li>
          ),
        )}
        <li className="flex items-center gap-2">
          <svg
            viewBox="-16 -16 32 32"
            width={16}
            height={16}
            aria-hidden="true"
            className="shrink-0"
          >
            <rect
              x={-13}
              y={-13}
              width={26}
              height={26}
              rx={5}
              fill="none"
              className="stroke-amber"
              strokeWidth={2}
            />
          </svg>
          <span className="text-label text-ink-soft">{t('catalog.gate')}</span>
        </li>
      </ul>
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
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
        role="group"
        aria-label={t('catalog.map_label')}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          {/* Mastery core glow + boss apex gradient — token-coloured via CSS vars. */}
          <radialGradient id="rdxCoreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--red)" stopOpacity={0.35} />
            <stop offset="60%" stopColor="var(--red)" stopOpacity={0.06} />
            <stop offset="100%" stopColor="var(--red)" stopOpacity={0} />
          </radialGradient>
          <radialGradient id="rdxBossGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--red-bright)" />
            <stop offset="70%" stopColor="var(--red-deep)" />
            <stop offset="100%" stopColor="var(--canvas)" />
          </radialGradient>
        </defs>

        {/* ── Decorative backdrop: starfield, core glow, tier rings + labels. All
            aria-hidden — the interactive nodes carry every fact a reader needs. ── */}
        <g aria-hidden="true">
          {STARS.map((s, i) => (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              className="fill-white rdx-anim-twinkle"
              style={
                {
                  opacity: s.opacity,
                  animationDuration: `${s.durSec}s`,
                  animationDelay: `${s.delaySec}s`,
                } as CSSProperties
              }
            />
          ))}
          <circle cx={CENTER.x} cy={CENTER.y} r={300} fill="url(#rdxCoreGlow)" />
          {rings.map((ring) => (
            <g key={ring.tier}>
              <circle
                cx={CENTER.x}
                cy={CENTER.y}
                r={ring.r}
                fill="none"
                className="stroke-line"
                strokeWidth={1}
                strokeDasharray="2 8"
                opacity={0.7}
              />
              <text
                x={CENTER.x}
                y={CENTER.y - ring.r - 6}
                fontSize={11}
                fontWeight={700}
                letterSpacing={3}
                textAnchor="middle"
                className="fill-ink-muted"
              >
                {t(`catalog.tier.${ring.tier}`).toUpperCase()}
              </text>
            </g>
          ))}
        </g>

        {/* ── Domain sector labels (aria-hidden; domain is in each node's label). ── */}
        <g aria-hidden="true">
          {domainLabels.map((l) => (
            <g
              key={l.domain}
              opacity={isDomainDimmed(l.domain) ? 0.25 : 1}
              className="transition-opacity duration-nav"
            >
              <text
                x={l.x}
                y={l.y}
                fontSize={13}
                fontWeight={800}
                letterSpacing={2}
                textAnchor="middle"
                className={DOMAIN_FILL[l.domain]}
              >
                {l.domain}
              </text>
              <text
                x={l.x}
                y={l.y + 15}
                fontSize={10}
                letterSpacing={1}
                textAnchor="middle"
                className="fill-ink-muted"
              >
                {t(`catalog.domain.${l.domain}`)}
              </text>
            </g>
          ))}
        </g>

        {/* ── Prereq edges (drawn under the nodes). Keystone artery animates; an
            edge from a cleared course lights up; others stay dim. ── */}
        <g>
          {data.prereqs.map((e) => {
            const from = byId.get(e.requiresCourseId);
            const to = byId.get(e.courseId);
            if (!from || !to) return null;
            const isKeystone = keystones.has(e.requiresCourseId);
            const cleared = from.state === 'passed' || from.state === 'mastered';
            const dim =
              domainFilter.size > 0 &&
              !domainFilter.has(from.domain) &&
              !domainFilter.has(to.domain);
            const cls = isKeystone
              ? 'stroke-redex rdx-edge-keystone'
              : cleared
                ? 'stroke-redex-bright'
                : 'stroke-line';
            return (
              <line
                key={`${e.requiresCourseId}->${e.courseId}-${e.kind}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className={cx(cls, 'transition-opacity duration-nav')}
                strokeWidth={isKeystone ? 2.4 : cleared ? 1.6 : 1}
                strokeDasharray={e.kind === 'soft' ? '4 4' : undefined}
                opacity={dim ? 0.05 : isKeystone ? 1 : cleared ? 0.85 : 0.5}
              />
            );
          })}
        </g>

        {/* ── Nodes ── */}
        <g>
          {nodes.map((n) => {
            const dim = isDimmed(n);
            const visual = NODE_VISUAL[n.state];
            const r = n.apex ? 30 : n.isBoss ? 22 : 16;
            const ariaLabel = t('catalog.node_label', {
              code: n.code,
              title: n.title,
              state: stateLabel(n.state),
              boss: n.isBoss ? t('catalog.boss_suffix') : '',
            });
            return (
              <g
                key={n.id}
                data-course={n.code}
                data-state={n.state}
                data-boss={n.isBoss || undefined}
                data-domain={n.domain}
                role="button"
                tabIndex={dim ? -1 : 0}
                aria-pressed={selectedId === n.id}
                aria-label={ariaLabel}
                transform={`translate(${n.x} ${n.y})`}
                className={cx(
                  'cursor-pointer outline-none transition-opacity duration-nav [transform-box:fill-box]',
                  dim && 'pointer-events-none opacity-[0.12]',
                  visual.pulse && 'rdx-anim-pulse',
                )}
                style={
                  visual.glowVar
                    ? ({ filter: `drop-shadow(0 0 6px ${visual.glowVar})` } as CSSProperties)
                    : undefined
                }
                onClick={(ev) => {
                  ev.stopPropagation();
                  selectNode(n);
                }}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    selectNode(n);
                  }
                }}
              >
                <title>{`${n.code} — ${n.title}`}</title>

                {n.apex ? (
                  // Centre apex (a Mastery boss, e.g. INT-410 the Field Evaluator).
                  <>
                    <circle r={r + 16} fill="url(#rdxCoreGlow)" aria-hidden="true" />
                    <circle
                      r={r + 6}
                      fill="none"
                      className="stroke-redex"
                      strokeWidth={1.5}
                      opacity={0.5}
                      aria-hidden="true"
                    />
                    <circle
                      r={r}
                      fill="url(#rdxBossGrad)"
                      className="stroke-redex rdx-anim-boss"
                      strokeWidth={2.5}
                    />
                    <path
                      d={starPath(0, -2, 8, 3.6, 5)}
                      className="fill-white"
                      aria-hidden="true"
                    />
                  </>
                ) : (
                  <>
                    {/* boss/gate heavier frame + ⚠ marker (M1 §3) */}
                    {n.isBoss ? (
                      <g aria-hidden="true">
                        <rect
                          x={-r - 7}
                          y={-r - 7}
                          width={(r + 7) * 2}
                          height={(r + 7) * 2}
                          rx={8}
                          fill="none"
                          className={n.state === 'locked' ? 'stroke-amber-edge' : 'stroke-amber'}
                          strokeWidth={1.5}
                          opacity={n.state === 'locked' ? 0.5 : 0.85}
                        />
                        <path
                          d={`M 0 ${-r - 13} L 7 ${-r - 1} L -7 ${-r - 1} Z`}
                          className="fill-amber-tint stroke-amber"
                          strokeWidth={1.2}
                          strokeLinejoin="round"
                        />
                        <line
                          x1={0}
                          y1={-r - 9}
                          x2={0}
                          y2={-r - 5}
                          className="stroke-amber"
                          strokeWidth={1.4}
                          strokeLinecap="round"
                        />
                        <circle cx={0} cy={-r - 2.6} r={0.9} className="fill-amber" />
                      </g>
                    ) : null}
                    {/* domain-tint halo so an active node reads its sector colour */}
                    {n.state !== 'locked' ? (
                      <circle
                        r={r + 5}
                        fill="none"
                        className={DOMAIN_STROKE[n.domain]}
                        strokeWidth={1}
                        opacity={0.35}
                        aria-hidden="true"
                      />
                    ) : null}
                    {/* keystone artery marker (cross-domain load-bearing node) */}
                    {keystones.has(n.id) ? (
                      <circle
                        r={r + 9}
                        fill="none"
                        className="stroke-redex rdx-edge-keystone"
                        strokeWidth={1.2}
                        aria-hidden="true"
                      />
                    ) : null}
                    <circle
                      r={r}
                      className={cx(visual.ring)}
                      strokeWidth={visual.strokeWidth}
                      strokeDasharray={visual.dash}
                    />
                    <StateGlyph state={n.state} r={r} />
                  </>
                )}

                <text
                  y={r + 14}
                  fontSize={10}
                  fontWeight={700}
                  letterSpacing={0.5}
                  textAnchor="middle"
                  className={cx(visual.labelClass)}
                >
                  {n.code}
                </text>
              </g>
            );
          })}
        </g>
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
          <ConstellationFrame
            stage={stage}
            lensPanel={lensPanel}
            legend={legend}
            className="min-h-[32rem]"
          />
          {selected ? (
            <Card variant="raised" eyebrow={selected.code} title={selected.title}>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag variant="tier">{t(`catalog.tier.${selected.tier}`)}</Tag>
                  <Tag>{selected.domain}</Tag>
                  {selected.isBoss ? <Tag variant="gate">{t('catalog.gate')}</Tag> : null}
                  <span className="text-caption text-ink-muted">{stateLabel(selected.state)}</span>
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
