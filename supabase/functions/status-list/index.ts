// ============================================================================
// supabase/functions/status-list/index.ts  (Deno Edge Function) — issuer re-host
//
// PUBLIC (no-JWT) hosted BitstringStatusList — the Netlify+Supabase replacement
// for the dropped Cloudflare `status-list` Worker:
//   GET /status/:listId  → the SIGNED BitstringStatusListCredential JSON
//
// netlify.toml proxies https://redex.education/status/* here, so a verifier can
// check revocation on the apex `did:web:redex.education` (ledger §F). Only listId
// '1' is valid (the single hosted list).
//
// The signed list is NOT stored — it is REBUILT + RE-SIGNED on every request from
// the CURRENT revoked set (academy.credential_status_list WHERE revoked = true),
// exactly as the issue-badge revoke path republishes it. SIGNING IS SERVER-ONLY
// (invariant 7): the Ed25519 key is read from the function env (Supabase Vault),
// never logged or bundled. The bitstring carries no PII (credential_status_list is
// public by design, ledger §F) — but the read still needs the service role because
// the table is RLS-locked. Short cache so a revocation propagates quickly. Mirrors
// the public response contract in packages/credentials/src/hosting.ts.
//
// verify_jwt = false (supabase/config.toml) so external verifiers reach it.
// ============================================================================
import { createClient } from "@supabase/supabase-js";
import { signStatusListCredential } from "../_shared/status-republish.ts";
import {
  DEFAULT_ISSUER_DID,
  resolveIssuerEndpoints,
} from "../../../packages/credentials/src/issuer-config.ts";

/** Media type for a Verifiable Credential as JSON-LD (VCDM 2.0). */
const VC_MEDIA_TYPE = "application/vc+ld+json";

const PUBLIC_CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
};

/** A public, CORS-enabled JSON(-LD) response (mirrors hosting.ts jsonResponse). */
function jsonResponse(
  body: unknown,
  init: { contentType?: string; maxAge?: number; status?: number } = {},
): Response {
  const { contentType = "application/json", maxAge = 300, status = 200 } = init;
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": contentType,
      "cache-control": `public, max-age=${maxAge}`,
      ...PUBLIC_CORS,
    },
  });
}

/** The hosted BitstringStatusList credential. SHORT cache so a revocation
 *  propagates to verifiers quickly (mirrors hosting.ts statusListResponse). */
function statusListResponse(statusListCredential: unknown): Response {
  return jsonResponse(statusListCredential, {
    contentType: VC_MEDIA_TYPE,
    maxAge: 60,
  });
}

function corsPreflightResponse(): Response {
  return new Response(null, { status: 204, headers: PUBLIC_CORS });
}

function notFoundResponse(message = "not_found"): Response {
  return jsonResponse({ error: message }, { status: 404, maxAge: 0 });
}

function methodNotAllowedResponse(): Response {
  return jsonResponse({ error: "method_not_allowed" }, {
    status: 405,
    maxAge: 0,
  });
}

/** The single hosted list id (resolveIssuerEndpoints → .../status/1). */
const VALID_LIST_ID = "1";

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  if (req.method !== "GET") return methodNotAllowedResponse();

  const { pathname } = new URL(req.url);
  // Netlify proxies the apex path onto this function (status=200), so the route
  // prefix differs: `.../status-list/<id>` via the /status/* proxy, or a direct
  // `.../status-list/<id>`. The list id is the trailing segment either way — match
  // that rather than a literal `/status/` prefix the proxy strips. Only '1' is valid.
  const segments = pathname.split("/").filter(Boolean);
  const listId = segments[segments.length - 1];
  if (!listId || listId !== VALID_LIST_ID) {
    return notFoundResponse("status_list_not_found");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const issuerDid = Deno.env.get("OB_ISSUER_DID") ?? DEFAULT_ISSUER_DID;
  const keyId = Deno.env.get("OB_ISSUER_KEY_ID") ?? "key-2026-05";
  const secretKeyMultibase = Deno.env.get("OB_ISSUER_PRIVATE_KEY");
  if (!supabaseUrl || !serviceKey || !secretKeyMultibase) {
    return jsonResponse({ error: "misconfigured" }, { status: 500, maxAge: 0 });
  }

  // Service role: credential_status_list is RLS-locked. Read the CURRENT revoked
  // set and rebuild + re-sign the published list from it.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: revokedRows, error } = await admin
    .schema("academy")
    .from("credential_status_list")
    .select("list_index")
    .eq("revoked", true);
  if (error) {
    return jsonResponse({ error: "lookup_failed" }, { status: 500, maxAge: 0 });
  }

  const revokedIndices = ((revokedRows ?? []) as { list_index: number }[]).map((
    r,
  ) => Number(r.list_index));

  try {
    const statusListCredential = await signStatusListCredential(
      revokedIndices,
      {
        issuer: { did: issuerDid, keyId, secretKeyMultibase },
        endpoints: resolveIssuerEndpoints(issuerDid),
        created: new Date().toISOString(),
      },
    );
    return statusListResponse(statusListCredential);
  } catch {
    return jsonResponse({ error: "sign_failed" }, { status: 500, maxAge: 0 });
  }
});
