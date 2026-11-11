import type { ErrorBoundaryProps } from "expo-router";
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "@/theme";
import { ErrorState } from "./states";

// Shown instead of a white screen when a screen throws while rendering.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.page}>
      <ErrorState error={error} onRetry={retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: "center", backgroundColor: colors.background, padding: spacing.xl },
});
