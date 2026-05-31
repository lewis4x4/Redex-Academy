// ============================================================================
// supabase/functions/finalize-signoff/index.ts  (Deno Edge Function) — M6
//
// Thin entrypoint for the SERVER-AUTHORITATIVE Evaluator sign-off ("Prove one") —
// the single most liability-critical write path. All logic (authn, the re-checked
// authorization gate, the three-layer safety veto, rubric materialization from the
// canonical templates, idempotent finalize, signed→void) lives in ./handler.ts so
// it is unit-testable without binding a server. This file only wires the runtime.
//
// Runs as the SERVICE ROLE (must flip status→signed + write competency_state/audit),
// so it BYPASSES RLS and is therefore THE access-control boundary — see handler.ts.
// ============================================================================
import { handleRequest } from './handler.ts';

Deno.serve(handleRequest);
