# Loggi — MVP to Paid Launch Plan

**Status:** Active
**Branch:** `release/mvp` (renamed from `feat/mvp-polish`; `main` remains production)
**Last updated:** 8 November 2026

---

## 1. Context and decisions

- `release/mvp` currently points at the same commit as `main` and `origin/main` (`b55257d`). All recent polish is uncommitted in the working tree, including the database schema.
- There is no `dev` branch. We will use `release/mvp` as the integration branch and `main` as production.
- The Supabase project is paused and has never contained live data. A clean dev reset is acceptable, but all production schema changes must still be captured as versioned migrations.
- **Stripe is in Release 1**, not deferred. The launch should be capable of taking real payments.
- The first cohort will be sales-led: direct outreach, founder pricing, and concierge onboarding rather than waiting for self-serve traffic.
- **Do not commit or push without explicit approval.** Once approved, work lands in focused commits on `release/mvp` and is merged to `main` only after preview QA.

### Release goal

A household can sign up, create or join a household, add dogs, log and correct care events, see updates from other members in real time, and pay for a premium household plan — on a deployed, monitored, testable production URL.

---

## 2. Release 1 scope

### Must ship

1. **Build and release engineering**
   - Clean `npm run build`, `npm run lint`, `npm run typecheck`.
   - CI on every pull request.
   - Vercel preview and production deploys.
   - Versioned Supabase migrations and an apply/reset runbook.

2. **Secure household foundation**
   - Atomic `create_household` and `join_household` RPCs.
   - Invite-code join that works under RLS without exposing households.
   - Leave/remove member, rename household, regenerate invite code.
   - Owner/member permissions; destructive actions owner-only.
   - One active household per user for Release 1.
   - Storage policies scoped to the user's household.

3. **Reliable app state and auth**
   - No setup-screen flash for existing users.
   - Loading, empty, and error states are distinct.
   - Failed reads/writes are visible and recoverable.
   - Sign-out clears all domain state; account switching cannot leak cached data.
   - Password recovery reliably lands on the update-password screen.
   - Friendly missing-configuration screen.

4. **Care logging**
   - Backdated events and event editing.
   - Quick-log pending states and duplicate prevention.
   - Initial weight log when a dog is added, plus a dedicated weight entry.
   - Correct CSV escaping and a fixed potty prediction ("due"/"overdue", not just an average interval).
   - Home-screen overdue cues for feed, walk, toilet and meds.

5. **Shared household experience**
   - Realtime event updates.
   - "Logged by [name]" on events.
   - Household member list and invite-code display.
   - Member leave/remove flows.

6. **Stripe billing**
   - Hosted Stripe Checkout for monthly, yearly, and founding lifetime plans.
   - Customer Portal for payment method, invoices and cancellation.
   - Signed webhook that updates entitlements idempotently.
   - Household-level entitlement: one subscription covers all members.
   - Pricing/paywall UI and 14-day trial.
   - Test-mode end-to-end verification before going live.

7. **PWA, accessibility and trust**
   - Installable PWA with correct manifest/icons/meta.
   - Offline read cache and clear offline behaviour (full write queue is Release 2).
   - Modal semantics, keyboard access, labels, alt text, and WCAG AA contrast for body text.
   - Privacy policy, terms, refund policy, account deletion, and data export.

8. **Tests and operations**
   - Unit tests for pure logic.
   - Two-user E2E smoke test.
   - Negative RLS tests.
   - Sentry/monitoring and an uptime check.
   - Deploy/rollback runbook.

### Explicitly out of scope for Release 1

- Push notifications and automated reminders (Release 2; email reminders may be a stretch goal).
- Native iOS/Android apps and app-store billing.
- Multi-household switching (one household per user for now).
- Weight charts and advanced analytics.
- Sitter/walker B2B portal (validated as a later opportunity).
- ML predictions.

---

## 3. Branch and release workflow

```text
main (production)
  └── release/mvp (integration + Vercel preview)
        ├── fix/ci-build
        ├── feat/secure-households
        ├── feat/logging-ux
        ├── feat/billing
        └── chore/docs-ci
```

1. Commit the existing working tree on `release/mvp` as the pre-MVP baseline once approved.
2. Push `release/mvp` with an upstream.
3. Use short-lived branches for risky changes, or focused commits directly on `release/mvp` for small fixes.
4. Open one draft PR to `main`; Vercel preview deployments run from it.
5. Merge to `main` only after two-account QA, Stripe test-mode QA, and a production smoke test.
6. Tag the release `v0.1.0`.
7. Keep `main` deployable at all times.

