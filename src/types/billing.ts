/**
 * Billing domain types.
 *
 * These mirror the billing contract in `plan.md` and the Edge Functions in
 * `supabase/functions/`. Keep the plan/status unions in sync with
 * `supabase/functions/_shared/billing.ts`.
 */

/** Plans that can be purchased from the pricing screen. */
export type BillingPlan = "monthly" | "yearly" | "lifetime";

/**
 * Mirrors Stripe subscription statuses plus the synthetic `lifetime` status
 * used for one-off founding-member purchases.
 */
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

/** The current user's role in a household. */
export type BillingRole = "owner" | "member";

/**
 * A household's current access to paid features.
 *
 * A household is entitled when it has a lifetime purchase or a subscription
 * whose status is `trialing` or `active`. One plan covers every household
 * member.
 */
export interface Entitlement {
  householdId: string;
  isEntitled: boolean;
  plan: BillingPlan | null;
  status: SubscriptionStatus | null;
  /** ISO-8601 timestamp for the end of the current billing period, if any. */
  currentPeriodEnd: string | null;
  /** True when a cancellation is scheduled for the end of the period. */
  cancelAtPeriodEnd: boolean;
}

/**
 * Entitlement plus the information the UI needs to decide whether to show
 * billing-management actions. Only household owners can start checkout or
 * open the Stripe Customer Portal.
 */
export interface BillingSummary {
  householdId: string;
  role: BillingRole | null;
  isOwner: boolean;
  canManageBilling: boolean;
  entitlement: Entitlement;
}

/** Response from `create-checkout-session` and `create-portal-session`. */
export interface BillingRedirect {
  url: string;
}

export type CheckoutSessionResponse = BillingRedirect;
export type PortalSessionResponse = BillingRedirect;
