import type { Tier } from "@parkpulse/shared";

/**
 * Types for the values the auth middleware puts on every request context.
 *
 * Without this augmentation `c.get("tier")` is typed `never`, so every gating
 * call site would need a cast — and a cast is exactly the wrong tool for the
 * value that decides what a user is allowed to see.
 */
declare module "hono" {
  interface ContextVariableMap {
    tier: Tier;
    user: {
      userId: string;
      email: string | null;
      displayName: string | null;
      createdAt: Date;
    } | null;
  }
}

export {};
