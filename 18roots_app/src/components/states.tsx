import { Feather } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View, type DimensionValue } from "react-native";

import { toApiError } from "@/api/client";
import { useT } from "@/i18n";
import { colors, fonts, radius, spacing, type } from "@/theme";
import { Button, type IconName } from "./ui";

export function Skeleton({
  height,
  width = "100%",
  style,
}: {
  height: number;
  width?: DimensionValue;
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.skeleton, { height, width, opacity }, style]} />;
}

export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <View style={{ gap: spacing.lg, marginTop: spacing.lg }} accessibilityLabel="Loading">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} height={index === 0 ? 150 : 110} />
      ))}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useT();
  const apiError = toApiError(error);
  return (
    <View style={styles.center}>
      <View style={styles.iconCircle}>
        <Feather name={apiError.isNetwork ? "wifi-off" : "alert-circle"} size={24} color={colors.roseDark} />
      </View>
      <Text style={styles.title}>{t("common.errorTitle")}</Text>
      <Text style={styles.body}>{apiError.isNetwork ? t("common.errorBody") : apiError.message}</Text>
      {onRetry ? (
        <Button label={t("common.retry")} onPress={onRetry} variant="outline" compact icon="refresh-cw" />
      ) : null}
    </View>
  );
}

export function EmptyState({ icon, title, body }: { icon: IconName; title: string; body?: string }) {
  return (
    <View style={styles.center}>
      <View style={[styles.iconCircle, { backgroundColor: colors.sageTint }]}>
        <Feather name={icon} size={24} color={colors.sageDark} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: { backgroundColor: colors.surfaceMuted, borderRadius: radius.lg },
  center: { alignItems: "center", paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, gap: spacing.sm },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.roseTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, textAlign: "center" },
  body: { ...type.body, textAlign: "center", marginBottom: spacing.sm },
});
