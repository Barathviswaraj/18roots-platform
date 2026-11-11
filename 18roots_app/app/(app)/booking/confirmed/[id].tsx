import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { useConsultation } from "@/api/queries";
import { Screen } from "@/components/layout";
import { ErrorState, LoadingCards } from "@/components/states";
import { toast } from "@/components/toast";
import { Avatar, Button, Card, MetaLine } from "@/components/ui";
import { useLocale, useT } from "@/i18n";
import { formatDate, formatTime, isJoinOpen } from "@/lib/format";
import { ensureNotificationPermission } from "@/lib/reminders";
import { usePreferences } from "@/store/preferences";
import { colors, fonts, spacing, type } from "@/theme";

// The one confirmation screen the guide asks for: status, time, doctor and a
// clear Join button when it is time.
export default function ConfirmedScreen() {
  const t = useT();
  const locale = useLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const consultation = useConsultation(id);
  const { remindersEnabled, setRemindersEnabled } = usePreferences();

  const turnOnReminders = async () => {
    if (await ensureNotificationPermission()) setRemindersEnabled(true);
    else toast.error(t("profile.permissionDenied"));
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.tick}>
          <Feather name="check" size={34} color={colors.white} />
        </View>
        <Text style={styles.title}>{t("booking.confirmedTitle")}</Text>
        <Text style={[type.body, styles.center]}>{t("booking.confirmedBody")}</Text>
      </View>

      {consultation.isPending ? (
        <LoadingCards count={1} />
      ) : consultation.isError ? (
        <ErrorState error={consultation.error} onRetry={() => consultation.refetch()} />
      ) : (
        <Card>
          <View style={styles.row}>
            <Avatar name={consultation.data.doctor.name} uri={consultation.data.doctor.photoUrl} size={64} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{consultation.data.doctor.name}</Text>
              <Text style={type.caption}>{consultation.data.doctor.title}</Text>
            </View>
          </View>
          <MetaLine icon="calendar">{formatDate(consultation.data.startsAt, locale)}</MetaLine>
          <MetaLine icon="clock">
            {formatTime(consultation.data.startsAt, locale)} · {t("consult.mode")}
          </MetaLine>
          <MetaLine icon="check-circle">{t(`consult.status.${consultation.data.status}`)}</MetaLine>
          {isJoinOpen(consultation.data) ? (
            <Button
              label={t("consult.joinConsultation")}
              icon="video"
              variant="rose"
              onPress={() => router.replace(`/call/${consultation.data.id}`)}
              style={styles.action}
            />
          ) : (
            <Text style={[type.caption, styles.action]}>{t("consult.joinOpens")}</Text>
          )}
        </Card>
      )}

      <View style={styles.actions}>
        {!remindersEnabled ? (
          <Button label={t("profile.reminders")} icon="bell" variant="outline" onPress={turnOnReminders} />
        ) : null}
        <Button
          label={t("booking.viewDetails")}
          variant="outline"
          onPress={() => router.replace(`/consultations/${id}`)}
        />
        <Button label={t("booking.backHome")} onPress={() => router.dismissTo("/")} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", marginTop: spacing.xxl, marginBottom: spacing.xl, gap: spacing.sm },
  tick: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.sage,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.ink, textAlign: "center" },
  center: { textAlign: "center" },
  row: { flexDirection: "row", gap: spacing.md, alignItems: "center", marginBottom: spacing.sm },
  name: { fontFamily: fonts.display, fontSize: 21, color: colors.ink },
  action: { marginTop: spacing.lg },
  actions: { gap: spacing.md, marginTop: spacing.xl },
});