### Definition of done for the branch

- `npm ci && npm run lint && npm run typecheck && npm test && npm run build` passes from a clean clone.
- Two real browser profiles can complete the household flow.
- Stripe test-mode checkout, webhook, portal and cancellation all work.
- No known P0/P1 issues remain in the release checklist.

---

## 4. Agent workstreams and file ownership

Agents must not touch files outside their ownership without flagging it. They must not commit, push, or run commands against the paused Supabase project.

| Agent | Owns | Primary deliverable |
|---|---|---|
| **A — Database & security** | `supabase/migrations/**`, `supabase/README.md` | Versioned schema, RPCs, RLS, storage, constraints, indexes, billing tables, realtime publication |
| **B — Stripe billing** | `supabase/functions/**`, `src/lib/billing.ts`, `src/types/billing.ts`, `docs/stripe-setup.md` | Checkout, portal, webhook, entitlement logic, setup/test documentation |
| **C — Frontend foundation** | `src/App.tsx`, `src/lib/api.ts`, `src/lib/env.ts`, `src/lib/supabase.ts`, `src/lib/eventMeta.ts`, `src/components/DogStatusCard.tsx`, `src/screens/HouseholdSetupScreen.tsx`, `src/screens/AuthScreen.tsx`, import-only edits in `LogEventScreen.tsx`/`DogProfileScreen.tsx` | Green build/lint, typed data layer, loading/error/session recovery, auth recovery |
| **D — CI, docs & repo hygiene** | `.github/workflows/ci.yml`, `LICENSE`, `README.md`, `docs/qa.md`, `docs/deploy.md`, `package.json` scripts | CI, accurate setup/deploy docs, QA matrix, license |
| **Integrator (main agent)** | New screens/components, final wiring, build verification, QA, commits after approval | Household settings, billing UI wiring, accessibility, final release |

### Shared contract: billing schema

All agents must use these names and shapes. If a change is needed, update this plan first.

- `BillingCustomer`: `userId UUID PK`, `stripeCustomerId TEXT UNIQUE NOT NULL`, `email TEXT`, `createdAt TIMESTAMPTZ`.
- `Subscription`: `id UUID PK`, `householdId UUID FK`, `stripeSubscriptionId TEXT UNIQUE`, `stripePriceId TEXT`, `plan TEXT CHECK IN ('monthly','yearly','lifetime')`, `status TEXT`, `currentPeriodEnd TIMESTAMPTZ`, `cancelAtPeriodEnd BOOLEAN`, `createdAt`, `updatedAt`.
- `StripeEvent`: `id TEXT PK`, `type TEXT`, `processedAt TIMESTAMPTZ`.
- A household is entitled when it has a subscription with `status IN ('trialing','active','lifetime')` or `plan = 'lifetime'` and status active.
- Only household owners can start checkout or open the billing portal. All household members can see entitlement.
- Webhooks write with the service role; client writes to billing tables are forbidden by RLS.

