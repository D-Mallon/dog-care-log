import { supabase } from "./supabase.ts";
import type {
  BillingPlan,
  BillingRedirect,
  BillingRole,
  BillingSummary,
  Entitlement,
  SubscriptionStatus,
} from "../types/billing.ts";

const BILLING_PLANS: readonly BillingPlan[] = ["monthly", "yearly", "lifetime"];

const SUBSCRIPTION_COLUMNS =
  "plan, status, currentPeriodEnd, cancelAtPeriodEnd, updatedAt";

interface SubscriptionRow {
  plan: BillingPlan | null;
  status: SubscriptionStatus | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean | null;
  updatedAt: string | null;
}

interface MembershipRow {
  role: BillingRole | null;
  status: string | null;
}

/**
 * Error thrown by the billing client. `status` is the HTTP status returned by
 * the Edge Function when it is available (for example 403 when a non-owner
 * tries to start checkout).
 */
export class BillingError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "BillingError";
    this.status = status;
  }
}

function isBillingPlan(value: unknown): value is BillingPlan {
  return (
    typeof value === "string" &&
    (BILLING_PLANS as readonly string[]).includes(value)
  );
}

function readErrorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) return context.status;
  }
  return undefined;
}

/**
 * Supabase stores the Edge Function's JSON error body on the response
 * context. Prefer that message over the generic "non-2xx status code" text.
 */
async function readFunctionErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  if (typeof error === "object" && error !== null) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload: unknown = await context.clone().json();
        if (
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof (payload as { error?: unknown }).error === "string"
        ) {
          return (payload as { error: string }).error;
        }
      } catch {
        // Fall through to the FunctionsError message.
      }
    }

    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
}

async function invokeBillingFunction(
  name: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke(
    name,
    body ? { body } : undefined,
  );

  if (error) {
    const message = await readFunctionErrorMessage(
      error,
      "Billing request failed. Please try again.",
    );
    throw new BillingError(message, readErrorStatus(error));
  }

  return data;
}

function readRedirect(payload: unknown): BillingRedirect {
  if (typeof payload === "object" && payload !== null) {
    const url = (payload as { url?: unknown }).url;
    if (typeof url === "string" && url.length > 0) {
      return { url };
    }
  }

  throw new BillingError(
    "Billing did not return a redirect URL. Please try again.",
  );
}

function isEntitledRow(row: SubscriptionRow): boolean {
  if (row.plan === "lifetime" && row.status === "lifetime") return true;
  return row.status === "active" || row.status === "trialing";
}

function pickEntitlementRow(rows: SubscriptionRow[]): SubscriptionRow | null {
  return (
    rows.find((row) => row.plan === "lifetime" && row.status === "lifetime") ??
    rows.find((row) => row.status === "active") ??
    rows.find((row) => row.status === "trialing") ??
    rows[0] ??
    null
  );
}

function emptyEntitlement(householdId: string): Entitlement {
  return {
    householdId,
    isEntitled: false,
    plan: null,
    status: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  };
}

/**
 * Start Stripe Checkout for a household plan.
 *
 * The Edge Function resolves the caller's household, verifies that they are
 * the owner, and maps the plan to a server-side Stripe price ID. Price IDs are
 * never accepted from the client.
 *
 * Returns the hosted Checkout URL; callers should send the browser there:
 *
 * ```ts
 * const { url } = await startCheckout("yearly");
 * window.location.assign(url);
 * ```
 */
export async function startCheckout(
  plan: BillingPlan,
): Promise<BillingRedirect> {
  if (!isBillingPlan(plan)) {
    throw new BillingError("Choose a valid billing plan.");
  }

  const payload = await invokeBillingFunction("create-checkout-session", {
    plan,
  });
  return readRedirect(payload);
}

/**
 * Open the Stripe Customer Portal for the caller's household.
 *
 * The portal lets an owner update the payment method, download invoices, and
 * cancel at the end of the billing period.
 *
 * Returns the hosted portal URL; callers should send the browser there:
 *
 * ```ts
 * const { url } = await openBillingPortal();
 * window.location.assign(url);
 * ```
 */
export async function openBillingPortal(): Promise<BillingRedirect> {
  const payload = await invokeBillingFunction("create-portal-session");
  return readRedirect(payload);
}

/**
 * Read the household's current entitlement.
 *
 * This is a normal Supabase read of the billing tables. RLS allows active
 * household members to select their own `Subscription` rows and forbids all
 * client writes. It intentionally does not call Stripe, so it is cheap enough
 * to use on app load and after returning from Checkout.
 */
export async function getHouseholdEntitlement(
  householdId: string,
): Promise<Entitlement> {
  if (!householdId) {
    throw new BillingError("A household is required to load billing.");
  }

  const { data, error } = await supabase
    .from("Subscription")
    .select(SUBSCRIPTION_COLUMNS)
    .eq("householdId", householdId)
    .order("updatedAt", { ascending: false });

  if (error) {
    throw new BillingError(
      "Could not load your billing status. Please try again.",
    );
  }

  const rows = (data ?? []) as SubscriptionRow[];
  const row = pickEntitlementRow(rows);
  if (!row) return emptyEntitlement(householdId);

  return {
    householdId,
    isEntitled: isEntitledRow(row),
    plan: row.plan,
    status: row.status,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
  };
}

/**
 * Load everything the billing/paywall screen needs: entitlement, the current
 * user's role in the household, and whether they may manage billing.
 */
export async function getBillingSummary(
  householdId: string,
): Promise<BillingSummary> {
  if (!householdId) {
    throw new BillingError("A household is required to load billing.");
  }

  const [entitlement, userResult] = await Promise.all([
    getHouseholdEntitlement(householdId),
    supabase.auth.getUser(),
  ]);

  if (userResult.error || !userResult.data.user) {
    throw new BillingError("Please sign in to view billing.");
  }

  const { data, error } = await supabase
    .from("HouseholdMember")
    .select("role, status")
    .eq("householdId", householdId)
    .eq("userId", userResult.data.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new BillingError(
      "Could not load your household role. Please try again.",
    );
  }

  const membership = data as MembershipRow | null;
  const role: BillingRole | null =
    membership?.role === "owner" || membership?.role === "member"
      ? membership.role
      : null;

  return {
    householdId,
    role,
    isOwner: role === "owner",
    canManageBilling: role === "owner",
    entitlement,
  };
}
