import { useEffect, useMemo, useState } from "react";
import { Linking, StyleSheet, Text } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { api } from "@/api";
import { AuthRefreshContext } from "@/auth";
import type { ExploreStack, RootTabs, WaitsStack } from "@/navigation";
import { saveSession } from "@/session";
import { colors } from "@/theme";
import { HomeScreen } from "@/screens/HomeScreen";
import { PlanScreen } from "@/screens/PlanScreen";
import { WaitsScreen } from "@/screens/WaitsScreen";
import { AttractionScreen } from "@/screens/AttractionScreen";
import { AccountScreen } from "@/screens/AccountScreen";
import { CrowdsScreen, ExploreScreen, ExpressScreen, GuideScreen, GuidesScreen, HotelsScreen, TicketsScreen } from "@/screens/ExploreScreens";

const Tabs = createBottomTabNavigator<RootTabs>();
const WaitStack = createNativeStackNavigator<WaitsStack>();
const ExploreNav = createNativeStackNavigator<ExploreStack>();

const icons: Record<keyof RootTabs, string> = { HomeTab: "⌂", PlanTab: "✦", WaitsTab: "◷", ExploreTab: "◇", AccountTab: "○" };
const labels: Record<keyof RootTabs, string> = { HomeTab: "Home", PlanTab: "Plan", WaitsTab: "Waits", ExploreTab: "Explore", AccountTab: "Account" };

const stackOptions = {
  headerStyle: { backgroundColor: colors.paper },
  headerTintColor: colors.ink,
  headerTitleStyle: { fontWeight: "900" as const },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.cream },
};

function WaitsNavigator() {
  return <WaitStack.Navigator screenOptions={stackOptions}><WaitStack.Screen name="Waits" component={WaitsScreen} options={{ headerShown: false }} /><WaitStack.Screen name="Attraction" component={AttractionScreen} options={({ route }) => ({ title: route.params.attraction.attractionName })} /></WaitStack.Navigator>;
}

function ExploreNavigator() {
  return <ExploreNav.Navigator screenOptions={stackOptions}><ExploreNav.Screen name="Explore" component={ExploreScreen} options={{ headerShown: false }} /><ExploreNav.Screen name="Hotels" component={HotelsScreen} /><ExploreNav.Screen name="Tickets" component={TicketsScreen} /><ExploreNav.Screen name="Express" component={ExpressScreen} options={{ title: "Express Pass" }} /><ExploreNav.Screen name="Crowds" component={CrowdsScreen} options={{ title: "Crowd calendar" }} /><ExploreNav.Screen name="Guides" component={GuidesScreen} /><ExploreNav.Screen name="Guide" component={GuideScreen} options={{ title: "Planning guide" }} /></ExploreNav.Navigator>;
}

function AppTabs() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <Tabs.Navigator
      safeAreaInsets={{ bottom: insets.bottom }}
      screenOptions={({ route }) => ({
        headerTitle: "RateCoaster",
        headerTitleAlign: "center",
        headerStyle: { backgroundColor: colors.paper },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.ink, fontWeight: "900", fontSize: 20 },
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.mute,
        tabBarStyle: [
          styles.tabBar,
          {
            height: 62 + bottomPadding,
            paddingBottom: bottomPadding,
          },
        ],
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>{icons[route.name]}</Text>,
        tabBarLabel: labels[route.name],
      })}
    >
      <Tabs.Screen name="HomeTab" component={HomeScreen} />
      <Tabs.Screen name="PlanTab" component={PlanScreen} />
      <Tabs.Screen name="WaitsTab" component={WaitsNavigator} options={{ headerShown: false }} />
      <Tabs.Screen name="ExploreTab" component={ExploreNavigator} options={{ headerShown: false }} />
      <Tabs.Screen name="AccountTab" component={AccountScreen} />
    </Tabs.Navigator>
  );
}

export default function App() {
  const [authRevision, setAuthRevision] = useState(0);
  const authValue = useMemo(() => ({ revision: authRevision, refresh: () => setAuthRevision((value) => value + 1) }), [authRevision]);

  useEffect(() => {
    async function handle(url: string | null) {
      if (!url) return;
      try {
        const parsed = new URL(url);
        const token = parsed.searchParams.get("token");
        if (!token || !parsed.pathname.includes("/app/auth")) return;
        const result = await api.exchangeMobileMagicLink(token);
        await saveSession(result.sessionToken);
        setAuthRevision((value) => value + 1);
      } catch { /* Account screen remains available for a fresh sign-in request. */ }
    }
    void Linking.getInitialURL().then(handle);
    const subscription = Linking.addEventListener("url", ({ url }) => { void handle(url); });
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthRefreshContext.Provider value={authValue}>
        <StatusBar style="dark" />
        <NavigationContainer theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.cream, primary: colors.blue, text: colors.ink, border: colors.line } }}>
          <AppTabs />
        </NavigationContainer>
      </AuthRefreshContext.Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    paddingTop: 7,
    backgroundColor: colors.paper,
    borderTopColor: colors.line,
  },
  tabLabel: { fontSize: 11, fontWeight: "800" },
  tabIcon: { fontSize: 22, fontWeight: "900", lineHeight: 24 },
});
