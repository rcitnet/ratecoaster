import { z } from "zod";
import { Attribution, ApiError } from "./schemas/common.js";
import {
  CurrentRate,
  Deal,
  Property,
  RateFilterOptions,
  RateHistoryPoint,
  type RateQuery,
} from "./schemas/hotels.js";
import {
  ExpressPassPrice,
  PriceCalendarDay,
  TicketProduct,
  type ExpressPassQuery,
  type TicketQuery,
} from "./schemas/tickets.js";
import { LiveWaitsResponse, WaitRollupPoint, type WaitQuery } from "./schemas/waits.js";
import { CreateWatch, Watch } from "./schemas/alerts.js";
import { Entitlements, GateInfo, SessionUser } from "./schemas/auth.js";
import { TripQuote, type TripQuoteQuery } from "./schemas/trips.js";

export class RateCoasterApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "RateCoasterApiError";
  }
}

export interface ClientOptions {
  baseUrl: string;
  /** Bearer token for authenticated endpoints (watches, push registration). */
  getToken?: () => string | null | Promise<string | null>;
  fetch?: typeof globalThis.fetch;
}

/**
 * A single typed client shared by the Next.js web app and the Expo mobile app.
 *
 * The point of putting this in `packages/shared` rather than in the web app is
 * that a change to a response shape becomes a *compile error* in both clients
 * at once. That is the whole reason for choosing a TypeScript monorepo when a
 * mobile companion is on the roadmap.
 */
export class RateCoasterClient {
  private readonly baseUrl: string;
  private readonly doFetch: typeof globalThis.fetch;

  constructor(private readonly opts: ClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.doFetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private async request<T extends z.ZodTypeAny>(
    path: string,
    schema: T,
    init?: RequestInit & { query?: Record<string, unknown> }
  ): Promise<z.infer<T>> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(init?.query ?? {})) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }

    const headers = new Headers(init?.headers);
    headers.set("accept", "application/json");
    if (init?.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    const token = await this.opts.getToken?.();
    if (token) headers.set("authorization", `Bearer ${token}`);

    const res = await this.doFetch(url.toString(), { ...init, headers });
    const text = await res.text();
    const json: unknown = text ? JSON.parse(text) : null;

    if (!res.ok) {
      const parsed = ApiError.safeParse(json);
      throw new RateCoasterApiError(
        res.status,
        parsed.success ? parsed.data.error.code : "unknown",
        parsed.success ? parsed.data.error.message : res.statusText,
        parsed.success ? parsed.data.error.details : json
      );
    }

    // Parsing the response against the same schema the server validated with
    // turns a silent backend contract break into a loud, local failure.
    return schema.parse(json);
  }

  // ---- Hotels ----

  listProperties(destination?: string) {
    return this.request("/v1/properties", z.array(Property), {
      query: { destination },
    });
  }

  listRates(query: Partial<RateQuery>) {
    return this.request(
      "/v1/rates",
      z.object({
        items: z.array(CurrentRate),
        attribution: z.array(Attribution),
        // Zod strips unknown keys, so the gate must be declared here or the
        // paywall information would be silently discarded before reaching the UI.
        gate: GateInfo.optional(),
      }),
      { query: query as Record<string, unknown> }
    );
  }

  rateFilterOptions(query: { destination?: string; propertySlug?: string }) {
    return this.request("/v1/rates/options", RateFilterOptions, { query });
  }

  rateHistory(propertySlug: string, stayDate: string, rateCode = "APH", roomTypeId?: string) {
    return this.request(
      `/v1/rates/${encodeURIComponent(propertySlug)}/history`,
      z.array(RateHistoryPoint),
      { query: { stayDate, rateCode, roomTypeId } }
    );
  }

  listDeals(params: { destination?: string; nights?: number; limit?: number } = {}) {
    return this.request("/v1/deals", z.array(Deal), { query: params });
  }

  // ---- Tickets & Express ----

  listTicketProducts(destination?: string) {
    return this.request("/v1/tickets/products", z.array(TicketProduct), {
      query: { destination },
    });
  }

  ticketCalendar(query: Partial<TicketQuery>) {
    return this.request("/v1/tickets/calendar", z.array(PriceCalendarDay), {
      query: query as Record<string, unknown>,
    });
  }

  expressPassCalendar(query: Partial<ExpressPassQuery>) {
    return this.request("/v1/express-pass", z.array(ExpressPassPrice), {
      query: query as Record<string, unknown>,
    });
  }

  // ---- Waits ----

  liveWaits(query: Partial<WaitQuery> = {}) {
    return this.request("/v1/waits/live", LiveWaitsResponse, {
      query: query as Record<string, unknown>,
    });
  }

  waitRollup(attractionSlug: string) {
    return this.request(
      `/v1/waits/${encodeURIComponent(attractionSlug)}/typical`,
      z.array(WaitRollupPoint)
    );
  }

  // ---- Trip planning ----

  tripQuote(query: TripQuoteQuery) {
    return this.request("/v1/trips/quote", TripQuote, {
      query: query as unknown as Record<string, unknown>,
    });
  }

  // ---- Auth ----

  me() {
    return this.request(
      "/v1/auth/me",
      z.object({ user: SessionUser.nullable(), entitlements: Entitlements })
    );
  }

  requestMagicLink(email: string, redirectTo?: string) {
    return this.request(
      "/v1/auth/magic-link",
      z.object({ ok: z.boolean(), message: z.string(), demo: z.boolean().optional() }),
      { method: "POST", body: JSON.stringify({ email, redirectTo }) }
    );
  }

  logout() {
    return this.request("/v1/auth/logout", z.object({ ok: z.boolean() }), { method: "POST" });
  }

  // ---- Watches (auth required) ----

  listWatches() {
    return this.request("/v1/watches", z.array(Watch));
  }

  createWatch(body: CreateWatch) {
    return this.request("/v1/watches", Watch, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  deleteWatch(id: string) {
    return this.request(`/v1/watches/${encodeURIComponent(id)}`, z.object({ ok: z.boolean() }), {
      method: "DELETE",
    });
  }

  registerPush(body: { channel: string; token: string; platform: string }) {
    return this.request("/v1/push/register", z.object({ ok: z.boolean() }), {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
}
