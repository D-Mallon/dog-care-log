# Loggi 🐾

Loggi is a Progressive Web App for households that share dog care. Everyone who looks after the dog uses the same household, so feeding, walks, toilet breaks, medication, weight and notes stay in one place — and every member can see who logged what.

**v0.6.0 is the current production release.** `main` is production and deploys through Vercel. The full scope, decisions and open questions live in [plan.md](plan.md). The [QA checklist](docs/qa.md) is the gate for calling a feature shipped.

## Release 1 target scope

**Status:** this is the Release 1 contract, not a claim that every item is finished for a paid public launch. The core product is implemented; the remaining commercial-launch work is tracked in [plan.md](plan.md) and [docs/deploy.md](docs/deploy.md).

### Households and collaboration

- Create a household or join one with an invite code.
- Owner and member roles; household-level destructive actions (delete dog, remove member, billing) are owner-only.
- Member list, leave/remove member, rename household and regenerate the invite code.
- One active household per user in Release 1 (multi-household switching is not included).
- Realtime event and weight updates for everyone in the household, plus refetch on reconnect/focus.
- "Logged by [name]" on events.

### Dogs and care logging

- Multiple dogs per household, each with a photo, breed, age, weight and notes.
- Quick-log buttons for feed, water, walk, toilet, medication and grooming.
- Full event form for every event type, including notes and toilet subtypes (pee, poo, accident).
- Backdated events and event editing, with author/owner permissions.
- Pending states and duplicate prevention for quick logs.
- Today's timeline and per-dog history.
- Overdue cues for feed, walk, toilet and medication.
- Shared routines that can cover one or several dogs; one completion marks the whole group done, and routines can be edited, paused or deleted.
- Potty predictions that report "due" or "overdue" rather than a bare average.
- Initial weight when a dog is added, plus a dedicated weight entry and weight history.
- CSV export of events and weight history, with correct escaping for Excel and Numbers.

### Billing (Stripe, test mode until launch sign-off)

