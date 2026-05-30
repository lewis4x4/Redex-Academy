import { useState, type ReactElement, type ReactNode } from 'react';
import { cx } from '../cx';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { NavPill } from '../components/NavPill';
import { Chip, Tab } from '../components/Chip';
import { Tag, type TagVariant } from '../components/Tag';
import {
  Tooltip,
  TooltipCode,
  TooltipTitle,
  TooltipMeta,
  TooltipHint,
} from '../components/Tooltip';
import { Modal } from '../components/Modal';
import { SlideOver } from '../components/SlideOver';
import { ToastProvider, useToast } from '../components/Toast';
import { Meter, ProgressBar, ProgressDots, type MeterTone } from '../components/Meter';
import { StatBlock, ScoreValue } from '../components/StatBlock';
import { Pip, PipRow } from '../components/Pip';
import { TrophyMedal, type TrophyDomain } from '../components/TrophyMedal';
import { Icon, ICON_NAMES } from '../components/Icon';
import { Input, Select, Textarea } from '../components/Input';
import { Checkbox, Radio, Switch } from '../components/Toggle';
import { Skeleton, EmptyState, ErrorState } from '../components/States';
import { StatusBadge, type VerdictKind } from '../StatusBadge';
import { BrandMark } from '../shell/BrandMark';
import { ScreenHead } from '../shell/ScreenHead';

// ── Gallery density ──────────────────────────────────────────────────────────
// The reviewer-facing persona-density toggle. `field` (Marco) = roomier touch +
// larger base type; `dense` (Priya/Dana) = compact. This is the ONLY place
// persona-density is demonstrated — it is PURE LAYOUT and never touches
// permissions (CLAUDE.md §7: persona drives UI, role drives permissions).
type GalleryDensity = 'field' | 'dense';

/**
 * A labelled gallery section. Renders a {@link ScreenHead} as the section heading
 * (so the page has a correct, screen-reader-navigable outline) wrapped in a
 * landmark `<section>` keyed to its heading via aria-labelledby.
 */
function Section({
  id,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}): ReactElement {
  const headingId = `gallery-${id}`;
  return (
    <section aria-labelledby={headingId} className="mb-2">
      <div id={headingId}>
        <ScreenHead eyebrow={eyebrow} title={title} subtitle={subtitle} />
      </div>
      <div className="px-8 py-4">{children}</div>
    </section>
  );
}

