# Stripe setup and test runbook

This document covers the Stripe billing slice of Loggi: three Supabase Edge
Functions, the browser billing client, the database rows they read and write,
and the test/live operational steps.

- **Scope:** hosted Stripe Checkout, Customer Portal, signed webhooks and
  household entitlement. Pricing/paywall UI and Stripe Tax are wired by the
  integrator; see [Known gaps](#known-gaps-and-schema-dependencies).
- **Modes:** all setup starts in **Stripe test mode**. Never run the Stripe CLI
  or these functions against a live account until the live checklist passes.
- **Secrets:** Stripe and Supabase service-role keys live only in Supabase Edge
  Function secrets. They must never appear in Vite env vars, source, or logs.

---

## 1. Architecture

```text
Browser (pricing screen)
  │  supabase.functions.invoke("create-checkout-session", { body: { plan } })
  ▼
create-checkout-session (JWT required)
  ├─ verify Supabase JWT
  ├─ verify caller is an active OWNER in "HouseholdMember" (via user JWT/RLS)
  ├─ read/create "BillingCustomer"
  ├─ map plan -> STRIPE_PRICE_* secret (never trust a client price ID)
  └─ return { url } for Stripe Checkout

Browser ──► Stripe Checkout ──► Stripe webhook
                                  │  stripe-webhook (no Supabase JWT)
                                  ├─ verify stripe-signature on the raw body
                                  ├─ insert "StripeEvent" id (idempotency)
                                  ├─ upsert "Subscription" via service role
                                  └─ return 200 quickly

Browser (billing screen)
  ├─ reads "Subscription" directly (RLS: members may read, nobody may write)
  └─ supabase.functions.invoke("create-portal-session") -> { url }
```

The browser never receives `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`SUPABASE_SERVICE_ROLE_KEY`, or a Stripe customer/price ID it can tamper with.

---

## 2. Prerequisites

- A Stripe account in **test mode**.
- Supabase CLI installed and authenticated (`supabase login`).
- The project linked to the target Supabase project:
  ```bash
  supabase link --project-ref <project-ref>
  ```
- Stripe CLI installed and logged in for local webhook forwarding
  (`stripe login`).
- Billing tables and RLS from Agent A's migrations applied. See
  [Known gaps](#known-gaps-and-schema-dependencies).
- The Edge Functions pin `stripe@18.5.0` with Stripe API version
  `2025-08-27.basil` (Basil) and `@supabase/supabase-js@2`.

---

## 3. Create products and prices (test mode)

In the Stripe Dashboard, turn **Test mode** on, then create one product with
three prices (or three products, it does not matter):

| Product | Price | Billing | Plan key |
|---|---|---|---|
| Loggi Household | €3.99 | Recurring, monthly | `monthly` |
| Loggi Household | €29.00 | Recurring, yearly | `yearly` |
| Founding lifetime | €79.00 | One-time | `lifetime` |

Steps:

1. **Product catalog → Add product**.
2. Name it `Loggi Household` (test mode).
3. Add the monthly price: €3.99 EUR, recurring monthly.
4. Add the yearly price: €29.00 EUR, recurring yearly.
5. Add a separate one-time price of €79.00 EUR to the same product for the
   founding lifetime offer, or create a separate `Founding lifetime` product.
6. Save and copy each **price ID** (`price_...`, not `prod_...`):
   - monthly price ID → `STRIPE_PRICE_MONTHLY`
   - yearly price ID → `STRIPE_PRICE_YEARLY`
   - one-time price ID → `STRIPE_PRICE_LIFETIME`

Notes:

- Prices are read from function secrets. Do not hard-code IDs in the frontend
  or in `src/lib/billing.ts`.
- If you display VAT-inclusive prices, set each price's tax behavior to
  **inclusive** in Stripe and enable Stripe Tax. See
  [Known gaps](#known-gaps-and-schema-dependencies).
- Promotion codes are enabled on Checkout; create founder/referral coupons
  under **Products → Coupons** when needed.

---

## 4. Environment and secrets

### 4.1 Supabase Edge Function secrets

Set these on the Supabase project (use test-mode values first):

```bash
supabase secrets set --project-ref <project-ref> \
  STRIPE_SECRET_KEY=sk_test_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  STRIPE_PRICE_MONTHLY=price_... \
  STRIPE_PRICE_YEARLY=price_... \
  STRIPE_PRICE_LIFETIME=price_... \
  APP_URL=http://localhost:5173
```

| Secret | Used by | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | all three functions | Test `sk_test_...`, live `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` | Endpoint signing secret; the CLI prints a **different** one |
| `STRIPE_PRICE_MONTHLY` | checkout, webhook fallback | Stripe price ID |
| `STRIPE_PRICE_YEARLY` | checkout, webhook fallback | Stripe price ID |
| `STRIPE_PRICE_LIFETIME` | checkout, webhook | Stripe one-time price ID |
| `APP_URL` | checkout, portal | Public app origin used for success/cancel/return URLs |

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` (or
`SUPABASE_PUBLISHABLE_KEY`) are injected by the Supabase Edge Function runtime.
Do not set them yourself and never expose the service-role key to the browser.

Verify:

```bash
supabase secrets list --project-ref <project-ref>
```

### 4.2 Frontend environment

In `.env` / Vercel (public values only):

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-or-publishable-key>
VITE_APP_URL=http://localhost:5173
```

`VITE_APP_URL` and the function secret `APP_URL` must point at the same app
origin. `APP_URL` should be an origin without a query string (a path such as
`https://example.com/app` is supported).

---

## 5. Run locally

1. Start the local Supabase stack:
   ```bash
   supabase start
   ```
2. Create `supabase/functions/.env.local` (ignored by the repo's `*.local`
   rule) with the function secrets from section 4.1. For local work use:
   ```text
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...      # from `stripe listen`, not the Dashboard
   STRIPE_PRICE_MONTHLY=price_...
   STRIPE_PRICE_YEARLY=price_...
   STRIPE_PRICE_LIFETIME=price_...
   APP_URL=http://localhost:5173
   ```
3. Serve the functions:
   ```bash
   supabase functions serve --env-file supabase/functions/.env.local
   ```
   The local endpoint base is
   `http://127.0.0.1:54321/functions/v1/`.
4. Start the app (`npm run dev`, normally on `http://localhost:5173`).
5. Forward webhooks with the Stripe CLI:
   ```bash
   stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
   ```
   Copy the `whsec_...` value printed by `stripe listen` into
   `supabase/functions/.env.local` and **restart** `supabase functions serve`.
   The CLI secret is different from the Dashboard endpoint secret; if the app
   starts returning 400 "Invalid Stripe signature", this is almost always why.

---

## 6. Deploy the functions

Deploy after the secrets are set:

```bash
supabase functions deploy create-checkout-session --project-ref <project-ref>
supabase functions deploy create-portal-session --project-ref <project-ref>

# Stripe cannot send a Supabase JWT. The function verifies the Stripe
# signature itself, so JWT verification must be disabled for this one.
supabase functions deploy stripe-webhook --no-verify-jwt --project-ref <project-ref>
```

`supabase/config.toml` also declares:

```toml
[functions.stripe-webhook]
verify_jwt = false
```

Keep both the config entry and the explicit `--no-verify-jwt` flag: the config
covers later deploys, while the flag makes the requirement obvious in release
commands. The two user-facing functions keep JWT verification enabled.

Useful commands:

```bash
supabase functions list --project-ref <project-ref>
supabase functions logs stripe-webhook --project-ref <project-ref>
supabase secrets unset STRIPE_WEBHOOK_SECRET --project-ref <project-ref>
```

Function URLs:

```text
https://<project-ref>.supabase.co/functions/v1/create-checkout-session
https://<project-ref>.supabase.co/functions/v1/create-portal-session
https://<project-ref>.supabase.co/functions/v1/stripe-webhook
```

---

## 7. Configure the Stripe webhook

### 7.1 Hosted endpoint

Stripe Dashboard → **Developers → Webhooks → Add endpoint** (test mode):

- **Endpoint URL:**
  `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
- **Events to send:**
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- Copy the endpoint's **Signing secret** (`whsec_...`) into
  `STRIPE_WEBHOOK_SECRET`.
- Redeploy/refresh the function environment after changing secrets.

The function handles the events above. Unrecognised events are acknowledged and
logged, so adding extra event types later is safe.

### 7.2 How the webhook is processed

1. The raw request body is read and `stripe-signature` is verified with
   `STRIPE_WEBHOOK_SECRET`. Invalid signatures return **400** and are not
   recorded.
2. The event ID is inserted into `"StripeEvent"` with its receipt time. A
   duplicate ID (`23505`) returns **200** with `{ "duplicate": true }`.
3. `"Subscription"` is upserted using the service-role client:
   - `checkout.session.completed` (subscription mode) retrieves the
     subscription and syncs it.
   - `checkout.session.completed` (payment/lifetime mode) writes
     `plan = 'lifetime'`, `status = 'lifetime'` and
     `stripeSubscriptionId = <checkout session id>` once payment is settled.
   - `customer.subscription.created` / `.updated` sync status, plan, price,
     `currentPeriodEnd` and `cancelAtPeriodEnd`.
   - `customer.subscription.deleted` forces `status = 'canceled'`.
   - `invoice.payment_failed` sets `status = 'past_due'` for the matching
     `stripeSubscriptionId`.
4. On success `processedAt` is refreshed and Stripe receives **200**. If
   processing throws, the idempotency row is deleted and Stripe receives
   **500**, allowing its retry schedule to run. (`"StripeEvent"."processedAt"`
   is `NOT NULL` in the migration; the function always supplies a timestamp.)

Household IDs from Stripe metadata are validated against a UUID pattern and the
`"Household"` table before any write. A webhook that references a missing
household is logged and acknowledged without writing data.

### 7.3 Local forwarding

```bash
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
```

To test a completed Checkout end-to-end, use the app and the test cards below;
`stripe trigger` fixtures do not contain this app's `householdId` metadata and
are ignored by the household validation.

### 7.4 Replay and idempotency

```bash
# List recent events
stripe events list --limit 10

# Resend an event; the second delivery should be acknowledged as duplicate
stripe events resend evt_...
```

Expected result: HTTP 200 with `{"received":true,"duplicate":true}` and no
duplicate `"Subscription"`/`"StripeEvent"` rows.

### 7.5 Duplicate purchases and plan changes

The migration enforces at most one `trialing`/`active` `Subscription` row per
household. `create-checkout-session` checks for an existing lifetime purchase
or any non-terminal subscription (`trialing`, `active`, `past_due`, `unpaid`,
`incomplete`, `paused`, `lifetime`) and returns **409 `already_subscribed`**
instead of creating a second plan that the webhook could not store.

To change plans, either configure plan switching in the Customer Portal (and
enable it in the portal settings) or cancel the current subscription and start
checkout once the old row is `canceled`. Test monthly, yearly and lifetime in
separate households, or reset the subscription rows between scenarios.

---

## 8. Customer Portal settings

In **test mode**, open Stripe Dashboard → **Settings → Billing → Customer
portal** and enable:

- Update payment method
- Invoice history
- Cancel subscriptions — **at end of billing period** (matches
  `cancelAtPeriodEnd` in our data)
- Business information / privacy and terms links

The Edge Function supplies `return_url` from `APP_URL`; the Dashboard return
URL is not used for session-based portal links.

Portal is owner-only in the app and the function. A member can view entitlement
but cannot open the portal.

---

## 9. Test-mode test cards

Use these in Checkout with any future expiry date, any CVC and any postal code
(where asked):

| Card number | Expected result |
|---|---|
| `4242 4242 4242 4242` | Payment succeeds; no 3DS |
| `4000 0025 0000 3155` | 3D Secure authentication required |
| `4000 0000 0000 0002` | Card declined |
| `4000 0000 0000 9995` | Declined — insufficient funds |
| `4000 0000 0000 0341` | Attaches, then fails on the first charge (useful for `invoice.payment_failed`) |

For 3DS, complete the test authentication prompt in the Checkout window.

---

## 10. Test-mode acceptance scenarios

Run these against the local stack or a test deployment. Check both the UI and
the database (`"Subscription"`, `"BillingCustomer"`, `"StripeEvent"`).

### 10.1 Monthly with trial (owner)

1. Sign in as the household **owner**.
2. Start monthly checkout from the pricing UI.
3. Confirm Checkout shows the plan, promo-code field and the 14-day trial.
4. Pay with `4242 4242 4242 4242`.
5. Expect `"Subscription"`: `plan = 'monthly'`, `status = 'trialing'`,
   `currentPeriodEnd` about 14 days ahead, `cancelAtPeriodEnd = false`,
   `stripeSubscriptionId = sub_...`.
6. `"BillingCustomer"` has one row for the owner with `stripeCustomerId =
   cus_...`; `"StripeEvent"` has rows with `processedAt` set.
7. Browser returns to `APP_URL/?checkout=success&session_id=cs_...`; the
   entitlement query returns `isEntitled: true`.

### 10.2 Yearly

Same as monthly with `plan = 'yearly'`; `currentPeriodEnd` about one year ahead.

### 10.3 Founding lifetime

1. Choose lifetime; pay with `4242 4242 4242 4242`.
2. Expect `"Subscription"`: `plan = 'lifetime'`, `status = 'lifetime'`,
   `stripeSubscriptionId = cs_...` (the Checkout Session ID),
   `currentPeriodEnd = null`, `cancelAtPeriodEnd = false`.
3. Replay the `checkout.session.completed` event; the row must not duplicate.

### 10.4 Billing portal (owner)

1. From the billing screen, open the portal.
2. Update the payment method and confirm Stripe shows the change.
3. Download an invoice.
4. Cancel at period end; expect `customer.subscription.updated` to set
   `cancelAtPeriodEnd = true` while `status` stays `active`/`trialing` and
   entitlement remains true.
5. In test mode, a subscription deleted at period end produces
   `customer.subscription.deleted`; expect `status = 'canceled'` and
   entitlement false.

### 10.5 3DS / declined payment

- `4000 0025 0000 3155`: complete the 3DS challenge; checkout succeeds.
- `4000 0000 0000 0002`: checkout fails with a decline; no paid subscription
  row is granted (an `incomplete` subscription may exist and is not entitled).

### 10.6 Failed renewal / `invoice.payment_failed`

Use a test clock or CLI to move a subscription to renewal with a failing card:

1. Attach `4000 0000 0000 0341` as the default payment method for a test
   subscription.
2. End the trial immediately or advance the test clock to the renewal date
   (Dashboard → Developers → Test clocks).
3. Expect the `invoice.payment_failed` handler to set the matching
   `"Subscription".status = 'past_due'`; entitlement becomes false.
4. Pay the invoice from the Dashboard and confirm
   `customer.subscription.updated` restores `active`.

`stripe trigger invoice.payment_failed` only creates a synthetic fixture; it
will verify signature handling and logging, but it will not match a real
subscription row unless you substitute an existing `sub_...` ID.

### 10.7 Authorization matrix

| Caller | Start checkout | Open portal | Read entitlement |
|---|---|---|---|
| Active household owner | 200 `{url}` | 200 `{url}` | yes |
| Active household member | 403 `owner_required` | 403 `owner_required` | yes |
| User with no household | 403 `owner_required` | 403 `owner_required` | empty/false |
| No/invalid JWT | 401 `unauthorized` | 401 `unauthorized` | RLS denies |
| Owner, no Stripe customer yet | 200 (customer created) | 400 `billing_customer_missing` | yes |
| Owner already has a non-terminal plan | 409 `already_subscribed` | 200 `{url}` | yes |

Verify the member case with a second browser profile, not by editing the UI.

### 10.8 Negative and robustness checks

- **Invalid webhook signature:** send a request with a fake
  `stripe-signature`; expect 400 and no `"StripeEvent"` row.
- **Missing webhook secret:** expect 500 configuration error, not a crash.
- **Missing price secret:** checkout returns 500 `price_not_configured`; no
  Stripe customer is created.
- **Duplicate delivery:** resend the same event; expect duplicate 200 and no
  second subscription row.
- **Unknown event type:** add a harmless event to the endpoint; expect 200 and
  an "Unhandled" log line.
- **Household not found:** use Checkout metadata for a deleted household
  (test fixture) and confirm the handler logs and does not write.
- **Failed processing:** temporarily point `SUPABASE_SERVICE_ROLE_KEY` at an
  invalid value (local only) and confirm the webhook returns 500 and the event
  is retried.

---

## 11. Frontend integration points

Imports:

```ts
import {
  BillingError,
  getBillingSummary,
  getHouseholdEntitlement,
  openBillingPortal,
  startCheckout,
} from "./lib/billing.ts";
import type {
  BillingPlan,
  BillingSummary,
  Entitlement,
} from "./types/billing.ts";
```

| Function | Signature | Returns |
|---|---|---|
| `startCheckout` | `(plan: BillingPlan) => Promise<BillingRedirect>` | `{ url }` — assign to `window.location` |
| `openBillingPortal` | `() => Promise<BillingRedirect>` | `{ url }` — assign to `window.location` |
| `getHouseholdEntitlement` | `(householdId: string) => Promise<Entitlement>` | `{ householdId, isEntitled, plan, status, currentPeriodEnd, cancelAtPeriodEnd }` |
| `getBillingSummary` | `(householdId: string) => Promise<BillingSummary>` | `{ householdId, role, isOwner, canManageBilling, entitlement }` |

`BillingRedirect` is `{ url: string }`. Errors throw `BillingError` with a
user-safe `message` and, when the Edge Function returned a non-2xx response, a
numeric `status` (for example `403` for non-owners).

Typical wiring (the pricing screen itself is owned by the integrator):

```ts
async function onChoosePlan(plan: BillingPlan) {
  try {
    const { url } = await startCheckout(plan);
    window.location.assign(url);
  } catch (error) {
    if (error instanceof BillingError) {
      setBillingError(error.message);
    }
  }
}

async function onManageBilling() {
  const { url } = await openBillingPortal();
  window.location.assign(url);
}

// On app load / return from Checkout:
const summary = await getBillingSummary(household.id);
const { isEntitled, plan, status, currentPeriodEnd, cancelAtPeriodEnd } =
  summary.entitlement;
```

Checkout return URLs are:

```text
<APP_URL>/?checkout=success&session_id={CHECKOUT_SESSION_ID}
<APP_URL>/?checkout=cancelled
```

The app is currently a single-page app without a router, so read these with
`new URLSearchParams(window.location.search)` and remove them from the URL when
done. Refresh entitlement after returning from Checkout and on window focus;
do not poll Stripe from the client.

Members can see the plan and entitlement; hide/disable “Choose plan” and
“Manage billing” unless `summary.canManageBilling` is true.

---

## 12. Known gaps and schema dependencies

### 12.1 Schema status and dependencies

The billing migration is
`supabase/migrations/20261108000200_billing_schema.sql`. It matches the shared
contract in `plan.md` for `"BillingCustomer"`, `"Subscription"` and
`"StripeEvent"`, and it grants active household members read-only access to
`"Subscription"`. The legacy `supabase/migration.sql` still contains only the
core tables; the versioned `supabase/migrations/` directory is the source of
truth.

Schema-level details that the functions account for:

- `"StripeEvent"."processedAt"` is `NOT NULL DEFAULT now()`. The webhook inserts
  the receipt timestamp immediately and refreshes it after successful
  processing; on failure it deletes the row so Stripe's retry can run.
- The partial unique index `Subscription_one_live_per_household_idx` allows at
  most one `trialing`/`active` row per household. `create-checkout-session`
  rejects any second non-terminal plan with **409 `already_subscribed`** (see
  7.5) instead of letting the webhook hit the constraint.
- `"Subscription"."id"` has a `gen_random_uuid()` default; the webhook also
  generates an ID explicitly, which is compatible.
- `"Subscription"."updatedAt"` has a trigger; the webhook also writes it, which
  is harmless.
- `"Subscription"."stripeSubscriptionId"` is UNIQUE, which the upsert race path
  relies on.

RLS required by the client (provided by the migration):

- `"Subscription"`: active household members may `SELECT` their household's
  rows. No client `INSERT`/`UPDATE`/`DELETE`.
- `"BillingCustomer"` and `"StripeEvent"`: no client access; service role only.
- `"HouseholdMember"`: active members can read membership rows (used by the
  ownership check and `getBillingSummary`).
- `"Household"`: active members can read their household.

The client reads `"Subscription"` directly; it does not call an Edge Function
for entitlement. This keeps the pricing screen fast and matches the plan's
"members read entitlement, no client writes" rule.

### 12.2 Stripe Tax / VAT

The Checkout code does **not** enable Stripe Tax or set `automatic_tax`; prices
are whatever is configured in Stripe. Before advertising VAT-inclusive EU
pricing, the integrator must:

1. Set tax behavior to inclusive on the Stripe prices.
2. Register tax obligations in Stripe.
3. Add `automatic_tax: { enabled: true }` (and, for existing customers,
   `customer_update: { address: "auto" }`) to both Checkout Session branches in
   `create-checkout-session/index.ts`.
4. Re-run the test scenarios.

### 12.3 Trial length and pricing

- Trial is 14 days, set by `TRIAL_PERIOD_DAYS` in
  `create-checkout-session/index.ts`.
- Prices are whatever the price IDs point at; the plan price table in `plan.md`
  is €3.99/month, €29/year, €79 lifetime.
- Lifetime availability is not enforced in code. The "first 50 households"
  limit must be handled operationally or with a future coupon/price change.

### 12.4 Other follow-ups

- No `invoice.paid` reconciliation job. Entitlement is webhook-driven; use the
  Stripe Dashboard or a periodic reconciliation script if webhooks are missed.
- No automatic cleanup of old `"StripeEvent"` rows. Consider a retention job
  after launch.
- No email receipts beyond Stripe's own settings.

---

## 13. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| 401 `unauthorized` on checkout/portal | No `Authorization: Bearer <jwt>` header, expired session, or function invoked without the Supabase client. Sign in again. |
| 403 `owner_required` | Caller is not an active `role = 'owner'` row in `"HouseholdMember"`, or the invitation was never accepted (`status != 'active'`). |
| 400 `billing_customer_missing` | Owner has never completed checkout, so there is no Stripe customer to open in the portal. Start a plan first. |
| 409 `already_subscribed` | The household already has a lifetime purchase or a non-terminal subscription. Use the portal to change/cancel, or test in a fresh household. |
| 500 `price_not_configured` | Missing `STRIPE_PRICE_*` secret or a test/live price ID mismatch. `supabase secrets list`. |
| 500 `server_configuration_error` | Missing `STRIPE_SECRET_KEY`, `APP_URL`, or Supabase runtime vars. Check function logs. |
| 400 invalid Stripe signature | Wrong `STRIPE_WEBHOOK_SECRET` (CLI vs Dashboard), body modified by a proxy, or the function was called with JSON instead of the raw body. The function reads raw text itself; do not add a body parser. |
| Webhook 401 before signature | `stripe-webhook` was deployed with JWT verification enabled. Redeploy with `--no-verify-jwt` and check `config.toml`. |
| Webhook 500 and Stripe retries | Check `supabase functions logs stripe-webhook`. Common causes: missing billing tables, RLS/role problem, or missing service-role env. |
| Checkout succeeds but no entitlement | Check webhook deliveries in Stripe, `"StripeEvent"` rows, and whether `"Subscription"."householdId"` matches. Check the client is reading as an active member (RLS). |
| Portal shows the wrong plan/member | The portal is per Stripe customer (`BillingCustomer.userId`), not per household. The owner must be the one opening it; one owner per household in Release 1. |
| Duplicate Stripe customers | A race hit the `BillingCustomer` unique key; the function reuses the winner and deletes the loser best-effort. Inspect Stripe for orphans if needed. |
| "No such price" from Stripe | Price ID belongs to the other mode (test vs live) or another Stripe account. |
| CORS error in the browser | Confirm the deployed function includes the shared CORS headers and that the request is invoked through `supabase.functions.invoke` (which sends the auth headers). |

Local logs:

```bash
supabase functions logs create-checkout-session
supabase functions logs create-portal-session
supabase functions logs stripe-webhook
```

---

## 14. Live-mode checklist

Do not switch to live keys until the test-mode acceptance scenarios pass.

### Stripe account

- [ ] Activate the Stripe account: business details, bank account, beneficial
      owners, branding, support email.
- [ ] Set up tax registrations and decide on Stripe Tax (see 12.2).
- [ ] Configure live Customer Portal settings and cancellation behavior.
- [ ] Confirm email receipts/invoices are enabled and branded.
- [ ] Review the refund policy and support process.

### Products and prices (live mode)

- [ ] Recreate the three prices in **live mode** (test-mode IDs do not work).
- [ ] Capture the live `price_...` IDs.
- [ ] Set tax behavior consistently (inclusive for EU consumer pricing).

### Secrets and deploy

- [ ] Set `STRIPE_SECRET_KEY=sk_live_...` in Supabase secrets.
- [ ] Set the three live `STRIPE_PRICE_*` IDs.
- [ ] Set `STRIPE_WEBHOOK_SECRET=whsec_...` from the **live** endpoint.
- [ ] Set `APP_URL` to the production URL.
- [ ] Redeploy all three functions; webhook with `--no-verify-jwt`.
- [ ] Confirm no secret is present in Vercel/Vite env or the client bundle.

### Webhook (live)

- [ ] Add the production webhook endpoint in live mode with the five events.
- [ ] Send a live test event; confirm 200 and a `"StripeEvent"` row.
- [ ] Confirm a bad signature returns 400.
- [ ] Configure webhook failure alerts and monitor the endpoint.

### End-to-end

- [ ] Real low-value purchase (monthly or lifetime) with a real card; confirm
      entitlement and the Stripe charge.
- [ ] Refund the purchase from Stripe; confirm entitlement behavior is
      understood (a refund does not automatically cancel a subscription).
- [ ] Customer Portal: update card, download invoice, cancel.
- [ ] 3DS/SCA challenge on a real card.
- [ ] Declined card path.
- [ ] Member account cannot start checkout or open the portal.
- [ ] Replay a live event; confirm idempotency.
- [ ] Remove test data and test secrets from production.

### Operations

- [ ] Back up the database before enabling live billing.
- [ ] Document who can issue refunds and how to cancel a subscription.
- [ ] Check `"StripeEvent"` growth and plan retention.
- [ ] Add a reconciliation runbook: compare Stripe active subscriptions with
      `"Subscription"` rows after the first live week.
