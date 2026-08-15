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

export interface AdminEndpoint {
  name: string;
  configured: boolean;
  notes: string | null;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
  updatedAt: string | null;
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

/** True only if the server says so. Never inferred client-side. */
export async function isAdmin(): Promise<boolean> {
  const me = await getMe();
  return me.entitlements.admin === true;
}

export const getOverview = () =>
  apiFetch<AdminOverview>("/v1/admin/overview", {
    counts: { rates: 0, waits: 0, users: 0, properties: 0 },
    silentFailures: 0,
    liveCollectors: 0,
    recentRuns: [],
  });

export const getCollectors = () => apiFetch<AdminCollector[]>("/v1/admin/collectors", []);
export const getEndpoints = () => apiFetch<AdminEndpoint[]>("/v1/admin/endpoints", []);
export const getProperties = () => apiFetch<AdminProperty[]>("/v1/admin/properties", []);
export const getUsers = () => apiFetch<AdminUser[]>("/v1/admin/users", []);
export const getAudit = () =>
  apiFetch<Array<{ at: string; email: string | null; action: string; target: string | null }>>(
    "/v1/admin/audit",
    []
  );