/** A small captioned cell so each specimen is labelled with the state it shows. */
function Specimen({ caption, children }: { caption: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex flex-col items-start gap-2">
      <span className="text-eyebrow font-label uppercase tracking-eyebrow text-ink-muted">
        {caption}
      </span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/** Even grid wrapper for specimen cells. */
function Grid({ children }: { children: ReactNode }): ReactElement {
  return <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

// The six learning domains (TrophyMedal domain union) + a human label each.
const DOMAINS: ReadonlyArray<{ domain: TrophyDomain; name: string }> = [
  { domain: 'FND', name: 'Foundations' },
  { domain: 'INT', name: 'Intrusion' },
  { domain: 'ADC', name: 'Alarm.com' },
  { domain: 'AC', name: 'Access Control' },
  { domain: 'VID', name: 'Video' },
  { domain: 'SEC', name: 'Security' },
];

const TAG_VARIANTS: ReadonlyArray<{ variant: TagVariant; label: string }> = [
  { variant: 'tier', label: 'Tier 2' },
  { variant: 'gate', label: 'Gate' },
  { variant: 'boss', label: 'Boss' },
  { variant: 'keystone', label: 'Keystone' },
];

const METER_TONES: ReadonlyArray<{ tone: MeterTone; value: number; label: string }> = [
  { tone: 'ok', value: 0.55, label: 'PoE budget — ok' },
  { tone: 'warn', value: 0.86, label: 'PoE budget — near limit' },
  { tone: 'over', value: 1, label: 'PoE budget — over' },
];

const VERDICTS: ReadonlyArray<VerdictKind> = ['pass', 'fail', 'safety_veto', 'pending'];

// Icon glyphs paired with a token text-tint class so each renders in a brand hue
// (the Icon itself draws in currentColor — never a raw hex).
const ICON_TINTS: Record<(typeof ICON_NAMES)[number], string> = {
  play: 'text-redex-bright',
  check: 'text-green',
  store: 'text-ink-soft',
  warn: 'text-amber',
  bolt: 'text-redex-bright',
};

/**
 * The Toast specimen. `useToast()` must run inside a {@link ToastProvider}, so this
 * is a small child rendered under the gallery's OWN provider (see the Overlays
 * section). The button push is gallery interactivity, not feature logic.
 */
function ToastSpecimen(): ReactElement {
  const { toast } = useToast();
  return (
    <Button
      variant="secondary"
      leftIcon={<Icon name="bolt" size={16} />}
      onClick={() =>
        toast({ message: 'Proof captured — synced to the Work OS job.', durationMs: 3200 })
      }
    >
      Push a toast
    </Button>
  );
}

/**
 * The D1 component gallery for @redex/ui — the reviewable artifact for the
 * human-verify gate. Renders every primitive in every state on the dark +
 * Redex-red theme, grouped in labelled sections, with a persona-density toggle.
 *
 * a11y: each section is a labelled landmark with a heading; every interactive
 * control is labelled; status is shape + text + color (never color alone); the
 * page is fully keyboard-navigable; only `rdx-anim-*` classes carry motion (all
 * reduced-motion-gated). No raw hex/rgba anywhere — token Tailwind classes only.
 */
export default function Gallery(): ReactElement {
  const [density, setDensity] = useState<GalleryDensity>('dense');

  // Overlay open-state (gallery interactivity via useState — NOT feature logic).
  const [modalOpen, setModalOpen] = useState(false);
  const [slideOverOpen, setSlideOverOpen] = useState(false);

  // Interactive form-control state so the live controls behave on keyboard/click.
  const [switchOn, setSwitchOn] = useState(true);
  const [checkboxOn, setCheckboxOn] = useState(true);
  const [radioChoice, setRadioChoice] = useState('failsafe');

  return (
    <div
      data-density={density}
      className={cx(
        'rdx-scope min-h-screen bg-canvas text-white',
        density === 'field' ? 'text-body-lg' : 'text-body',
      )}
    >
      {/* ── Density toggle (the reviewer control) ─────────────────────────── */}
      <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-4 border-b border-line bg-grad-header px-8 py-4 backdrop-blur-md">
        <BrandMark />
        <fieldset className="flex items-center gap-3 border-0 p-0">
          <legend className="sr-only">
            Persona density (layout only — does not change permissions)
          </legend>
          <span className="text-label font-label uppercase tracking-label text-ink-muted">
            Persona density
          </span>
          <div role="radiogroup" aria-label="Persona density" className="flex gap-1.5">
            <Chip
              selected={density === 'field'}
              onClick={() => setDensity('field')}
              aria-label="Field density (Marco): roomier, larger type"
            >
              Field (Marco)
            </Chip>
            <Chip
              selected={density === 'dense'}
              onClick={() => setDensity('dense')}
              aria-label="Dense density (Priya / Dana): compact type"
            >
              Dense (Priya/Dana)
            </Chip>
          </div>
          <span className="text-eyebrow text-ink-dim">layout only · not permissions</span>
        </fieldset>
      </div>

      {/* ── Brand ──────────────────────────────────────────────────────────── */}
      <Section
        id="brand"
        eyebrow="Identity"
        title="Brand"
        subtitle="The Redex Academy lockup — the glowing red mark + wordmark."
      >
        <Card variant="panel" padding="lg">
          <div className="flex flex-col gap-6">
            <Specimen caption="With tagline (md)">
              <BrandMark />
            </Specimen>
            <Specimen caption="Compact, no tagline (sm)">
              <BrandMark size="sm" showTagline={false} />
            </Specimen>
          </div>
        </Card>
      </Section>

      {/* ── Buttons ────────────────────────────────────────────────────────── */}
      <Section
        id="buttons"
        eyebrow="Actions"
        title="Buttons"
        subtitle="Every variant × normal / disabled, plus a leftIcon example. Hover state is noted (hover the primary to see the lift + glow)."
      >
        <Card variant="panel" padding="lg">
          <div className="flex flex-col gap-6">
            <Specimen caption="Primary — normal · hover (lifts + glows) · disabled">
              <Button variant="primary">Primary</Button>
              <Button variant="primary" leftIcon={<Icon name="play" size={16} />}>
                With icon
              </Button>
              <Button variant="primary" disabled>
                Disabled
              </Button>
            </Specimen>
            <Specimen caption="Secondary — normal · disabled">
              <Button variant="secondary">Secondary</Button>
              <Button variant="secondary" leftIcon={<Icon name="store" size={16} />}>
                With icon
              </Button>
              <Button variant="secondary" disabled>
                Disabled
              </Button>
            </Specimen>
            <Specimen caption="Ghost — normal · disabled">
              <Button variant="ghost">Ghost</Button>
              <Button variant="ghost" leftIcon={<Icon name="check" size={16} />}>
                With icon
              </Button>
              <Button variant="ghost" disabled>
                Disabled
              </Button>
            </Specimen>
            <Specimen caption="CTA — full-width launch button · disabled">
              <div className="flex w-full max-w-md flex-col gap-3">
                <Button variant="cta" leftIcon={<Icon name="bolt" size={18} />}>
                  Launch simulation
                </Button>
                <Button variant="cta" disabled>
                  Launch simulation (disabled)
                </Button>
              </div>
            </Specimen>
          </div>
        </Card>
      </Section>

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <Section
        id="nav"
        eyebrow="Navigation"
        title="NavPill"
        subtitle="The ghost nav button — default + active (red tint, soft glow, aria-current). Each carries a currentColor dot."
      >
        <Card variant="panel" padding="lg">
          <nav aria-label="Gallery nav demo" className="flex flex-wrap gap-1.5">
            <NavPill leftIcon={<Icon name="store" size={16} />}>Catalog</NavPill>
            <NavPill active leftIcon={<Icon name="play" size={16} />}>
              Learn
            </NavPill>
            <NavPill>Backpack</NavPill>
          </nav>
        </Card>
      </Section>

      {/* ── Chips + Tabs ───────────────────────────────────────────────────── */}
      <Section
        id="chips"
        eyebrow="Selection"
        title="Chip + Tab"
        subtitle="Chips default / selected / persona-GOLD, and a tablist with an active tab."
      >
        <Card variant="panel" padding="lg">
          <div className="flex flex-col gap-6">
            <Specimen caption="Chip — default · selected · persona (gold) default · persona selected">
              <Chip>Filter</Chip>
              <Chip selected>Selected</Chip>
              <Chip variant="persona">Persona</Chip>
              <Chip variant="persona" selected>
                Persona on
              </Chip>
            </Specimen>
            <Specimen caption="Tabs — row with an active tab (role=tablist)">
              <div role="tablist" aria-label="Sim views" className="flex items-end gap-1">
                <Tab active>Overview</Tab>
                <Tab>Telemetry</Tab>
                <Tab>Evidence</Tab>
              </div>
            </Specimen>
          </div>
        </Card>
      </Section>

      {/* ── Tags ───────────────────────────────────────────────────────────── */}
      <Section
        id="tags"
        eyebrow="Metadata"
        title="Tag"
        subtitle="Every variant. gate (⚠) and keystone (◆) carry a glyph so they read without color."
      >
        <Card variant="panel" padding="lg">
          <Specimen caption="default · tier · gate · boss · keystone">
            <Tag>Default</Tag>
            {TAG_VARIANTS.map((t) => (
              <Tag key={t.variant} variant={t.variant}>
                {t.label}
              </Tag>
            ))}
          </Specimen>
        </Card>
      </Section>

      {/* ── Tooltip ────────────────────────────────────────────────────────── */}
      <Section
        id="tooltip"
        eyebrow="Overlay"
        title="Tooltip"
        subtitle="Shown (open) example with its composed parts — code, title, meta, hint."
      >
        <Card variant="panel" padding="lg">
          <div className="flex min-h-[140px] items-end">
            <Tooltip
              open
              placement="top"
              content={
                <div className="flex flex-col gap-1">
                  <TooltipCode>AC-203</TooltipCode>
                  <TooltipTitle>Maglock fail-safe wiring</TooltipTitle>
                  <TooltipMeta>Access Control · Tier 2</TooltipMeta>
                  <TooltipHint>Egress must release on power loss.</TooltipHint>
                </div>
              }
            >
              <Button variant="secondary">Anchor (tooltip shown above)</Button>
            </Tooltip>
          </div>
        </Card>
      </Section>

      {/* ── Overlays: Modal / SlideOver / Toast ────────────────────────────── */}
      <Section
        id="overlays"
        eyebrow="Overlays"
        title="Modal · SlideOver · Toast"
        subtitle="A trigger for each. Open state is local useState (gallery interactivity). Toast runs in the gallery's own ToastProvider."
      >
        <Card variant="panel" padding="lg">
          <ToastProvider>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
              <Button variant="secondary" onClick={() => setSlideOverOpen(true)}>
                Open SlideOver
              </Button>
              <ToastSpecimen />
            </div>
          </ToastProvider>

          <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Confirm sign-off">
            <p className="text-body text-ink-soft">
              This is the centered modal dialog. Press Escape, click the scrim, or use the button
              below to close.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setModalOpen(false)}>
                Confirm
              </Button>
            </div>
          </Modal>

          <SlideOver
            open={slideOverOpen}
            onClose={() => setSlideOverOpen(false)}
            title="Course detail"
          >
            <p className="text-body text-ink-soft">
              The right slide-over panel. It slides in over a drawer scrim; Escape or the close
              button dismisses it.
            </p>
            <div className="mt-5">
              <Button variant="primary" onClick={() => setSlideOverOpen(false)}>
                Done
              </Button>
            </div>
          </SlideOver>
        </Card>
      </Section>

      {/* ── Progress: Meter / ProgressBar / ProgressDots ───────────────────── */}
      <Section
        id="progress"
        eyebrow="Progress"
        title="Meter · ProgressBar · ProgressDots"
        subtitle="Meter tones (ok / warn / over) carry a tone word; ProgressDots pair color with a glyph + label."
      >
        <Grid>
          <Card variant="panel" padding="lg">
            <div className="flex flex-col gap-4">
              <span className="text-eyebrow font-label uppercase tracking-eyebrow text-ink-muted">
                ProgressBar — 25% · 60% · 95%
              </span>
              <ProgressBar value={0.25} label="Module progress 25 percent" />
              <ProgressBar value={0.6} label="Module progress 60 percent" />
              <ProgressBar value={0.95} label="Module progress 95 percent" />
            </div>
          </Card>
          <Card variant="panel" padding="lg">
            <div className="flex flex-col gap-4">
              <span className="text-eyebrow font-label uppercase tracking-eyebrow text-ink-muted">
                Meter — ok / warn / over
              </span>
              {METER_TONES.map((m) => (
                <Meter key={m.tone} value={m.value} tone={m.tone} ariaLabel={m.label} />
              ))}
            </div>
          </Card>
          <Card variant="panel" padding="lg">
            <div className="flex flex-col gap-4">
              <span className="text-eyebrow font-label uppercase tracking-eyebrow text-ink-muted">
                ProgressDots — done / fail / current / todo
              </span>
              <ProgressDots
                label="Scenario progress"
                steps={['done', 'done', 'fail', 'current', 'todo']}
              />
            </div>
          </Card>
        </Grid>
      </Section>

      {/* ── Stats: StatBlock / ScoreValue ──────────────────────────────────── */}
      <Section
        id="stats"
        eyebrow="HUD"
        title="StatBlock · ScoreValue"
        subtitle="Compact value/label pairs and the larger display-weight score variant."
      >
        <Card variant="panel" padding="lg">
          <div className="flex flex-wrap items-end gap-10">
            <StatBlock value="1,240" label="Proof Points" accent align="start" />
            <StatBlock value="3" label="Badges" align="start" />
            <ScoreValue value="92" unit="%" label="Mastery score" />
            <ScoreValue value="4" unit="/ 6" label="Domains complete" />
          </div>
        </Card>
      </Section>

      {/* ── Pips ───────────────────────────────────────────────────────────── */}
      <Section
        id="pips"
        eyebrow="Badges"
        title="Pip · PipRow"
        subtitle="Earned (red + ✓) vs locked. Each pip announces its earned/locked state as text."
      >
        <Card variant="panel" padding="lg">
          <div className="flex flex-col gap-6">
            <Specimen caption="Single pips — earned · locked">
              <Pip earned label="Foundations badge" />
              <Pip label="Intrusion badge" />
            </Specimen>
            <Specimen caption="PipRow — overlapping cluster (mixed states)">
              <PipRow label="Earned badges">
                <Pip earned label="Foundations" />
                <Pip earned label="Intrusion" />
                <Pip label="Alarm.com" />
                <Pip label="Video" />
              </PipRow>
            </Specimen>
          </div>
        </Card>
      </Section>

      {/* ── Trophies ───────────────────────────────────────────────────────── */}
      <Section
        id="trophies"
        eyebrow="Mastery"
        title="TrophyMedal"
        subtitle="All six domains, locked AND earned. State is shape (🔒) + text + opacity, never hue alone."
      >
        <div className="flex flex-col gap-6">
          <div>
            <span className="mb-3 block text-eyebrow font-label uppercase tracking-eyebrow text-ink-muted">
              Earned
            </span>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {DOMAINS.map((d) => (
                <TrophyMedal key={`earned-${d.domain}`} domain={d.domain} earned name={d.name} />
              ))}
            </div>
          </div>
          <div>
            <span className="mb-3 block text-eyebrow font-label uppercase tracking-eyebrow text-ink-muted">
              Locked
            </span>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {DOMAINS.map((d) => (
                <TrophyMedal
                  key={`locked-${d.domain}`}
                  domain={d.domain}
                  earned={false}
                  name={d.name}
                />
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Icons ──────────────────────────────────────────────────────────── */}
      <Section
        id="icons"
        eyebrow="Iconography"
        title="Icon"
        subtitle="Every ICON_NAMES glyph, tinted via text-* token classes (the SVG draws in currentColor)."
      >
        <Card variant="panel" padding="lg">
          <div className="flex flex-wrap gap-8">
            {ICON_NAMES.map((n) => (
              <div key={n} className="flex flex-col items-center gap-2">
                <Icon name={n} size={28} className={ICON_TINTS[n]} title={n} />
                <span className="text-eyebrow font-label uppercase tracking-eyebrow text-ink-muted">
                  {n}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      {/* ── Form controls ──────────────────────────────────────────────────── */}
      <Section
        id="forms"
        eyebrow="Forms"
        title="Form controls"
        subtitle="Input · Select · Textarea · Checkbox · Radio · Switch — each labelled, plus focus + disabled examples."
      >
        <Grid>
          <Card variant="panel" padding="lg">
            <div className="flex flex-col gap-4">
              <Input label="Tech name" placeholder="e.g. Marco R." />
              <Input label="Autofocus (focus example)" placeholder="Focused on load" autoFocus />
              <Input label="Disabled" placeholder="Unavailable" disabled />
            </div>
          </Card>
          <Card variant="panel" padding="lg">
            <div className="flex flex-col gap-4">
              <Select label="Domain" defaultValue="AC">
                <option value="FND">Foundations</option>
                <option value="INT">Intrusion</option>
                <option value="AC">Access Control</option>
              </Select>
              <Select label="Disabled select" disabled defaultValue="FND">
                <option value="FND">Foundations</option>
              </Select>
              <Textarea label="Evidence note" placeholder="Describe what you verified…" />
            </div>
          </Card>
          <Card variant="panel" padding="lg">
            <div className="flex flex-col gap-4">
              <span className="text-eyebrow font-label uppercase tracking-eyebrow text-ink-muted">
                Checkbox · Radio · Switch
              </span>
              <Checkbox
                label="Acknowledge safety brief"
                checked={checkboxOn}
                onChange={(e) => setCheckboxOn(e.currentTarget.checked)}
              />
              <Checkbox label="Disabled checkbox" disabled />
              <div role="radiogroup" aria-label="Lock mode" className="flex flex-col gap-2">
                <Radio
                  name="gallery-lock-mode"
                  label="Fail-safe (REX releases on power loss)"
                  value="failsafe"
                  checked={radioChoice === 'failsafe'}
                  onChange={() => setRadioChoice('failsafe')}
                />
                <Radio
                  name="gallery-lock-mode"
                  label="Fail-locked"
                  value="faillocked"
                  checked={radioChoice === 'faillocked'}
                  onChange={() => setRadioChoice('faillocked')}
                />
                <Radio name="gallery-lock-mode" label="Disabled radio" value="disabled" disabled />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={switchOn} onCheckedChange={setSwitchOn} label="Offline mode" />
                <span className="text-body text-ink-soft">
                  Offline mode {switchOn ? 'on' : 'off'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={false} disabled label="Disabled switch" />
                <span className="text-body text-ink-muted">Disabled switch</span>
              </div>
            </div>
          </Card>
        </Grid>
      </Section>

      {/* ── States: Skeleton / EmptyState / ErrorState ─────────────────────── */}
      <Section
        id="states"
        eyebrow="States"
        title="Skeleton · EmptyState · ErrorState"
        subtitle="Loading, zero-data, and failure placeholders. Error uses ⚠ + text, not color alone."
      >
        <Grid>
          <Card variant="panel" padding="lg">
            <div className="flex flex-col gap-3">
              <span className="text-eyebrow font-label uppercase tracking-eyebrow text-ink-muted">
                Skeleton
              </span>
              <Skeleton height="1.25rem" width="60%" />
              <Skeleton height="1rem" />
              <Skeleton height="1rem" width="80%" />
              <Skeleton height={64} rounded="card" />
            </div>
          </Card>
          <EmptyState
            icon={<Icon name="store" size={28} />}
            title="No courses yet"
            description="Published catalog content will appear here once it's assigned."
            action={<Button variant="secondary">Browse catalog</Button>}
          />
          <ErrorState
            title="Couldn't load progress"
            description="The telemetry service is unreachable. Your work is saved and will sync on reconnect."
            onRetry={() => undefined}
            retryLabel="Retry"
          />
        </Grid>
      </Section>

      {/* ── StatusBadge ────────────────────────────────────────────────────── */}
      <Section
        id="status"
        eyebrow="Verdict"
        title="StatusBadge"
        subtitle="pass / fail / safety_veto / pending — shape + text + color together, never color alone."
      >
        <Card variant="panel" padding="lg">
          <div className="flex flex-wrap items-center gap-8">
            {VERDICTS.map((kind) => (
              <StatusBadge key={kind} kind={kind} />
            ))}
          </div>
        </Card>
      </Section>
    </div>
  );
}
