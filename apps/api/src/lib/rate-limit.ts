import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context, MiddlewareHandler } from "hono";

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * A fixed-window store for this single-process API.
 *
 * RateCoaster currently runs one API service, so an external cache would add
 * more operational risk than resilience. If the API is ever scaled to several
 * processes, this interface is the seam to replace with a shared store.
 */
export class MemoryRateLimitStore {
  private readonly buckets = new Map<string, Bucket>();
  private checks = 0;

  take(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitDecision {
    if (!Number.isInteger(limit) || limit < 1) throw new Error("rate limit must be positive");
    if (!Number.isFinite(windowMs) || windowMs < 1) throw new Error("rate window must be positive");

    if (++this.checks % 1_024 === 0) this.prune(now);

    const existing = this.buckets.get(key);
    const bucket = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : existing;

    const allowed = bucket.count < limit;
    if (allowed) bucket.count++;
    this.buckets.set(key, bucket);

    return {
      allowed,
      limit,
      remaining: Math.max(0, limit - bucket.count),
      resetAt: bucket.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
    };
  }

  prune(now = Date.now()): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

const sharedStore = new MemoryRateLimitStore();

function normalizedIp(value: string | undefined): string | null {
  if (!value) return null;
  let candidate = value.trim();
  if (candidate.startsWith("[")) {
    const closing = candidate.indexOf("]");
    if (closing > 0) candidate = candidate.slice(1, closing);
  } else if (candidate.includes(":")) {
    const ipv4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(candidate);
    if (ipv4WithPort) candidate = ipv4WithPort[1]!;
  }
  if (candidate.startsWith("::ffff:")) candidate = candidate.slice(7);
  return isIP(candidate) ? candidate : null;
}

function isLoopback(address: string | null): boolean {
  return address === "127.0.0.1" || address === "::1";
}

/**
 * Trust proxy headers only when the direct peer is the local reverse proxy.
 * Using the last X-Forwarded-For entry matches Caddy's appended client address
 * and avoids letting a public direct caller choose an arbitrary bucket.
 */
export function clientIp(c: Context): string {
  let peer: string | null = null;
  try {
    peer = normalizedIp(getConnInfo(c).remote.address);
  } catch {
    // Synthetic app.request() calls have no socket. Tests may still supply the
    // same proxy header Caddy uses in production.
  }

  if (!peer || isLoopback(peer)) {
    const forwarded = c.req.header("x-forwarded-for")
      ?.split(",")
      .map((part) => normalizedIp(part))
      .filter((part): part is string => Boolean(part));
    const fromProxy = forwarded?.at(-1);
    if (fromProxy) return fromProxy;
  }

  return peer ?? "unknown";
}

/** Keep email addresses and other identifiers out of the in-memory key map. */
export function opaqueRateLimitKey(namespace: string, value: string): string {
  const digest = createHash("sha256").update(value.trim().toLowerCase()).digest("base64url");
  return `${namespace}:${digest}`;
}

export interface RateLimitOptions {
  namespace: string;
  limit: number;
  windowMs: number;
  store?: MemoryRateLimitStore;
  message?: string;
}

function applyHeaders(c: Context, decision: RateLimitDecision): void {
  c.header("RateLimit-Limit", String(decision.limit));
  c.header("RateLimit-Remaining", String(decision.remaining));
  c.header("RateLimit-Reset", String(decision.retryAfterSeconds));
}

export function enforceRateLimit(
  c: Context,
  key: string,
  options: Omit<RateLimitOptions, "namespace">
): Response | null {
  const decision = (options.store ?? sharedStore).take(
    key,
    options.limit,
    options.windowMs
  );
  applyHeaders(c, decision);
  if (decision.allowed) return null;

  c.header("Retry-After", String(decision.retryAfterSeconds));
  return c.json(
    {
      error: {
        code: "rate_limited",
        message: options.message ?? "Too many requests. Please wait a moment and try again.",
      },
    },
    429
  );
}

export function rateLimitByIp(options: RateLimitOptions): MiddlewareHandler {
  return async (c, next) => {
    const response = enforceRateLimit(c, `${options.namespace}:ip:${clientIp(c)}`, options);
    if (response) return response;
    await next();
  };
}
