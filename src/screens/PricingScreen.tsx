import type { BillingPlan } from "../types/billing.ts";

export type PricingPlan = BillingPlan;

type PricingScreenProps = {
  currentPlan: PricingPlan | null;
  isEntitled: boolean;
  isOwner: boolean;
  isLoading?: boolean;
  error?: string | null;
  onSelectPlan: (plan: PricingPlan) => void;
  onManageBilling: () => void;
  onRetry: () => void;
  onBack: () => void;
};

type PlanCard = {
  id: PricingPlan;
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  badge?: string;
};

const PLANS: PlanCard[] = [
  {
    id: "monthly",
    name: "Household",
    price: "€3.99",
    cadence: "per month",
    blurb: "Cancel anytime. 14-day free trial.",
    features: [
      "Unlimited dogs",
      "Unlimited household members",
      "Full care history",
      "Potty insights",
      "Vet-ready CSV export",
    ],
  },
  {
    id: "yearly",
    name: "Household yearly",
    price: "€29",
    cadence: "per year",
    blurb: "Save over 35% versus monthly.",
    badge: "Best value",
    features: [
      "Everything in monthly",
      "Two months free",
      "Priority support",
      "Founding-member pricing locked in",
    ],
  },
  {
    id: "lifetime",
    name: "Founding member",
    price: "€79",
    cadence: "one-time",
    blurb: "Limited to the first 50 households.",
    badge: "First 50",
    features: [
      "Lifetime access",
      "Concierge onboarding",
      "Direct line to the founder",
      "All future household features",
    ],
  },
];

export default function PricingScreen({
  currentPlan,
  isEntitled,
  isOwner,
  isLoading = false,
  error,
  onSelectPlan,
  onManageBilling,
  onRetry,
  onBack,
}: PricingScreenProps) {
  return (
    <div className="pt-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-warm-brown mb-6 hover:opacity-70 transition-opacity"
      >
        ← Back
      </button>

      <div className="mb-8">
        <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-1">
          one plan for the whole pack
        </p>
        <h1 className="text-4xl font-bold font-fraunces text-warm-brown">
          Keep Loggi running
        </h1>
        <p className="text-sm text-text-muted mt-3 leading-relaxed">
          Free includes one dog and core logging. Premium unlocks unlimited
          dogs and supports the project. Every plan covers your whole household
          — no ads, no selling your data, cancel any time.
        </p>
      </div>

      {isEntitled && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">
            Your household is on {currentPlan ?? "a paid"} plan. Thank you.
          </p>
          {isOwner && (
            <button
              type="button"
              onClick={onManageBilling}
              disabled={isLoading}
              className="mt-3 w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
            >
              Manage billing and invoices
            </button>
          )}
          {!isOwner && (
            <p className="mt-2 text-xs text-emerald-800">
              Only the household owner can manage billing.
            </p>
          )}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 text-xs font-semibold underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      )}

      {!isOwner && !isEntitled && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Ask the household owner to start a plan. One subscription covers
          everyone in the pack.
        </div>
      )}

      <div className="flex flex-col gap-4">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id && isEntitled;
          const disabled = isLoading || !isOwner || isEntitled;

          return (
            <section
              key={plan.id}
              className={`rounded-3xl border p-5 ${
                plan.id === "yearly"
                  ? "border-warm-brown/40 bg-white shadow-sm"
                  : "border-warm-brown/15 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold font-fraunces text-warm-brown">
                      {plan.name}
                    </h2>
                    {plan.badge && (
                      <span className="rounded-full bg-light-tan px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-warm-brown">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-1">{plan.blurb}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-warm-brown">
                    {plan.price}
                  </p>
                  <p className="text-[11px] text-text-muted">{plan.cadence}</p>
                </div>
              </div>

              <ul className="mb-4 space-y-1.5">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm text-text-dark"
                  >
                    <span aria-hidden="true" className="text-emerald-600">
                      ✓
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => onSelectPlan(plan.id)}
                disabled={disabled}
                className={`w-full rounded-xl py-3 text-sm font-semibold transition-colors ${
                  isCurrent
                    ? "bg-emerald-50 text-emerald-800 cursor-default"
                    : "bg-warm-brown text-white hover:opacity-90 disabled:opacity-40"
                }`}
              >
                {isCurrent
                  ? "Current plan"
                  : isEntitled
                    ? "Change plan in billing portal"
                    : isLoading
                      ? "Opening checkout…"
                      : plan.id === "lifetime"
                        ? "Become a founding member"
                        : "Start 14-day free trial"}
              </button>
            </section>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-text-muted leading-relaxed">
        Prices include VAT where applicable. Payments are handled by Stripe.
        Annual plans renew automatically until cancelled.
      </p>
    </div>
  );
}
