import { requireHouseholdOwner } from "../_shared/auth.ts";
import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { findBillingCustomerId } from "../_shared/customers.ts";
import { getAppUrl } from "../_shared/env.ts";
import { errorResponse, HttpError } from "../_shared/errors.ts";
import { getStripe } from "../_shared/stripe.ts";
import { createAdminClient } from "../_shared/supabase.ts";

async function handlePortal(req: Request): Promise<Response> {
  const { user } = await requireHouseholdOwner(req);
  const admin = createAdminClient();

  const customerId = await findBillingCustomerId(admin, user.id);
  if (!customerId) {
    throw new HttpError(
      400,
      "No billing account found yet. Choose a plan before opening the billing portal.",
      "billing_customer_missing",
    );
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: getAppUrl(),
    });

    if (!session.url) {
      console.error("Stripe returned a billing portal session without URL", {
        sessionId: session.id,
      });
      throw new HttpError(
        502,
        "Stripe did not return a billing portal URL. Please try again.",
        "stripe_portal_failed",
      );
    }

    return jsonResponse({ url: session.url });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error("Failed to create Stripe billing portal session:", error);
    throw new HttpError(
      502,
      "Could not open the billing portal. Please try again.",
      "stripe_portal_failed",
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
    return await handlePortal(req);
  } catch (error) {
    return errorResponse(error);
  }
});
