import type Stripe from "npm:stripe@18.5.0";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  isBillingPlan,
  normalizeSubscriptionStatus,
  type SubscriptionStatus,
} from "../_shared/billing.ts";
import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { requireEnv } from "../_shared/env.ts";
import { errorResponse, HttpError } from "../_shared/errors.ts";
import { planForPriceId } from "../_shared/prices.ts";
import { getStripe, verifyStripeWebhook } from "../_shared/stripe.ts";
import {
  findSubscription,
  saveSubscription,
  subscriptionPeriodEnd,
  subscriptionPriceId,
} from "../_shared/subscriptions.ts";
import { createAdminClient } from "../_shared/supabase.ts";

/**
 * Stripe's webhook is deployed with `verify_jwt = false` because Stripe cannot
 * send a Supabase JWT. Authenticity comes from the signed `stripe-signature`
 * header, verified against the raw request body.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function householdExists(
  admin: SupabaseClient,
  householdId: string,
): Promise<boolean> {
  if (!UUID_PATTERN.test(householdId)) {
    console.error("Stripe metadata contains an invalid householdId", {
      householdId,
    });
    return false;
  }

  const { data, error } = await admin
    .from("Household")
    .select("id")
    .eq("id", householdId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    console.error("Stripe event references a missing household", {
      householdId,
    });
  }

  return Boolean(data);
}

function metadataString(
  metadata: Stripe.Metadata | null | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Keep `Subscription` in sync with a Stripe subscription object.
 *
 * Metadata is the primary household source; for events that predate it (for
 * example a retried delivery after a metadata edit) fall back to the existing
 * row. Never creates a row for a household that does not exist.
 */
async function syncSubscription(
  admin: SupabaseClient,
  subscription: Stripe.Subscription,
  forcedStatus?: SubscriptionStatus,
): Promise<void> {
  const existing = await findSubscription(admin, subscription.id);
  const householdId =
    metadataString(subscription.metadata, "householdId") ??
    existing?.householdId ??
    null;

  if (!householdId) {
    console.error("Subscription event has no householdId", {
      stripeSubscriptionId: subscription.id,
    });
    return;
  }

  if (!(await householdExists(admin, householdId))) return;

  const priceId =
    subscriptionPriceId(subscription) ?? existing?.stripePriceId ?? null;
  const metadataPlan = isBillingPlan(subscription.metadata?.plan)
    ? subscription.metadata.plan
    : null;
  // Prefer the price mapping so a plan change made in the Customer Portal
  // updates `plan`, then fall back to checkout metadata and the existing row.
  const plan =
    planForPriceId(priceId) ??
    metadataPlan ??
    existing?.plan ??
    "monthly";

  await saveSubscription(admin, {
    householdId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    plan,
    status:
      forcedStatus ?? normalizeSubscriptionStatus(subscription.status),
    currentPeriodEnd: subscriptionPeriodEnd(subscription),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
  });
}

async function handleCheckoutCompleted(
  admin: SupabaseClient,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const householdId =
    metadataString(session.metadata, "householdId") ??
    session.client_reference_id ??
    null;

  if (!householdId) {
    console.error("Checkout Session has no householdId", {
      checkoutSessionId: session.id,
    });
    return;
  }

  if (!(await householdExists(admin, householdId))) return;

  if (session.mode === "payment") {
    // One-time lifetime purchase. Only grant entitlement once the payment has
    // actually settled; delayed payment methods may complete as `unpaid`.
    if (
      session.payment_status !== "paid" &&
      session.payment_status !== "no_payment_required"
    ) {
      console.warn("Lifetime Checkout Session is not paid yet", {
        checkoutSessionId: session.id,
        paymentStatus: session.payment_status,
      });
      return;
    }

    await saveSubscription(admin, {
      householdId,
      // A one-off payment has no Stripe subscription; use the Checkout Session
      // ID so the row remains unique and traceable.
      stripeSubscriptionId: session.id,
      stripePriceId: Deno.env.get("STRIPE_PRICE_LIFETIME") ?? null,
      plan: "lifetime",
      status: "lifetime",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });

    return;
  }

  if (session.mode !== "subscription") {
    console.warn("Ignoring unsupported Checkout Session mode", {
      checkoutSessionId: session.id,
      mode: session.mode,
    });
    return;
  }

  // The subscription.created/updated event normally handles this, but syncing
  // here closes the window where the browser returns before the webhook does.
  if (typeof session.subscription === "string") {
    const subscription = await getStripe().subscriptions.retrieve(
      session.subscription,
    );
    await syncSubscription(admin, subscription);
    return;
  }

  if (session.subscription) {
    await syncSubscription(admin, session.subscription);
    return;
  }

  console.warn(
    "Subscription Checkout Session has no subscription; waiting for subscription.created",
    { checkoutSessionId: session.id },
  );
}

