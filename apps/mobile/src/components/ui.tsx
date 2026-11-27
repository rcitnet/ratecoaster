import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ViewStyle,
} from "react-native";
import { colors } from "@/theme";

export function Screen({ children, refreshControl }: PropsWithChildren<{ refreshControl?: ReactNode }>) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      refreshControl={refreshControl as never}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function Hero({ eyebrow, title, copy }: { eyebrow?: string; title: string; copy: string }) {
  return (
    <View style={styles.hero}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroCopy}>{copy}</Text>
    </View>
  );
}

export function Section({ title, action, children, style }: PropsWithChildren<{ title: string; action?: ReactNode; style?: ViewStyle }>) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export function Button({ label, tone = "blue", ...props }: PressableProps & { label: string; tone?: "blue" | "pink" | "light" }) {
  return (
    <Pressable {...props} style={({ pressed }) => [styles.button, styles[`button_${tone}`], pressed && { opacity: 0.78 }, typeof props.style === "function" ? props.style({ pressed }) : props.style]}>
      <Text style={[styles.buttonText, tone === "light" && styles.buttonTextLight]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <View style={styles.state}><ActivityIndicator color={colors.blue} /><Text style={styles.stateText}>{label}</Text></View>;
}

export function Empty({ children }: PropsWithChildren) {
  return <View style={styles.empty}><Text style={styles.emptyText}>{children}</Text></View>;
}

export function Money({ cents, suffix }: { cents: number | null; suffix?: string }) {
  return <Text style={styles.money}>{cents === null ? "Not available" : `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}${suffix ?? ""}`}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  screenContent: { padding: 18, paddingBottom: 40, gap: 16 },
  hero: { backgroundColor: colors.ink, borderRadius: 28, padding: 22, gap: 8 },
  eyebrow: { color: "#9ff1e9", fontSize: 12, fontWeight: "800", letterSpacing: 1.1, textTransform: "uppercase" },
  heroTitle: { color: colors.paper, fontSize: 31, lineHeight: 35, fontWeight: "900" },
  heroCopy: { color: "#dcd8ee", fontSize: 15, lineHeight: 22 },
  section: { backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: 22, padding: 17, gap: 13 },
  sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  sectionTitle: { color: colors.ink, fontSize: 21, fontWeight: "900", flexShrink: 1 },
  button: { minHeight: 48, borderRadius: 14, paddingHorizontal: 17, alignItems: "center", justifyContent: "center" },
  button_blue: { backgroundColor: colors.blue },
  button_pink: { backgroundColor: colors.magenta },
  button_light: { backgroundColor: colors.blueTint },
  buttonText: { color: colors.paper, fontWeight: "900", fontSize: 15 },
  buttonTextLight: { color: colors.blue },
  chip: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  chipSelected: { borderColor: colors.blue, backgroundColor: colors.blueTint },
  chipText: { color: colors.soft, fontWeight: "700" },
  chipTextSelected: { color: colors.blue },
  state: { minHeight: 130, alignItems: "center", justifyContent: "center", gap: 10 },
  stateText: { color: colors.mute },
  empty: { backgroundColor: colors.cream, padding: 16, borderRadius: 14 },
  emptyText: { color: colors.soft, lineHeight: 21 },
  money: { color: colors.ink, fontSize: 20, fontWeight: "900" },
});
