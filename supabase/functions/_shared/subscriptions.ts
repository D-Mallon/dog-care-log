import type Stripe from "npm:stripe@18.5.0";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { BillingPlan, SubscriptionStatus } from "./billing.ts";

/** The subset of `Subscription` needed for webhook reconciliation. */
export interface StoredSubscription {
  id: string;
  householdId: string;
  plan: BillingPlan | null;
  stripePriceId: string | null;
}

interface SubscriptionRow {
  id: string;
  householdId: string;
  plan: BillingPlan | null;
  stripePriceId: string | null;
}

export interface SubscriptionWrite {
  householdId: string;
  stripeSubscriptionId: string;
  stripePriceId: string | null;
  plan: BillingPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

/** The subset of `Subscription` needed to detect an existing plan. */
export interface ExistingSubscription {
  plan: BillingPlan | null;
  status: SubscriptionStatus | null;
}

const NON_BLOCKING_STATUSES: readonly SubscriptionStatus[] = [
  "canceled",
  "incomplete_expired",
];

/**
 * Find a subscription that should stop the household starting another one.
 *
 * The schema has a partial unique index allowing only one `trialing`/`active`
 * row per household, and a recovering `past_due` subscription could otherwise
 * collide with a newly created plan. Checkout therefore refuses any existing
 * lifetime purchase or non-terminal subscription; changes go through the
 * Customer Portal (or cancel first, then buy a different plan).
 */
export async function findBlockingSubscription(
  admin: SupabaseClient,
  householdId: string,
): Promise<ExistingSubscription | null> {
  const { data, error } = await admin
    .from("Subscription")
    .select("plan, status")
    .eq("householdId", householdId);

  if (error) throw error;

  const rows = (data ?? []) as ExistingSubscription[];
  return (
    rows.find(
      (row) =>
        row.plan === "lifetime" ||
        row.status === null ||
        !NON_BLOCKING_STATUSES.includes(row.status),
    ) ?? null
  );
}

/** Look up a subscription by its Stripe ID (used when metadata is missing). */
export async function findSubscription(
  admin: SupabaseClient,
  stripeSubscriptionId: string,
): Promise<StoredSubscription | null> {
  const { data, error } = await admin
    .from("Subscription")
    .select("id, householdId, plan, stripePriceId")
    .eq("stripeSubscriptionId", stripeSubscriptionId)
    .maybeSingle();

  if (error) throw error;
  return (data as SubscriptionRow | null) ?? null;
}

interface SubscriptionPeriodFields {
  current_period_end?: number;
  items?: {
    data?: Array<{
      current_period_end?: number;
    }>;
  };
}

/**
 * Read the end of the current period across Stripe API versions.
 *
 * Newer Basil API versions moved `current_period_end` from the subscription
 * onto each subscription item, so prefer the subscription-level field when it
 * exists and fall back to the first item.
 */
export function subscriptionPeriodEnd(
  subscription: Stripe.Subscription,
): string | null {
  const fields = subscription as unknown as SubscriptionPeriodFields;
  const unixSeconds =
    fields.current_period_end ?? fields.items?.data?.[0]?.current_period_end;

  return typeof unixSeconds === "number"
    ? new Date(unixSeconds * 1000).toISOString()
    : null;
}

export function subscriptionPriceId(
  subscription: Stripe.Subscription,
): string | null {
  return subscription.items?.data?.[0]?.price?.id ?? null;
}

/**
 * Upsert a `Subscription` row by `stripeSubscriptionId`.
 *
 * The table's primary key is a separate UUID, so updating by primary key avoids
 * changing it. A concurrent webhook delivery can win the insert race; in that
 * case retry as an update.
 */
export async function saveSubscription(
  admin: SupabaseClient,
  values: SubscriptionWrite,
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await findSubscription(admin, values.stripeSubscriptionId);

  if (existing) {
    const { error } = await admin
      .from("Subscription")
      .update({ ...values, updatedAt: now })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await admin.from("Subscription").insert({
    id: crypto.randomUUID(),
    ...values,
    createdAt: now,
    updatedAt: now,
  });

  if (!error) return;

  // A concurrent webhook delivery can win the insert race for this Stripe
  // subscription. Only retry as an update if that exact subscription now
  // exists; other 23505 errors (for example the one-live-plan-per-household
  // index) must surface so the failure is visible rather than silently
  // dropping the event.
  if (error.code === "23505") {
    const raced = await findSubscription(admin, values.stripeSubscriptionId);
    if (raced) {
      const { error: updateError } = await admin
        .from("Subscription")
        .update({ ...values, updatedAt: now })
        .eq("id", raced.id);
      if (updateError) throw updateError;
      return;
    }
  }

  throw error;
}
