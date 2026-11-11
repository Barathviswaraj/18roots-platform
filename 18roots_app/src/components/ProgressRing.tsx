import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { colors, fonts } from "@/theme";

export const ProgressRing = memo(function ProgressRing({
  percent,
  size = 92,
  stroke = 9,
}: {
  percent: number;
  size?: number;
  stroke?: number;
}) {
  const value = Math.max(0, Math.min(100, percent));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: value }}
    >
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#F1DCD6" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.sageDark}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - value / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={[styles.value, { fontSize: size * 0.27 }]}>
          {Math.round(value)}
          <Text style={styles.unit}>%</Text>
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  value: { fontFamily: fonts.displayBold, color: colors.ink },
  unit: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft },
});
