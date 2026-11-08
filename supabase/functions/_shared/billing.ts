/**
 * Billing vocabulary shared by the Edge Functions.
 *
 * Keep these unions in sync with `src/types/billing.ts` and the schema
 * contract in `plan.md`.
 */

export type BillingPlan = "monthly" | "yearly" | "lifetime";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused"
  | "lifetime";

const BILLING_PLANS: readonly BillingPlan[] = ["monthly", "yearly", "lifetime"];

const SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
  "lifetime",
];

export function isBillingPlan(value: unknown): value is BillingPlan {
  return (
    typeof value === "string" &&
    (BILLING_PLANS as readonly string[]).includes(value)
  );
}

/**
 * Map a Stripe subscription status to our stored status.
 *
 * Stripe's statuses are a subset of ours, so this is mostly a type guard. An
 * unknown value is treated as `incomplete`, which never grants entitlement.
 */
export function normalizeSubscriptionStatus(
  value: unknown,
): SubscriptionStatus {
  return typeof value === "string" &&
    (SUBSCRIPTION_STATUSES as readonly string[]).includes(value)
    ? (value as SubscriptionStatus)
    : "incomplete";
}

/**
 * A household is entitled when it has a lifetime purchase or an active/trial
 * subscription. Mirrors the client-side rule in `src/lib/billing.ts`.
 */
export function isEntitledSubscription(
  plan: BillingPlan | null,
  status: SubscriptionStatus | null,
): boolean {
  if (plan === "lifetime" && status === "lifetime") return true;
  return status === "active" || status === "trialing";
}
