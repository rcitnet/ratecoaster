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

/**
 * Values that mean "not filled in yet".
 *
 * Without this check a placeholder is treated as a real key, the send fails at
 * the provider, and the user is told delivery went wrong — when in truth the
 * feature was never switched on. Wrong diagnosis, wrong place to look.
 */
function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  const v = value.trim();
  if (v === "") return true;
  return /^(change_?me|your[-_]?key|placeholder|todo|xxx+)/i.test(v);
}

export function emailConfigured(): boolean {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (isPlaceholder(key) || isPlaceholder(from)) return false;
  // Resend keys all start with re_. Catching this here turns a confusing 401
  // from the provider into a clear "not configured" locally.
  if (!key!.startsWith("re_")) {
    console.error(
      "[email] RESEND_API_KEY does not start with 're_' — treating email as unconfigured."
    );
    return false;
  }
  return true;
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

export interface PriceDropEmail {
  to: string;
  hotelName: string;
  checkIn: string;
  checkOut: string;
  /** Whole-stay total, in cents. */
  currentCents: number;
  previousCents: number | null;
  rateLabel: string;
  /** Deep link back to the exact page that shows this. */
  url: string;
}

/**
 * The alert people signed up for.
 *
 * Subject line leads with the saving rather than the brand, because that is the
 * only thing that decides whether this gets opened — and an unopened price
 * alert is worse than none, since it trains the recipient to ignore the next.
 */
export async function sendPriceDropEmail(input: PriceDropEmail): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const siteName = process.env.SITE_NAME ?? "RateCoaster";

  if (!apiKey || !from) {
    return { sent: false, reason: "RESEND_API_KEY or EMAIL_FROM is not set" };
  }

  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const saving = input.previousCents !== null ? input.previousCents - input.currentCents : null;
  const accountUrl = new URL("/account", input.url).toString();

  const subject =
    saving && saving > 0
      ? `${money(saving)} off your ${input.hotelName} dates`
      : `${input.hotelName} is now ${money(input.currentCents)}`;

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: input.to,
      subject,
      html: priceDropHtml(input, siteName, saving),
      text:
        `${input.hotelName}\n${input.checkIn} to ${input.checkOut} · ${input.rateLabel}\n\n` +
        `Now ${money(input.currentCents)} for the stay` +
        (saving && saving > 0 ? `, down ${money(saving)}.` : ".") +
        `\n\n${input.url}\n\n` +
        `Prices are observations, not quotes — confirm on the official site before booking.\n` +
        `Manage or stop these alerts: ${accountUrl}\n`,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { sent: false, reason: `Resend returned ${res.status}: ${body.slice(0, 300)}` };
  }
  return { sent: true };
}

function priceDropHtml(input: PriceDropEmail, siteName: string, saving: number | null): string {
  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const accountUrl = `${input.url.split("/hotels")[0]}/account`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#fff9f2;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px;">
          <tr><td>
            <div style="font-size:22px;font-weight:700;color:#16123c;margin-bottom:20px;">${siteName}</div>
            <div style="font-size:20px;font-weight:600;color:#16123c;margin-bottom:6px;">
              ${saving && saving > 0 ? `The price dropped ${money(saving)}` : "Your watched dates moved"}
            </div>
            <div style="font-size:15px;color:#4a4470;line-height:1.6;margin-bottom:22px;">
              ${input.hotelName}<br />
              ${input.checkIn} to ${input.checkOut} · ${input.rateLabel}
            </div>
            <div style="background:#e8fbf7;border-radius:12px;padding:18px;margin-bottom:24px;">
              <div style="font-size:13px;font-weight:700;color:#077368;letter-spacing:0.5px;">NOW</div>
              <div style="font-size:32px;font-weight:700;color:#077368;">${money(input.currentCents)}</div>
              ${
                input.previousCents !== null
                  ? `<div style="font-size:13px;color:#4a4470;">was ${money(input.previousCents)} for the whole stay</div>`
                  : `<div style="font-size:13px;color:#4a4470;">for the whole stay</div>`
              }
            </div>
            <a href="${input.url}"
               style="display:inline-block;background:#e6218c;color:#ffffff;text-decoration:none;
                      padding:14px 28px;border-radius:999px;font-weight:600;font-size:16px;">
              See the dates
            </a>
            <div style="font-size:13px;color:#7d76a3;line-height:1.6;margin-top:26px;">
              Prices here are observations, not held quotes — always confirm on the official site
              before booking.<br /><br />
              <a href="${accountUrl}" style="color:#7d76a3;">Manage or stop these alerts</a>
            </div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
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
