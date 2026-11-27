const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_TOKEN_RE = /^(?:ExponentPushToken|ExpoPushToken)\[[^\s\]]+\]$/;

export function isValidExpoPushToken(token: string): boolean {
  return EXPO_TOKEN_RE.test(token.trim());
}

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface ExpoPushDeliveryResult {
  sent: number;
  failed: number;
  unregisteredTokens: string[];
  errors: string[];
}

export async function sendExpoPushMessages(
  messages: ExpoPushMessage[],
  fetchImpl: typeof globalThis.fetch = globalThis.fetch
): Promise<ExpoPushDeliveryResult> {
  if (messages.length === 0) {
    return { sent: 0, failed: 0, unregisteredTokens: [], errors: [] };
  }

  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  };
  const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim();
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;

  const unregisteredTokens: string[] = [];
  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  // Expo accepts up to 100 messages per HTTP request.
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const res = await fetchImpl(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify(batch),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: Array<{
          status?: string;
          message?: string;
          details?: { error?: string };
        }>;
      } | null;

      if (!res.ok || !Array.isArray(json?.data)) {
        failed += batch.length;
        errors.push(`Expo push API HTTP ${res.status}`);
        continue;
      }

      json.data.forEach((ticket, idx) => {
        if (ticket.status === "ok") {
          sent++;
        } else {
          failed++;
          const code = ticket.details?.error;
          if (code === "DeviceNotRegistered") {
            unregisteredTokens.push(batch[idx]!.to);
          }
          errors.push(ticket.message ?? code ?? "Expo push rejected");
        }
      });
    } catch (err) {
      failed += batch.length;
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return { sent, failed, unregisteredTokens, errors };
}