### Shared contract: environment

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_APP_URL=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_MONTHLY=
STRIPE_PRICE_YEARLY=
STRIPE_PRICE_LIFETIME=
APP_URL=
```

Stripe secrets live only in Supabase Edge Function secrets. Never commit `.env` or service-role keys.

---

## 5. Phase plan

### Phase 0 — Baseline and branch hygiene

**Owner:** Integrator + Agent D
**Estimate:** 2 hours

- Commit the existing working tree on `release/mvp` once approved.
- Track `supabase/`, add `supabase/migrations/`, and stop tracking `.vercel/`.
- Add `LICENSE` (MIT).
- Add `docs/release-checklist.md`, `docs/qa.md`, `docs/deploy.md`.
- Correct README setup, redirect URLs, migration, Stripe and deployment sections.

**Acceptance:** clean clone can follow the README to a running dev environment; `.vercel/` is no longer tracked.

### Phase 1 — Build, lint and CI

**Owner:** Agent C + Agent D
**Estimate:** 0.5 day

- Fix the unused `isLoading` build error.
- Extract data access into `src/lib/api.ts`; make effects satisfy the React hooks lint rules.
- Move event metadata into `src/lib/eventMeta.ts`; remove duplicate maps and the fast-refresh export error.
- Replace `any` in household setup with the Supabase client type.
- Add `src/lib/env.ts` validation and a configuration error screen.
- Add `typecheck` and CI scripts.
- Fix all lint errors and the missing-dependency warning.

**Acceptance:** `npm run build`, `npm run lint`, `npm run typecheck` pass locally and in CI.

### Phase 2 — Database, RLS and billing schema

**Owner:** Agent A
**Estimate:** 1 day

- Create versioned migrations for a fresh dev reset and for production hardening.
- Implement `create_household`, `join_household`, `leave_household`, `remove_household_member`, `rename_household`, `regenerate_invite_code`.
- Enforce one active household per user.
- Tighten `HouseholdMember` policies so users cannot self-insert as owner.
- Scope storage writes to the user's household path.
- Add event/weight/age constraints and indexes.
- Add realtime publication for `DogEvent` and `WeightLog`.
- Add billing tables, RLS and entitlement helper.
- Backfill an initial weight log for existing dogs with a weight.

**Acceptance:** two-account SQL/API tests prove join works, unauthorized access fails, storage writes are scoped, and constraints reject bad data.

### Phase 3 — Frontend data layer, loading, errors and auth

**Owner:** Agent C
**Estimate:** 1 day

- Add `householdLoading` and a combined splash gate.
- Distinguish "no household" from "load failed"; add retry.
- Stop showing empty states when reads fail.
- Clear all domain state on sign-out; guard stale responses.
- Fix password recovery with explicit recovery-redirect handling.
- Add a global error surface that works on every screen, plus an error boundary.
- Add friendly missing-env handling.

**Acceptance:** existing-user reload shows splash → home; failures show retry; password reset works; account switch leaks nothing.

### Phase 4 — Logging UX and data correctness

**Owner:** Integrator + Agent C (foundation hooks)
**Estimate:** 1.5 days

- Add "When" datetime field with backdating and validation.
- Add edit-event flow; author/owner permissions.
- Insert toilet pee+poo atomically.
- Add quick-log pending state, duplicate prevention, optimistic rollback and error toasts.
- Create an initial weight log when adding a dog; add a dedicated weight entry.
- Add dog notes UI; validate image type/size; compress before upload.
- Add overdue cues for feed/walk/toilet/meds.
- Fix CSV escaping (all fields, BOM, CRLF, formula injection).
- Fix predictions to say "due in" / "overdue by" using last event plus the average interval.
- Add unit tests for time, predictions, CSV and date validation.

**Acceptance:** backdated and edited events display correctly; CSV opens cleanly in Excel/Numbers; predictions handle overdue correctly.

### Phase 5 — Household collaboration

**Owner:** Integrator + Agent A
**Estimate:** 1 day

- Add `displayName` to household membership and capture it during setup/join.
- Show "Logged by" on events.
- Add a Household screen: members, roles, leave/remove, rename, invite code, regenerate code.
- Enforce owner-only destructive actions in the app and RLS.
- Subscribe to realtime `DogEvent`/`WeightLog` changes; refetch on reconnect/focus.
- Display and copy the invite code with a clipboard fallback.

**Acceptance:** two browsers see events live with the correct logger; owner/member permissions hold; leaving revokes access.

### Phase 6 — Stripe billing

**Owner:** Agent B + Integrator
**Estimate:** 1.5 days

- Create Stripe products/prices for monthly, yearly and founding lifetime.
- Edge Functions: `create-checkout-session`, `create-portal-session`, `stripe-webhook`.
- Checkout validates the caller is the household owner; creates/reuses a Stripe customer; passes `householdId` and `userId` metadata; supports promotion codes and a 14-day trial.
- Webhook verifies the signature, records event IDs idempotently, and upserts subscription/entitlement rows.
- Handle checkout completed, subscription created/updated/deleted, invoice payment failed, and lifetime payment.
- Client billing library and pricing/paywall screen.
- Customer Portal for invoices, payment method and cancellation.
- Setup docs with test cards, Stripe CLI webhook forwarding and deploy commands.

**Acceptance:** test-mode monthly/yearly/lifetime checkout updates entitlement; portal opens; cancellation downgrades at period end; duplicate webhooks are idempotent; non-owners cannot start checkout.

### Phase 7 — PWA, accessibility and polish

**Owner:** Integrator
**Estimate:** 1 day

- Fix manifest (`id`, `start_url`, `scope`, maskable icon, screenshots) and iOS meta.
- Add offline read cache and an offline banner; do not claim full offline writes.
- Reusable accessible modal with focus trap, Escape and return focus.
- Associate labels, add alt text, make clickable cards keyboard-accessible.
- Add `aria-live` for toasts; fix `text-muted` contrast.
- Add install instructions for iOS/Android.
- Add privacy policy, terms, refund policy, account deletion and full data export.

**Acceptance:** installable PWA; keyboard-only flows work; no critical Lighthouse accessibility issues; legal pages reachable.

### Phase 8 — QA, staging and production launch

**Owner:** Integrator + Agent D
**Estimate:** 1 day

- Unit and component tests; two-user Playwright smoke test.
- Negative RLS tests.
- Stripe test-mode E2E: checkout, webhook, portal, cancel, lifetime.
- Resume the Supabase project; reset dev; apply migrations; deploy functions; set secrets.
- Configure Stripe webhook endpoint and Customer Portal.
- Vercel preview QA on iOS Safari, Android Chrome and desktop.
- Production smoke test with two accounts and a test purchase.
- Sentry, uptime monitoring, backups and rollback runbook.
- Tag `v0.1.0`.

**Acceptance:** production URL takes a real payment in live mode only after test mode passes; rollback is documented and tested.

---

## 6. Stripe architecture

### Products and prices

| Plan | Price | Billing | Notes |
|---|---|---|---|
| Household monthly | €3.99 | Monthly | 14-day trial |
| Household yearly | €29 | Yearly | Default/recommended |
| Founding lifetime | €79 | One-time | Limited to first 50 households |
| Sitter/walker | €9.99–€19.99 | Monthly | Release 2 |

- Prices are configured in Stripe, not hard-coded in the app.
- The app maps `priceId` to a plan label.
- One subscription covers every member of the household.
- Display prices VAT-inclusive in the EU; enable Stripe Tax.
- Use promotion codes for founder/referral discounts.

### Flow

1. Owner opens Pricing.
2. App calls `create-checkout-session` with the selected plan.
3. Function authenticates the Supabase JWT, checks household ownership, creates/reuses the Stripe customer, and creates a Checkout Session with `client_reference_id = householdId` and metadata.
4. Stripe redirects to Checkout; success returns to `/app?checkout=success`, cancel to `/app?checkout=cancelled`.
5. Stripe calls `stripe-webhook`; the function verifies the signature, records the event ID, and upserts `Subscription`.
6. The app refreshes entitlement and unlocks premium features.
7. "Manage billing" opens the Customer Portal.

### Security requirements

- Never expose `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` to the client.
- Verify the webhook signature against the raw request body.
- Use the Supabase service role only inside Edge Functions.
- Store `StripeEvent.id` to make retries idempotent.
- Do not trust `priceId` from the client; map plan names to server-side price IDs.
- Check `auth.uid()` and household ownership in every billing function.
- RLS: members read entitlement; no client writes to billing tables.

---

## 7. Sales-led first cohort

### Offer

- **Founding household:** €79 lifetime for the first 50 households, including concierge onboarding and a direct feedback channel.
- Alternative: €29 for the first year, then standard yearly pricing.
- 14-day trial for standard self-serve users.
- Free accounts for 5–10 dog trainers/rescues in exchange for feedback and introductions.

### Target segments

1. Puppy owners in multi-adult households (highest immediate pain).
2. Dog trainers and puppy classes (distribution partners).
3. Rescues and foster networks (many dogs, many helpers).
4. Dog sitters/walkers (future B2B plan).

### Channels

- Direct outreach to Irish puppy classes, trainers, vets, groomers and rescues.
- Irish pet Facebook/Instagram communities and puppy-training creators.
- A simple landing page with the pricing table and a founding-member waitlist.
- Referral code: one free month for both households.
- Onboarding call for the first 20 households; watch them use it and fix friction.

### Metrics

- Activation: signed up → household created → dog added → first event.
- Day-7 and day-30 return rate.
- Trial → paid conversion.
- Founding lifetime sales.
- Churn/cancellation reasons.
- Referral rate.

### Rules

- Do not discount below €29/year for standard plans.
- Do not promise reminders until they exist.
- Do not add ads.
- Do not build the sitter portal until paying households validate the core product.

---

## 8. QA matrix

### Automated

- Unit: `getTimeAgo`, predictions, CSV escaping, date/backdate validation, invite-code normalization.
- Component: log-event form, quick log, household setup.
- E2E: two-user household flow, realtime, backdate/edit, leave/remove, password reset, Stripe checkout/webhook/portal.
- RLS negative tests: no cross-household reads/writes; no self-join as owner; no out-of-scope storage writes.

### Manual

- iOS Safari (installed PWA and browser).
- Android Chrome (installed PWA and browser).
- Desktop Chrome/Safari/Firefox.
- Slow network and offline.
- Expired session and password reset.
- Wrong invite code and duplicate join.
- Stripe test cards: success, declined, 3D Secure, cancel, portal cancellation.
- Screenshot/console check for each flow.

---

## 9. Deployment checklist

### Supabase

- [ ] Resume the dev project.
- [ ] Reset the dev database.
- [ ] Apply migrations in order.
- [ ] Deploy Edge Functions.
- [ ] Set function secrets.
- [ ] Verify RLS with two accounts.
- [ ] Configure auth Site URL and redirect URLs.
- [ ] Configure email templates.
- [ ] Enable realtime publication.
- [ ] Create a backup before production changes.

### Stripe

- [ ] Create products/prices in test mode.
- [ ] Set test secrets.
- [ ] Configure webhook endpoint and events.
- [ ] Test Checkout, webhook replay, portal, cancellation, lifetime.
- [ ] Enable Stripe Tax and Customer Portal settings.
- [ ] Switch to live keys only after sign-off.
- [ ] Confirm webhook signature in live mode.

### Vercel

- [ ] Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_APP_URL`.
- [ ] Confirm build command and output directory.
- [ ] Test preview deployment.
- [ ] Test production deployment.
- [ ] Configure custom domain and HTTPS.
- [ ] Add security headers where compatible with Supabase/Stripe/Google Fonts.

