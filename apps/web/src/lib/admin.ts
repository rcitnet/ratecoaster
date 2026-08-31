import type { HeroVariant } from "@ratecoaster/shared";
import { apiFetch, getMe } from "./api";

/**
 * Admin data access. Every call goes through the same session-forwarding fetch
 * as the public pages, so the server-side `requireAdmin` gate is the only thing
 * granting access — the UI never decides for itself.
 */

export interface AdminCollector {
  name: string;
  description: string;
  intervalMinutes: number;
  enabled: boolean;
  dryRun: boolean;
  ready: boolean;
  notReadyReason: string | null;
  lastRun: {
    status: string;
    startedAt: string;
    parsedCount: number;
    writtenCount: number;
    errorCount: number;
    ageMinutes: number;
  } | null;
}

export interface AdminSource {
  id: string;
  name: string;
  host: string;
  coverage: string;
  configured: boolean;
  configuration: string;
}

export interface AdminProperty {
  id: string;
  slug: string;
  name: string;
  destination: string;
  tier: string;
  operator: string;
  includesExpressPass: boolean;
  earlyParkAdmission: boolean;
  roomCount: number | null;
  active: boolean;
  collectorConfig: Record<string, unknown> | null;
}

export interface AdminUser {
  id: string;
  email: string | null;
  tier: string;
  createdAt: string;
  lastSeenAt: string | null;
}

export interface AdminOverview {
  counts: { rates: number; waits: number; users: number; properties: number };
  silentFailures: number;
  liveCollectors: number;
  recentRuns: Array<{
    collector: string;
    status: string;
    startedAt: string;
    parsedCount: number;
    writtenCount: number;
    errorCount: number;
  }>;
}

export interface AdminSocialSetting {
  platform: "threads" | "bluesky" | "x";
  enabled: boolean;
  dryRun: boolean;
  configured: boolean;
  automatic: boolean;
  detail: string;
}

export interface AdminSocialDelivery {
  postId: string;
  kind: string;
  body: string;
  url: string | null;
  fullText: string;
  sourceObservedAt: string | null;
  expiresAt: string;
  createdAt: string;
  deliveryId: string | null;
  platform: "threads" | "bluesky" | "x" | null;
  status: "pending" | "claimed" | "published" | "failed" | "cancelled" | null;
  attempts: number | null;
  lastError: string | null;
  externalUrl: string | null;
  publishedAt: string | null;
}

export interface AdminSocial {
  settings: AdminSocialSetting[];
  deliveries: AdminSocialDelivery[];
}

/** True only if the server says so. Never inferred client-side. */
export async function isAdmin(): Promise<boolean> {
  const me = await getMe();
  return me.entitlements.admin === true;
}

export interface AdminHomepage {
  heroVariant: HeroVariant;
  updatedAt: string | null;
}

export const getHomepage = () =>
  apiFetch<AdminHomepage>("/v1/admin/homepage", { heroVariant: "current", updatedAt: null });

export const getOverview = () =>
  apiFetch<AdminOverview>("/v1/admin/overview", {
    counts: { rates: 0, waits: 0, users: 0, properties: 0 },
    silentFailures: 0,
    liveCollectors: 0,
    recentRuns: [],
  });

export const getCollectors = () => apiFetch<AdminCollector[]>("/v1/admin/collectors", []);
export const getSources = () => apiFetch<AdminSource[]>("/v1/admin/sources", []);
export const getProperties = () => apiFetch<AdminProperty[]>("/v1/admin/properties", []);
export const getUsers = () => apiFetch<AdminUser[]>("/v1/admin/users", []);
export const getSocial = () =>
  apiFetch<AdminSocial>("/v1/admin/social", { settings: [], deliveries: [] });
export const getAudit = () =>
  apiFetch<Array<{ at: string; email: string | null; action: string; target: string | null }>>(
    "/v1/admin/audit",
    []
  );
