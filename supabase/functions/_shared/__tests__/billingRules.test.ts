import { describe, expect, it } from "vitest";
import {
  isBillingPlan,
  isEntitledSubscription,
  normalizeSubscriptionStatus,
} from "../billing.ts";
import {
  subscriptionPeriodEnd,
  subscriptionPriceId,
} from "../subscriptions.ts";

describe("shared billing rules", () => {
  it("accepts only supported plans", () => {
    expect(isBillingPlan("monthly")).toBe(true);
    expect(isBillingPlan("yearly")).toBe(true);
    expect(isBillingPlan("lifetime")).toBe(true);
    expect(isBillingPlan("free")).toBe(false);
    expect(isBillingPlan(null)).toBe(false);
  });

  it("normalizes unknown Stripe statuses to incomplete", () => {
    expect(normalizeSubscriptionStatus("active")).toBe("active");
    expect(normalizeSubscriptionStatus("trialing")).toBe("trialing");
    expect(normalizeSubscriptionStatus("lifetime")).toBe("lifetime");
    expect(normalizeSubscriptionStatus("something_new")).toBe("incomplete");
    expect(normalizeSubscriptionStatus(undefined)).toBe("incomplete");
  });

  it("grants entitlement only for active/trial/lifetime", () => {
    expect(isEntitledSubscription("monthly", "active")).toBe(true);
    expect(isEntitledSubscription("yearly", "trialing")).toBe(true);
    expect(isEntitledSubscription("lifetime", "lifetime")).toBe(true);
    expect(isEntitledSubscription("monthly", "past_due")).toBe(false);
    expect(isEntitledSubscription("yearly", "canceled")).toBe(false);
    expect(isEntitledSubscription("monthly", "lifetime")).toBe(false);
  });

  it("reads current period end from the subscription or first item", () => {
    expect(
      subscriptionPeriodEnd({
        current_period_end: 1_800_000_000,
      } as never),
    ).toBe(new Date(1_800_000_000_000).toISOString());

    expect(
      subscriptionPeriodEnd({
        items: { data: [{ current_period_end: 1_800_000_000 }] },
      } as never),
    ).toBe(new Date(1_800_000_000_000).toISOString());

    expect(subscriptionPeriodEnd({} as never)).toBeNull();
  });

  it("reads the first subscription item price", () => {
    expect(
      subscriptionPriceId({
        items: { data: [{ price: { id: "price_123" } }] },
      } as never),
    ).toBe("price_123");
    expect(subscriptionPriceId({ items: { data: [] } } as never)).toBeNull();
  });
});
