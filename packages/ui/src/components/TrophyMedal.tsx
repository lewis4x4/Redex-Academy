import { forwardRef, type HTMLAttributes } from 'react';
import { cx } from '../cx';

export type TrophyDomain = 'FND' | 'INT' | 'ADC' | 'AC' | 'VID' | 'SEC';

export interface TrophyMedalProps extends Omit<HTMLAttributes<HTMLDivElement>, 'aria-label'> {
  /** Learning domain — drives the medal's hue (text-domain-* token). */
  domain: TrophyDomain;
  /** Whether the trophy has been earned. Locked dims the medal + shows a 🔒. */
  earned: boolean;
  /** The trophy's display name (also folded into the accessible label). */
  name: string;
}

// Token-class recipes (D1 §5.14, matched to the prototype `.trophy`). No raw hex —
// every class is backed by a CSS variable via the Tailwind preset. The card is an
// aspect-square panel; `earned` flips it to the red-tint brand surface with a soft
// glow + a hover lift/rotate. The medal SVG is hued per domain via the wrapper's
// `text-domain-*` (the circle stroke reads `currentColor`).
const CARD =
  'relative flex aspect-square flex-col items-center justify-center gap-2 ' +
  'rounded-card border p-3 text-center transition-all duration-screen ease-out';

const CARD_STATE: Record<'earned' | 'locked', string> = {
  earned: 'border-redex bg-red-tint shadow-glow-soft hover:-translate-y-1 hover:-rotate-1',
  locked: 'border-line bg-surface-1',
};

// The domain hue lives on the wrapper as a text color so the medal's circle stroke can
// inherit it via `currentColor`. Locked medals drop the hue (the stroke goes grey).
const DOMAIN_HUE: Record<TrophyDomain, string> = {
  FND: 'text-domain-fnd',
  INT: 'text-domain-int',
  ADC: 'text-domain-adc',
  AC: 'text-domain-ac',
  VID: 'text-domain-vid',
  SEC: 'text-domain-sec',
};

/**
 * TrophyMedal — a domain-hued mastery medal in a locked/earned card (D1 §5.14).
 * Colorblind-safe by construction: earned/locked is conveyed by shape (the 🔒
 * overlay), text (the accessible label states "earned"/"locked") and opacity, never
 * by hue alone. Renders a non-interactive `<div role="img">` whose `aria-label`
 * carries the medal's state + name. Forwards its ref, spreads ...rest, merges
 * className via cx. The inline 48×48 medal SVG is decorative (aria-hidden).
 */
export const TrophyMedal = forwardRef<HTMLDivElement, TrophyMedalProps>(function TrophyMedal(
  { domain, earned, name, className, ...rest },
  ref,
) {
  const state = earned ? 'earned' : 'locked';
  const label = `${earned ? 'Earned' : 'Locked'} trophy: ${name}`;
  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      className={cx(CARD, CARD_STATE[state], DOMAIN_HUE[domain], className)}
      {...rest}
    >
      {!earned ? (
        <span aria-hidden="true" className="absolute right-2 top-2 text-label opacity-40">
          🔒
        </span>
      ) : null}
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        width="48"
        height="48"
        className={cx(
          'transition-all duration-screen ease-out',
          earned ? 'opacity-100' : 'opacity-30',
        )}
        focusable="false"
      >
        {/* Ribbon — drapes behind the medal. earned = deep brand red; locked = dim surface. */}
        <path
          d="M18 26 L14 44 L24 38 L34 44 L30 26 Z"
          className={earned ? 'fill-redex-deep' : 'fill-surface-2'}
        />
        {/* Medal disc — earned fill = brand red, stroke = domain hue (currentColor);
            locked = dim track fill + grey locked stroke. */}
        <circle
          cx="24"
          cy="18"
          r="14"
          strokeWidth="2"
          className={earned ? 'fill-redex stroke-current' : 'fill-track stroke-domain-locked'}
        />
        {/* 5-point star — earned = gold mastery star; locked = grey. */}
        <path
          d="M24 9 L26.47 14.91 L32.85 15.42 L27.99 19.59 L29.49 25.82 L24 22.48 L18.51 25.82 L20.01 19.59 L15.15 15.42 L21.53 14.91 Z"
          className={earned ? 'fill-gold' : 'fill-domain-locked'}
        />
      </svg>
      <span
        className={cx(
          'text-eyebrow font-label leading-[1.2] tracking-name',
          earned ? 'text-white' : 'text-ink-muted',
        )}
      >
        {name}
      </span>
    </div>
  );
});
