#!/usr/bin/env node
/**
 * Apply SMTP settings and auth email templates to a hosted Supabase project
 * through the Management API.
 *
 * This is intentionally dry-run by default: it prints the payload (with the
 * API key redacted) so it can be reviewed before touching production.
 *
 * Required environment:
 *   SUPABASE_ACCESS_TOKEN   personal access token (never commit it)
 *   SUPABASE_PROJECT_REF    project ref, e.g. zmvwqnysmpcsuxqibifh
 *   SMTP_PASS               SMTP password/API key (or RESEND_API_KEY)
 *   SMTP_FROM               verified sender, e.g. no-reply@loggidogs.com
 *
 * Optional:
 *   SMTP_HOST               default smtp.resend.com
 *   SMTP_PORT               default 465
 *   SMTP_USER               default resend
 *   SMTP_APP_URL            production origin (default https://loggidogs.vercel.app)
 *   SMTP_CONFIRM_EMAIL      "true" to require email confirmation
 *   SMTP_APPLY              "true" to actually PATCH; otherwise dry-run
 *   SMTP_APPLY_TEMPLATES    "false" to apply SMTP only (default: apply both)
 *
 * Example:
 *   SMTP_APPLY=true SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... \
 *     RESEND_API_KEY=re_... SMTP_FROM=no-reply@loggidogs.com \
 *     node scripts/setup-smtp.mjs
 */

import { readFile } from "node:fs/promises";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF;
const smtpPass = process.env.SMTP_PASS || process.env.RESEND_API_KEY;
const smtpHost = process.env.SMTP_HOST || "smtp.resend.com";
const smtpPort = process.env.SMTP_PORT || "465";
const smtpUser = process.env.SMTP_USER || "resend";
const from = process.env.SMTP_FROM;
const appUrl = process.env.SMTP_APP_URL || "https://loggidogs.vercel.app";
const confirmEmail = process.env.SMTP_CONFIRM_EMAIL === "true";
const apply = process.env.SMTP_APPLY === "true";
const applyTemplates = process.env.SMTP_APPLY_TEMPLATES !== "false";

const missing = [
  ["SUPABASE_ACCESS_TOKEN", token],
  ["SUPABASE_PROJECT_REF", projectRef],
  ["SMTP_PASS or RESEND_API_KEY", smtpPass],
  ["SMTP_FROM", from],
].filter(([, value]) => !value);

if (missing.length > 0) {
  console.error(
    `Missing required environment variable(s): ${missing
      .map(([name]) => name)
      .join(", ")}`,
  );
  process.exit(1);
}

const TEMPLATE_SPECS = [
  {
    name: "confirmation",
    file: "confirmation.html",
    subject: "Confirm your Loggi email",
  },
  {
    name: "recovery",
    file: "recovery.html",
    subject: "Reset your Loggi password",
  },
  {
    name: "magic_link",
    file: "magic_link.html",
    subject: "Sign in to Loggi",
  },
  {
    name: "email_change",
    file: "email_change.html",
    subject: "Confirm your new Loggi email",
  },
];

async function buildTemplatePayload() {
  const payload = {};
  for (const spec of TEMPLATE_SPECS) {
    const path = new URL(
      `../supabase/templates/${spec.file}`,
      import.meta.url,
    );
    const content = await readFile(path, "utf8");
    payload[`mailer_subjects_${spec.name}`] = spec.subject;
    payload[`mailer_templates_${spec.name}_content`] = content;
  }
  return payload;
}

const smtpPayload = {
  smtp_host: smtpHost,
  smtp_port: smtpPort,
  smtp_user: smtpUser,
  smtp_pass: smtpPass,
  smtp_admin_email: from,
  smtp_sender_name: "Loggi",
  site_url: appUrl,
  uri_allow_list: [`http://localhost:5173/**`, `${appUrl}/**`].join(","),
  ...(confirmEmail ? { mailer_autoconfirm: false } : {}),
};

const templatePayload = applyTemplates ? await buildTemplatePayload() : {};

function redacted(value) {
  if (typeof value !== "string" || value.length < 8) return "<redacted>";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

console.log(`Project: ${projectRef}`);
console.log(`Sender:  ${from}`);
console.log(`App URL: ${appUrl}`);
console.log(`Confirm email: ${confirmEmail ? "enabled" : "left unchanged"}`);
console.log("SMTP payload:");
console.log({ ...smtpPayload, smtp_pass: redacted(smtpPayload.smtp_pass) });

if (applyTemplates) {
  console.log("Email templates:");
  for (const spec of TEMPLATE_SPECS) {
    const key = `mailer_templates_${spec.name}_content`;
    console.log(
      `  ${spec.name}: "${spec.subject}" (${templatePayload[key].length} bytes)`,
    );
  }
}

if (!apply) {
  console.log(
    "\nDry run only. Re-run with SMTP_APPLY=true to PATCH the hosted auth config.",
  );
  process.exit(0);
}

async function patchAuth(label, payload) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const body = await response.text();

  if (!response.ok) {
    console.error(`${label} update failed (HTTP ${response.status}).`);
    console.error(body.slice(0, 1000));
    return false;
  }

  console.log(`${label} updated (HTTP ${response.status}).`);
  return true;
}

const smtpOk = await patchAuth("SMTP config", smtpPayload);
if (!smtpOk) process.exit(1);

if (applyTemplates) {
  const templatesOk = await patchAuth("Email templates", templatePayload);
  if (!templatesOk) {
    console.error(
      "SMTP was applied, but the templates were not. Copy them from supabase/templates/ in Dashboard → Authentication → Email Templates.",
    );
    process.exit(1);
  }
}

console.log(
  "\nNext: send a password reset from the app to a non-team email address and check Resend + Supabase Auth logs.",
);
