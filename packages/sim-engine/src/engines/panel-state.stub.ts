/**
 * Engine #4 — virtual IQ-panel (XState), PLACEHOLDER export (F5 §12). The API
 * surface is reserved so consumers + the 2D fallback can target it now; the full
 * interactive build is Phase 2. validateSpec already returns the permissive
 * envelope-only guard for this kind (StubEnvelopeOnly). Calling the runtime throws
 * — it is intentionally not implemented in F5.
 */
import type { EngineKindValue } from '../api';

export const PANEL_STATE_ENGINE_KIND: EngineKindValue = 'panel_state_machine';

/** Reserved: building this in F5 is out of scope (Phase 2). */
export function createPanelStateSim(): never {
  throw new Error(
    'panel_state_machine (#4) is a Phase-2 engine — only the envelope-only schema stub exists in F5',
  );
}
