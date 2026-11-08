import {
  createClient,
  type SupabaseClient,
  type User,
} from "npm:@supabase/supabase-js@2";
import { HttpError } from "./errors.ts";
import { requireEnv } from "./env.ts";

const CLIENT_OPTIONS = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
} as const;

/**
 * Service-role client. Only use this inside Edge Functions; the service role
 * key must never be sent to the browser.
 */
export function createAdminClient(): SupabaseClient {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    CLIENT_OPTIONS,
  );
}

/**
 * Client scoped to an end user's JWT. Queries made with it are subject to RLS,
 * which is what we want for the household-ownership check.
 */
export function createUserClient(accessToken: string): SupabaseClient {
  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

  if (!anonKey) {
    console.error("Missing SUPABASE_ANON_KEY/SUPABASE_PUBLISHABLE_KEY.");
    throw new HttpError(
      500,
      "Billing is not configured correctly. Please contact support.",
      "server_configuration_error",
    );
  }

  return createClient(requireEnv("SUPABASE_URL"), anonKey, {
    ...CLIENT_OPTIONS,
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

export interface AuthenticatedRequest {
  user: User;
  accessToken: string;
}

/** Extract and validate the caller's Supabase access token. */
export async function requireUser(
  req: Request,
): Promise<AuthenticatedRequest> {
  const authorization = req.headers.get("Authorization");
  const match = authorization
    ? /^Bearer\s+(.+)$/i.exec(authorization.trim())
    : null;

  if (!match) {
    throw new HttpError(
      401,
      "Authentication required. Please sign in again.",
      "unauthorized",
    );
  }

  const accessToken = match[1];
  const { data, error } = await createUserClient(accessToken).auth.getUser(
    accessToken,
  );

  if (error || !data.user) {
    throw new HttpError(
      401,
      "Your session has expired. Please sign in again.",
      "unauthorized",
    );
  }

  return { user: data.user, accessToken };
}
