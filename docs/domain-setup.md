# Loggi — domain name choice and purchase

*Checked 20 November 2026. Availability and prices change; verify at checkout.*

## Why you need one now

Resend requires a verified sending domain before it will deliver to real users.
A `vercel.app` address cannot be used as the From domain. The domain can be used
for email only at first; moving the app off `loggidogs.vercel.app` is a separate
step.

## Availability check

Checked with the registry WHOIS/RDAP:

| Domain | Status | Notes |
| --- | --- | --- |
| `loggi.com` | **Taken** | Appears to be a logistics brand; not available |
| `loggi.app` | **Taken** | Registered since 2018 |
| `loggi.dev` | **Taken** | Registered 2026 |
| `loggi.co.uk` | **Taken** | Registered 2021 |
| `loggidogs.com` | **Available** | Good global primary |
| `loggi.ie` | **Available** | Short, Irish, exact brand |
| `loggidogs.ie` | **Available** | Longer, descriptive |
| `loggidogs.co.uk` | **Available** | UK expansion option |
| `loggidogs.eu` | **Available** | EU expansion option |
| `loggi.dog` | **Available** | Fun, but weak trust for a paid app |
| `loggi.pet` | **Available** | Same caveat |
| `loggidogs.app` | **Available** | `.app` requires HTTPS; less familiar |

## Price comparison

Prices are approximate and usually exclude VAT. Irish registrars may add 23%
VAT. Verify the renewal price before buying, not just the first-year promo.