### Operations

- [ ] Sentry frontend project.
- [ ] Uptime check.
- [ ] Error/alert routing.
- [ ] Backup and restore drill.
- [ ] Rollback plan.
- [ ] Support email and refund process.

---

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Paused Supabase project cannot be tested | Build schema/migrations offline; resume and reset dev before QA |
| RLS changes lock users out | Test with two accounts; keep rollback SQL; deploy to staging first |
| Stripe webhook duplication or missed events | Idempotency table; replay events; reconcile with Stripe dashboard |
| Scope creep delays launch | Freeze Release 1 scope; push reminders/charts/multi-household to Release 2 |
| Low willingness to pay | Pre-sell founding lifetime; interview 20–30 households before heavy billing polish |
| Account switching data leak | Clear state on sign-out; request IDs; E2E test |
| Auth UI package limitations | Keep for Release 1; evaluate custom auth in Release 2 |
| GDPR/privacy exposure | Privacy policy, export, account deletion, data minimisation, EU hosting review |
| Vercel/Supabase env mismatch | Env validation at startup; documented env names; preview smoke test |
| Stripe fees/app-store rules | Web/PWA Checkout first; avoid IAP until native app exists |

---

## 11. Timeline

| Phase | Estimate |
|---|---|
| 0 — Baseline | 2 hours |
| 1 — Build/CI | 0.5 day |
| 2 — DB/RLS/billing schema | 1 day |
| 3 — Frontend state/auth | 1 day |
| 4 — Logging UX | 1.5 days |
| 5 — Collaboration | 1 day |
| 6 — Stripe | 1.5 days |
| 7 — PWA/a11y/legal | 1 day |
| 8 — QA/deploy | 1 day |
| **Total** | **8–10 focused days** |

