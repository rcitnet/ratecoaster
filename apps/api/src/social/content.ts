export type SocialCandidate = {
  kind: "shortest-waits" | "hotel-deal";
  fingerprint: string;
  body: string;
  url: string;
  sourceObservedAt: Date | null;
  expiresAt: Date;
};

export type ShortWait = { name: string; minutes: number };

function compact(value: string, max = 40): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

export function buildWaitPost(input: {
  parkName: string;
  parkSlug: string;
  waits: ShortWait[];
  observedAt: Date;
  timezone: string;
  dataSource: string;
  hourKey: string;
  siteUrl: string;
  expiresAt: Date;
}): SocialCandidate {
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: input.timezone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(input.observedAt);
  const lines = input.waits.slice(0, 3).map((wait) => `• ${compact(wait.name, 28)}: ${wait.minutes}m`);
  const body = [
    `🎢 ${compact(input.parkName, 28)} shortest now:`,
    ...lines,
    `${time} • Data: ${input.dataSource}`,
  ].join("\n");

  return {
    kind: "shortest-waits",
    fingerprint: `shortest-waits:${input.parkSlug}:${input.hourKey}`,
    body,
    url: `${input.siteUrl}/waits?park=${encodeURIComponent(input.parkSlug)}`,
    sourceObservedAt: input.observedAt,
    expiresAt: input.expiresAt,
  };
}

export function buildHotelDealPost(input: {
  tierLabel: string;
  propertyName: string;
  propertySlug: string;
  stayDate: string;
  nightlyCents: number;
  rateCode: "STANDARD" | "APH";
  rateLabel: string;
  dateKey: string;
  siteUrl: string;
  observedAt: Date;
  expiresAt: Date;
}): SocialCandidate {
  const date = new Date(`${input.stayDate}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const dollars = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: input.nightlyCents % 100 === 0 ? 0 : 2,
  }).format(input.nightlyCents / 100);

  return {
    kind: "hotel-deal",
    fingerprint: `hotel-deal:${input.dateKey}:${input.tierLabel}:${input.rateCode}`,
    body:
      `🏨 ${input.tierLabel} deal: ${compact(input.propertyName, 42)} — ` +
      `${dollars}/night on ${date}. ${input.rateLabel}. ` +
      "Near its collected low; verify price at checkout.",
    url:
      `${input.siteUrl}/hotels/${encodeURIComponent(input.propertySlug)}` +
      `?stayDate=${encodeURIComponent(input.stayDate)}&rateCode=${input.rateCode}`,
    sourceObservedAt: input.observedAt,
    expiresAt: input.expiresAt,
  };
}

export function renderSocialText(candidate: Pick<SocialCandidate, "body" | "url">): string {
  return `${candidate.body}\n\n${candidate.url}`;
}
