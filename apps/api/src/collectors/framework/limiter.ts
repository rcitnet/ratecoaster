/**
 * Token-bucket rate limiter with per-host buckets.
 *
 * Being a good citizen here is not decoration. A 365-day crawl across a dozen
 * properties is the kind of traffic that gets an IP range blocked, and a block
 * costs you the entire dataset. Pacing to a low, steady rate — well under what
 * the origin would notice — is both the polite choice and the one that keeps
 * the site working next month.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    if (elapsedSeconds <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillPerSecond);
    this.lastRefill = now;
  }

  /** Resolves when a token is available, then consumes it. */
  async take(): Promise<void> {
    for (;;) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const deficit = 1 - this.tokens;
      const waitMs = Math.ceil((deficit / this.refillPerSecond) * 1000);
      await sleep(Math.max(25, waitMs));
    }
  }
}

const buckets = new Map<string, TokenBucket>();

/**
 * One bucket per host. Two collectors hitting the same booking engine share a
 * budget, which is what the *origin* sees — per-collector limits would let N
 * collectors multiply into N times the intended load.
 */
export function bucketForHost(host: string, rpm: number): TokenBucket {
  let bucket = buckets.get(host);
  if (!bucket) {
    // Burst of 5 keeps latency reasonable without letting a backlog dump at once.
    bucket = new TokenBucket(Math.min(5, Math.max(1, rpm)), rpm / 60);
    buckets.set(host, bucket);
  }
  return bucket;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Full jitter exponential backoff (AWS's recommended variant). Randomizing the
 * whole interval rather than adding jitter to it prevents a fleet of retries
 * from re-synchronizing into a thundering herd after a shared outage.
 */
export function backoffDelay(attempt: number, baseMs = 500, capMs = 30_000): number {
  const exponential = Math.min(capMs, baseMs * 2 ** attempt);
  return Math.random() * exponential;
}