Stripe test-mode verification and any live Supabase surprises are the most likely sources of slippage.

---

## 12. Open decisions

1. Confirm final pricing: €3.99/month, €29/year, €79 founding lifetime.
2. Confirm 14-day trial length.
3. Confirm owner-only destructive actions (delete dog, remove member, billing).
4. Confirm whether email reminders are a Release 1 stretch goal or Release 2.
5. Confirm legal entity/VAT status before enabling live Stripe payments.
6. Confirm whether to offer free accounts to trainers/rescues for distribution.

---

## 13. Implementation progress — 8 November 2026

Completed in the working tree (uncommitted, `release/mvp`):

- [x] Branch renamed to `release/mvp`; `main` untouched.
- [x] Versioned migrations for core schema, billing and household RPCs, plus `supabase/README.md`.
- [x] Database migrations validated locally against PostgreSQL 18 with 105 assertions (RLS, RPC permissions, storage scoping, constraints, backfill, billing, realtime, rerun idempotency).
- [x] Stripe Edge Functions, client billing library/types and `docs/stripe-setup.md`.
- [x] Frontend build, lint and typecheck green; PWA build generates successfully.
- [x] Household create/join now uses `create_household` / `join_household`; direct inserts removed.
- [x] Loading, household-load and fetch-error states; no setup-screen flash; sign-out/account-switch state reset.
- [x] Password recovery detection and update-password routing.
- [x] Global error toast/boundary, offline banner and last-known-data cache.
- [x] Realtime subscription for `DogEvent` / `WeightLog` plus focus refresh.
- [x] Household settings screen: members, invite code, rename, regenerate, remove, leave.
- [x] Pricing screen, checkout, portal and entitlement wiring.
- [x] Backdated events, event editing, author/owner delete gating.
- [x] Initial weight log, dedicated weight entry, corrected CSV export and potty insights.
- [x] PWA manifest/icons/meta, accessible modal primitive, legal page, Vercel headers, WCAG AA muted text.
- [x] Vitest unit and component suites (49 tests) and an esbuild parse check for all Edge Functions wired into CI; CI runs lint, typecheck, test, function check and build.
- [x] README setup updated to `supabase/migrations/`; legacy destructive script explicitly deprecated.
- [x] `.vercel/` removed from the git index; `vercel.json` headers added.
- [x] Self-serve account deletion Edge Function and Account & data screen with full household CSV export.
- [x] Free-plan one-dog limit enforced in the UI and by a `Dogs` INSERT RLS policy; pricing copy updated. Migration 4 was validated on local PostgreSQL 18 (free second dog blocked, cross-household insert blocked, premium second dog allowed, rerun idempotent).
- [x] A CI database job now applies every migration to PostgreSQL 16 with mocked `auth`/`storage` schemas and runs the free-plan/RLS checks using `supabase/tests/`.
- [x] Vitest suites cover CSV, dates, predictions, care status, household export, account deletion UI, pricing gating, modals, household setup RPCs and backdate validation.

