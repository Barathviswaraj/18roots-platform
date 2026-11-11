import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useHome } from "@/api/queries";
import { LotusScene } from "@/components/illustrations";
import { Logo, Screen } from "@/components/layout";
import { ErrorState, LoadingCards } from "@/components/states";
import { Avatar, IconButton } from "@/components/ui";
import { HomeSectionView } from "@/features/home/sections";
import { useT } from "@/i18n";
import { greetingKey } from "@/lib/format";
import { useAuth } from "@/store/auth";
import { colors, fonts, spacing } from "@/theme";

export default function HomeScreen() {
  const t = useT();
  const home = useHome();
  const user = useAuth((state) => state.user);
  const firstName = home.data?.user.name ?? user?.name.split(" ")[0] ?? "";

  return (
    <Screen tab onRefresh={() => home.refetch()} refreshing={home.isRefetching}>
      <View style={styles.hero}>
        <View style={styles.art} pointerEvents="none">
          <LotusScene width={215} height={205} />
        </View>
        <View style={styles.topRow}>
          <Logo />
          <View style={styles.actions}>
            <IconButton
              icon="bell"
              label={t("home.notifications")}
              badge={home.data?.unreadNotifications}
              onPress={() => router.push("/notifications")}
            />
            <Pressable
              onPress={() => router.push("/profile")}
              accessibilityRole="button"
              accessibilityLabel={t("home.openProfile")}
            >
              <Avatar name={user?.name ?? firstName} uri={home.data?.user.avatarUrl} size={44} shape="circle" />
            </Pressable>
          </View>
        </View>
        <View style={styles.greeting}>
          <Text style={styles.hello}>{t(greetingKey())}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {firstName}
          </Text>
          {home.data?.message ? (
            <Text style={styles.message}>
              {home.data.message} <Feather name="heart" size={13} color={colors.rose} />
            </Text>
          ) : null}
        </View>
      </View>

      {home.isPending ? (
        <LoadingCards />
      ) : home.isError ? (
        <ErrorState error={home.error} onRetry={() => home.refetch()} />
      ) : (
        home.data.sections.map((section) => <HomeSectionView key={section.id} section={section} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 250, marginHorizontal: -spacing.xl, paddingHorizontal: spacing.xl },
  art: { position: "absolute", right: -6, top: 46 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: spacing.sm },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  greeting: { marginTop: spacing.xl, maxWidth: "62%" },
  hello: { fontFamily: fonts.displayMedium, fontSize: 26, lineHeight: 30, color: colors.ink },
  name: { fontFamily: fonts.display, fontSize: 42, lineHeight: 46, color: colors.ink },
  message: {
    fontFamily: fonts.displayMedium,
    fontSize: 16,
    lineHeight: 21,
    color: colors.inkSoft,
    marginTop: spacing.sm,
  },
});
