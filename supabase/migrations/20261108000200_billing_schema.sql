-- ============================================================================
-- Loggi billing schema
-- ----------------------------------------------------------------------------
-- Tables and policies for Stripe billing. This file is the database half of the
-- shared billing contract in plan.md; Agent B's Edge Functions write these
-- tables with the service role.
--
-- Security model:
--   * BillingCustomer, Subscription and StripeEvent are read/written by Edge
--     Functions using the service role (which bypasses RLS).
--   * Authenticated clients may SELECT only their own household's Subscription
--     so the app can show entitlement/paywall state.
--   * Clients have no INSERT/UPDATE/DELETE policies or grants on any billing
--     table, so browser code cannot forge a subscription.
--   * household_is_entitled() is the single place that defines "paid".
-- ============================================================================

-- ============================================================================
-- Tables
-- ============================================================================

-- Maps a Supabase user to a Stripe Customer. Written by create-checkout-session
-- and the webhook using the service role.
create table "BillingCustomer" (
  "userId" uuid primary key,
  "stripeCustomerId" text not null,
  email text,
  "createdAt" timestamptz not null default now(),

  constraint "BillingCustomer_stripeCustomerId_key" unique ("stripeCustomerId")
);

comment on table "BillingCustomer" is
  'Stripe customer mapping per Supabase user. Service-role writes only; no client access.';

-- One row per Stripe subscription (or lifetime purchase). householdId is the
-- entitlement boundary: one subscription covers every member of the household.
create table "Subscription" (
  id uuid primary key default gen_random_uuid(),
  "householdId" uuid not null references "Household"(id) on delete cascade,
  "stripeSubscriptionId" text,
  "stripePriceId" text,
  plan text not null,
  status text not null,
  "currentPeriodEnd" timestamptz,
  "cancelAtPeriodEnd" boolean not null default false,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),

  constraint "Subscription_plan_check"
    check (plan in ('monthly', 'yearly', 'lifetime')),
  constraint "Subscription_status_check"
    check (status in (
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'incomplete',
      'incomplete_expired',
      'paused',
      'lifetime'
    )),
  constraint "Subscription_stripeSubscriptionId_key"
    unique ("stripeSubscriptionId")
);

comment on table "Subscription" is
  'Household-level Stripe subscription. Members can read it; only the service role can write it.';

-- At most one live subscription per household. Lifetime rows use status
-- 'lifetime' and are not part of this partial index (a lifetime purchase and a
-- stale active Stripe subscription can coexist without locking the household
-- out). The webhook is responsible for keeping rows mutually consistent.
create unique index "Subscription_one_live_per_household_idx"
  on "Subscription" ("householdId")
  where status in ('trialing', 'active');

create index "Subscription_householdId_idx"
  on "Subscription" ("householdId");

-- Idempotency ledger for Stripe webhook retries.
create table "StripeEvent" (
  id text primary key,
  type text not null,
  "processedAt" timestamptz not null default now()
);

comment on table "StripeEvent" is
  'Processed Stripe event ids for webhook idempotency. Service-role writes only; no client access.';

-- ============================================================================
-- updatedAt trigger
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new."updatedAt" := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger helper that stamps Subscription.updatedAt on every update.';

drop trigger if exists "Subscription_set_updatedAt" on "Subscription";
create trigger "Subscription_set_updatedAt"
  before update on "Subscription"
  for each row
  execute function public.set_updated_at();

-- Trigger functions cannot be called directly, but keep them out of the client
-- API anyway. Trigger execution is performed by the table owner, so this does
-- not prevent the trigger from firing.
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- ============================================================================
-- Entitlement helper
-- ============================================================================

create or replace function public.household_is_entitled(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from "Subscription" s
    where s."householdId" = hid
      and (
        (s.plan = 'lifetime' and s.status = 'lifetime')
        or s.status in ('trialing', 'active')
      )
  );
$$;

comment on function public.household_is_entitled(uuid) is
  'True when the household has a lifetime purchase or a trialing/active subscription. SECURITY DEFINER so callers do not need Subscription table privileges.';

revoke all on function public.household_is_entitled(uuid) from public, anon, authenticated;
grant execute on function public.household_is_entitled(uuid) to authenticated, service_role;

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table "BillingCustomer" enable row level security;
alter table "Subscription" enable row level security;
alter table "StripeEvent" enable row level security;

-- Members can see their household's subscription. This is intentionally the
-- only billing policy: BillingCustomer and StripeEvent have RLS enabled with no
-- policies, which denies all client access. The service role bypasses RLS.
drop policy if exists "subscription_select_household_members" on "Subscription";
create policy "subscription_select_household_members"
  on "Subscription"
  for select
  to authenticated
  using (public.is_household_member("householdId"));

-- ============================================================================
-- Privileges
-- ============================================================================

revoke all on "BillingCustomer" from anon, authenticated;
revoke all on "Subscription" from anon, authenticated;
revoke all on "StripeEvent" from anon, authenticated;

grant select on "Subscription" to authenticated;

grant all on "BillingCustomer" to service_role;
grant all on "Subscription" to service_role;
grant all on "StripeEvent" to service_role;
