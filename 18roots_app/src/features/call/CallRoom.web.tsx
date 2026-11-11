import { StyleSheet, Text, View } from "react-native";

import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui";
import { useT } from "@/i18n";
import { colors, spacing } from "@/theme";
import type { CallRoomProps } from "./CallRoom";

// The web preview cannot run native WebRTC; the call itself needs the app.
export function CallRoom({ onLeave }: CallRoomProps) {
  const t = useT();
  return (
    <View style={styles.page}>
      <EmptyState icon="smartphone" title={t("call.webUnavailable")} />
      <Text style={styles.spacer} />
      <Button label={t("common.back")} onPress={onLeave} variant="outline" />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background, justifyContent: "center", padding: spacing.xl },
  spacer: { height: spacing.md },
});
