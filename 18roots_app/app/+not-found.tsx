import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui";
import { useT } from "@/i18n";
import { colors, spacing } from "@/theme";

export default function NotFound() {
  const t = useT();
  return (
    <View style={styles.page}>
      <EmptyState icon="compass" title={t("common.notFound")} />
      <Button label={t("common.goHome")} onPress={() => router.replace("/")} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: "center", padding: spacing.xl, backgroundColor: colors.background },
});
