import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { AttractionKind, LiveWait, LiveWaitsResponse } from "@ratecoaster/shared";
import { api, messageFrom } from "@/api";
import { Chip, Empty, Hero, Loading, Screen } from "@/components/ui";
import { relativeTime } from "@/format";
import { rideImageUrl } from "@/rideImages";
import { colors, parkColors } from "@/theme";

export function WaitsScreen({ navigation }: { navigation: any }) {
  const [data, setData] = useState<LiveWaitsResponse | null>(null);
  const [parkSlug, setParkSlug] = useState<string | null>(null);
  const [attractionKind, setAttractionKind] = useState<AttractionKind | null>("ride");
  const [rideType, setRideType] = useState<string | null>(null);
  const [interest, setInterest] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>("wait-asc");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(refresh = false) {
    refresh ? setRefreshing(true) : setLoading(true);
    try { setData(await api.liveWaits({ destination: "universal-orlando", ridesOnly: false })); setError(""); }
    catch (caught) { setError(messageFrom(caught)); }
    finally { setLoading(false); setRefreshing(false); }
  }
  useEffect(() => { void load(); }, []);

  const parkAttractions = useMemo(() => data?.parks
    .filter(({ park }) => !parkSlug || park.slug === parkSlug)
    .flatMap(({ waits }) => waits) ?? [], [data, parkSlug]);

  const availableKinds = useMemo(() => [...new Set(parkAttractions.map((attraction) => attraction.kind))]
    .sort((left, right) => KIND_ORDER.indexOf(left) - KIND_ORDER.indexOf(right)), [parkAttractions]);
  const availableRideTypes = useMemo(() => {
    const types = new Map<string, string>();
    for (const attraction of parkAttractions) {
      for (const type of attraction.attractionTypes) types.set(type.key, type.label);
    }
    return [...types].map(([key, label]) => ({ key, label })).sort((left, right) => left.label.localeCompare(right.label));
  }, [parkAttractions]);
  const availableInterests = useMemo(() => {
    const interests = new Map<string, string>();
    for (const attraction of parkAttractions) {
      for (const item of attraction.interests) interests.set(item.key, item.label);
    }
    return [...interests].map(([key, label]) => ({ key, label })).sort((left, right) => left.label.localeCompare(right.label));
  }, [parkAttractions]);

  useEffect(() => {
    if (attractionKind && data && !availableKinds.includes(attractionKind)) {
      setAttractionKind(null);
    }
  }, [attractionKind, availableKinds, data]);

  useEffect(() => {
    if (rideType && data && !availableRideTypes.some((type) => type.key === rideType)) {
      setRideType(null);
    }
  }, [rideType, availableRideTypes, data]);

  useEffect(() => {
    if (interest && data && !availableInterests.some((item) => item.key === interest)) {
      setInterest(null);
    }
  }, [interest, availableInterests, data]);

  const rides = useMemo(() => parkAttractions
    .filter((attraction) => !attractionKind || attraction.kind === attractionKind)
    .filter((attraction) => !rideType || attraction.attractionTypes.some((type) => type.key === rideType))
    .filter((attraction) => !interest || attraction.interests.some((item) => item.key === interest))
    .filter((attraction) => !query || `${attraction.attractionName} ${attraction.land ?? ""} ${attraction.kind} ${attraction.attractionTypes.map((type) => type.label).join(" ")} ${attraction.interests.map((interest) => interest.label).join(" ")}`.toLowerCase().includes(query.toLowerCase()))
    .sort(sorters[sort]), [parkAttractions, attractionKind, rideType, interest, query, sort]);

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.blue} />}>
      <Hero eyebrow="Updated throughout the day" title="Live attraction waits" copy="Tap any attraction for its typical wait profile and an in-park map." />
      <TextInput value={query} onChangeText={setQuery} placeholder="Search rides or lands" placeholderTextColor={colors.mute} style={styles.search} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        <Chip label="All parks" selected={!parkSlug} onPress={() => setParkSlug(null)} />
        {data?.parks.map(({ park }) => <Chip key={park.id} label={park.name} selected={parkSlug === park.slug} onPress={() => setParkSlug(park.slug)} />)}
      </ScrollView>
      <View style={styles.controls}>
        <Text style={styles.controlLabel}>SORT</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {SORT_OPTIONS.map((option) => <Chip key={option.value} label={option.label} selected={sort === option.value} onPress={() => setSort(option.value)} />)}
        </ScrollView>
        <Text style={styles.controlLabel}>ATTRACTION CATEGORY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <Chip label="All types" selected={!attractionKind} onPress={() => setAttractionKind(null)} />
          {availableKinds.map((kind) => <Chip key={kind} label={KIND_LABELS[kind]} selected={attractionKind === kind} onPress={() => setAttractionKind(kind)} />)}
        </ScrollView>
        {availableRideTypes.length ? (
          <>
            <Text style={styles.controlLabel}>OFFICIAL RIDE TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              <Chip label="All ride types" selected={!rideType} onPress={() => setRideType(null)} />
              {availableRideTypes.map((type) => <Chip key={type.key} label={type.label} selected={rideType === type.key} onPress={() => setRideType(type.key)} />)}
            </ScrollView>
          </>
        ) : null}
        {availableInterests.length ? (
          <>
            <Text style={styles.controlLabel}>OFFICIAL INTEREST</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              <Chip label="All interests" selected={!interest} onPress={() => setInterest(null)} />
              {availableInterests.map((item) => <Chip key={item.key} label={item.label} selected={interest === item.key} onPress={() => setInterest(item.key)} />)}
            </ScrollView>
          </>
        ) : null}
      </View>
      {!loading && !error ? <Text style={styles.resultCount}>{rides.length} attraction{rides.length === 1 ? "" : "s"}</Text> : null}
      {loading ? <Loading /> : error ? <Empty>{error}</Empty> : rides.length ? rides.map((ride) => {
        const image = rideImageUrl(ride.parkSlug, ride.attractionName);
        const accent = parkColors[ride.parkSlug] ?? colors.blue;
        return (
          <Pressable key={ride.attractionId} onPress={() => navigation.navigate("Attraction", { attraction: ride })} style={({ pressed }) => [styles.ride, pressed && { opacity: 0.78 }]}>
            {image ? <Image source={{ uri: image }} style={styles.image} /> : <View style={[styles.image, styles.imageFallback, { backgroundColor: `${accent}20` }]}><Text style={{ color: accent, fontSize: 25 }}>🎢</Text></View>}
            <View style={styles.rideBody}>
              <Text numberOfLines={2} style={styles.rideName}>{ride.attractionName}</Text>
              <Text numberOfLines={1} style={styles.meta}>{ride.attractionTypes.length ? ride.attractionTypes.map((type) => type.label).join(" · ") : KIND_LABELS[ride.kind]} · {ride.land ?? ride.parkName}</Text>
              <Text style={styles.updated}>Updated {relativeTime(ride.observedAt)}</Text>
            </View>
            <View style={[styles.waitBubble, { backgroundColor: ride.status === "operating" ? colors.tealTint : colors.coralTint }]}>
              <Text style={[styles.wait, { color: ride.status === "operating" ? "#087d72" : colors.coral }]}>{ride.waitMinutes === null ? "—" : ride.waitMinutes}</Text>
              <Text style={styles.minutes}>{ride.status === "operating" ? "min" : ride.status}</Text>
            </View>
          </Pressable>
        );
      }) : <Empty>No attractions match this filter.</Empty>}
    </Screen>
  );
}

