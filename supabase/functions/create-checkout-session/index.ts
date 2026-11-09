import { requireHouseholdOwner } from "../_shared/auth.ts";
import { isBillingPlan, type BillingPlan } from "../_shared/billing.ts";
import { handleCorsPreflight, jsonResponse, readJsonBody } from "../_shared/cors.ts";
import { getOrCreateBillingCustomer } from "../_shared/customers.ts";
import { appUrlWithQuery } from "../_shared/env.ts";
import { errorResponse, HttpError } from "../_shared/errors.ts";
import { priceIdForPlan } from "../_shared/prices.ts";
import { getStripe } from "../_shared/stripe.ts";
import { findBlockingSubscription } from "../_shared/subscriptions.ts";
import { createAdminClient } from "../_shared/supabase.ts";

const TRIAL_PERIOD_DAYS = 14;

/**
 * Accept `{ plan }` only. Price IDs and amounts are never read from the
 * request; the server maps the plan to a configured Stripe price.
 */
function parsePlan(body: unknown): BillingPlan {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "Choose a billing plan.", "invalid_plan");
  }

  // Only `plan` is accepted. In particular, never accept a client price ID or
  // amount.
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== "plan" || !("plan" in body)) {
    throw new HttpError(
      400,
      "Checkout accepts a plan only.",
      "invalid_request",
    );
  }

  const plan = (body as { plan?: unknown }).plan;
  if (!isBillingPlan(plan)) {
    throw new HttpError(
      400,
      "Choose a valid billing plan: monthly, yearly or lifetime.",
      "invalid_plan",
    );
  }

  return plan;
}

async function handleCheckout(req: Request): Promise<Response> {
  const { user, householdId } = await requireHouseholdOwner(req);
  const body = await readJsonBody(req);
  const plan = parsePlan(body);
  const admin = createAdminClient();

  // Reject a second plan rather than letting the webhook hit the one-live-plan
  // unique index. Plan changes belong in the Customer Portal.
  const existing = await findBlockingSubscription(admin, householdId);
  if (existing) {
    const message =
      existing.plan === "lifetime"
        ? "This household already has lifetime access."
        : "This household already has a plan. Use Manage billing to change or cancel it first.";
    throw new HttpError(409, message, "already_subscribed");
  }

  // Resolve the price before creating customers so a misconfigured deploy
  // fails without leaving orphaned Stripe customers behind.
  const priceId = priceIdForPlan(plan);
  const customerId = await getOrCreateBillingCustomer(admin, user, householdId);

  const metadata = {
    householdId,
    userId: user.id,
    plan,
  };

  const common = {
    customer: customerId,
    client_reference_id: householdId,
    metadata,
    allow_promotion_codes: true,
    success_url: appUrlWithQuery(
      "checkout=success&session_id={CHECKOUT_SESSION_ID}",
    ),
    cancel_url: appUrlWithQuery("checkout=cancelled"),
    line_items: [{ price: priceId, quantity: 1 }],
  };

  try {
    const stripe = getStripe();

    if (plan === "lifetime") {
      const session = await stripe.checkout.sessions.create({
        ...common,
        mode: "payment",
        payment_intent_data: { metadata },
      });

      if (!session.url) {
        console.error("Stripe returned a lifetime Checkout Session without URL", {
          sessionId: session.id,
        });
        throw new HttpError(
          502,
          "Stripe did not return a checkout URL. Please try again.",
          "stripe_checkout_failed",
        );
      }

      return jsonResponse({ url: session.url });
    }

    const session = await stripe.checkout.sessions.create({
      ...common,
      mode: "subscription",
      subscription_data: {
        trial_period_days: TRIAL_PERIOD_DAYS,
        metadata,
      },
    });

    if (!session.url) {
      console.error("Stripe returned a Checkout Session without URL", {
        sessionId: session.id,
      });
      throw new HttpError(
        502,
        "Stripe did not return a checkout URL. Please try again.",
        "stripe_checkout_failed",
      );
    }

    return jsonResponse({ url: session.url });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error("Failed to create Stripe Checkout Session:", error);
    throw new HttpError(
      502,
      "Could not start checkout. Please try again.",
      "stripe_checkout_failed",
    );
  }
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    return await handleCheckout(req);
  } catch (error) {
    return errorResponse(error);
  }
});
