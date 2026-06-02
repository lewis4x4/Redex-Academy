import { SimUnitScreen } from './SimUnitScreen';

export interface Ac203SimScreenProps {
  /** Return to the Constellation (which re-reads gating → an advanced node shows). */
  onExit: () => void;
}

/**
 * M3 flagship — the AC-203 branching egress-fail simulation. As of Phase 2 this is a
 * thin alias over the generalized {@link SimUnitScreen}, configured for the AC-203
 * egress branching scenario. The full server-authoritative finalize + safety-veto path
 * is UNCHANGED (it lives in SimUnitScreen). The standalone screen advanced the
 * Constellation node by re-reading competency_state on exit, so onComplete is a no-op
 * here; in the course-player the scenario unit advances via SimUnitScreen.onComplete.
 *
 * NOTE: this screen is no longer routed by App.tsx (the legacy ?screen=sim entry is
 * retired in Phase 2 — the sim is reached only by progressing through the course-player).
 * Kept for the engine/recording contract + any direct embed.
 */
export function Ac203SimScreen({ onExit }: Ac203SimScreenProps) {
  return (
    <SimUnitScreen
      specKey="ac-203/egress-compliant"
      engineKind="branching_scenario"
      onComplete={() => {
        /* standalone: the Constellation re-reads competency_state on exit to advance */
      }}
      onExit={onExit}
    />
  );
}
