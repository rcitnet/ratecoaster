import { useEffect, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { Deal, LiveWaitsResponse } from "@ratecoaster/shared";
import { api, messageFrom } from "@/api";
import { Hero, Loading, Screen, Section } from "@/components/ui";
import { money, shortDate } from "@/format";
import { colors } from "@/theme";

export function HomeScreen({ navigation }: { navigation: any }) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [waits, setWaits] = useState<LiveWaitsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(refresh = false) {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [nextDeals, nextWaits] = await Promise.all([
        api.listDeals({ destination: "universal-orlando", limit: 5 }),
        api.liveWaits({ destination: "universal-orlando", ridesOnly: true }),
      ]);
      setDeals(nextDeals);
      setWaits(nextWaits);
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const operating = waits?.parks.flatMap((park) => park.waits).filter((ride) => ride.status === "operating" && ride.waitMinutes !== null) ?? [];
  const average = operating.length ? Math.round(operating.reduce((sum, ride) => sum + (ride.waitMinutes ?? 0), 0) / operating.length) : null;

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.blue} />}>
      <Hero eyebrow="Universal trip intelligence" title="Spend less. Wait less. Ride more." copy="Live park conditions and complete trip pricing, built as a real Android app." />

      <View style={styles.shortcuts}>
        {[
          ["Plan a trip", "PlanTab", colors.blueTint],
          ["Live waits", "WaitsTab", colors.tealTint],
          ["Tickets", "ExploreTab", colors.coralTint],
        ].map(([label, tab, backgroundColor]) => (
          <Pressable key={label} style={[styles.shortcut, { backgroundColor }]} onPress={() => navigation.navigate(tab)}>
            <Text style={styles.shortcutText}>{label}</Text>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        ))}
      </View>

      {loading ? <Loading label="Checking prices and parks…" /> : error ? <Section title="Couldn’t refresh"><Text style={styles.copy}>{error}</Text></Section> : (
        <>
          <Section title="Park pulse" action={<Pressable onPress={() => navigation.navigate("WaitsTab")}><Text style={styles.link}>See waits</Text></Pressable>}>
            <Text style={styles.big}>{average === null ? "—" : `${average} min`}</Text>
            <Text style={styles.copy}>Average posted wait across {operating.length} operating rides.</Text>
            <View style={styles.parkRow}>
              {waits?.parks.map(({ park, waits: parkWaits }) => {
                const open = parkWaits.filter((ride) => ride.status === "operating" && ride.waitMinutes !== null);
                const avg = open.length ? Math.round(open.reduce((sum, ride) => sum + (ride.waitMinutes ?? 0), 0) / open.length) : null;
                return <View key={park.id} style={styles.park}><Text numberOfLines={2} style={styles.parkName}>{park.name}</Text><Text style={styles.parkWait}>{avg === null ? "Closed" : `${avg}m avg`}</Text></View>;
              })}
            </View>
          </Section>

          <Section title="Best hotel finds" action={<Pressable onPress={() => navigation.navigate("ExploreTab", { screen: "Hotels" })}><Text style={styles.link}>All hotels</Text></Pressable>}>
            {deals.length ? deals.map((deal) => (
              <View key={`${deal.propertyId}-${deal.stayDate}`} style={styles.deal}>
                <View style={{ flex: 1 }}><Text style={styles.dealName}>{deal.propertyName}</Text><Text style={styles.copy}>{shortDate(deal.stayDate)} · {deal.rateCode}{deal.includesExpressPass ? " · Express included" : ""}</Text></View>
                <View><Text style={styles.dealPrice}>{money(deal.nightlyCents)}</Text><Text style={styles.perNight}>per night</Text></View>
              </View>
            )) : <Text style={styles.copy}>No current deal observations are available.</Text>}
          </Section>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  shortcuts: { gap: 9 },
  shortcut: { minHeight: 55, borderRadius: 17, paddingHorizontal: 17, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  shortcutText: { color: colors.ink, fontWeight: "900", fontSize: 16 },
  arrow: { color: colors.ink, fontSize: 28 },
  link: { color: colors.blue, fontWeight: "800" },
  big: { color: colors.teal, fontWeight: "900", fontSize: 36 },
  copy: { color: colors.soft, lineHeight: 20 },
  parkRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  park: { width: "48%", backgroundColor: colors.cream, borderRadius: 13, padding: 11, gap: 4 },
  parkName: { color: colors.ink, fontWeight: "800", minHeight: 35 },
  parkWait: { color: colors.teal, fontWeight: "900" },
  deal: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, gap: 10 },
  dealName: { color: colors.ink, fontWeight: "800", fontSize: 15 },
  dealPrice: { color: colors.ink, fontWeight: "900", textAlign: "right", fontSize: 18 },
  perNight: { color: colors.mute, fontSize: 11, textAlign: "right" },
});
