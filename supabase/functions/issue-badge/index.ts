// ============================================================================
// supabase/functions/issue-badge/index.ts  (Deno Edge Function) — F6
//
// Thin entrypoint for the SERVER-ONLY OB 3.0 / W3C VC issuer. All logic (authn,
// the re-checked issuer-authorization boundary, the eddsa-rdfc-2022 signing, the
// self-verify, the credentials/status-list writes) lives in ./handler.ts so it
// is unit-testable without binding a server. Runs as the SERVICE ROLE — it is
// THE access-control boundary (see handler.ts). The signing key is read from the
// function env (Supabase Vault) and never leaves the server.
// ============================================================================
import { handleRequest } from './handler.ts';

Deno.serve(handleRequest);
