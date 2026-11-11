import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useT, type TranslationKey } from "@/i18n";
import { colors, fonts, radius, shadow } from "@/theme";
import { LeafIcon } from "./illustrations";
import type { IconName } from "./ui";

// Expo Router bundles React Navigation, so the props come from its Tabs.
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const TABS: Record<string, { label: TranslationKey; icon: IconName | "leaf" }> = {
  index: { label: "tabs.home", icon: "home" },
  care: { label: "tabs.care", icon: "leaf" },
  consult: { label: "tabs.consult", icon: "calendar" },
  orders: { label: "tabs.orders", icon: "shopping-bag" },
  profile: { label: "tabs.profile", icon: "user" },
};

// The floating tab bar from the design: the active tab sits in a sage tile.
export function TabBar({ state, navigation }: TabBarProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <View style={styles.bar} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === index;
          const color = focused ? colors.white : colors.muted;
          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => undefined);
              navigation.navigate(route.name, route.params);
            }
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={t(tab.label)}
              style={styles.item}
            >
              <View style={[styles.tile, focused && styles.tileActive]}>
                {tab.icon === "leaf" ? (
                  <LeafIcon size={21} color={color} />
                ) : (
                  <Feather name={tab.icon} size={20} color={color} />
                )}
                <Text
                  style={[styles.label, { color: focused ? colors.white : colors.muted }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {t(tab.label)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
  bar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow.card,
  },
  item: { flex: 1, alignItems: "center" },
  tile: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 18,
    width: "92%",
    gap: 3,
    minHeight: 54,
  },
  tileActive: { backgroundColor: colors.sage },
  label: { fontFamily: fonts.bodyMedium, fontSize: 10.5, textAlign: "center" },
});
