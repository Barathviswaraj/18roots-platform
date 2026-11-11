import { Stack } from "expo-router";
import { useEffect } from "react";

import { listenForReminderTaps } from "@/lib/reminders";
import { useReminderSync } from "@/lib/useReminderSync";
import { colors } from "@/theme";

export const unstable_settings = { initialRouteName: "(tabs)" };

export default function AppLayout() {
  useReminderSync();
  useEffect(() => listenForReminderTaps(), []);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="call/[id]"
        options={{ presentation: "fullScreenModal", animation: "fade", gestureEnabled: false }}
      />
      <Stack.Screen name="booking/confirmed/[id]" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
