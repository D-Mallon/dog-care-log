import { HttpError } from "./errors.ts";

/**
 * Read a required server-side secret.
 *
 * Missing configuration is logged without printing the value and surfaced to
 * the client as a generic 500, so a half-configured deploy cannot be used to
 * probe which secrets exist.
 */
export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    throw new HttpError(
      500,
      "Billing is not configured correctly. Please contact support.",
      "server_configuration_error",
    );
  }
  return value;
}

/** Public app origin used for Checkout success/cancel and the billing portal. */
export function getAppUrl(): string {
  const raw = requireEnv("APP_URL").trim().replace(/\/+$/, "");

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("APP_URL must use http or https");
    }
  } catch {
    console.error("APP_URL is not a valid absolute URL.", { raw });
    throw new HttpError(
      500,
      "Billing is not configured correctly. Please contact support.",
      "server_configuration_error",
    );
  }

  return raw;
}

/**
 * Build a URL on the app origin.
 *
 * Query strings are passed through verbatim (rather than via `URLSearchParams`)
 * so Stripe's `{CHECKOUT_SESSION_ID}` placeholder is not percent-encoded.
 */
export function appUrlWithQuery(query: string): string {
  return `${getAppUrl()}/?${query.replace(/^[?&]+/, "")}`;
}
