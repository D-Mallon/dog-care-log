import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { errorResponse, HttpError } from "../_shared/errors.ts";
import { getStripe } from "../_shared/stripe.ts";
import {
  createAdminClient,
  requireUser,
} from "../_shared/supabase.ts";

const OPEN_SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
];

interface MembershipRow {
  householdId: string;
  role: "owner" | "member";
  status: string;
}

interface SubscriptionRow {
  stripeSubscriptionId: string | null;
  status: string;
  plan: string;
}

interface BillingCustomerRow {
  stripeCustomerId: string;
}

async function countOtherActiveMembers(
  admin: ReturnType<typeof createAdminClient>,
  householdId: string,
  userId: string,
): Promise<number> {
  const { count, error } = await admin
    .from("HouseholdMember")
    .select("userId", { count: "exact", head: true })
    .eq("householdId", householdId)
    .eq("status", "active")
    .neq("userId", userId);

  if (error) {
    console.error("Failed to count household members:", error);
    throw new HttpError(
      500,
      "Could not check your household members. Please try again.",
      "membership_count_failed",
    );
  }

  return count ?? 0;
}

async function cancelOpenSubscriptions(
  admin: ReturnType<typeof createAdminClient>,
  householdId: string,
): Promise<void> {
  const { data, error } = await admin
    .from("Subscription")
    .select("stripeSubscriptionId,status,plan")
    .eq("householdId", householdId)
    .in("status", OPEN_SUBSCRIPTION_STATUSES);

  if (error) {
    console.error("Failed to load household subscriptions:", error);
    throw new HttpError(
      500,
      "Could not check your subscription. Please try again.",
      "subscription_lookup_failed",
    );
  }

  for (const row of (data ?? []) as SubscriptionRow[]) {
    if (!row.stripeSubscriptionId) continue;

    try {
      await getStripe().subscriptions.cancel(row.stripeSubscriptionId);
    } catch (stripeError) {
      const code = (stripeError as { code?: string } | null)?.code;
      if (code === "resource_missing") continue;

      console.error("Failed to cancel subscription before deletion:", stripeError);
      throw new HttpError(
        502,
        "We couldn't cancel your subscription. Please try again; you have not been charged twice.",
        "subscription_cancel_failed",
      );
    }
  }
}

async function deleteHouseholdImages(
  admin: ReturnType<typeof createAdminClient>,
  householdId: string,
): Promise<void> {
  // The app stores images at <householdId>/<uuid>; list and remove in batches.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await admin.storage
      .from("dog-images")
      .list(householdId, { limit: 100 });

    if (error) {
      console.warn("Could not list dog images for deletion:", error);
      return;
    }
    if (!data || data.length === 0) return;

    const paths = data.map((object) => `${householdId}/${object.name}`);
    const { error: removeError } = await admin.storage
      .from("dog-images")
      .remove(paths);

    if (removeError) {
      console.warn("Could not remove dog images:", removeError);
      return;
    }
    if (data.length < 100) return;
  }
}

async function deleteUserAvatar(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<void> {
  const { data, error } = await admin.storage
    .from("avatars")
    .list(userId, { limit: 20 });

  if (error) {
    console.warn("Could not list avatar for deletion:", error);
    return;
  }
  if (!data || data.length === 0) return;

  const { error: removeError } = await admin.storage
    .from("avatars")
    .remove(data.map((object) => `${userId}/${object.name}`));
  if (removeError) {
    console.warn("Could not remove avatar:", removeError);
  }
}

async function handleDeleteAccount(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    throw new HttpError(405, "Method not allowed.", "method_not_allowed");
  }

  const { user } = await requireUser(req);
  const admin = createAdminClient();

  const { data: membershipData, error: membershipError } = await admin
    .from("HouseholdMember")
    .select("householdId,role,status")
    .eq("userId", user.id)
    .eq("status", "active");

  if (membershipError) {
    console.error("Failed to load memberships for deletion:", membershipError);
    throw new HttpError(
      500,
      "Could not load your household. Please try again.",
      "membership_lookup_failed",
    );
  }

  const memberships = (membershipData ?? []) as MembershipRow[];
  const ownedHousehold = memberships.find((row) => row.role === "owner");

  if (ownedHousehold) {
    const otherMembers = await countOtherActiveMembers(
      admin,
      ownedHousehold.householdId,
      user.id,
    );

    if (otherMembers > 0) {
      throw new HttpError(
        409,
        "Remove the other household members or transfer ownership before deleting your account.",
        "household_not_empty",
      );
    }

    await cancelOpenSubscriptions(admin, ownedHousehold.householdId);
    await deleteHouseholdImages(admin, ownedHousehold.householdId);

    // Dogs, events, weights, memberships and subscriptions cascade from here.
    const { error: deleteHouseholdError } = await admin
      .from("Household")
      .delete()
      .eq("id", ownedHousehold.householdId);

    if (deleteHouseholdError) {
      console.error("Failed to delete household:", deleteHouseholdError);
      throw new HttpError(
        500,
        "Could not delete your household data. Please try again.",
        "household_delete_failed",
      );
    }
  }

  // Remove memberships (including pending rows). If an owner household was
  // deleted above, these rows are already gone via cascade.
  const { error: membershipDeleteError } = await admin
    .from("HouseholdMember")
    .delete()
    .eq("userId", user.id);

  if (membershipDeleteError) {
    console.error("Failed to delete memberships:", membershipDeleteError);
    throw new HttpError(
      500,
      "Could not remove your household membership. Please try again.",
      "membership_delete_failed",
    );
  }

  const { data: billingData } = await admin
    .from("BillingCustomer")
    .select("stripeCustomerId")
    .eq("userId", user.id)
    .maybeSingle();

  const billingCustomer = billingData as BillingCustomerRow | null;
  if (billingCustomer?.stripeCustomerId) {
    try {
      await getStripe().customers.del(billingCustomer.stripeCustomerId);
    } catch (stripeError) {
      // The subscription (if any) is already cancelled; a lingering customer
      // record is not a reason to block erasure.
      console.warn("Could not delete Stripe customer:", stripeError);
    }
  }

  const { error: billingDeleteError } = await admin
    .from("BillingCustomer")
    .delete()
    .eq("userId", user.id);

  if (billingDeleteError) {
    console.warn("Could not delete BillingCustomer row:", billingDeleteError);
  }

  await deleteUserAvatar(admin, user.id);

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(user.id);
  if (authDeleteError) {
    console.error("Failed to delete auth user:", authDeleteError);
    throw new HttpError(
      500,
      "Could not delete your login. Please contact support if this continues.",
      "auth_delete_failed",
    );
  }

  return jsonResponse({ deleted: true });
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    return await handleDeleteAccount(req);
  } catch (error) {
    return errorResponse(error);
  }
});
