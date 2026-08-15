import { backoffDelay, bucketForHost, sleep } from "./limiter.js";

export interface FetchOptions extends RequestInit {
  /** Requests per minute allowed to this host. Defaults to COLLECTOR_MAX_RPM. */
  rpm?: number;
  /** Total attempts including the first. */
  maxAttempts?: number;
  timeoutMs?: number;
  /** Stable key identifying this request, used for caching and raw snapshots. */
  requestKey?: string;
  /** Skip the dry-run guard. Only for free public APIs that welcome traffic. */
  alwaysSend?: boolean;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    readonly body: string
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = "HttpError";
  }
}

/** Status codes worth retrying. 429 and 5xx are transient; 4xx generally is not. */
function isRetryable(status: number): boolean {
  return status === 408 || status === 429 || status === 425 || status >= 500;
}

function env(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export interface FetchResult {
  status: number;
  body: string;
  headers: Headers;
  url: string;
  /** True when the dry-run guard short-circuited the request. */
  skipped: boolean;
}

/**
 * The single outbound HTTP path for every collector.
 *
 * Centralizing this is what makes the politeness guarantees actually true. If
 * an adapter could call `fetch` directly, the global rate limit, the honest
 * user-agent, the Retry-After handling, and the dry-run guard would all be
 * suggestions rather than invariants.
 */
export async function politeFetch(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const {
    rpm = Number(env("COLLECTOR_MAX_RPM", "30")),
    maxAttempts = 4,
    timeoutMs = 20_000,
    alwaysSend = false,
    ...init
  } = options;

  const target = new URL(url);

  // Dry run exists so the first thing you do with a new adapter is *not* to
  // send 16,000 requests at someone's booking engine because of a typo in a
  // loop bound. Flip COLLECTOR_DRY_RUN off deliberately.
  const dryRun = env("COLLECTOR_DRY_RUN", "1") === "1";
  if (dryRun && !alwaysSend) {
    console.log(`[dry-run] ${init.method ?? "GET"} ${url}`);
    return { status: 0, body: "", headers: new Headers(), url, skipped: true };
  }

  const headers = new Headers(init.headers);
  if (!headers.has("user-agent")) {
    // Identify honestly and give the operator a way to contact you. Pretending
    // to be a browser is both a worse engineering choice — you lose the signal
    // when they change something — and a worse-faith one.
    headers.set("user-agent", env("COLLECTOR_USER_AGENT", "ParkPulseBot/0.1"));
  }
  if (!headers.has("accept")) headers.set("accept", "application/json, text/html;q=0.9");
  headers.set("accept-encoding", "gzip, deflate");

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await bucketForHost(target.host, rpm).take();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...init, headers, signal: controller.signal });
      const body = await res.text();

      if (res.ok) {
        return { status: res.status, body, headers: res.headers, url, skipped: false };
      }

      if (!isRetryable(res.status) || attempt === maxAttempts - 1) {
        throw new HttpError(res.status, url, body.slice(0, 2000));
      }

      // Honour Retry-After when the origin bothers to tell us. Ignoring it is
      // how a soft throttle escalates into a hard ban.
      const retryAfter = res.headers.get("retry-after");
      const waitMs = retryAfter
        ? Number(retryAfter) * 1000 || backoffDelay(attempt)
        : backoffDelay(attempt);
      console.warn(`[http] ${res.status} ${url} — retrying in ${Math.round(waitMs)}ms`);
      await sleep(waitMs);
      lastError = new HttpError(res.status, url, body.slice(0, 500));
    } catch (err) {
      lastError = err;
      if (err instanceof HttpError) throw err;
      if (attempt === maxAttempts - 1) break;
      const waitMs = backoffDelay(attempt);
      console.warn(`[http] ${String(err)} — retrying in ${Math.round(waitMs)}ms`);
      await sleep(waitMs);
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`request failed: ${url}`);
}

export async function fetchJson<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<T | null> {
  const res = await politeFetch(url, options);
  if (res.skipped || !res.body) return null;
  try {
    return JSON.parse(res.body) as T;
  } catch {
    throw new Error(
      `Expected JSON from ${url} but got ${res.body.slice(0, 200)}${res.body.length > 200 ? "…" : ""}`
    );
  }
}