Deployment progress (9 November 2026):

- [x] Supabase project resumed; legacy dev tables dropped (1 empty legacy household, no dogs/events) and all 4 migrations applied.
- [x] Four Edge Functions deployed and active: create-checkout-session, create-portal-session, delete-account, stripe-webhook (`verify_jwt = false`).
- [x] Stripe test-mode products/prices created and webhook endpoint configured with the five required events.
- [x] Live test-mode flow verified against the deployed project: household create, first dog, free-plan second-dog block (403), checkout session (monthly and lifetime), member join, one-household enforcement (409), cross-household RLS, subscription webhook → entitlement, second dog unlocked, Customer Portal session, cancellation webhook → entitlement revoked, owner-with-members deletion guard (409), member leave, account deletion (200), auth user removed.
- [x] Local headless browser smoke test: sign in, create household, add dog, log event. Found and fixed a missing-photo placeholder bug.
- [x] Password-recovery browser flow tested: recovery link lands on the update-password screen.
- [x] Stripe checkout success/cancel URLs point at `https://loggidogs.vercel.app`; expired test sessions and test accounts cleaned up.
- [x] Branch committed and pushed; CI and the Vercel preview deployment pass.

Still required before production:

- [ ] Run the full two-user QA checklist (`docs/qa.md`) against a public preview or local app, including email/password reset and mobile layout.
- [ ] Set Vercel `VITE_APP_URL` and confirm `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` for Production and Preview.
- [ ] Review the legal placeholders and decide live Stripe activation/VAT setup.
- [ ] Merge `release/mvp` to `main` after explicit approval; deploy production and tag `v0.1.0`.
- [ ] Optional Release 1 stretch: email reminders; otherwise move to Release 2.

---

## 14. Post-v0.1.0 product roadmap — retention and differentiation

Status: Phases A–E implemented on `feat/retention-roadmap` (2026-11-09). Production deployed as **v0.2.0** on `main` (tag `v0.2.0`, commit `28bf15e`) after CI, migrations and a production smoke test passed. Email reminder delivery is deliberately deferred until SMTP is configured; the in-app schedule/today-plan loop is live in the feature branch.

### Product thesis

Loggi should not be “a diary of dog events”. The daily jobs are:

1. “What does my dog need right now?”
2. “Has someone else already done it?”
3. “Is my puppy improving?”
4. “Is this normal?”

The product should move from **recording** to **reassurance, coordination and progress**. The strongest initial wedge is puppy potty training in multi-person households.

### Email confirmation / SMTP prerequisite

Current Supabase auth config:

- `mailer_autoconfirm = true` (signup signs in immediately)
- no custom SMTP host; built-in email rate limit is **2 messages/hour**

Do **not** flip `mailer_autoconfirm` to false until SMTP is configured, or new users will be unable to confirm their accounts. Recommended:

1. Create a Resend/Postmark/SES account and verify a sending domain.
2. Configure Supabase Auth SMTP with the provider host, port, user, API key and sender address.
3. Set `mailer_autoconfirm = false`.
4. Update the confirmation and recovery email templates with the Loggi branding and production URL.
5. Test signup, confirmation, resend and password recovery.
6. Keep auto-confirm only for a private beta if needed; require verified email before paid upgrade.

