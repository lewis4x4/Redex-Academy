// ============================================================================
// supabase/functions/hosted-assertion/index.ts  (Deno Edge Function) — issuer re-host
//
// PUBLIC (no-JWT) hosted credential assertion — the Netlify+Supabase replacement
// for the dropped Cloudflare `badge-assertion` Worker:
//   GET /credentials/:id  → the stored, signed OB 3.0 credential JSON
//
// netlify.toml proxies https://redex.education/credentials/* here, so the badge
// "verifies at a public URL" on the apex `did:web:redex.education` (ledger §J).
// The path arrives proxied (the Edge-Function route prefix is stripped/rewritten),
// so the regex tolerates a leading prefix and matches the trailing /credentials/:id.
//
// Read-only + public (the signed credential carries no secret). The credential
// lives in academy.credentials, which is RLS-locked with NO public policy, so we
// read with the SERVICE ROLE and return ONLY open_badge_json — never any other
// column (no PII, no proof-of-anything beyond the public credential). Mirrors the
// public response contract in packages/credentials/src/hosting.ts (media type,
// short cache, open CORS for browser-based verifiers).
//
// verify_jwt = false (supabase/config.toml) so external verifiers reach it.
// ============================================================================
import { createClient } from "@supabase/supabase-js";

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

/** A hosted, verifiable credential assertion (short cache). */
function assertionResponse(credential: unknown): Response {
  return jsonResponse(credential, { contentType: VC_MEDIA_TYPE, maxAge: 600 });
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

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  if (req.method !== "GET") return methodNotAllowedResponse();

  const { pathname } = new URL(req.url);
  // Netlify proxies the apex path (/credentials/:id) onto this function's route,
  // so tolerate any leading prefix and capture the trailing credential id.
  const match = /^.*\/credentials\/([A-Za-z0-9._-]+)$/.exec(pathname);
  if (!match) return notFoundResponse();
  const id = match[1]!;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: "misconfigured" }, { status: 500, maxAge: 0 });
  }

  // Service role: academy.credentials is RLS-locked with no public policy, so the
  // service role is required to read the stored signed credential. We SELECT only
  // open_badge_json and return nothing else.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin
    .schema("academy")
    .from("credentials")
    .select("open_badge_json")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return jsonResponse({ error: "lookup_failed" }, { status: 500, maxAge: 0 });
  }
  const openBadgeJson = (data as { open_badge_json: unknown } | null)
    ?.open_badge_json;
  if (openBadgeJson == null) return notFoundResponse("credential_not_found");

  return assertionResponse(openBadgeJson);
});
