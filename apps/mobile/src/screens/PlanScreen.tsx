import { useEffect, useMemo, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ORIGINS, type FlightQuote, type TripCostDay } from "@ratecoaster/shared";
import { api, messageFrom } from "@/api";
import { Button, Chip, Empty, Hero, Loading, Screen, Section } from "@/components/ui";
import { isoFromNow, money, shortDate } from "@/format";
import { colors } from "@/theme";

type FlightItem = FlightQuote & { historicalLowCents: number | null; stale: boolean };

export function PlanScreen() {
  const [origin, setOrigin] = useState("CHI");
  const [adults, setAdults] = useState("2");
  const [children, setChildren] = useState("0");
  const [nights, setNights] = useState("5");
  const [days, setDays] = useState<TripCostDay[]>([]);
  const [flights, setFlights] = useState<FlightItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function calculate() {
    setLoading(true); setError("");
    const party = Math.max(1, Number(adults) + Number(children));
    const tripNights = Math.max(1, Math.min(21, Number(nights) || 5));
    const from = isoFromNow(7);
    const to = isoFromNow(180);
    try {
      const [cost, flightData] = await Promise.all([
        api.tripCost({ origin, adults: Math.max(1, Number(adults) || 1), children: Math.max(0, Number(children) || 0), nights: tripNights, parkDays: Math.max(1, tripNights - 1), rateCode: "STANDARD", parkToPark: true, from, to, limit: 40 }),
        api.listFlights({ origin, tripLengthDays: tripNights, passengers: party, from, to, limit: 100 }),
      ]);
      setDays(cost.days.filter((day) => day.totalCents !== null).slice(0, 20));
      setFlights(flightData.items);
    } catch (caught) { setError(messageFrom(caught)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void calculate(); }, []);

  const selectedOrigin = useMemo(() => ORIGINS.find((item) => item.code === origin), [origin]);
  const bookingFor = (date: string) => flights.find((flight) => flight.departDate === date)?.bookingUrl ?? null;

  return (
    <Screen>
      <Hero eyebrow="Hotels + tickets + flights" title="Plan the whole trip" copy="Compare complete trip totals without hiding a missing leg or confusing a per-person flight with the family total." />
      <Section title="Your trip">
        <Text style={styles.label}>Flying from · {selectedOrigin?.label}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {ORIGINS.map((item) => <Chip key={item.code} label={`${item.code} · ${item.city}`} selected={origin === item.code} onPress={() => setOrigin(item.code)} />)}
        </ScrollView>
        <View style={styles.fields}>
          <Field label="Adults" value={adults} onChange={setAdults} />
          <Field label="Children" value={children} onChange={setChildren} />
          <Field label="Nights" value={nights} onChange={setNights} />
        </View>
        <Button label={loading ? "Calculating…" : "Compare trip dates"} onPress={() => void calculate()} disabled={loading} />
      </Section>
      {loading ? <Loading label="Combining hotels, admission, and flights…" /> : error ? <Empty>{error}</Empty> : (
        <Section title="Lowest complete trips">
          {days.length ? days.map((day, index) => {
            const bookingUrl = bookingFor(day.startDate);
            return <View key={day.startDate} style={styles.result}>
              <View style={styles.rank}><Text style={styles.rankText}>{index + 1}</Text></View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.date}>{shortDate(day.startDate)} – {shortDate(day.endDate)}</Text>
                <Text style={styles.hotel}>{day.hotelName ?? "Hotel unavailable"}{day.hotelIncludesExpressPass ? " · Express included" : ""}</Text>
                <Text style={styles.detail}>Hotel {money(day.components.hotelCents)} · Tickets {money(day.components.ticketsCents)}</Text>
                <Text style={styles.detail}>Flights {money(day.components.flightsCents)} · {day.airline ?? "airline varies"}{day.transfers === 0 ? " · nonstop" : day.transfers ? ` · ${day.transfers} stop` : ""}</Text>
                {bookingUrl ? <Text onPress={() => void Linking.openURL(bookingUrl)} style={styles.book}>Check live flight ›</Text> : null}
              </View>
              <View><Text style={styles.total}>{money(day.totalCents)}</Text><Text style={styles.pp}>{money(day.perPersonPerDayCents)}/person/day</Text></View>
            </View>;
          }) : <Empty>No complete dates are available for these inputs. Try another origin or party size.</Empty>}
          <Text style={styles.disclosure}>Flight prices are recent cached “from” fares. Hotel, ticket, and flight availability can change; confirm every amount with the seller before purchase.</Text>
        </Section>
      )}
    </Screen>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <View style={{ flex: 1, gap: 6 }}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChange} keyboardType="number-pad" style={styles.input} /></View>;
}

const styles = StyleSheet.create({
  label: { color: colors.soft, fontWeight: "800", fontSize: 12 },
  chips: { gap: 8, paddingRight: 12 },
  fields: { flexDirection: "row", gap: 10 },
  input: { minHeight: 47, borderWidth: 1, borderColor: colors.line, borderRadius: 13, paddingHorizontal: 12, color: colors.ink, fontSize: 16, backgroundColor: colors.cream },
  result: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  rank: { width: 27, height: 27, borderRadius: 14, backgroundColor: colors.blueTint, alignItems: "center", justifyContent: "center" },
  rankText: { color: colors.blue, fontWeight: "900" },
  date: { color: colors.ink, fontWeight: "900", fontSize: 16 },
  hotel: { color: colors.soft, fontSize: 13, fontWeight: "700" },
  detail: { color: colors.mute, fontSize: 12 },
  total: { color: colors.ink, fontWeight: "900", fontSize: 18, textAlign: "right" },
  pp: { color: colors.mute, fontSize: 10, textAlign: "right", maxWidth: 75 },
  book: { color: colors.blue, fontWeight: "900", marginTop: 4 },
  disclosure: { color: colors.mute, fontSize: 11, lineHeight: 17 },
});