### Detailed dog profile and breed catalog

The current `Dogs` table is intentionally thin. Add:

- `breedId` (stable catalogue ID) and `breed` free-text fallback
- `sex`, `neutered`
- `dateOfBirth` (not just age)
- `adultWeightKg`, `currentWeightKg`, `sizeCategory`
- `activityLevel`, `foodType`, `feedingSchedule`
- `allergies`, `medications`, `medicalNotes`
- `temperamentNotes`, `trainingStage`, `coatType`
- `vetName`, `vetPhone`, `microchipNumber` (later)
- `timezone` at household level

Breed catalogue fields:

- id, name, aliases, size category, adult weight range male/female, height range
- lifespan range, energy level, grooming needs, shedding level
- trainability, apartment suitability, good with children/dogs
- common health considerations, exercise guidance
- searchable combobox with “Mixed breed” and “I can’t find it” free-text paths

The catalogue should be a local static JSON/TS file (no runtime third-party API dependency) with a licensed or internally curated source. Start with 100–150 common breeds; do not block onboarding on completeness.

UX: keep the first add-dog form short (name, breed, sex, DOB, weight). Put the detailed care profile behind an optional “Add more details” step. Use the same form for editing.

### Retention loops

- **Morning:** today’s plan / due tasks
- **During the day:** quick log and reminders
- **Evening:** today’s summary
- **Weekly:** progress report and streak
- **Social:** reactions, short comments, handoff notes

### Feature roadmap and agent division

#### Phase A — Foundations (1 week)

| Agent | Owns | Deliverable |
|---|---|---|
| A1 — Data/breed catalogue | `supabase/migrations/2026...dog_profile.sql`, `src/data/breeds.ts`, `src/types/core.ts` | Breed catalogue, new dog fields, validation, migration |
| A2 — Dog profile UX | `src/screens/RegisterNewDogScreen.tsx`, `src/screens/DogProfileScreen.tsx`, `src/components/BreedCombobox.tsx` | Searchable breed picker, optional detailed profile, edit flow |
| Integrator | App wiring, tests, build | Merge both, QA, commit |

Acceptance: adding/editing a dog supports breed search, DOB, sex, neuter status, weight and optional care details; existing dogs remain editable; build/lint/tests pass.

#### Phase B — Potty training engine (1–2 weeks)

| Agent | Owns | Deliverable |
|---|---|---|
| B1 — Outcome data | migration, event types, `src/lib/pottyOutcomes.ts` | success/accident, location, cue, context fields |
| B2 — Potty dashboard | `src/components/PottyDashboard.tsx`, profile integration | success rate, intervals, accident patterns, next window |
| B3 — Insights/rules | `src/lib/pottyInsights.ts` + tests | rule-based predictions, explainability, cold-start priors |

Acceptance: owners can mark success/accident; dashboard shows progress and a next-potty window; predictions are labelled as estimates, not veterinary advice.

#### Phase C — Reminders and daily plan (1–2 weeks)

| Agent | Owns | Deliverable |
|---|---|---|
| C1 — Schedule schema | migration, task/schedule types | recurring feed/walk/toilet/meds tasks |
| C2 — Reminder delivery | `supabase/functions/send-reminders`, cron, email template | email reminders; later web push |
| C3 — Today checklist UI | `src/components/TodayPlan.tsx`, App integration | due/overdue/done board and quick complete |

Acceptance: a household can define a routine, see what is due, and one member completing a task updates everyone; reminders respect quiet hours.

#### Phase D — Reactions and handoff (3–5 days)

| Agent | Owns | Deliverable |
|---|---|---|
| D1 — Event social schema | migration, types | reactions and short comments per event |
| D2 — UI | `src/components/EventReactions.tsx`, timeline integration | emoji reactions, comments, “I’ve got this” |
| D3 — Notifications | notification preferences | mention/handoff notification only, no general chat noise |

Acceptance: reactions/comments are event-anchored, realtime, accessible and do not turn into an unstructured chat.

#### Phase E — Weekly progress (3–5 days)

| Agent | Owns | Deliverable |
|---|---|---|
| E1 — Metrics | `src/lib/weeklyReport.ts` | success rate, accident trend, intervals, consistency |
| E2 — Report UI/email | report screen, email template | weekly summary and shareable progress card |

Acceptance: weekly metrics are computed from the household’s own data; no shaming language; data export remains free.

#### Phase F — Predictive/anomaly layer (3–6 weeks after data)

