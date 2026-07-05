// Email templates. Each returns { html, text, subject }.
// WHY both html and text? Some email clients (and spam filters) prefer
// plain-text. Always include a text fallback.

const APP_NAME = "Auth System";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// ── Verification email ─────────────────────────────────────────────────────

export function verificationEmail(
  name: string | null,
  token: string
): EmailTemplate {
  const url = `${APP_URL}/api/auth/verify-email?token=${token}`;
  const greeting = name ? `Hi ${name},` : "Hi,";

  return {
    subject: `Verify your ${APP_NAME} email address`,
    text: `
${greeting}

Thanks for signing up! Please verify your email address by visiting the link below.
This link expires in 24 hours.

${url}

If you didn't create an account, you can safely ignore this email.

— ${APP_NAME}
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #111;">
  <h2 style="margin-bottom: 8px;">${APP_NAME}</h2>
  <p>${greeting}</p>
  <p>Thanks for signing up! Please verify your email address. This link expires in <strong>24 hours</strong>.</p>
  <p style="margin: 32px 0;">
    <a href="${url}"
       style="background:#000;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
      Verify Email Address
    </a>
  </p>
  <p style="color:#666;font-size:13px;">Or copy this URL into your browser:<br/>${url}</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
  <p style="color:#888;font-size:12px;">If you didn't create an account, you can safely ignore this email.</p>
</body>
</html>
    `.trim(),
  };
}

// ── Password reset email ───────────────────────────────────────────────────

export function passwordResetEmail(
  name: string | null,
  token: string
): EmailTemplate {
  const url = `${APP_URL}/reset-password?token=${token}`;
  const greeting = name ? `Hi ${name},` : "Hi,";

  return {
    subject: `Reset your ${APP_NAME} password`,
    text: `
${greeting}

We received a request to reset your password. Click the link below to choose a new one.
This link expires in 15 minutes and can only be used once.

${url}

If you didn't request a password reset, you can safely ignore this email.
Your password will not be changed.

— ${APP_NAME}
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #111;">
  <h2 style="margin-bottom: 8px;">${APP_NAME}</h2>
  <p>${greeting}</p>
  <p>We received a request to reset your password. This link expires in <strong>15 minutes</strong> and can only be used once.</p>
  <p style="margin: 32px 0;">
    <a href="${url}"
       style="background:#000;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
      Reset Password
    </a>
  </p>
  <p style="color:#666;font-size:13px;">Or copy this URL into your browser:<br/>${url}</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
  <p style="color:#888;font-size:12px;">If you didn't request this, you can safely ignore this email. Your password will not be changed.</p>
</body>
</html>
    `.trim(),
  };
}
