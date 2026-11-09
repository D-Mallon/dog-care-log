# Loggi — deployment and rollback runbook

**Applies to:** Release 1 / `v0.1.0`

**Branches:** `release/mvp` (integration and Vercel preview) → `main` (production)

**Owner:** the release owner on duty

This is the ordered runbook for taking Loggi from an approved `release/mvp` to production, and for getting back to a known-good state if something goes wrong. Run commands from the repository root unless stated otherwise. Replace every `<placeholder>`.

> **Rules**
> - Production changes only after test-mode QA and a fresh backup.
> - Never run a destructive database command until you have compared the target project ref with the production ref, out loud.
> - Stripe secrets live only in Supabase Edge Function secrets. Never put them in Vercel, `.env` or the repository.
> - `.vercel/` must never be committed. See [Repository hygiene](#12-repository-hygiene).

## 0. Order of operations

1. Preflight and release freeze.
2. Back up the target database.
3. Resume Supabase and verify the project.
4. Reset **dev** (not production) and apply migrations.
5. Deploy Edge Functions and set secrets.
6. Configure the Stripe webhook and Customer Portal; verify in test mode.
7. Configure Vercel env and deploy a preview.
8. Run QA on the preview.
9. Promote to production, smoke test and tag.
10. Monitor; roll back if needed.

## 1. Preflight

- [ ] CI is green on `release/mvp` (lint, typecheck, unit/component tests, Edge Function parse check, build, migration/RLS database job).
- [ ] The pull request from `release/mvp` to `main` is approved.
- [ ] The migration diff has been reviewed by someone other than its author.
- [ ] Stripe test-mode products/prices exist and `docs/stripe-setup.md` has been followed.
- [ ] Legal placeholders in `src/screens/LegalScreen.tsx` are replaced and the copy has been reviewed.
- [ ] Supabase, Stripe and Vercel access is confirmed.
- [ ] A maintenance window and a support contact are agreed.
- [ ] The previous production deployment URL and commit SHA are recorded.
- [ ] You know the **production** Supabase project ref and the **dev** project ref; keep them distinct.
- [ ] `.vercel/` is not tracked: `git ls-files .vercel` prints nothing (see §12 if it does).
- [ ] `.env` is not tracked: `git ls-files .env` prints nothing.
- [ ] Backups from the last deploy are present and readable.

Tooling (first run downloads the CLI, so network access is required):

```bash
node --version        # 20.19+ or 22.12+
npx supabase --version
npx vercel --version
stripe --version
```

Commands below assume **Supabase CLI v3**, where `--remote` targets the linked project. On older CLI versions the linked project is the default target; use the equivalent `--linked` flag where supported, or omit the target flag.

Authenticate and link the intended project:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx vercel login
```

If `supabase/config.toml` is missing, run `npx supabase init` once before linking. Do not commit generated local state such as `supabase/.temp/`.

Record the starting migration state:

```bash
npx supabase migration list --remote
```

## 2. Back up before changing anything

Do this for the target environment **before** migrations, function deploys or env changes. Keep backups outside the repository.

```bash
mkdir -p ~/loggi-backups
STAMP=$(date +%Y%m%d-%H%M)

# Schema dump
npx supabase db dump --remote -f ~/loggi-backups/loggi-schema-$STAMP.sql

# Data-only dump as a second recovery path
npx supabase db dump --remote --data-only -f ~/loggi-backups/loggi-data-$STAMP.sql

ls -lh ~/loggi-backups
```

- [ ] Each file is non-empty and contains expected SQL.
- [ ] The backup is stored somewhere access-controlled and encrypted at rest (not in Git, not in a public bucket).
- [ ] Supabase dashboard backups / point-in-time recovery (PITR) status is checked; PITR may require a paid plan.
- [ ] A restore has been rehearsed against a scratch project at least once before relying on it.

If your CLI supports `--role-only`, keep a roles/grants dump as well; it can save time when restoring into a fresh project.

## 3. Resume the Supabase project

The project may be paused after inactivity.

- [ ] Open the Supabase dashboard → project → **Resume project** (or **Restore** if offered).
- [ ] Wait until the project reports healthy and the database is accepting connections.
- [ ] Confirm from the CLI:

  ```bash
  npx supabase projects list
  ```

- [ ] Confirm the linked ref is the intended environment:

  ```bash
  cat supabase/.temp/project-ref
  ```

If the project was deleted rather than paused, create a new project, update `VITE_SUPABASE_URL`/keys everywhere, and treat this as a fresh deployment rather than a resume.

## 4. Reset the dev database (dev only)

> **Destructive.** This deletes all data in the target project. Only run it against the disposable dev project. Never run it against production.

Guard the target explicitly:

```bash
# Replace with the dev project ref and keep this line in your shell history.
export SUPABASE_PROJECT_REF="<dev-project-ref>"
export PRODUCTION_PROJECT_REF="<production-project-ref>"

test "$SUPABASE_PROJECT_REF" != "$PRODUCTION_PROJECT_REF" || {
  echo "Refusing to reset: SUPABASE_PROJECT_REF is the production project"; exit 1;
}
test "$SUPABASE_PROJECT_REF" = "<dev-project-ref>" || {
  echo "Refusing to reset: not the expected dev ref"; exit 1;
}

npx supabase link --project-ref "$SUPABASE_PROJECT_REF"
npx supabase db reset --remote
```

The CLI asks for confirmation before touching a hosted project. Read it before confirming. If the reset already applies the migrations, the `db push` in §5 will simply report no pending changes.

If your CLI version does not support `db reset --remote`, reset through the dashboard's database reset control (dev only) or run the CLI against an explicit dev connection string:

```bash
npx supabase db reset --db-url "<dev-database-url>"
```

Do not use `DROP SCHEMA`/recreate snippets copied from old notes against a project that may contain data.

## 5. Apply migrations

Migrations in [`supabase/migrations/`](../supabase/migrations) are the source of truth. Apply them in filename order. See [`supabase/README.md`](../supabase/README.md) for the schema, RPC API and detailed apply order.

> **Never run the legacy root `supabase/migration.sql`.** It is a historical reset script that drops every table (`DROP TABLE ... CASCADE`). It was only ever safe on a throwaway dev database with no data, is retained for historical reference only, and must not be part of any deploy. Use only `supabase/migrations/`.

```bash
# See what is pending
npx supabase migration list --remote

# Apply pending migrations to the linked project
npx supabase db push --remote

# Confirm everything is applied
npx supabase migration list --remote
```

Verify the schema and supporting objects:

```sql
-- Run in the Supabase SQL editor.
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

select routine_name
from information_schema.routines
where routine_schema = 'public'
order by routine_name;

select id, name, public
from storage.buckets
where id = 'dog-images';
```

- [ ] Domain tables exist (`Household`, `HouseholdMember`, `Dogs`, `DogEvent`, `WeightLog`).
- [ ] Billing tables exist (`BillingCustomer`, `Subscription`, `StripeEvent`).
- [ ] RPCs exist (`create_household`, `join_household`, `leave_household`, `remove_household_member`, `rename_household`, `regenerate_invite_code`).
- [ ] RLS is enabled on every domain and billing table.
- [ ] Realtime publication includes the tables the app subscribes to.
- [ ] The `dog-images` storage bucket exists.
- [ ] Constraints and indexes from the migrations are present.

**If a migration fails:** stop. Do not edit a migration that may already be recorded as applied. Write a new forward migration that corrects the state, or restore the pre-deploy backup and redeploy the previous app version. Record the failure and the exact migration filename.

**For production:** prefer expand/contract migrations that keep the previous app version working while both versions may be live during the deploy.

## 6. Deploy Edge Functions and set secrets

Deploy the billing functions (they run on Supabase, not Vercel):

```bash
npx supabase functions deploy create-checkout-session
npx supabase functions deploy create-portal-session
npx supabase functions deploy delete-account

# Stripe cannot send a Supabase JWT. The webhook verifies the Stripe signature
# itself, so JWT verification must be disabled for this function only.
npx supabase functions deploy stripe-webhook --no-verify-jwt

npx supabase functions list
```

Set the secrets that Edge Functions read. Use **test-mode** values until the live-mode switch in §7.

```bash
npx supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  STRIPE_PRICE_MONTHLY=price_... \
  STRIPE_PRICE_YEARLY=price_... \
  STRIPE_PRICE_LIFETIME=price_... \
  APP_URL=https://<production-or-preview-domain>

# Lists names and digests only — never the values.
npx supabase secrets list
```

- [ ] All six secrets are present.
- [ ] `STRIPE_SECRET_KEY` is a test key (`sk_test_...`) for QA, or a live key only after sign-off.
- [ ] `APP_URL` matches the environment whose checkout redirects you are testing.
- [ ] No Stripe secret appears in Vercel env, `.env`, the client bundle or Git.
- [ ] Functions were deployed after the latest code change. Secrets are read at runtime; redeploy only when code changes.

## 7. Stripe webhook and Customer Portal

### 7.1 Test-mode webhook

1. Open the Stripe dashboard in **test mode** → Developers → Webhooks → **Add endpoint**.
2. Endpoint URL:

   ```text
   https://<project-ref>.supabase.co/functions/v1/stripe-webhook
   ```

3. Subscribe to the events the handler verifies:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

   The handler acknowledges unrecognised events, so adding more later is safe. See [docs/stripe-setup.md](stripe-setup.md) for the processing details.

4. Copy the signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET` from §6.
5. Send a test event and confirm a `2xx` response and a corresponding function log with no errors.

Local forwarding alternative:

```bash
stripe listen --forward-to https://<project-ref>.supabase.co/functions/v1/stripe-webhook
# Use the whsec_... printed by this command as STRIPE_WEBHOOK_SECRET while testing locally.
```

### 7.2 Customer Portal

In Stripe test mode → Settings → Billing → **Customer Portal**:

- [ ] Business name, branding and support details are set.
- [ ] The monthly, yearly and lifetime prices are available.
- [ ] Customers can update payment methods, view invoices and cancel.
- [ ] Cancellation behaviour is set to cancel at period end (not immediately).
- [ ] Stripe Tax is enabled if required for your jurisdiction; confirm prices are displayed VAT-inclusive where required.

### 7.3 Test-mode verification

Run the Stripe section of [docs/qa.md](qa.md) before any live key is used. Do not proceed to production until checkout, webhook, portal, cancellation, lifetime and idempotent replay all pass.

### 7.4 Going live (only after sign-off)

- [ ] Create live-mode products and prices (test-mode objects do not carry over) and map them to the same plans.
- [ ] Create a **separate live webhook endpoint** and copy its signing secret.
- [ ] Set live `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and live price IDs with `supabase secrets set`.
- [ ] Confirm the webhook signature and entitlement updates with a small real purchase; refund it afterwards and record the accounting treatment.
- [ ] Keep the test endpoint and secrets available for future QA; never mix test and live values.

## 8. Vercel: environment, preview and production

### 8.1 Project settings

- Framework preset: **Vite**
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Node.js version: **20.x** (or 22.x); match CI
- Production branch: `main`

The repository includes `vercel.json` with baseline security headers. Keep it in place, and verify CSP/header changes against Supabase, Stripe and font requests before enabling anything stricter.

### 8.2 Environment variables

Set these for **Production**, **Preview** and **Development** as appropriate:

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
VITE_APP_URL=https://<environment-domain>
```

```bash
npx vercel link
for env in production preview development; do
  npx vercel env add VITE_SUPABASE_URL "$env"
  npx vercel env add VITE_SUPABASE_PUBLISHABLE_KEY "$env"
  npx vercel env add VITE_APP_URL "$env"
done
```

Or use the Vercel dashboard (Project → Settings → Environment Variables) for bulk entry.

- [ ] `VITE_*` values are browser-safe (no service-role key, no Stripe secret).
- [ ] `VITE_APP_URL` matches the environment you are testing; for preview deployments use the deployment URL or a stable preview alias.
- [ ] `APP_URL` (Supabase Edge Function secret) and `VITE_APP_URL` (Vercel) point at the same public origin for that environment.
- [ ] Preview and production URLs are both present in Supabase **Authentication → URL Configuration → Redirect URLs**.
- [ ] Changing an env var requires a **new deployment** to take effect.

### 8.3 Preview deployment

1. Open or refresh the pull request from `release/mvp` to `main`.
2. Wait for the Vercel preview build to succeed.
3. Open the preview URL and confirm the app boots without a configuration error.
4. Add the preview origin to Supabase redirect URLs if it is new (a wildcard such as `https://*-<team-slug>.vercel.app/**` is convenient but broader than an exact origin; use exact URLs where practical).
5. Run the full [QA checklist](qa.md) against the preview. Stripe remains in test mode.
6. Record the preview URL, commit SHA and QA result on the PR.

### 8.4 Production deployment

1. Merge the approved PR into `main`.
2. Vercel builds and deploys `main` to production.
3. Confirm the production deployment points at the expected commit.
4. Confirm the custom domain, HTTPS and redirect URLs are correct.
5. Confirm the app loads without the configuration-error screen.

## 9. Production smoke test

Run this immediately after the production deploy. Use two real accounts and test-mode payments unless live mode has been explicitly approved.

- [ ] Production URL loads on desktop and mobile; no console errors on first load.
- [ ] Sign up/sign in with two accounts in separate profiles.
- [ ] Create a household, add a dog with a photo and weight.
- [ ] Join the second account with the invite code; both see the same dogs.
- [ ] Log an event; the other account sees it in realtime.
- [ ] Backdate and edit an event; values persist.
- [ ] Log a weight; history and CSV are correct.
- [ ] Install the PWA and verify the offline shell/read cache.
- [ ] Complete the Stripe flow for the approved mode:
  - Test mode: use the test cards from [docs/qa.md](qa.md).
  - Live mode: smallest plan with a real card, verify entitlement, then refund and record it.
- [ ] Webhook shows a successful delivery; entitlement is household-wide.
- [ ] Customer Portal opens and cancellation state is correct.
- [ ] Supabase function logs, Vercel logs and monitoring show no unexpected errors.
- [ ] Run the RLS negative cases in [docs/qa.md](qa.md) against production **without creating data** (read-only checks plus a rolled-back transaction).

Tag the release after the smoke test passes and the release owner signs off:

```bash
git switch main
git pull --ff-only
git tag -a v0.1.0 -m "Loggi v0.1.0 — Release 1"
git push origin v0.1.0
```

## 10. Rollback

Choose the smallest rollback that fixes the problem. Do not roll back the database to fix a frontend-only bug.

| Symptom | First action |
| --- | --- |
| Bad frontend build/layout | Roll back the Vercel production deployment to the previous known-good deployment. |
| Bad Edge Function or webhook handler | Redeploy the previous function code from the last good tag; keep the same secrets unless they are compromised. |
| Bad migration / broken RLS | Prefer a forward-fix migration. If data is corrupted, restore the pre-deploy backup or PITR, then redeploy the previous app/functions. |
| Payment/entitlement incident | Disable new checkout if possible, verify webhook deliveries, reconcile Stripe events, rotate the webhook secret only if compromised. |
| Auth lockout | Restore the previous RLS/auth configuration with a forward migration; use the SQL editor/service role only for diagnosis. Communicate status. |
| Wrong env var | Correct the value in Vercel/Supabase and redeploy the affected layer. |

### 10.1 Frontend rollback (Vercel)

Dashboard: **Project → Deployments → previous known-good deployment → Promote to Production**.

CLI alternative:

```bash
npx vercel rollback <previous-deployment-url>
```

Then verify the production URL and the commit SHA. No database change is needed for a frontend-only rollback.

### 10.2 Edge Function rollback

Deploy from the last known-good Git tag in an isolated worktree so the release branch is not modified:

```bash
git fetch --tags
git worktree add /tmp/loggi-rollback <last-good-tag>
cd /tmp/loggi-rollback

npx supabase link --project-ref <project-ref>
npx supabase functions deploy create-checkout-session
npx supabase functions deploy create-portal-session
npx supabase functions deploy delete-account
npx supabase functions deploy stripe-webhook --no-verify-jwt

npx supabase functions list
```

Remove the worktree when finished:

```bash
cd -
git worktree remove /tmp/loggi-rollback
```

### 10.3 Database rollback

Prefer a **forward fix** (a new migration) because it preserves data and keeps migration history honest.

If the database must be restored:

1. Put the app into maintenance/read-only mode if possible.
2. Stop writes and note the current time.
3. Restore from the pre-deploy dump or Supabase PITR to a **scratch** project first; verify the restored schema/data.
4. Restore production from the verified backup (dashboard restore or `psql "<production-database-url>" -f <dump>`).
5. Reapply any post-backup migrations deliberately; do not replay a half-applied migration.
6. Redeploy the matching app and functions.
7. Run the smoke test and reconcile Stripe events that occurred during the outage.

Document the restore timestamp and the exact backup file used.

### 10.4 Stripe rollback

- Pause or disable new checkout (temporarily hide the pricing CTA or revert the relevant deploy) if charges are being created incorrectly.
- Check **Stripe → Developers → Webhooks** for failed deliveries and replay them after the fix.
- If a signing secret is compromised, roll the endpoint secret, update `STRIPE_WEBHOOK_SECRET`, redeploy if needed, and verify with a test event.
- Reconcile any subscription changes made in Stripe against `Subscription` rows manually; the webhook is the source of truth and replay is idempotent.
- Never delete the `StripeEvent` idempotency rows to "force" a reprocess; use the replay mechanism.

### 10.5 Post-rollback

- [ ] Smoke test the affected flows.
- [ ] Confirm webhook deliveries and entitlement.
- [ ] Check logs/monitoring for new errors.
- [ ] Update the status page/support channel.
- [ ] Write a short incident note: cause, timeline, rollback, follow-up.

## 11. Post-deploy checklist

- [ ] CI green and the release commit/tag recorded.
- [ ] Supabase migrations applied; `migration list --remote` matches the repository.
- [ ] Edge Functions deployed and secrets present.
- [ ] Stripe webhook endpoint healthy; recent deliveries are `2xx`.
- [ ] Vercel production and preview deployments point at the intended commits.
- [ ] Supabase auth Site URL and redirect URLs include production and preview origins.
- [ ] Two-account smoke test and RLS negative checks pass.
- [ ] Backups retained and a restore path is known.
- [ ] Sentry/monitoring and the uptime check are active (Release 1 operations workstream).
- [ ] Support email and refund process are live.
- [ ] `.vercel/` is untracked (see §12).

## 12. Repository hygiene

The Vercel CLI may create a `.vercel/` directory when you run `vercel link` or `vercel`. It contains local project metadata and **must not be tracked**. If `git ls-files .vercel` prints anything, remove it from the index (without deleting the local folder):

```bash
git rm -r --cached .vercel
git commit -m "chore: stop tracking .vercel"
```

Verify:

```bash
git ls-files .vercel                 # should print nothing
git check-ignore -v .vercel/project.json
```

`.gitignore` already contains `.vercel`. Never commit `.vercel/`, `.env`, service-role keys, Stripe secrets or database dumps. If a secret is committed, rotate it immediately; removing the commit is not enough.

## Appendix: environment variables

| Variable | Set in | Example | Secret? |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env` locally; Vercel env per environment | `https://abcdefghijklmnop.supabase.co` | No |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env` locally; Vercel env per environment | `sb_publishable_...` or legacy anon key | No (browser-safe) |
| `VITE_APP_URL` | `.env` locally; Vercel env per environment | `https://loggi.example` | No |
| `STRIPE_SECRET_KEY` | Supabase Edge Function secrets only | `sk_test_...` / `sk_live_...` | **Yes** |
| `STRIPE_WEBHOOK_SECRET` | Supabase Edge Function secrets only | `whsec_...` | **Yes** |
| `STRIPE_PRICE_MONTHLY` | Supabase Edge Function secrets | `price_...` | No, but server-only |
| `STRIPE_PRICE_YEARLY` | Supabase Edge Function secrets | `price_...` | No, but server-only |
| `STRIPE_PRICE_LIFETIME` | Supabase Edge Function secrets | `price_...` | No, but server-only |
| `APP_URL` | Supabase Edge Function secrets | `https://loggi.example` | No, but server-only |

`service_role` is used only inside Edge Functions and never enters the client, Vercel env or Git.
