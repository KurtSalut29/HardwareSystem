import nodemailer from "nodemailer";
import { STORE_ADDRESS, STORE_NAME } from "@/lib/brand";

/**
 * Email through the store's Gmail account, for account approval notices.
 *
 * Set in .env (and in Vercel's environment variables):
 *   GMAIL_USER          the store's Gmail address, e.g. rmhardware.biliran@gmail.com
 *   GMAIL_APP_PASSWORD  a 16-character App Password from
 *                       Google Account > Security > 2-Step Verification > App passwords
 *                       (the normal Gmail password does not work here)
 *   APP_URL             optional, the site's address for the "Sign in" link
 *
 * Without them nothing is sent: callers get { sent: false } and the admin is
 * told, but approving or registering still works.
 */

export type MailResult = { sent: true } | { sent: false; reason: string };

export function mailReady(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

let transport: nodemailer.Transporter | null = null;

function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "") },
    });
  }
  return transport;
}

async function send(to: string, subject: string, heading: string, paragraphs: string[], cta?: { label: string; href: string }): Promise<MailResult> {
  if (!mailReady()) return { sent: false, reason: "Email isn't set up yet (GMAIL_USER and GMAIL_APP_PASSWORD in .env)." };
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  const html = `<!doctype html><html><body style="margin:0;background:#f3f5fa;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;border:1px solid #e5e7eb">
      <tr><td style="padding:20px 24px;border-bottom:3px solid #1e4fd8">
        <div style="font-size:18px;font-weight:800;color:#12327f">${esc(STORE_NAME)}</div>
        <div style="font-size:12px;color:#6b7280">${esc(STORE_ADDRESS)}</div>
      </td></tr>
      <tr><td style="padding:24px">
        <h1 style="font-size:20px;margin:0 0 12px;color:#111827">${esc(heading)}</h1>
        ${paragraphs.map((p) => `<p style="font-size:14px;line-height:1.6;margin:0 0 12px">${esc(p)}</p>`).join("")}
        ${cta ? `<p style="margin:20px 0 4px"><a href="${esc(cta.href)}" style="display:inline-block;background:#1e4fd8;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 20px;border-radius:10px">${esc(cta.label)}</a></p>` : ""}
      </td></tr>
      <tr><td style="padding:14px 24px;border-top:1px solid #f0f1f5;font-size:11px;color:#9ca3af">
        You're getting this because this email was used to register at ${esc(STORE_NAME)}. If that wasn't you, you can ignore it.
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
  const text = [heading, "", ...paragraphs, ...(cta ? ["", `${cta.label}: ${cta.href}`] : [])].join("\n");
  try {
    await getTransport().sendMail({
      from: `"${STORE_NAME}" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (e) {
    console.error("[mailer]", e);
    return { sent: false, reason: e instanceof Error ? e.message : "The email couldn't be sent." };
  }
}

function signInUrl(origin?: string) {
  return `${(process.env.APP_URL || origin || "").replace(/\/$/, "")}/login`;
}

export function sendRegistrationReceived(to: string, name: string) {
  return send(to, `We received your registration — ${STORE_NAME}`, `Thanks for registering, ${name}!`, [
    "Your customer account is waiting for the store's approval. This keeps orders safe for everyone: the store checks each new account before it can order.",
    "We'll email you again at this address as soon as it's approved. It usually takes less than a day.",
  ]);
}

export function sendAccountApproved(to: string, name: string, origin?: string) {
  return send(to, `Your account is approved — ${STORE_NAME}`, `You're all set, ${name}!`, [
    "The store approved your customer account. You can now sign in with this email and the password you chose, and start ordering for delivery or pickup.",
  ], { label: "Sign in", href: signInUrl(origin) });
}

export function sendAccountRejected(to: string, name: string, reason: string) {
  return send(to, `About your registration — ${STORE_NAME}`, `Hi ${name},`, [
    "We couldn't approve your customer account this time.",
    `Reason from the store: ${reason}`,
    "If you think this is a mistake, please visit or call the store.",
  ]);
}