type SortOption = "wait-asc" | "wait-desc" | "name-asc" | "name-desc";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "wait-asc", label: "Shortest wait" },
  { value: "wait-desc", label: "Longest wait" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
];

const KIND_ORDER: AttractionKind[] = ["ride", "show", "meet-and-greet", "other"];
const KIND_LABELS: Record<AttractionKind, string> = {
  ride: "Ride",
  show: "Show",
  "meet-and-greet": "Meet & greet",
  other: "Other",
};

function waitValue(attraction: LiveWait) {
  return attraction.status === "operating" && attraction.waitMinutes !== null
    ? attraction.waitMinutes
    : null;
}

const sorters: Record<SortOption, (left: LiveWait, right: LiveWait) => number> = {
  "wait-asc": (left, right) => compareNullable(waitValue(left), waitValue(right), 1) || compareNames(left, right),
  "wait-desc": (left, right) => compareNullable(waitValue(left), waitValue(right), -1) || compareNames(left, right),
  "name-asc": compareNames,
  "name-desc": (left, right) => compareNames(right, left),
};

function compareNullable(left: number | null, right: number | null, direction: 1 | -1) {
  // Closed/down attractions remain at the bottom instead of looking like a
  // zero-minute wait, regardless of which wait direction was selected.
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return (left - right) * direction;
}

function compareNames(left: LiveWait, right: LiveWait) {
  return left.attractionName.localeCompare(right.attractionName, "en", { sensitivity: "base" });
}

const styles = StyleSheet.create({
  search: { minHeight: 50, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 15, paddingHorizontal: 15, color: colors.ink, fontSize: 16 },
  filters: { gap: 8, paddingRight: 10 },
  controls: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 13, gap: 9 },
  controlLabel: { color: colors.mute, fontWeight: "900", fontSize: 10, letterSpacing: 1 },
  resultCount: { color: colors.soft, fontWeight: "800", fontSize: 12 },
  ride: { backgroundColor: colors.paper, borderRadius: 19, borderWidth: 1, borderColor: colors.line, padding: 10, flexDirection: "row", alignItems: "center", gap: 11 },
  image: { width: 72, height: 72, borderRadius: 15 },
  imageFallback: { alignItems: "center", justifyContent: "center" },
  rideBody: { flex: 1, minWidth: 0, gap: 3 },
  rideName: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  meta: { color: colors.soft, fontSize: 13 },
  updated: { color: colors.mute, fontSize: 11 },
  waitBubble: { minWidth: 62, minHeight: 62, borderRadius: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  wait: { fontSize: 22, fontWeight: "900" },
  minutes: { color: colors.soft, fontSize: 10, textTransform: "capitalize", maxWidth: 55 },
});
