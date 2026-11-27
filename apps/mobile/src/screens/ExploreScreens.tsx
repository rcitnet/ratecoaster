import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GUIDES, type CrowdCalendarDay, type CurrentRate, type ExpressPassPrice, type ExpressPassProduct, type PriceCalendarDay, type Property, type TicketProduct } from "@ratecoaster/shared";
import { api, messageFrom } from "@/api";
import { Button, Chip, Empty, Hero, Loading, Screen, Section } from "@/components/ui";
import { isoFromNow, money, shortDate } from "@/format";
import { colors } from "@/theme";

const menu = [
  { screen: "Hotels", icon: "🏨", title: "Hotels", copy: "Nightly rates, tiers, APH pricing, and included benefits", color: colors.blueTint },
  { screen: "Tickets", icon: "🎟️", title: "Park tickets", copy: "Date-based admission and Undercover Tourist links", color: colors.coralTint },
  { screen: "Express", icon: "⚡", title: "Express Pass", copy: "Compare Standard and Unlimited by date", color: colors.yellowTint },
  { screen: "Crowds", icon: "📅", title: "Crowd calendar", copy: "Demand signals from tickets, hotels, and Express", color: colors.tealTint },
  { screen: "Guides", icon: "📚", title: "Planning guides", copy: "Practical answers built from the same RateCoaster data", color: "#f1eaff" },
];

