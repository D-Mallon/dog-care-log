import type { BillingPlan } from "./billing.ts";
import { HttpError } from "./errors.ts";

/**
 * Server-side mapping from a plan name to the Stripe price ID.
 *
 * The client sends a plan name only. Keeping price IDs in function secrets
 * means a caller cannot swap in a cheaper price or another account's price.
 */
export const PRICE_ENV_BY_PLAN: Record<BillingPlan, string> = {
  monthly: "STRIPE_PRICE_MONTHLY",
  yearly: "STRIPE_PRICE_YEARLY",
  lifetime: "STRIPE_PRICE_LIFETIME",
};

export function priceIdForPlan(plan: BillingPlan): string {
  const envName = PRICE_ENV_BY_PLAN[plan];
  const priceId = Deno.env.get(envName);

  if (!priceId) {
    console.error(`Missing Stripe price configuration: ${envName}`);
    throw new HttpError(
      500,
      "Billing is not configured for this plan. Please contact support.",
      "price_not_configured",
    );
  }

  return priceId;
}

/** Best-effort reverse mapping for webhook events that carry a price ID. */
export function planForPriceId(
  priceId: string | null | undefined,
): BillingPlan | null {
  if (!priceId) return null;

  for (const plan of Object.keys(PRICE_ENV_BY_PLAN) as BillingPlan[]) {
    if (Deno.env.get(PRICE_ENV_BY_PLAN[plan]) === priceId) {
      return plan;
    }
  }

  return null;
}
