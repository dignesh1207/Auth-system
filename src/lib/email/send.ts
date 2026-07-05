// Email sending service.
// Production: uses Resend (https://resend.com) — set RESEND_API_KEY in .env
// Development: prints a formatted preview to the terminal instead of sending.
//
// WHY Resend over nodemailer?
// nodemailer requires you to configure an SMTP server (Gmail OAuth, AWS SES,
// etc.) and manage TLS, auth, and deliverability yourself. Resend is an API
// service that handles all of that — one API key and you get production-grade
// deliverability, open tracking, and a dashboard. It also has a great free tier
// for low-volume apps.

import { Resend } from "resend";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string; // plain-text fallback for email clients that don't render HTML
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Auth System <noreply@example.com>";

  // Dev fallback: log a formatted preview instead of making a real API call.
  // This lets you test the full flow without a Resend account.
  if (!apiKey || apiKey.startsWith("re_your_")) {
    console.log("\n┌─────────────────────────────────────────────┐");
    console.log("│  [DEV EMAIL — not sent, Resend key missing]  │");
    console.log("├─────────────────────────────────────────────┤");
    console.log(`│  To:      ${opts.to}`);
    console.log(`│  Subject: ${opts.subject}`);
    console.log("├─────────────────────────────────────────────┤");
    console.log(opts.text);
    console.log("└─────────────────────────────────────────────┘\n");
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });

  if (error) {
    // Don't expose Resend errors to callers — just log and swallow.
    // The API endpoint returns the same success response either way to
    // prevent email oracle attacks (confirming whether an address exists).
    console.error("[email] Resend error:", error);
  }
}