| Registrar | TLD | First year | Renewal | Notes |
| --- | --- | ---: | ---: | --- |
| [Cloudflare Registrar](https://www.cloudflare.com/domains/) | `.com` | ~$11.17 | ~$11.17 | At-cost; free WHOIS privacy; uses Cloudflare DNS |
| [Porkbun](https://porkbun.com/tld/com) | `.com` | $11.81 | $11.81 | Free WHOIS privacy, DNS and **email forwarding** |
| [Spaceship](https://www.spaceship.com/domains/) | `.com` | ~$3.18 promo | ~$10.88 | Cheapest first year; promo pricing |
| [Blacknight](https://www.blacknight.com/price-list/) | `.ie` | €5.99 promo | €36.99 | Irish registrar; easy .ie verification |
| [Dynadot](https://www.dynadot.com/domain/ie) | `.ie` | ~$15.79 | ~$21.06 | Cheapest .ie renewal; Irish connection docs required |

`.ie` registration requires a real connection to Ireland (citizen, resident,
Irish business, or trading with Ireland). See
[Blacknight's .ie policy](https://www.blacknight.com/ie-domain-registration-policy/).

## Recommendation

**Primary: `loggidogs.com`.** It is available, descriptive, globally trusted for
email, avoids the taken `loggi.com`, and fits UK/EU expansion. Use
`no-reply@loggidogs.com` for Resend. If the Spaceship promo is the cheapest
way in, take it; you can transfer the domain later (see below).

**Optional second: `loggi.ie`.** Short, exact-brand and Irish-friendly. Use it
as a redirect to `loggidogs.com` for local marketing. It costs ~€6 the first
year at Blacknight but renews at ~€37; Dynadot's renewal is ~€21. If you buy
both, use Porkbun/Cloudflare for the `.com` and Blacknight or Dynadot for the
`.ie`.

If you are deliberately Ireland-only and want the shortest brand, `loggi.ie`
can be the primary instead. I would still secure `loggidogs.com` for expansion.

**Avoid as primary:** `loggi.dog`, `loggi.pet`, `loggidogs.app` and
`getloggi.com`. They are available, but a `.com` remains the default trust
signal for a paid consumer app.

**Trademark caution:** `loggi.com` is taken and “Loggi” is also used by a
logistics company. Before spending heavily on the brand, do a quick trademark
search in Ireland/EU for software and pet services. This is not legal advice.

## Purchase steps

1. Pick a registrar:
   - Easiest for a `.com`: **Porkbun** (free email forwarding is useful for
     `support@` and `hello@`).
   - Cheapest at-cost `.com`: **Cloudflare Registrar**.
   - `.ie`: **Blacknight** (easy Irish verification) or **Dynadot** (cheaper
     renewal).
2. Search for the exact name and add it to the cart.
3. Create the registrant account with your real name, address and email. For
   `.ie`, have proof of your Irish connection ready.
4. Pay. Enable free WHOIS privacy if offered.
5. In the registrar's DNS panel, add the records Resend gives you:
   - SPF
   - DKIM
   - DMARC
   Use a subdomain such as `send.loggidogs.com` if the root domain already has
   email (Google Workspace/Outlook).
6. In Resend: **Domains → Add Domain**, add the same domain, add the records,
   wait for **Verified**.
7. In Supabase: **Authentication → SMTP Settings**, use
   `no-reply@loggidogs.com` with `smtp.resend.com:465`, user `resend`, password
   = Resend API key.
8. Set Supabase **Site URL** and redirect URLs. If you move the app to the new
   domain, also update Vercel, `VITE_APP_URL`, Stripe `APP_URL` and any links in
   the app.

## Email-only shortcut

You do **not** have to move the app to the new domain immediately. Buy the
domain, verify it in Resend, and send from `no-reply@loggidogs.com` while the
app stays on `loggidogs.vercel.app`. Move the app later when you are ready to
update the Supabase redirect URLs, Vercel domain and Stripe `APP_URL`.

## Can I transfer the domain later?

Yes. A `.com` registered at Spaceship can be moved to Porkbun, Cloudflare or
another registrar later. The standard process is:

1. Wait until **60 days after registration** (ICANN's transfer lock also applies
   after a previous transfer or certain registrant changes).
2. Unlock the domain in Spaceship and request the **authorization/EPP code**.
3. Start the transfer at the new registrar and pay its transfer fee. This
   usually includes one year of renewal; remaining registration time is
   normally preserved.
4. Approve the transfer email from Spaceship/the registry.
5. Recreate or point DNS. If the new registrar uses different nameservers,
   re-add the Resend SPF/DKIM/DMARC records and any `support@` forwarding
   records. Keep a copy of the DNS records before moving.

The domain stays live during a normal transfer, but plan it when you are not
mid-campaign. A transfer is not a punishment; it is a routine registrar move.

**You do not have to transfer just to get email forwarding.** You can keep the
domain at Spaceship and point its MX records at a forwarding service:

- [Cloudflare Email Routing](https://developers.cloudflare.com/email-service/)
  — free inbound forwarding, but best if the domain uses Cloudflare DNS.
- [ImprovMX](https://improvmx.com/) — free tier for simple `support@`/`hello@`
  forwarding with MX records at your current DNS provider.

Spaceship also documents an Email Forwarding feature in its Domain Manager; if
it is available on your plan, you can use that without moving. If it is not,
Cloudflare Email Routing or ImprovMX avoids a transfer entirely.

If you literally meant **URL/port forwarding** rather than email forwarding:
that is handled by DNS/redirect rules at the registrar or a proxy, and also
does not require a registrar transfer.

## After buying at Spaceship: the short checklist

1. **Secure the registrar account.** Enable 2FA, keep the domain locked, and
   confirm WHOIS privacy is on. Do not unlock it unless you are transferring.
2. **Add the domain to Resend.** Resend → Domains → Add Domain. Choose the
   region closest to your users if offered, then copy the DNS records it shows.
3. **Add those records in Spaceship DNS.** Typical Resend records look like:
   - a DKIM `TXT` record at `resend._domainkey`
   - an SPF `TXT` record on the `send` subdomain
   - an `MX` record on the `send` subdomain
   - a DMARC `TXT` record at `_dmarc`
   Use the **exact host and value Resend shows**; do not invent them. If the
   root domain already has Google Workspace/Outlook MX records, keep them and
   use Resend's `send` subdomain records as shown.
4. **Wait for Resend to show Verified.** This is usually minutes, but DNS can
   take up to 48 hours.
5. **Create a sending-only Resend API key** and keep it out of Git/Vercel.
6. **Set Supabase SMTP:** `smtp.resend.com`, port `465`, user `resend`,
   password = API key, sender `no-reply@loggidogs.com`, name `Loggi`.
7. **Set Supabase URLs:** Site URL `https://loggidogs.vercel.app` for now;
   redirect URLs for production and localhost.
8. **Apply the templates** from `supabase/templates/` in Supabase →
   Authentication → Emails → Email Templates, or use
   `SMTP_APPLY=true npm run setup:smtp` (the helper applies SMTP and templates).
9. **Test password reset** with a non-team email address. Check Resend logs and
   Supabase Auth logs.
10. **Optional:** create `support@loggidogs.com` forwarding in Spaceship or via
    ImprovMX/Cloudflare Email Routing, then update the legal/support copy.

### Do you need to move the app now?

No. You can use `loggidogs.com` for email only and keep the app at
`loggidogs.vercel.app`. Moving the app is a separate change: add the domain in
Vercel, update DNS, then update Supabase Site URL/redirect URLs,
`VITE_APP_URL`, and Stripe `APP_URL`.

## Resend DNS records in Spaceship (Ireland region example)

Resend may show this shape for an Ireland-region domain:

| Resend row | Spaceship type | Host/name | Value | TTL |
| --- | --- | --- | --- | --- |
| DKIM | `TXT` | `resend._domainkey` | `p=MIGf...` (the full value Resend shows) | Auto/3600 |
| SPF | `CNAME` | `rsend` | `rsend-euw1.forge.rmta.net` | Auto/3600 |
| SPF | `CNAME` | `send` | `send.forge.rmta.net` | Auto/3600 |
| DMARC | `TXT` | `_dmarc` | `v=DMARC1; p=none;` | Auto/3600 |

Notes:

- Do **not** add the section heading (“Domain Verification”) as a record.
- There is no MX record in this Resend setup; the two CNAMEs handle sending.
- If Spaceship asks for a full hostname, use the full name
  (`resend._domainkey.loggidogs.com`, `rsend.loggidogs.com`, etc.). If it asks
  for a label, use the short label shown above.
- TTL can be Auto if available; otherwise 3600 is fine.
- Leave priority blank for TXT/CNAME. Priority is only for MX.
- Paste the DKIM value exactly, with no line breaks. Don’t double-quote it unless
  Spaceship’s form specifically asks for quotes.
- If you later move DNS to Cloudflare, set the Resend CNAMEs to **DNS only**
  (not proxied).
- After adding all four, wait a few minutes, then click **Verify** in Resend.
  DNS can take up to 48 hours, but it is usually much faster.
- Turn on **Enable Sending** in Resend once verification passes.

Useful checks:

```bash
dig TXT resend._domainkey.loggidogs.com +short
dig CNAME rsend.loggidogs.com +short
dig CNAME send.loggidogs.com +short
dig TXT _dmarc.loggidogs.com +short
```

If a record looks like `resend._domainkey.loggidogs.com.loggidogs.com`, the
Spaceship form appended the domain to a name you already made fully qualified.
Remove the duplicate suffix.

## Support forwarding with ImprovMX

If Spaceship’s built-in forwarding is not available, ImprovMX works without
moving nameservers. The root domain has no MX or SPF records today, so add:

| Type | Host / name | Priority | Value | TTL |
| --- | --- | ---: | --- | --- |
| MX | `@` | `10` | `mx1.improvmx.com` | Auto / 3600 |
| MX | `@` | `20` | `mx2.improvmx.com` | Auto / 3600 |
| TXT | `@` | — | `v=spf1 include:spf.improvmx.com ~all` | Auto / 3600 |

Spaceship’s form may append `.loggidogs.com` automatically. In that case enter
`@` as the host, not the full domain, or the record becomes
`loggidogs.com.loggidogs.com`.

Alias: create `support@loggidogs.com` (not `support*@`). If you intentionally
want a catch-all, use `*` as the alias.

Keep the Resend records untouched:

- `resend._domainkey` TXT
- `rsend` CNAME
- `send` CNAME
- `_dmarc` TXT

After saving, click **Check again** in ImprovMX. DNS can take a few minutes.
Send a test from an outside address to `support@loggidogs.com`; check the
forwarded copy and the ImprovMX logs.

If you already have a root SPF TXT record later, merge the includes into one
record instead of creating a second SPF record. Forwarding only receives mail;
to reply *as* `support@`, you need a real mailbox or ImprovMX’s paid SMTP.
