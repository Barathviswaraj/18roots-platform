import {
  CormorantGaramond_500Medium,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_700Bold,
} from "@expo-google-fonts/cormorant-garamond";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { queryClient } from "@/api/queries";
import { ToastHost } from "@/components/toast";
import { setupCalls } from "@/features/call/setup";
import { envError } from "@/lib/env";
import { configureNotifications } from "@/lib/reminders";
import { useAuth } from "@/store/auth";
import { usePreferences } from "@/store/preferences";
import { colors, paperTheme, spacing } from "@/theme";

export { ErrorBoundary } from "@/components/RouteError";

SplashScreen.preventAutoHideAsync().catch(() => undefined);
setupCalls();
configureNotifications();

// Queries pause while offline and refetch when the connection or the app comes back.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    CormorantGaramond_500Medium,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const status = useAuth((state) => state.status);
  const preferencesReady = usePreferences((state) => state.hydrated);

  useEffect(() => {
    useAuth.getState().hydrate();
    const subscription = AppState.addEventListener("change", (state) => focusManager.setFocused(state === "active"));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (status === "signedOut") queryClient.clear();
  }, [status]);

  const ready = (fontsLoaded || !!fontError) && status !== "loading" && preferencesReady;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (envError) {
    return (
      <View style={styles.configError}>
        <Text style={styles.configTitle}>App settings are incomplete</Text>
        <Text style={styles.configBody}>{envError}</Text>
      </View>
    );
  }
  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={paperTheme}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
            <Stack.Protected guard={status === "signedIn"}>
              <Stack.Screen name="(app)" />
            </Stack.Protected>
            <Stack.Protected guard={status !== "signedIn"}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
          </Stack>
          <ToastHost />
        </PaperProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  configError: { flex: 1, justifyContent: "center", padding: spacing.xxl, backgroundColor: colors.background },
  configTitle: { fontSize: 22, fontWeight: "600", color: colors.ink, marginBottom: spacing.md },
  configBody: { fontSize: 15, color: colors.inkSoft, lineHeight: 22 },
});
