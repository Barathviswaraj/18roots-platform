import Constants from "expo-constants";
import { router } from "expo-router";
import { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { Switch } from "react-native-paper";

import { authApi } from "@/api/endpoints";
import { useProfile } from "@/api/queries";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LeafSprig } from "@/components/illustrations";
import { Screen } from "@/components/layout";
import { toast } from "@/components/toast";
import { Avatar, Card, Chip, Divider, ListRow } from "@/components/ui";
import { useT } from "@/i18n";
import { env } from "@/lib/env";
import { formatPhone } from "@/lib/format";
import { clearReminders, ensureNotificationPermission } from "@/lib/reminders";
import { useAuth } from "@/store/auth";
import { usePreferences } from "@/store/preferences";
import { colors, fonts, spacing, type } from "@/theme";

export default function ProfileScreen() {
  const t = useT();
  const profile = useProfile();
  const cachedUser = useAuth((state) => state.user);
  const user = profile.data ?? cachedUser;
  const { language, setLanguage, remindersEnabled, setRemindersEnabled } = usePreferences();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const toggleReminders = async (next: boolean) => {
    if (!next) {
      setRemindersEnabled(false);
      return;
    }
    const granted = await ensureNotificationPermission();
    if (granted) setRemindersEnabled(true);
    else toast.error(t("profile.permissionDenied"));
  };

  const signOut = async () => {
    setSigningOut(true);
    // The server call is best effort; the phone forgets the session either way.
    await authApi.logout().catch(() => undefined);
    await clearReminders().catch(() => undefined);
    await useAuth.getState().signOut();
  };

  return (
    <Screen tab title={t("profile.title")} onRefresh={() => profile.refetch()} refreshing={profile.isRefetching}>
      <Card tone="sage" style={styles.userCard}>
        <View style={styles.userRow}>
          <Avatar name={user?.name ?? ""} uri={user?.avatarUrl} size={68} shape="circle" />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={type.body}>{user ? formatPhone(user.phone) : ""}</Text>
            {user?.programName ? <Text style={type.caption}>{user.programName}</Text> : null}
          </View>
        </View>
        <View style={styles.sprig} pointerEvents="none">
          <LeafSprig size={50} opacity={0.7} />
        </View>
      </Card>

      <Card style={styles.section}>
        <ListRow
          icon="user"
          title={t("profile.personal")}
          subtitle={t("profile.edit")}
          onPress={() => router.push("/profile/edit")}
        />
        <Divider />
        <ListRow
          icon="globe"
          title={t("profile.language")}
          right={
            <View style={styles.languages}>
              <Chip label="English" selected={language === "en"} onPress={() => setLanguage("en")} />
              <Chip label="தமிழ்" selected={language === "ta"} onPress={() => setLanguage("ta")} />
            </View>
          }
        />
        <Divider />
        <ListRow
          icon="bell"
          title={t("profile.reminders")}
          subtitle={t("profile.remindersBody")}
          right={<Switch value={remindersEnabled} onValueChange={toggleReminders} color={colors.sageDark} />}
        />
        <Divider />
        <ListRow icon="inbox" title={t("profile.notifications")} onPress={() => router.push("/notifications")} />
      </Card>

      <Card style={styles.section}>
        <ListRow
          icon="phone"
          title={t("profile.help")}
          subtitle={env.supportPhone}
          onPress={() => Linking.openURL(`tel:${env.supportPhone}`)}
        />
        <Divider />
        <ListRow icon="log-out" title={t("profile.signOut")} danger onPress={() => setConfirmSignOut(true)} />
      </Card>

      <Text style={[type.caption, styles.version]}>
        {t("profile.version", { version: Constants.expoConfig?.version ?? "1.0.0" })}
        {env.apiMode === "mock" ? ` · ${t("common.demoMode")}` : ""}
      </Text>

      <ConfirmDialog
        visible={confirmSignOut}
        message={t("profile.signOutConfirm")}
        confirmLabel={t("profile.signOut")}
        danger
        loading={signingOut}
        onConfirm={signOut}
        onDismiss={() => setConfirmSignOut(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  userCard: { overflow: "hidden" },
  userRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  name: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  sprig: { position: "absolute", right: 6, bottom: 0 },
  section: { marginTop: spacing.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  languages: { flexDirection: "row", gap: 6 },
  version: { textAlign: "center", marginTop: spacing.xl },
});
