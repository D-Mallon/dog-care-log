/**
 * CORS and JSON helpers shared by the billing Edge Functions.
 *
 * Requests are authenticated with a bearer JWT, not cookies, so a wildcard
 * origin is safe. The browser client (`supabase.functions.invoke`) sends the
 * `authorization`, `apikey`, `x-client-info` and `content-type` headers.
 */

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

/** Return a 204 response for CORS preflight, or null for normal requests. */
export function handleCorsPreflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;

  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

/** Parse the request body as JSON, returning a 400-friendly error on failure. */
export async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new InvalidJsonError();
  }
}

/** Marker error so callers can map malformed JSON to a 400 response. */
export class InvalidJsonError extends Error {
  constructor() {
    super("Request body must be valid JSON.");
    this.name = "InvalidJsonError";
  }
}
