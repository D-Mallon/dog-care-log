import type { SupabaseClient, User } from "npm:@supabase/supabase-js@2";
import { HttpError } from "./errors.ts";
import { getStripe } from "./stripe.ts";

interface BillingCustomerRow {
  stripeCustomerId: string;
}

/** Read the Stripe customer mapped to a user. */
export async function findBillingCustomerId(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("BillingCustomer")
    .select("stripeCustomerId")
    .eq("userId", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load BillingCustomer:", error);
    throw new HttpError(
      500,
      "Could not load your billing profile. Please try again.",
      "billing_customer_lookup_failed",
    );
  }

  const row = data as BillingCustomerRow | null;
  return row?.stripeCustomerId ?? null;
}

/**
 * Reuse the user's Stripe customer or create one.
 *
 * `user` comes from a verified Supabase JWT, so the email and user ID are
 * trustworthy. The household ID is also recorded in Stripe metadata for
 * support and reconciliation.
 */
export async function getOrCreateBillingCustomer(
  admin: SupabaseClient,
  user: User,
  householdId: string,
): Promise<string> {
  const existingCustomerId = await findBillingCustomerId(admin, user.id);
  if (existingCustomerId) return existingCustomerId;

  let customerId: string;
  try {
    const customer = await getStripe().customers.create({
      email: user.email ?? undefined,
      metadata: {
        userId: user.id,
        householdId,
      },
    });
    customerId = customer.id;
  } catch (error) {
    console.error("Failed to create Stripe customer:", error);
    throw new HttpError(
      502,
      "Could not prepare billing. Please try again.",
      "stripe_customer_failed",
    );
  }

  const { error: insertError } = await admin.from("BillingCustomer").insert({
    userId: user.id,
    stripeCustomerId: customerId,
    email: user.email ?? null,
  });

  if (!insertError) return customerId;

  // Another request may have created the mapping first. Reuse it and clean up
  // the duplicate Stripe customer we just made, best-effort.
  if (insertError.code === "23505") {
    const racedCustomerId = await findBillingCustomerId(admin, user.id);
    if (racedCustomerId) {
      try {
        await getStripe().customers.del(customerId);
      } catch (cleanupError) {
        console.warn(
          "Could not remove duplicate Stripe customer:",
          cleanupError,
        );
      }
      return racedCustomerId;
    }
  }

  console.error("Failed to save BillingCustomer:", insertError);
  try {
    await getStripe().customers.del(customerId);
  } catch (cleanupError) {
    console.warn("Could not roll back Stripe customer:", cleanupError);
  }

  throw new HttpError(
    500,
    "Could not save your billing profile. Please try again.",
    "billing_customer_save_failed",
  );
}
