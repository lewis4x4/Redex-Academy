import type { ReactElement, ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { Pip, PipRow } from '../components/Pip';
import { StatBlock } from '../components/StatBlock';
import { BrandMark } from './BrandMark';

export interface BackpackBadge {
  label: string;
  earned: boolean;
}

export interface AppHeaderProps {
  /** The primary nav pills (caller composes <NavPill/>s). Rendered in a <nav>. */
  nav?: ReactNode;
  /** Proof Points HUD stat (the brand economy; G1 fills the logic). */
  proofPoints?: number;
  /** Up to 4 badge pips shown on the Digital Backpack button. */
  badges?: BackpackBadge[];
  /** Opens the Digital Backpack (the modal/wall is M7/D1-template; this just triggers). */
  onBackpack?: () => void;
  /** Trailing app-level controls (e.g. a sign-out button, user menu). */
  actions?: ReactNode;
}

/**
 * The persistent app header (D1 §6.2): brand lockup · primary nav pills · HUD
 * (Proof Points + the Digital Backpack button with badge pips). Gradient bar with
 * blur, a hairline bottom border. Persona drives the shell density around it, never
 * what appears here (permissions are role-driven elsewhere).
 */
export function AppHeader({
  nav,
  proofPoints,
  badges = [],
  onBackpack,
  actions,
}: AppHeaderProps): ReactElement {
  return (
    <header className="z-40 flex items-center gap-6 border-b border-line bg-grad-header px-[26px] py-3.5 backdrop-blur-md">
      <BrandMark />
      {nav ? (
        <nav aria-label="Primary" className="ml-2 flex gap-1.5">
          {nav}
        </nav>
      ) : null}

      <div className="ml-auto flex items-center gap-[18px]">
        {proofPoints !== undefined ? (
          <StatBlock
            value={
              <span className="inline-flex items-center gap-1">
                <Icon name="bolt" size={15} className="text-redex-bright" aria-hidden />
                {proofPoints}
              </span>
            }
            label="Proof Points"
            accent
          />
        ) : null}

        {onBackpack ? (
          <button
            type="button"
            onClick={onBackpack}
            aria-label="Open Digital Backpack"
            className="flex items-center gap-2.5 rounded-pill border border-line bg-surface-1 px-3.5 py-2 text-label font-nav text-ink-soft transition-all duration-hover hover:border-redex hover:text-white hover:shadow-glow-soft"
          >
            <span>Backpack</span>
            {badges.length > 0 ? (
              <PipRow label="Earned badges">
                {badges.slice(0, 4).map((b) => (
                  <Pip key={b.label} earned={b.earned} label={b.label} />
                ))}
              </PipRow>
            ) : null}
          </button>
        ) : null}
        {actions}
      </div>
    </header>
  );
}
