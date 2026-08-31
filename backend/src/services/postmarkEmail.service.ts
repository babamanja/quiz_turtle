import { ServerClient } from "postmark";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isPostmarkConfigured(): boolean {
  const token = process.env.POSTMARK_SERVER_TOKEN?.trim();
  const from = process.env.POSTMARK_FROM_EMAIL?.trim();
  return Boolean(token && from);
}

export function getAuthPublicAppUrl(): string {
  const raw = process.env.AUTH_PUBLIC_APP_URL?.trim();
  if (!raw) {
    return "";
  }
  return raw.replace(/\/+$/, "");
}

export function normalizeOptionalAppOrigin(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return "";
  }
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol).origin;
  } catch {
    return "";
  }
}

/** Base URL for auth-related email links: env wins; otherwise optional client origin (e.g. from SPA). */
export function resolveAuthEmailAppBase(clientAppBaseUrl?: string): string {
  const fromEnv = getAuthPublicAppUrl();
  if (fromEnv) {
    return fromEnv;
  }
  return normalizeOptionalAppOrigin(clientAppBaseUrl);
}

export async function sendPasswordResetEmail(input: {
  to: string;
  resetUrl: string;
  userName: string;
}): Promise<void> {
  const token = process.env.POSTMARK_SERVER_TOKEN?.trim();
  const from = process.env.POSTMARK_FROM_EMAIL?.trim();
  if (!token || !from) {
    throw new Error("Postmark is not configured");
  }

  const safeName = escapeHtml(input.userName);
  const subject = "Reset your password";
  const textBody = [
    `Hi ${input.userName},`,
    "",
    "We received a request to reset the password for your account.",
    `Open this link to choose a new password (it expires in 30 minutes):`,
    input.resetUrl,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  const htmlBody = `
<p>Hi ${safeName},</p>
<p>We received a request to reset the password for your account.</p>
<p><a href="${escapeHtml(input.resetUrl)}">Reset your password</a></p>
<p>If the button does not work, copy and paste this URL into your browser:</p>
<p style="word-break:break-all;">${escapeHtml(input.resetUrl)}</p>
<p>If you did not request this, you can ignore this email.</p>
`.trim();

  const client = new ServerClient(token);
  await client.sendEmail({
    From: from,
    To: input.to,
    Subject: subject,
    TextBody: textBody,
    HtmlBody: htmlBody,
    MessageStream: "outbound",
  });
}

export async function sendEmailVerificationEmail(input: {
  to: string;
  verifyUrl: string;
  userName: string;
}): Promise<void> {
  const token = process.env.POSTMARK_SERVER_TOKEN?.trim();
  const from = process.env.POSTMARK_FROM_EMAIL?.trim();
  if (!token || !from) {
    throw new Error("Postmark is not configured");
  }

  const safeName = escapeHtml(input.userName);
  const subject = "Verify your email";
  const textBody = [
    `Hi ${input.userName},`,
    "",
    "Confirm your email address for your Language Turtle account:",
    input.verifyUrl,
    "",
    "If you did not create an account, you can ignore this email.",
  ].join("\n");

  const htmlBody = `
<p>Hi ${safeName},</p>
<p>Confirm your email address for your Language Turtle account.</p>
<p><a href="${escapeHtml(input.verifyUrl)}">Verify email</a></p>
<p>If the button does not work, copy and paste this URL into your browser:</p>
<p style="word-break:break-all;">${escapeHtml(input.verifyUrl)}</p>
<p>If you did not create an account, you can ignore this email.</p>
`.trim();

  const client = new ServerClient(token);
  await client.sendEmail({
    From: from,
    To: input.to,
    Subject: subject,
    TextBody: textBody,
    HtmlBody: htmlBody,
    MessageStream: "outbound",
  });
}

function getFeedbackInboxEmail(): string {
  const inbox = process.env.FEEDBACK_INBOX_EMAIL?.trim();
  if (inbox) {
    return inbox;
  }
  return process.env.POSTMARK_FROM_EMAIL?.trim() ?? "";
}

export async function sendFeedbackNotificationEmail(input: {
  userName: string;
  userEmail: string;
  category: string;
  message: string;
  feedbackId: string;
}): Promise<void> {
  const token = process.env.POSTMARK_SERVER_TOKEN?.trim();
  const from = process.env.POSTMARK_FROM_EMAIL?.trim();
  const to = getFeedbackInboxEmail();
  if (!token || !from || !to) {
    return;
  }

  const safeName = escapeHtml(input.userName);
  const safeEmail = escapeHtml(input.userEmail);
  const safeCategory = escapeHtml(input.category);
  const safeMessage = escapeHtml(input.message);
  const subject = `New feedback: ${input.category}`;
  const textBody = [
    `Feedback ID: ${input.feedbackId}`,
    `Category: ${input.category}`,
    `User: ${input.userName} <${input.userEmail}>`,
    "",
    input.message,
  ].join("\n");

  const htmlBody = `
<p><strong>Feedback ID:</strong> ${escapeHtml(input.feedbackId)}</p>
<p><strong>Category:</strong> ${safeCategory}</p>
<p><strong>User:</strong> ${safeName} &lt;${safeEmail}&gt;</p>
<hr />
<p style="white-space:pre-wrap;">${safeMessage}</p>
`.trim();

  const client = new ServerClient(token);
  await client.sendEmail({
    From: from,
    To: to,
    Subject: subject,
    TextBody: textBody,
    HtmlBody: htmlBody,
    MessageStream: "outbound",
    ReplyTo: input.userEmail,
  });
}
