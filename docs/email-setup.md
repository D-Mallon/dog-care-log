# Loggi — transactional email and custom SMTP

**Status:** code/templates prepared; the hosted Supabase project still needs a
domain, a provider API key and the SMTP settings applied.

## Direct dashboard links

Replace `<project-ref>` with the Supabase project ref:

- SMTP settings: `https://supabase.com/dashboard/project/<project-ref>/auth/smtp`
- Email templates: `https://supabase.com/dashboard/project/<project-ref>/auth/templates`
- URL configuration: `https://supabase.com/dashboard/project/<project-ref>/auth/url-configuration`

In the current dashboard these are also under **Authentication → Emails** (SMTP
Settings / Email Templates tabs).

## Quick start if you already have a Resend API key

1. In Resend, add your sending domain and wait for **Verified**. Without a
   verified domain you cannot send to real users.
2. In Supabase: **Authentication → SMTP Settings**, set host
   `smtp.resend.com`, port `465`, user `resend`, password = your API key,
   sender = `no-reply@your-verified-domain`, sender name = `Loggi`.
3. Copy the four templates from [`supabase/templates/`](../supabase/templates)
   into **Authentication → Email Templates** (or apply `supabase/config.toml`).
4. Set **Authentication → URL Configuration**: Site URL
   `https://loggidogs.vercel.app` and redirect URLs for production + localhost.
5. Send a password reset to a **non-team** email address and confirm it arrives.
6. Only then enable **Confirm email** if you want verification on signup.

## Why this is required

Supabase's built-in email service is for development only. It only delivers to
addresses on the project's team, is limited to **2 messages per hour**, and has
no delivery SLA. Real users therefore cannot receive password-reset or email
confirmation messages until a custom SMTP provider is configured.