interface InvoiceSubscriptionFields {
  subscription?: string | { id: string } | null;
  parent?: {
    subscription_details?: {
      subscription?: string | { id: string } | null;
    } | null;
  } | null;
}

/**
 * `invoice.subscription` moved under `invoice.parent.subscription_details` in
 * newer Stripe API versions. Support both so a library bump cannot silently
 * break failed-payment handling.
 */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const fields = invoice as unknown as InvoiceSubscriptionFields;
  const value =
    fields.subscription ??
    fields.parent?.subscription_details?.subscription ??
    null;

  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function handleInvoicePaymentFailed(
  admin: SupabaseClient,
  invoice: Stripe.Invoice,
): Promise<void> {
  const stripeSubscriptionId = invoiceSubscriptionId(invoice);

  if (!stripeSubscriptionId) {
    console.warn("invoice.payment_failed has no subscription", {
      invoiceId: invoice.id,
    });
    return;
  }

  const { error } = await admin
    .from("Subscription")
    .update({
      status: "past_due",
      updatedAt: new Date().toISOString(),
    })
    .eq("stripeSubscriptionId", stripeSubscriptionId)
    .in("status", ["trialing", "active", "past_due", "incomplete", "paused"]);

  if (error) throw error;

  console.log("Marked subscription past_due after failed invoice", {
    stripeSubscriptionId,
    invoiceId: invoice.id,
  });
}

async function processEvent(
  admin: SupabaseClient,
  event: Stripe.Event,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(
        admin,
        event.data.object as Stripe.Checkout.Session,
      );
      return;

    case "customer.subscription.created":
    case "customer.subscription.updated":
      await syncSubscription(
        admin,
        event.data.object as Stripe.Subscription,
      );
      return;

    case "customer.subscription.deleted":
      await syncSubscription(
        admin,
        event.data.object as Stripe.Subscription,
        "canceled",
      );
      return;

    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(
        admin,
        event.data.object as Stripe.Invoice,
      );
      return;

    default:
      console.log(`Unhandled Stripe webhook event: ${event.type}`);
  }
}

async function handleWebhook(req: Request): Promise<Response> {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    throw new HttpError(
      400,
      "Missing Stripe signature.",
      "missing_stripe_signature",
    );
  }

  // Read the raw body before any parsing; signature verification depends on
  // the exact bytes Stripe signed.
  const payload = await req.text();
  const webhookSecret = requireEnv("STRIPE_WEBHOOK_SECRET");

  let event: Stripe.Event;
  try {
    event = await verifyStripeWebhook(payload, signature, webhookSecret);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error("Stripe webhook signature verification failed:", error);
    return jsonResponse({ error: "Invalid Stripe signature." }, 400);
  }

  const admin = createAdminClient();

  // Idempotency: the primary key is the Stripe event ID. A duplicate delivery
  // (or a manual resend) is acknowledged without reprocessing. `processedAt`
  // is not nullable in the schema, so record the receipt time here and refresh
  // it once processing succeeds.
  const { error: insertError } = await admin.from("StripeEvent").insert({
    id: event.id,
    type: event.type,
    processedAt: new Date().toISOString(),
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return jsonResponse({ received: true, duplicate: true });
    }

    console.error("Failed to record StripeEvent:", insertError);
    return jsonResponse({ error: "Could not record webhook event." }, 500);
  }

  try {
    await processEvent(admin, event);

    const { error: updateError } = await admin
      .from("StripeEvent")
      .update({ processedAt: new Date().toISOString() })
      .eq("id", event.id);

    if (updateError) {
      // Processing succeeded; do not ask Stripe to retry just because the
      // bookkeeping update failed.
      console.error("Failed to mark StripeEvent processed:", updateError);
    }

    return jsonResponse({ received: true });
  } catch (error) {
    console.error(
      `Failed to process Stripe event ${event.id} (${event.type}):`,
      error,
    );

    // Remove the idempotency record so Stripe's retry can process the event.
    const { error: cleanupError } = await admin
      .from("StripeEvent")
      .delete()
      .eq("id", event.id);

    if (cleanupError) {
      console.error("Failed to release StripeEvent for retry:", cleanupError);
    }

    return jsonResponse({ error: "Webhook processing failed." }, 500);
  }
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    return await handleWebhook(req);
  } catch (error) {
    return errorResponse(error);
  }
});
