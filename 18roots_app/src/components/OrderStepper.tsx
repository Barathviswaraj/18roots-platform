import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { OrderStatus } from "@/api/schemas";
import { useT, type TranslationKey } from "@/i18n";
import { colors, fonts } from "@/theme";

const STEPS: { key: TranslationKey; reachedAt: OrderStatus[] }[] = [
  { key: "orders.step.packed", reachedAt: ["packed", "shipped", "out_for_delivery", "delivered"] },
  { key: "orders.step.shipped", reachedAt: ["shipped", "out_for_delivery", "delivered"] },
  { key: "orders.step.out_for_delivery", reachedAt: ["out_for_delivery", "delivered"] },
  { key: "orders.step.arriving", reachedAt: ["delivered"] },
];

export const OrderStepper = memo(function OrderStepper({ status }: { status: OrderStatus }) {
  const t = useT();
  const reached = STEPS.map((step) => step.reachedAt.includes(status));
  const current = reached.lastIndexOf(true);
  const label = status === "delivered" ? t("orders.status.delivered") : null;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? (current >= 0 ? t(STEPS[current].key) : undefined)}
    >
      <View style={styles.track}>
        {STEPS.map((step, index) => (
          <View key={step.key} style={styles.segment}>
            {index > 0 ? (
              <View style={[styles.line, { backgroundColor: reached[index] ? colors.sage : colors.border }]} />
            ) : (
              <View style={styles.spacer} />
            )}
            <View
              style={[
                styles.dot,
                reached[index] && styles.dotDone,
                index === current && status !== "delivered" && styles.dotCurrent,
              ]}
            />
            {index < STEPS.length - 1 ? (
              <View style={[styles.line, { backgroundColor: reached[index + 1] ? colors.sage : colors.border }]} />
            ) : (
              <View style={styles.spacer} />
            )}
          </View>
        ))}
      </View>
      <View style={styles.labels}>
        {STEPS.map((step, index) => (
          <Text key={step.key} numberOfLines={2} style={[styles.label, index === current && styles.labelCurrent]}>
            {index === STEPS.length - 1 && status === "delivered" ? t("orders.status.delivered") : t(step.key)}
          </Text>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  track: { flexDirection: "row", alignItems: "center" },
  segment: { flex: 1, flexDirection: "row", alignItems: "center" },
  line: { flex: 1, height: 2, borderRadius: 1 },
  spacer: { flex: 1 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.border },
  dotDone: { backgroundColor: colors.sage },
  dotCurrent: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.sageDark,
    borderWidth: 3,
    borderColor: colors.sageLight,
  },
  labels: { flexDirection: "row", marginTop: 8 },
  label: { flex: 1, textAlign: "center", fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  labelCurrent: { fontFamily: fonts.bodySemiBold, color: colors.ink },
});
