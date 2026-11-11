import { Feather } from "@expo/vector-icons";
import { useNetInfo } from "@react-native-community/netinfo";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useT } from "@/i18n";
import { colors, fonts, spacing, type } from "@/theme";
import { LogoLeaf } from "./illustrations";

export const TAB_BAR_SPACE = 104;

export function OfflineBanner() {
  const t = useT();
  const { isConnected } = useNetInfo();
  if (isConnected !== false) return null;
  return (
    <View style={styles.offline} accessibilityLiveRegion="polite">
      <Feather name="wifi-off" size={14} color={colors.roseDark} />
      <Text style={styles.offlineText}>{t("common.offline")}</Text>
    </View>
  );
}

// Scrollable page with pull-to-refresh. Tab screens leave room for the
// floating tab bar; stack screens get a back header.
export function Screen({
  children,
  title,
  onRefresh,
  refreshing = false,
  tab = false,
  footer,
  headerRight,
}: {
  children: ReactNode;
  title?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  tab?: boolean;
  footer?: ReactNode;
  headerRight?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const t = useT();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <OfflineBanner />
      {title && !tab ? (
        <View style={styles.header}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            hitSlop={10}
            style={styles.back}
          >
            <Feather name="chevron-left" size={24} color={colors.ink} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          <View style={styles.headerRight}>{headerRight}</View>
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: (tab ? TAB_BAR_SPACE : spacing.xxl) + (footer ? 0 : insets.bottom) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.sage}
              colors={[colors.sageDark]}
            />
          ) : undefined
        }
      >
        {title && tab ? <Text style={[type.title, styles.tabTitle]}>{title}</Text> : null}
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>{footer}</View> : null}
    </View>
  );
}

export function Logo({ compact }: { compact?: boolean }) {
  const t = useT();
  return (
    <View accessibilityRole="image" accessibilityLabel="18 Roots">
      <View style={styles.logoRow}>
        <Text style={styles.logoNumber}>18</Text>
        <View style={styles.logoLeaf}>
          <LogoLeaf size={16} />
        </View>
      </View>
      <Text style={styles.logoWord}>ROOTS</Text>
      {compact ? null : <Text style={styles.logoTagline}>{t("app.tagline")}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 52,
  },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontFamily: fonts.display, fontSize: 22, color: colors.ink, textAlign: "center" },
  headerRight: { width: 44, alignItems: "center" },
  tabTitle: { marginTop: spacing.md, marginBottom: spacing.sm },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  offline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    backgroundColor: colors.roseTint,
  },
  offlineText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.roseDark },
  logoRow: { flexDirection: "row", alignItems: "flex-start" },
  logoNumber: { fontFamily: fonts.displayMedium, fontSize: 38, lineHeight: 40, color: colors.sageDark },
  logoLeaf: { marginLeft: -4, marginTop: 2 },
  logoWord: { fontFamily: fonts.displayMedium, fontSize: 15, letterSpacing: 4, color: colors.sageDark, marginTop: -2 },
  logoTagline: {
    fontFamily: fonts.display,
    fontSize: 11,
    lineHeight: 13,
    color: colors.inkSoft,
    maxWidth: 110,
    marginTop: 2,
  },
});