Source: [Supabase — Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Recommended provider: Resend (needs a domain)

Resend's free tier is enough for the first cohort: **100 emails/day**, custom
domains (3 on the free tier) and DKIM/SPF/DMARC support. It works with Supabase
over standard SMTP. Resend requires a verified domain, so this is the right
choice once you have one (a cheap domain is enough).

Source: [Resend pricing](https://resend.com/pricing).

You can use any SMTP provider (Postmark, SES, Mailgun, Brevo). The settings are
the same shape: host, port, username, password, sender address.

### If you do not have a domain yet

Resend requires a verified domain. Two free options can work without buying one,
with trade-offs:

| Provider | Free allowance | No-domain option | Caveat |
| --- | --- | --- | --- |
| [Brevo](https://www.brevo.com/pricing/) | 300 emails/day | Verify a single sender email | A `gmail.com`/`outlook.com` From address cannot be DKIM-signed by Brevo and will often be rejected or filed as spam. Use an address on a domain you control. |
| [SMTP2GO](https://www.smtp2go.com/pricing/) | 1,000 emails/month | Verify a single sender email | Without a verified sender domain the account is limited to 25 emails/hour. |

The recommended path is still a cheap domain + Resend, because password-reset
deliverability is part of the product. A shared-domain relay is not recommended
for account-security email.

## Prerequisites

- A domain you control. A `vercel.app` subdomain **cannot** be used as a sender
  domain. Use something like `loggidogs.com` or a subdomain such as
  `mail.loggidogs.com`. See [domain-setup.md](domain-setup.md) for registrar
  prices and the recommended name.
- Access to the Supabase dashboard for the production project (or a Supabase
  access token for the Management API).
- A Resend account (free).

## 1. Add and verify the sending domain in Resend

1. Create a Resend account and add your domain under **Domains → Add domain**.
2. Add the DNS records Resend shows. At minimum this is usually:
   - an MX/SPF record for the sending domain,
   - a DKIM record,
   - a DMARC record (`v=DMARC1; p=none;` is fine to start).
3. Wait for Resend to show the domain as **Verified**.
4. Create an API key under **API Keys**. Give it sending permission only.
5. Decide the From address, for example `no-reply@loggi.ie`. It must be on the
   verified domain.

Do not put the API key in `.env`, Vercel, or the repository. It is a Supabase
Auth secret.

## 2. Configure Supabase SMTP

In the Supabase dashboard for the production project:

**Authentication → SMTP Settings → Enable custom SMTP**

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key |
| Sender email | `no-reply@your-verified-domain` |
| Sender name | `Loggi` |

Save. Supabase sends a test email to the sender address; confirm it arrives.

If you use a no-domain stopgap instead:

| Provider | Host | Port | Username | Password |
| --- | --- | --- | --- | --- |
| Brevo | `smtp-relay.brevo.com` | `587` | Brevo SMTP login | Brevo SMTP key |
| SMTP2GO | `mail.smtp2go.com` | `2525` (or `587`) | SMTP username | SMTP password |

For either, the From address must be a **verified sender** in that provider.

## 3. Apply the branded templates

The templates are checked in under [`supabase/templates/`](../supabase/templates):

- `confirmation.html`
- `recovery.html`
- `magic_link.html`
- `email_change.html`

For the hosted project, either:

- copy the HTML into **Authentication → Email Templates** in the dashboard, or
- link the project and run `npx supabase config push` after reviewing
  [`supabase/config.toml`](../supabase/config.toml). The config references the
  same files.

Keep the `{{ .ConfirmationURL }}` placeholder intact; Supabase replaces it
with the signed action link.

## 4. Set the auth URL configuration

In **Authentication → URL Configuration**:

- **Site URL**: `https://loggidogs.vercel.app` (or the custom domain once it
  exists).
- **Redirect URLs**:
  - `https://loggidogs.vercel.app/**`
  - `http://localhost:5173/**` for local development
  - any stable preview alias you actually use

Do not use a broad wildcard unless you need preview deployments; exact origins
are safer.

## 5. Enable email confirmation

Only after SMTP works and templates are applied:

1. **Authentication → Providers → Email → Confirm email** → on.
2. Set `mailer_autoconfirm` to false (this is the same switch in the hosted
   project).
3. Sign up with an address that is **not** a project team member and confirm
   the message arrives.
4. Test resend, password reset (including an expired link) and email change.

If you are running a private beta and want instant sign-in, leave confirmation
off for now — but password reset still needs custom SMTP.

## 6. Test checklist

- [ ] Sign up with a fresh non-team email; confirmation arrives within a minute.
- [ ] Resend confirmation works.
- [ ] Password reset email arrives; link opens the app on the update-password
      screen; a used/expired link shows a friendly error.
- [ ] Email change sends to the new address and only takes effect after the
      link is opened.
- [ ] Emails are not in spam; SPF, DKIM and DMARC pass.
- [ ] Sender display name is `Loggi` and the from address is on the verified
      domain.
- [ ] Supabase Auth logs show no `Email address not authorized` errors.

## 7. CLI/Management API alternative

The dashboard is the simplest path. If you prefer to script it, the repository
includes a dry-run-first helper:

```bash
# 1. Preview the payload (no changes are made).
SUPABASE_PROJECT_REF=<project-ref> \
SUPABASE_ACCESS_TOKEN=<personal-access-token> \
RESEND_API_KEY=<re_...> \
SMTP_FROM=no-reply@your-verified-domain \
npm run setup:smtp

# 2. Apply once the payload looks right.
SMTP_APPLY=true ...
npm run setup:smtp
```

The script PATCHes `/v1/projects/<ref>/config/auth` with the SMTP host, port,
user, sender and your `app_url`. It defaults to Resend but accepts `SMTP_HOST`,
`SMTP_PORT` and `SMTP_USER` for Brevo/SMTP2GO. It also applies the four HTML
templates from `supabase/templates/` in a second PATCH; set
`SMTP_APPLY_TEMPLATES=false` if you only want the SMTP settings.

The script never prints the API key, and it is a dry run unless
`SMTP_APPLY=true` is set. Do not put these values in `.env`, Vercel, or Git.
The repository config is the source of truth for templates, but hosted SMTP
credentials must live in Supabase secrets or the dashboard.

## What is still needed from the owner

The provider account must be created by you (or with you on a screen share):
it needs your email, password, identity and acceptance of the provider's terms.
Do not share your provider password. Once the account exists, the Supabase side
can be applied with `npm run setup:smtp` using an API key.

To finish this end-to-end I need either:

- dashboard access (or a screen-share), or
- the Supabase project ref + a Supabase access token, plus
- the verified sending domain and a Resend API key.

Without those, the code and templates are ready, but the production project
will keep using the development mailer and password resets will not reach real
users.
