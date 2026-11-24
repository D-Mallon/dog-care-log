/**
 * Public support channel.
 *
 * Keep the footer and legal pages pointing at the same mailbox so the contact
 * route does not drift. Forwarding for this address is configured at the DNS
 * provider; see docs/domain-setup.md.
 */
export const SUPPORT_EMAIL = "support@loggidogs.com";
export const SUPPORT_URL = `mailto:${SUPPORT_EMAIL}`;
export const SUPPORT_LABEL = "Email support";
