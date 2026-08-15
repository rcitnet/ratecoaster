/**
 * Transactional email for sign-in links.
 *
 * Uses Resend, which has a free tier that comfortably covers a site of this
 * size and needs only an API key plus two DNS records. No SMTP server to run.
 *
 * If RESEND_API_KEY is absent the sender reports that plainly instead of
 * silently succeeding — a mail path that pretends to work is worse than one
 * that is obviously off, because you find out from confused users.
 */

export interface SendResult {
  sent: boolean;
  reason?: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendMagicLinkEmail(to: string, link: string): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const siteName = process.env.SITE_NAME ?? "RateCoaster";

  if (!apiKey || !from) {
    return { sent: false, reason: "RESEND_API_KEY or EMAIL_FROM is not set" };
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: `Your ${siteName} sign-in link`,
      html: magicLinkHtml(link, siteName),
      // A plain-text alternative meaningfully improves deliverability, and some
      // corporate mail clients strip HTML entirely.
      text: `Sign in to ${siteName}\n\n${link}\n\nThis link works once and expires in 15 minutes.\nIf you didn't ask for it, you can ignore this email.`,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { sent: false, reason: `Resend returned ${res.status}: ${body.slice(0, 300)}` };
  }

  return { sent: true };
}

function magicLinkHtml(link: string, siteName: string): string {
  // Inline styles and a table layout, because email clients support neither
  // external stylesheets nor modern CSS reliably. This looks dated on purpose.
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#fff9f2;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px;">
            <tr>
              <td>
                <div style="font-size:22px;font-weight:700;color:#16123c;margin-bottom:20px;">
                  ${siteName}
                </div>
                <div style="font-size:20px;font-weight:600;color:#16123c;margin-bottom:10px;">
                  Here's your sign-in link
                </div>
                <div style="font-size:15px;color:#4a4470;line-height:1.6;margin-bottom:26px;">
                  Click below and you're in — the whole 365-day rate calendar unlocks.
                </div>
                <a href="${link}"
                   style="display:inline-block;background:#e6218c;color:#ffffff;text-decoration:none;
                          padding:14px 28px;border-radius:999px;font-weight:600;font-size:16px;">
                  Sign in
                </a>
                <div style="font-size:13px;color:#7d76a3;line-height:1.6;margin-top:26px;">
                  This link works once and expires in 15 minutes.<br />
                  If you didn't request it, you can safely ignore this email.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