- Hosted Stripe Checkout for monthly, yearly and founding lifetime plans.
- 14-day trial and promotion codes. Stripe Tax is **optional and not free**; it is wired behind the `STRIPE_AUTOMATIC_TAX` secret and documented in [docs/stripe-setup.md](docs/stripe-setup.md#122-stripe-tax--vat).
- Customer Portal for payment methods, invoices and cancellation.
- Household-level entitlement: one subscription covers every member.
- Free plan includes one dog and core logging; premium unlocks unlimited dogs (enforced in the UI and by RLS).
- Signed, idempotent webhook that updates entitlements.

### PWA, accessibility and trust

- Installable PWA on iOS, Android and desktop.
- Offline app shell and read cache with a clear offline state.
- Keyboard-accessible modals, labelled forms, alt text and WCAG AA body-text contrast.
- Privacy policy and terms (reachable before sign-up), per-dog and household data export, and self-serve account deletion.

## Not in Release 1

To keep the launch honest, these are explicitly out of scope:

- Push notifications and automated reminders.
- A full offline **write** queue or background sync.
- Multi-household switching for one account.
- Native iOS/Android apps and app-store billing.
- Weight charts and advanced analytics.
- Sitter/walker portal and ML predictions.

## Before taking live payments

- Have the plain-language privacy and terms copy in [`LegalScreen.tsx`](src/screens/LegalScreen.tsx) reviewed for your entity, consumer-law and VAT position. The company/contact placeholders have been removed; the current contact channel is the in-app support form.
- Configure custom SMTP before inviting real users. Supabase's built-in mailer only delivers to project team addresses and is limited to 2 messages/hour — see [docs/email-setup.md](docs/email-setup.md).
- Stripe Tax is deliberately **off for now**: it costs per transaction and Loggi is pre-revenue. Keep the neutral pricing copy and revisit VAT after the first paying cohort — see [docs/stripe-setup.md](docs/stripe-setup.md#122-stripe-tax--vat).
- Settle the VAT position before live billing. If Loggi is VAT-registered, consumer prices must be displayed **VAT-inclusive**; if it is below the services threshold, do not claim VAT is included. See [VAT-inclusive consumer pricing](docs/stripe-setup.md#1221-vat-inclusive-consumer-pricing).
- Complete the Stripe live-mode checklist in [`docs/stripe-setup.md`](docs/stripe-setup.md).
- Add monitoring/uptime (Sentry or equivalent) and confirm backups.
- Run the QA checklist in [`docs/qa.md`](docs/qa.md) on a preview deployment.

## Tech stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions)
- **Auth:** Supabase Auth UI
- **Billing:** Stripe Checkout, Customer Portal and signed webhooks
- **PWA:** `vite-plugin-pwa`
- **Browser smoke tests:** Playwright (`npm run test:e2e`)

## Prerequisites

- **Node.js 20.19+ (20 LTS) or 22.12+ (22 LTS)** and npm 10+. Vite 7 does not support Node 18.
- A **Supabase project** (the free tier is enough for development) with access to the SQL editor and Edge Functions.
- A **Stripe account** with test-mode products and prices.
- Optional but recommended: a Vercel account for previews/production, the Supabase CLI, and the Stripe CLI for local webhook forwarding.

## Local setup

### 1. Clone and install

```bash
git clone <repository-url>
cd dog-care-log
git switch main
npm install
```

Use `npm ci` instead of `npm install` when you want the exact dependency tree from `package-lock.json` (for example, to reproduce CI).

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in the values from your Supabase project (**Project Settings → API**):

```dotenv
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
VITE_APP_URL=http://localhost:5173
```

- `VITE_SUPABASE_PUBLISHABLE_KEY` is the browser-safe publishable (or legacy anon) key. Never use the `service_role` key in the client.
- `VITE_APP_URL` is the public app URL used for absolute links and Stripe Checkout success/cancel redirects. Use `http://localhost:5173` locally.
- Stripe secrets do **not** belong in `.env` or any `VITE_*` variable. They live only in Supabase Edge Function secrets (see below).
- `.env` is git-ignored. Never commit it.

### 3. Apply the database migrations

Versioned SQL migrations live in [`supabase/migrations/`](supabase/migrations). Apply them in filename order. See [`supabase/README.md`](supabase/README.md) for the schema, RPC API and detailed apply order. The recommended path is the Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --remote
```

These commands assume Supabase CLI v3, where `--remote` targets the linked project. On older CLI versions the linked project is the default target; omit `--remote`.

If the repository does not yet have `supabase/config.toml`, run `npx supabase init` once before linking.

As a fallback, open **SQL Editor** in the Supabase dashboard and run each migration file in order. Migrations are the source of truth; do not run ad-hoc `DROP`/recreate scripts against a project that contains data.

> **Legacy script warning:** the root `supabase/migration.sql` is an old, destructive reset script (`DROP TABLE ... CASCADE`) that was only ever safe on a throwaway dev database. It is retained for historical reference only and should not be run at all; it must never be run against a shared or production project. Use `supabase/migrations/` and the guidance in [`supabase/README.md`](supabase/README.md).

After applying, confirm the domain tables (`Household`, `HouseholdMember`, `Dogs`, `DogEvent`, `WeightLog`), billing tables, RPCs and the `dog-images` storage bucket exist.

The migrations assume an **empty schema** and do not drop or migrate the legacy tables in place. For the paused dev project, reset it first (see [docs/deploy.md](docs/deploy.md) §4) and then apply the migrations.

### 4. Configure Stripe in test mode

Follow [docs/stripe-setup.md](docs/stripe-setup.md) for products, prices, test cards and webhook forwarding. The short version:

```bash
# Deploy the billing and account Edge Functions (run from the repo root).
# Stripe cannot send a Supabase JWT, so the webhook function must have JWT
# verification disabled. The two user-facing functions keep it enabled.
npx supabase functions deploy create-checkout-session --project-ref <project-ref>
npx supabase functions deploy create-portal-session --project-ref <project-ref>
npx supabase functions deploy delete-account --project-ref <project-ref>
npx supabase functions deploy stripe-webhook --no-verify-jwt --project-ref <project-ref>

# Set secrets for the Edge Functions only — never in Vercel client env
npx supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  STRIPE_PRICE_MONTHLY=price_... \
  STRIPE_PRICE_YEARLY=price_... \
  STRIPE_PRICE_LIFETIME=price_... \
  APP_URL=http://localhost:5173
```

Configure the Stripe webhook endpoint as:

```text
https://<project-ref>.supabase.co/functions/v1/stripe-webhook
```

For local development, forward events with the Stripe CLI and use the `whsec_...` value it prints:

```bash
stripe listen --forward-to https://<project-ref>.supabase.co/functions/v1/stripe-webhook
```

### 5. Start the app

```bash
npm run dev
```

Vite serves the app at <http://localhost:5173>. All data access goes directly to Supabase through the client SDK; there is no separate backend server to run locally.

## Supabase auth configuration

### URL configuration

In **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:5173` for local development; your production URL in production.
- **Redirect URLs:** add every origin that can complete an auth flow:
  - `http://localhost:5173/**`
  - `https://<production-domain>/**`
  - your Vercel preview pattern, for example `https://*-<team-slug>.vercel.app/**`

Keep the list as narrow as practical. Password-recovery links must land on an allowed redirect URL; the app listens for Supabase's `PASSWORD_RECOVERY` event and shows the update-password form.

### Custom SMTP (required before real users)

Supabase's built-in mailer only sends to project team addresses and is limited
to 2 messages/hour, so password resets will not reach real users without a
custom SMTP provider. Resend's free tier is enough for the first cohort. See
[docs/email-setup.md](docs/email-setup.md) for the SMTP settings, DNS records,
branded templates and the verification checklist.

The templates are checked in under [`supabase/templates/`](supabase/templates)
and referenced by [`supabase/config.toml`](supabase/config.toml).

### Email confirmation for local development

Email/password auth is enabled under **Authentication → Providers → Email**.

- For local development, either disable **Confirm email** (Authentication → Providers → Email) or confirm each account through the email link.
- If you use the Supabase CLI locally, the local mail catcher receives the confirmation and recovery emails.
- Re-enable email confirmation before production and verify the templates and redirect URLs.

## npm scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server at `http://localhost:5173`. |
| `npm run build` | Typecheck with `tsc -b`, then build the production bundle with Vite. This is the release gate. |
| `npm run lint` | Run ESLint over the repository. |
| `npm run typecheck` | Run `tsc -b --pretty false` without emitting a bundle. |
| `npm test` | Run the Vitest unit/component suite. |
| `npm run test:e2e` | Build and run the Playwright unauthenticated-shell smoke tests. |
| `npm run setup:smtp` | Dry-run (or apply, with `SMTP_APPLY=true`) the Resend SMTP config via the Supabase Management API. |
| `npm run preview` | Serve the built `dist/` locally with Vite preview. |

## Branch and release workflow

`main` is both the integration branch and production. Use short-lived branches
and pull requests; Vercel creates a preview deployment for each pull request.

```text
main (production + integration)
  ├── fix/...
  ├── feat/...
  └── chore/...
```

1. Branch from `main` (`git switch -c fix/short-description main`).
2. Open a pull request into `main`. CI runs lint, typecheck, unit tests,
   Edge Function parsing, the production build, the database/RLS jobs and the
   Playwright smoke test.
3. Run the two-user and Stripe test-mode QA in [docs/qa.md](docs/qa.md) against
   the Vercel preview.
4. Merge to `main` only after QA passes. Vercel deploys `main` to production.
5. Tag the release:

   ```bash
   git switch main
   git pull --ff-only
   git tag -a v0.6.0 -m "Loggi v0.6.0"
   git push origin v0.6.0
   ```

Keep `main` deployable at all times. The CI workflow is [`.github/workflows/ci.yml`](.github/workflows/ci.yml): it runs `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run check:functions` and `npm run build` on pull requests and pushes to `main`. A database job applies every migration to PostgreSQL 16 with mocked `auth`/`storage` schemas and runs the free-plan **and** retention/social RLS checks. A separate job runs the Playwright browser smoke tests.

## Deployment

The step-by-step runbook — including resuming Supabase, resetting dev, migrations, Edge Functions, secrets, Stripe webhooks, Vercel environments, smoke tests, backups and rollback — is [docs/deploy.md](docs/deploy.md).

At a minimum, Vercel needs these client-side variables for each environment:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_APP_URL
```

Stripe secrets are set with `supabase secrets set` and must never be added to Vercel or committed. Add `STRIPE_AUTOMATIC_TAX=true` only after tax registrations and prices are ready; leaving it unset keeps Checkout tax-free. Custom SMTP is configured in Supabase Auth, not Vercel — see [docs/email-setup.md](docs/email-setup.md).

## PWA and offline behaviour (honest version)

Loggi is installable and caches the app shell plus previously loaded read data. In Release 1:

- **Works offline:** opening the installed app, navigating the shell, and reading data that was already cached.
- **Requires a connection:** creating, editing or deleting events, weights, household changes and billing actions.
- **Not included:** a write queue, background sync or optimistic replay. An offline write must fail visibly and must not pretend to have saved. Do not promise "log anywhere, sync later" for this release.

Install on iOS Safari via **Share → Add to Home Screen**; on Android Chrome via **Menu → Install app**; on desktop Chrome/Edge via the install icon in the address bar.

## Repository hygiene

- Never commit `.env`, service-role keys, Stripe secret keys, webhook signing secrets, Resend/SMTP API keys or Supabase access tokens.
- `.vercel/` is generated by the Vercel CLI and must never be tracked. If `git ls-files .vercel` prints anything, remove it from the Git index (without deleting the local folder) and commit the removal:

  ```bash
  git rm -r --cached .vercel
  git commit -m "chore: stop tracking .vercel"
  ```

  `.vercel/` is already listed in `.gitignore`. Verify with `git ls-files .vercel` (should print nothing) and `git check-ignore -v .vercel/project.json`.
- Store database backups outside the repository.

## Project structure

```text
src/
  App.tsx              # App shell, screen wiring and session/household state
  components/          # Shared UI components, including AppChrome and ConfirmDialog
  screens/             # Auth, household setup, logging, legal, dog profile
  lib/                 # Supabase client, data access, history, env validation, helpers
  types/               # Shared domain and navigation types
supabase/
  migrations/          # Versioned SQL migrations (source of truth)
  functions/           # Stripe billing and account-deletion Edge Functions
  templates/           # Branded auth email templates
  tests/               # Migration, free-plan and retention/social RLS checks
e2e/
  auth-legal.spec.ts   # Playwright smoke test for the unauthenticated shell
docs/
  qa.md                # Two-user manual QA checklist
  deploy.md            # Deployment and rollback runbook
  stripe-setup.md      # Stripe products, secrets, webhook and test cards
  email-setup.md       # Resend/SMTP, auth templates and email verification
  domain-setup.md      # Domain availability, registrar prices and choice
  insights.md          # Rule-based baseline, potty windows and ML status
  go-to-market.md      # Trial acquisition, content and paid-ads plan
.github/workflows/
  ci.yml               # Verify, database/RLS and browser-smoke jobs
```

## Documentation

- [plan.md](plan.md) — Release 1 scope, architecture, phases and decisions.
- [docs/qa.md](docs/qa.md) — two-user QA checklist, Stripe test-mode flows and RLS negative cases.
- [docs/deploy.md](docs/deploy.md) — deployment, backup and rollback runbook.
- [docs/stripe-setup.md](docs/stripe-setup.md) — Stripe test-mode setup and verification.
- [docs/email-setup.md](docs/email-setup.md) — custom SMTP, templates and email verification.
- [docs/domain-setup.md](docs/domain-setup.md) — domain availability, registrar prices and the recommended name.
- [docs/insights.md](docs/insights.md) — how the baseline, potty windows and commentary actually work.
- [docs/go-to-market.md](docs/go-to-market.md) — trial sourcing, content calendar and ad-automation limits.

## License

MIT — see [LICENSE](LICENSE). © 2026 Loggi contributors.