export function ExploreScreen({ navigation }: { navigation: any }) {
  return <Screen><Hero eyebrow="Explore every tool" title="Your Universal toolkit" copy="The website’s planning information, organized for thumb-friendly native navigation." />{menu.map((item) => <Pressable key={item.screen} onPress={() => navigation.navigate(item.screen)} style={[styles.menu, { backgroundColor: item.color }]}><Text style={styles.menuIcon}>{item.icon}</Text><View style={{ flex: 1 }}><Text style={styles.menuTitle}>{item.title}</Text><Text style={styles.menuCopy}>{item.copy}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}</Screen>;
}

export function HotelsScreen() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [rates, setRates] = useState<CurrentRate[]>([]);
  const [rateCode, setRateCode] = useState<"STANDARD" | "APH">("STANDARD");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load(code = rateCode) {
    setLoading(true); setError("");
    try {
      const [nextProperties, response] = await Promise.all([
        api.listProperties("universal-orlando"),
        api.listRates({ destination: "universal-orlando", rateCode: code, from: isoFromNow(1), to: isoFromNow(180), limit: 300 }),
      ]);
      setProperties(nextProperties); setRates(response.items);
    } catch (caught) { setError(messageFrom(caught)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  function changeCode(code: "STANDARD" | "APH") { setRateCode(code); void load(code); }
  const best = useMemo(() => properties.map((property) => ({ property, rate: rates.filter((rate) => rate.propertyId === property.id && rate.available).sort((a, b) => a.nightlyCents - b.nightlyCents)[0] })).sort((a, b) => (a.rate?.nightlyCents ?? Infinity) - (b.rate?.nightlyCents ?? Infinity)), [properties, rates]);
  return <Screen><Hero eyebrow="Universal Orlando resorts" title="Hotel price explorer" copy="Compare the lowest available dates while keeping hotel tier, rate plan, and included Express visible." /><View style={styles.row}><Chip label="Standard rates" selected={rateCode === "STANDARD"} onPress={() => changeCode("STANDARD")} /><Chip label="Passholder rates" selected={rateCode === "APH"} onPress={() => changeCode("APH")} /></View>{loading ? <Loading /> : error ? <Empty>{error}</Empty> : best.map(({ property, rate }) => <Section key={property.id} title={property.name}><View style={styles.badges}><Text style={styles.badge}>{property.tier.replaceAll("-", " ")}</Text>{property.includesExpressPass ? <Text style={[styles.badge, styles.expressBadge]}>Express Unlimited included</Text> : null}{property.earlyParkAdmission ? <Text style={styles.badge}>Early entry</Text> : null}</View>{rate ? <View style={styles.priceRow}><View><Text style={styles.muted}>Lowest observed · {shortDate(rate.stayDate)}</Text><Text style={styles.subtle}>{rate.roomTypeName ?? "Room type varies"}</Text></View><View><Text style={styles.price}>{money(rate.nightlyCents)}</Text><Text style={styles.per}>per night</Text></View></View> : <Empty>No current {rateCode} rate observed.</Empty>}</Section>)}</Screen>;
}

export function TicketsScreen() {
  const [products, setProducts] = useState<TicketProduct[]>([]);
  const [selected, setSelected] = useState<TicketProduct | null>(null);
  const [calendar, setCalendar] = useState<PriceCalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { api.listTicketProducts("universal-orlando").then((items) => { setProducts(items); setSelected(items[0] ?? null); }).catch((caught) => setError(messageFrom(caught))).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (!selected) return; setLoading(true); api.ticketCalendar({ destination: "universal-orlando", productSlug: selected.slug, guestCategory: "adult", from: isoFromNow(1), to: isoFromNow(120) }).then(setCalendar).catch((caught) => setError(messageFrom(caught))).finally(() => setLoading(false)); }, [selected]);
  return <Screen><Hero eyebrow="Admission by start date" title="Park ticket prices" copy="Choose the exact ticket first, then compare full-ticket prices across travel dates." /><Section title="Ticket product"><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{products.map((product) => <Chip key={product.id} label={product.name} selected={selected?.id === product.id} onPress={() => setSelected(product)} />)}</ScrollView>{selected?.bookingUrl ? <Button tone="pink" label={selected.bookingMerchant === "undercover-tourist" ? "Check Undercover Tourist" : "Check current price"} onPress={() => void Linking.openURL(selected.bookingUrl!)} /> : null}<Text style={styles.disclosure}>Booking links may be affiliate links. RateCoaster may earn a commission at no extra cost to you.</Text></Section>{loading ? <Loading /> : error ? <Empty>{error}</Empty> : <PriceCalendar days={calendar} />}</Screen>;
}

export function ExpressScreen() {
  const [products, setProducts] = useState<ExpressPassProduct[]>([]);
  const [selected, setSelected] = useState<ExpressPassProduct | null>(null);
  const [prices, setPrices] = useState<ExpressPassPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { api.listExpressPassProducts().then((items) => { setProducts(items); setSelected(items[0] ?? null); }).catch((caught) => setError(messageFrom(caught))).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (!selected) return; setLoading(true); api.expressPassCalendar({ destination: "universal-orlando", productSlug: selected.slug, from: isoFromNow(1), to: isoFromNow(120) }).then(setPrices).catch((caught) => setError(messageFrom(caught))).finally(() => setLoading(false)); }, [selected]);
  return <Screen><Hero eyebrow="The most volatile add-on" title="Express Pass calendar" copy="See the whole-pass amount for each date and compare it with Premier hotel benefits." /><Section title="Express product"><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{products.map((product) => <Chip key={product.id} label={product.name} selected={selected?.id === product.id} onPress={() => setSelected(product)} />)}</ScrollView></Section>{loading ? <Loading /> : error ? <Empty>{error}</Empty> : <Section title="Upcoming prices">{prices.length ? prices.slice(0, 60).map((item) => <View key={item.validDate} style={styles.calendarRow}><View><Text style={styles.date}>{shortDate(item.validDate)}</Text><Text style={styles.subtle}>{item.passType} · {item.parkCount} park{item.parkCount === 1 ? "" : "s"}</Text></View><View><Text style={styles.price}>{money(item.totalCents)}</Text><Text style={styles.per}>{item.available ? "available" : "unavailable"}</Text></View></View>) : <Empty>No Express prices are available for this product.</Empty>}</Section>}</Screen>;
}

function PriceCalendar({ days }: { days: PriceCalendarDay[] }) {
  return <Section title="Upcoming prices">{days.length ? days.slice(0, 60).map((day) => <View key={day.validDate} style={styles.calendarRow}><View><Text style={styles.date}>{shortDate(day.validDate)}</Text><Text style={[styles.band, day.band === "low" && styles.low]}>{day.isWindowLow ? "Lowest in this window" : day.band ? `${day.band} price` : "Observed price"}{day.isEstimated ? " · estimated" : ""}</Text></View><View><Text style={styles.price}>{money(day.totalCents ?? day.priceCents)}</Text><Text style={styles.per}>{day.available ? "full ticket" : "unavailable"}</Text></View></View>) : <Empty>No price observations are available for this product.</Empty>}</Section>;
}

const CROWD_PARKS = [
  ["universal-studios-florida", "Universal Studios"], ["islands-of-adventure", "Islands of Adventure"], ["epic-universe", "Epic Universe"], ["volcano-bay", "Volcano Bay"],
] as const;

export function CrowdsScreen() {
  const [park, setPark] = useState<string>(CROWD_PARKS[0][0]);
  const [days, setDays] = useState<CrowdCalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  function load(slug = park) { setLoading(true); setError(""); api.crowdCalendar({ parkSlug: slug, from: isoFromNow(0), to: isoFromNow(120) }).then((data) => setDays(data.days)).catch((caught) => setError(messageFrom(caught))).finally(() => setLoading(false)); }
  useEffect(() => { load(); }, []);
  function choose(slug: string) { setPark(slug); load(slug); }
  return <Screen><Hero eyebrow="Relative planning signal" title="Crowd calendar" copy="A 1–10 demand score combines the hotel, ticket, and Express observations available for each day." /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{CROWD_PARKS.map(([slug, name]) => <Chip key={slug} label={name} selected={park === slug} onPress={() => choose(slug)} />)}</ScrollView>{loading ? <Loading /> : error ? <Empty>{error}</Empty> : <Section title="Next 120 days">{days.length ? days.map((day) => <View key={day.date} style={styles.calendarRow}><View><Text style={styles.date}>{shortDate(day.date)}</Text><Text style={styles.subtle}>{day.level.replace("-", " ")} · {day.confidence} confidence</Text></View><View style={[styles.score, { backgroundColor: crowdColor(day.score) }]}><Text style={styles.scoreText}>{day.score.toFixed(1)}</Text><Text style={styles.scoreOf}>/10</Text></View></View>) : <Empty>Not enough pricing signals are available yet.</Empty>}<Text style={styles.disclosure}>This is a relative planning score, not a promised wait time.</Text></Section>}</Screen>;
}

function crowdColor(score: number) { return score <= 3 ? colors.tealTint : score <= 6 ? colors.yellowTint : colors.coralTint; }

export function GuidesScreen({ navigation }: { navigation: any }) {
  return <Screen><Hero eyebrow="Make the data useful" title="Planning guides" copy="Straight answers about when to go, what to buy, and how to compare unlike prices." />{GUIDES.map((guide) => <Pressable key={guide.slug} onPress={() => navigation.navigate("Guide", { slug: guide.slug })} style={styles.guide}><View style={{ flex: 1, gap: 5 }}><Text style={styles.guideTitle}>{guide.title}</Text><Text style={styles.menuCopy}>{guide.summary}</Text><Text style={styles.readTime}>{guide.readTime}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}</Screen>;
}

export function GuideScreen({ route }: { route: any }) {
  const guide = GUIDES.find((item) => item.slug === route.params.slug);
  if (!guide) return <Screen><Empty>Guide not found.</Empty></Screen>;
  return <Screen><Hero eyebrow={guide.readTime} title={guide.title} copy={guide.summary} />{guide.sections.map((section) => <Section key={section.heading} title={section.heading}>{section.paragraphs.map((paragraph) => <Text key={paragraph} style={styles.paragraph}>{paragraph}</Text>)}{section.bullets?.map((bullet) => <Text key={bullet} style={styles.bullet}>•  {bullet}</Text>)}</Section>)}</Screen>;
}

const styles = StyleSheet.create({
  menu: { borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", gap: 13 },
  menuIcon: { fontSize: 28 }, menuTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" }, menuCopy: { color: colors.soft, lineHeight: 19 }, chevron: { color: colors.ink, fontSize: 30 },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" }, chips: { gap: 8, paddingRight: 12 }, badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: { backgroundColor: colors.blueTint, color: colors.blue, fontSize: 11, fontWeight: "800", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, textTransform: "capitalize" },
  expressBadge: { backgroundColor: colors.yellowTint, color: "#835e00" }, priceRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-end" },
  muted: { color: colors.soft, fontWeight: "700" }, subtle: { color: colors.mute, fontSize: 12, marginTop: 2 }, price: { color: colors.ink, fontWeight: "900", fontSize: 18, textAlign: "right" }, per: { color: colors.mute, fontSize: 10, textAlign: "right" },
  disclosure: { color: colors.mute, fontSize: 11, lineHeight: 17 }, calendarRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  date: { color: colors.ink, fontWeight: "900", fontSize: 15 }, band: { color: colors.mute, fontSize: 11, textTransform: "capitalize", marginTop: 3 }, low: { color: "#087d72", fontWeight: "800" },
  score: { minWidth: 65, padding: 8, borderRadius: 13, flexDirection: "row", justifyContent: "center", alignItems: "baseline" }, scoreText: { color: colors.ink, fontWeight: "900", fontSize: 20 }, scoreOf: { color: colors.soft, fontSize: 10 },
  guide: { backgroundColor: colors.paper, borderRadius: 19, borderWidth: 1, borderColor: colors.line, padding: 16, flexDirection: "row", alignItems: "center", gap: 8 }, guideTitle: { color: colors.ink, fontWeight: "900", fontSize: 18, lineHeight: 22 }, readTime: { color: colors.magenta, fontWeight: "800", fontSize: 11 },
  paragraph: { color: colors.soft, lineHeight: 23, fontSize: 15 }, bullet: { color: colors.soft, lineHeight: 22, paddingLeft: 4 },
});
