import { useEffect, useMemo, useState } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import MapView, { Marker, type Region } from "react-native-maps";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import type { WaitRollupPoint } from "@ratecoaster/shared";
import { api, messageFrom } from "@/api";
import { Button, Empty, Loading, Screen, Section } from "@/components/ui";
import { relativeTime } from "@/format";
import { rideImageUrl } from "@/rideImages";
import { colors } from "@/theme";

const PARK_CENTERS: Record<string, Region> = {
  "universal-studios-florida": { latitude: 28.4751, longitude: -81.4675, latitudeDelta: 0.015, longitudeDelta: 0.015 },
  "islands-of-adventure": { latitude: 28.4717, longitude: -81.4719, latitudeDelta: 0.015, longitudeDelta: 0.015 },
  "epic-universe": { latitude: 28.4407, longitude: -81.4474, latitudeDelta: 0.018, longitudeDelta: 0.018 },
  "volcano-bay": { latitude: 28.4627, longitude: -81.4730, latitudeDelta: 0.012, longitudeDelta: 0.012 },
  "universal-studios-hollywood": { latitude: 34.1381, longitude: -118.3534, latitudeDelta: 0.015, longitudeDelta: 0.015 },
};

export function AttractionScreen({ route }: { route: any }) {
  const attraction = route.params.attraction;
  const [history, setHistory] = useState<WaitRollupPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [origin, setOrigin] = useState<Location.LocationObjectCoords | null>(null);
  const parkCenter = PARK_CENTERS[attraction.parkSlug] ?? PARK_CENTERS["universal-studios-florida"]!;
  const hasExactLocation = attraction.latitude !== null && attraction.longitude !== null;
  const center: Region = hasExactLocation ? {
    latitude: attraction.latitude,
    longitude: attraction.longitude,
    latitudeDelta: 0.004,
    longitudeDelta: 0.004,
  } : parkCenter;
  const image = attraction.officialImageUrl ?? rideImageUrl(attraction.parkSlug, attraction.attractionName);

  useEffect(() => {
    api.waitRollup(attraction.attractionSlug)
      .then(setHistory)
      .catch((caught) => setError(messageFrom(caught)))
      .finally(() => setLoading(false));
  }, [attraction.attractionSlug]);

  async function locateAndRoute() {
    setLocating(true);
    setLocationError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setLocationError("Location permission is needed to start walking directions.");
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setOrigin(current.coords);
      const destination = encodeURIComponent(
        hasExactLocation
          ? `${attraction.latitude},${attraction.longitude}`
          : `${attraction.attractionName}, ${attraction.parkName}`
      );
      const url = `https://www.google.com/maps/dir/?api=1&origin=${current.coords.latitude},${current.coords.longitude}&destination=${destination}&travelmode=walking`;
      await Linking.openURL(url);
    } catch (caught) {
      setLocationError(messageFrom(caught));
    } finally {
      setLocating(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        {image ? <Image source={{ uri: image }} style={styles.image} /> : null}
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={styles.park}>{attraction.parkName}</Text>
          <Text style={styles.title}>{attraction.attractionName}</Text>
          <Text style={styles.meta}>{attraction.land ?? "Park location details"}</Text>
        </View>
      </View>
      <View style={[styles.live, { backgroundColor: attraction.status === "operating" ? colors.tealTint : colors.coralTint }]}>
        <View><Text style={styles.liveLabel}>LIVE WAIT</Text><Text style={styles.liveValue}>{attraction.status === "operating" && attraction.waitMinutes !== null ? `${attraction.waitMinutes} minutes` : `Currently ${attraction.status}`}</Text></View>
        <Text style={styles.age}>Updated {relativeTime(attraction.observedAt)}</Text>
      </View>

      <Section title="Typical waits by time of day">
        <Text style={styles.copy}>Based on recorded wait observations. The line shows the typical posted wait each hour.</Text>
        {loading ? <Loading /> : error ? <Empty>{error}</Empty> : <WaitChart points={history} />}
      </Section>

      {attraction.attractionTypes.length || attraction.interests.length || attraction.heightRequirements.length ? (
        <Section title="Official attraction details">
          {attraction.attractionTypes.length ? <TagGroup label="Ride type" tags={attraction.attractionTypes.map((tag: { label: string }) => tag.label)} /> : null}
          {attraction.interests.length ? <TagGroup label="Good for" tags={attraction.interests.map((tag: { label: string }) => tag.label)} /> : null}
          {attraction.ageGroups.length ? <TagGroup label="Age groups" tags={attraction.ageGroups.map((tag: { label: string }) => tag.label)} /> : null}
          {attraction.heightRequirements.length ? <TagGroup label="Height information" tags={attraction.heightRequirements.map((tag: { label: string }) => tag.label)} /> : null}
          {attraction.expressPass !== null ? <Text style={styles.copy}>Express Pass: <Text style={styles.detailStrong}>{attraction.expressPass ? "Eligible" : "Not listed as eligible"}</Text></Text> : null}
          {attraction.officialUrl ? <Button tone="light" label="View on Universal Orlando" onPress={() => void Linking.openURL(attraction.officialUrl!)} /> : null}
        </Section>
      ) : null}

      <Section title="Where to find it">
        <Text style={styles.copy}>{hasExactLocation ? "The pin uses the attraction coordinates published by Universal Orlando." : "The pin marks the park area because precise coordinates are not available for this attraction yet."}</Text>
        <MapView style={styles.map} initialRegion={center} showsUserLocation={Boolean(origin)} showsMyLocationButton={false}>
          <Marker coordinate={{ latitude: center.latitude, longitude: center.longitude }} title={hasExactLocation ? attraction.attractionName : attraction.parkName} description={hasExactLocation ? attraction.land ?? attraction.parkName : "Park area"} />
        </MapView>
        <Button label={locating ? "Finding your location…" : "Start walking directions"} onPress={() => void locateAndRoute()} disabled={locating} />
        {locationError ? <Text style={styles.error}>{locationError}</Text> : null}
        <Text style={styles.privacy}>Your location is requested only after you tap the button and is not stored by RateCoaster.</Text>
      </Section>
    </Screen>
  );
}

function TagGroup({ label, tags }: { label: string; tags: string[] }) {
  return <View style={styles.tagGroup}><Text style={styles.tagLabel}>{label}</Text><View style={styles.tags}>{tags.map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}</View></View>;
}

function WaitChart({ points }: { points: WaitRollupPoint[] }) {
  const [width, setWidth] = useState(0);
  const data = useMemo(() => points.filter((point) => point.p50Minutes !== null), [points]);
  if (!data.length) return <Empty>Not enough history has been collected for this attraction yet.</Empty>;
  const height = 210;
  const left = 34;
  const right = 12;
  const top = 18;
  const bottom = 32;
  const innerWidth = Math.max(1, width - left - right);
  const innerHeight = height - top - bottom;
  const max = Math.max(15, ...data.map((point) => point.p50Minutes ?? 0));
  const x = (index: number) => left + (index / Math.max(1, data.length - 1)) * innerWidth;
  const y = (value: number) => top + innerHeight - (value / max) * innerHeight;
  const path = data.map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point.p50Minutes ?? 0)}`).join(" ");
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.chartWrap}>
      {width ? <Svg width={width} height={height}>
        {[0, 0.5, 1].map((ratio) => <Line key={ratio} x1={left} x2={width - right} y1={top + innerHeight * ratio} y2={top + innerHeight * ratio} stroke={colors.line} />)}
        <Path d={path} fill="none" stroke={colors.blue} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((point, index) => <Circle key={point.hour} cx={x(index)} cy={y(point.p50Minutes ?? 0)} r={3.5} fill={colors.blue} />)}
        <SvgText x={2} y={top + 5} fontSize={10} fill={colors.mute}>{max}m</SvgText>
        <SvgText x={8} y={top + innerHeight + 4} fontSize={10} fill={colors.mute}>0m</SvgText>
        {[0, Math.floor((data.length - 1) / 2), data.length - 1].map((index) => <SvgText key={index} x={x(index)} y={height - 8} textAnchor="middle" fontSize={10} fill={colors.mute}>{formatHour(data[index]!.hour)}</SvgText>)}
      </Svg> : null}
    </View>
  );
}

function formatHour(hour: number) {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 15, paddingVertical: 6 },
  image: { width: 90, height: 90, borderRadius: 19 },
  park: { color: colors.magenta, fontWeight: "800", fontSize: 12 },
  title: { color: colors.ink, fontSize: 27, lineHeight: 30, fontWeight: "900" },
  meta: { color: colors.soft, fontSize: 15 },
  live: { borderRadius: 18, padding: 17, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  liveLabel: { color: "#087d72", fontWeight: "900", fontSize: 11 },
  liveValue: { color: "#087d72", fontWeight: "900", fontSize: 20, textTransform: "capitalize" },
  age: { color: colors.mute, fontSize: 11, textAlign: "right" },
  copy: { color: colors.soft, lineHeight: 21 },
  detailStrong: { color: colors.ink, fontWeight: "900" },
  tagGroup: { gap: 7 },
  tagLabel: { color: colors.mute, fontSize: 10, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  tag: { color: colors.blue, backgroundColor: colors.blueTint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: "800" },
  chartWrap: { width: "100%", minHeight: 210, overflow: "hidden" },
  map: { width: "100%", height: 265, borderRadius: 16 },
  error: { color: colors.coral, lineHeight: 20 },
  privacy: { color: colors.mute, fontSize: 12, lineHeight: 17 },
});
