import Stripe from "npm:stripe@18.5.0";
import { requireEnv } from "./env.ts";

let stripeClient: Stripe | null = null;

/**
 * Lazily construct the Stripe client.
 *
 * `stripe@18.5.0` and API version `2025-08-27.basil` are pinned deliberately.
 * The fetch HTTP client is required in Deno.
 */
export function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
      // Pinned to the API version shipped with stripe@18.5.0 (Basil). Keeping
      // it explicit prevents an account-level default from changing response
      // shapes such as `subscription.current_period_end`.
      apiVersion: "2025-08-27.basil",
      httpClient: Stripe.createFetchHttpClient(),
      maxNetworkRetries: 2,
      timeout: 20_000,
    });
  }

  return stripeClient;
}

/**
 * Verify a Stripe webhook signature against the raw request body.
 *
 * `constructEventAsync` needs an explicit crypto provider because Edge
 * Functions run on Deno's Web Crypto rather than Node's crypto module.
 */
export async function verifyStripeWebhook(
  payload: string,
  signature: string,
  secret: string,
): Promise<Stripe.Event> {
  return await getStripe().webhooks.constructEventAsync(
    payload,
    signature,
    secret,
    undefined,
    Stripe.createSubtleCryptoProvider(),
  );
}
