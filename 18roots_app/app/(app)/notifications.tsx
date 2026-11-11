import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useMarkNotificationRead, useNotifications } from "@/api/queries";
import { Screen } from "@/components/layout";
import { EmptyState, ErrorState, LoadingCards } from "@/components/states";
import { Button, Card } from "@/components/ui";
import { useLocale, useT } from "@/i18n";
import { formatDate, formatTime } from "@/lib/format";
import { colors, fonts, spacing, type } from "@/theme";

export default function NotificationsScreen() {
  const t = useT();
  const locale = useLocale();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const hasUnread = notifications.data?.some((item) => !item.read);

  return (
    <Screen
      title={t("notifications.title")}
      onRefresh={() => notifications.refetch()}
      refreshing={notifications.isRefetching}
    >
      {hasUnread ? (
        <Button
          label={t("notifications.markAll")}
          variant="ghost"
          compact
          icon="check"
          onPress={() => markRead.mutate("all")}
          style={styles.markAll}
        />
      ) : null}
      {notifications.isPending ? (
        <LoadingCards count={3} />
      ) : notifications.isError ? (
        <ErrorState error={notifications.error} onRetry={() => notifications.refetch()} />
      ) : notifications.data.length === 0 ? (
        <EmptyState icon="bell" title={t("notifications.empty")} />
      ) : (
        <Card style={styles.list}>
          {notifications.data.map((item, index) => (
            <Pressable
              key={item.id}
              onPress={() => {
                if (!item.read) markRead.mutate(item.id);
                if (item.link) router.push(item.link as never);
              }}
              accessibilityRole="button"
              style={[styles.row, index > 0 && styles.border]}
            >
              <View style={[styles.icon, !item.read && styles.iconUnread]}>
                <Feather name="bell" size={16} color={item.read ? colors.muted : colors.roseDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, !item.read && styles.unread]}>{item.title}</Text>
                <Text style={type.body}>{item.body}</Text>
                <Text style={type.caption}>
                  {formatDate(item.createdAt, locale, { day: "numeric", month: "short" })},{" "}
                  {formatTime(item.createdAt, locale)}
                </Text>
              </View>
              {!item.read ? <View style={styles.dot} /> : null}
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  markAll: { alignSelf: "flex-end", marginBottom: spacing.sm },
  list: { paddingVertical: spacing.sm },
  row: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.md, alignItems: "flex-start" },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  iconUnread: { backgroundColor: colors.roseTint },
  title: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
  unread: { fontFamily: fonts.bodySemiBold, color: colors.ink },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.rose, marginTop: 6 },
});
