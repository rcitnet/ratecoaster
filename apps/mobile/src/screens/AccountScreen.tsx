import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type { SessionUser, WatchView } from "@ratecoaster/shared";
import { api, messageFrom } from "@/api";
import { useAuthRefresh } from "@/auth";
import { Button, Empty, Hero, Loading, Screen, Section } from "@/components/ui";
import { clearSession, saveSession } from "@/session";
import { colors } from "@/theme";

export function AccountScreen() {
  const { revision, refresh } = useAuthRefresh();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [watches, setWatches] = useState<WatchView[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const me = await api.me();
      setUser(me.user);
      setWatches(me.user ? await api.listWatches() : []);
    } catch { setUser(null); setWatches([]); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [revision]);

  async function signIn() {
    setSending(true); setMessage("");
    try {
      const result = await api.requestMobileMagicLink(email.trim());
      if (result.sessionToken) { await saveSession(result.sessionToken); refresh(); setMessage("Signed in."); }
      else setMessage(result.message);
    } catch (caught) { setMessage(messageFrom(caught)); }
    finally { setSending(false); }
  }

  async function signOut() {
    try { await api.logout(); } catch { /* Clear the device session even if the network is unavailable. */ }
    await clearSession(); setUser(null); setWatches([]); refresh();
  }

  const accountTitle = user
    ? user.displayName
      ? `Hi, ${user.displayName}`
      : "Your RateCoaster account"
    : "Your RateCoaster account";

  return (
    <Screen>
      <Hero
        eyebrow="Saved planning"
        title={accountTitle}
        copy={user
          ? "Your price watches and account travel with you between the website and Android app."
          : "Sign in with the same email as the website to see saved watches and receive price-drop alerts."}
      />
      {loading ? <Loading /> : user ? (
        <>
          <Section title="Account">
            <Text style={styles.email}>{user.email}</Text>
            <Text style={styles.tier}>{user.tier} account</Text>
            <Button tone="light" label="Sign out" onPress={() => void signOut()} />
          </Section>
          <Section title={`Price watches (${watches.length})`}>
            {watches.length ? watches.map((watch) => (
              <View key={watch.id} style={styles.watch}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.watchName}>{watch.propertyName ?? watch.ticketProductName ?? watch.target.destination ?? "Saved watch"}</Text>
                  <Text style={styles.watchMeta}>{watch.target.kind} · {watch.target.checkIn} to {watch.target.checkOut}</Text>
                </View>
                <Text style={[styles.active, !watch.active && styles.inactive]}>{watch.active ? "Active" : "Paused"}</Text>
              </View>
            )) : <Empty>You have no price watches yet. Watches created on the website will appear here automatically.</Empty>}
          </Section>
        </>
      ) : (
        <Section title="Email sign-in">
          <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.mute} style={styles.input} />
          <Button label={sending ? "Sending…" : "Email me a sign-in link"} disabled={sending || !email.includes("@")} onPress={() => void signIn()} />
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <Text style={styles.help}>The link opens RateCoaster and creates an app-only secure session. No password is stored.</Text>
        </Section>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.cream, borderRadius: 14, paddingHorizontal: 14, color: colors.ink, fontSize: 16 },
  message: { color: colors.teal, fontWeight: "700", lineHeight: 20 }, help: { color: colors.mute, fontSize: 12, lineHeight: 18 },
  email: { color: colors.ink, fontWeight: "900", fontSize: 18 }, tier: { color: colors.mute, textTransform: "capitalize" },
  watch: { flexDirection: "row", gap: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, alignItems: "center" }, watchName: { color: colors.ink, fontWeight: "800", fontSize: 15 }, watchMeta: { color: colors.mute, fontSize: 12, marginTop: 3, textTransform: "capitalize" }, active: { backgroundColor: colors.tealTint, color: "#087d72", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, fontSize: 11, fontWeight: "900" }, inactive: { backgroundColor: colors.coralTint, color: colors.coral },
});