- Collect structured outcomes for at least several weeks.
- Per-dog baseline, anomaly detection, breed/size/age priors.
- Explainable predictions and confidence; vet-reviewed copy.
- ML only after data quality and volume are sufficient. Do not promise diagnosis.

#### Phase G — Offline write queue and caregiver links

- IndexedDB/localStorage outbox with idempotent replay.
- Limited caregiver/sitter links.
- Later B2B sitter plan.

### Rough timeline

With one focused developer: **6–8 weeks** for Phases A–E, with reminders and potty training being the bulk. With AI agents doing parallel implementation: **3–5 weeks calendar time**, but integration, product decisions and QA remain the bottleneck. ML is a later 2–3 month data/model effort, not a first sprint.

### Recommended first sprint

1. Breed catalogue + detailed dog profile.
2. Structured potty outcomes (success/accident/location/cue).
3. Today checklist with next due.
4. Event reactions/comments.
5. Weekly progress report stub.

This directly addresses the new-owner pain and creates reasons to return daily without overbuilding.

### Decisions needed

- SMTP/email provider and domain for confirmation.
- Whether to enable email confirmation now or after SMTP.
- Which first sprint items to prioritise.
- Breed catalogue source/licence and size (100 vs 200 breeds).
- Whether reminders should be email-only initially or include web push.


### Implementation status (2026-11-09)

Delivered on `feat/retention-roadmap`:

- **A — detailed dog profile + breed catalogue:** four additive migrations, 129-breed local catalogue (plus mixed/unknown), searchable combobox, detailed add/edit profile, DOB/sex/neuter/weight/size/activity/care fields.
- **B — potty training engine:** structured success/accident/location/cue fields on logs and edit, rule-based success-rate/interval/next-window/accident-pattern engine, profile dashboard with confidence and non-veterinary guidance.
- **C — schedules/today plan (in-app):** CareSchedule + CareTaskCompletion tables/RLS, schedule management screen, today plan with overdue/done states and household completion attribution. Email reminders remain deferred until SMTP exists.
- **D — reactions/comments:** immutable event reactions and short comments, realtime subscriptions, home/profile integration, author/owner deletion.
- **E — weekly progress:** seven-day household/per-dog report with success rate, active days, consistency, weight trend, highlights and non-veterinary disclaimer.

Verification: 120 tests pass, lint/typecheck/build pass, four migrations applied to Supabase production, and a browser smoke test covered dog creation with breed search, schedule creation/completion, potty logging/dashboard, reactions/comments and the weekly report. Test household/user were deleted after QA; the existing Mallon Family data was untouched.

Remaining before calling the whole roadmap complete: SMTP-backed email reminders, live Stripe activation, real legal company details, and the separate ML phase.

---

## 15. ML Phase 1 — explainable baseline and labels

Status: implemented and deployed as **v0.3.0** on `main` (merge `1c8b4fc`) after CI, migrations and production QA.

### What is included

- **Feature snapshot** (`src/lib/mlFeatures.ts`): versioned, PII-free features per dog for future offline analysis/models — profile, active-day rates, potty outcome/interval, time-of-day shares, weight trend and consistency. All values are nullable and guarded against NaN.
- **Baseline engine** (`src/lib/healthBaseline.ts`): compares the last 3 days with the previous 14 days using local calendar days and active logging days. Covers feeding, water, walking, potty accidents, success rate, toilet interval and weight. Confidence and data-quality labels are explicit; sparse data returns a “keep logging” insight instead of inventing an anomaly.
- **Pattern-watch UI** (`src/components/HealthInsights.tsx`): explainable cards on the dog profile with recent vs baseline values, confidence, neutral wording and a non-veterinary disclaimer.
- **Owner feedback labels** (`InsightFeedback` table + `src/lib/insightFeedbackApi.ts`): “Looks normal” / “Something’s off” records owner-confirmed labels for future model evaluation. RLS is household-scoped; labels are immutable to clients.
- **Production migration** `20261110000100_insight_feedback.sql` applied.

### Why this is the first ML step

The product needs trustworthy pattern signals before a cross-dog model. Per-dog baselines handle individual variation, require less data, are explainable and are safer to ship than a diagnostic model. The feature snapshots and feedback labels are the dataset foundation for the next phase.

### Next model steps

1. Accumulate enough owner-confirmed labels across dogs.
2. Evaluate a cross-dog model (gradient boosting/logistic regression) against the baseline on precision, recall, false-alarm rate and lead time.
3. Add breed/size/age priors and time-of-day features where they improve validation.
4. Only then consider personalized sequence models.
5. Keep prediction copy non-diagnostic and vet-reviewed.
