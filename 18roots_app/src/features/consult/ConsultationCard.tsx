import { router } from "expo-router";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { Consultation, ConsultationStatus } from "@/api/schemas";
import { Avatar, Button, Card, MetaLine, StatusPill } from "@/components/ui";
import { useLocale, useT } from "@/i18n";
import { formatDate, formatTime, isJoinOpen } from "@/lib/format";
import { colors, fonts, spacing } from "@/theme";

export const STATUS_TONE: Record<ConsultationStatus, "sage" | "rose" | "muted" | "danger"> = {
  pending_payment: "rose",
  confirmed: "sage",
  in_progress: "sage",
  completed: "muted",
  cancelled: "danger",
  missed: "danger",
};

export const ConsultationCard = memo(function ConsultationCard({ consultation }: { consultation: Consultation }) {
  const t = useT();
  const locale = useLocale();
  const open = isJoinOpen(consultation);
  return (
    <Card
      style={styles.card}
      onPress={() => router.push(`/consultations/${consultation.id}`)}
      accessibilityLabel={consultation.doctor.name}
      hasActions={open}
    >
      <View style={styles.row}>
        <Avatar name={consultation.doctor.name} uri={consultation.doctor.photoUrl} size={60} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {consultation.doctor.name}
          </Text>
          <Text style={styles.title}>{consultation.doctor.title}</Text>
          <StatusPill label={t(`consult.status.${consultation.status}`)} tone={STATUS_TONE[consultation.status]} />
        </View>
      </View>
      <View style={styles.meta}>
        <MetaLine icon="calendar">{formatDate(consultation.startsAt, locale)}</MetaLine>
        <MetaLine icon="clock">{formatTime(consultation.startsAt, locale)}</MetaLine>
      </View>
      {open ? (
        <Button
          label={t("consult.joinConsultation")}
          icon="video"
          variant="rose"
          onPress={() => router.push(`/call/${consultation.id}`)}
          style={styles.join}
        />
      ) : null}
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  row: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  name: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  title: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginBottom: 6 },
  meta: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm },
  join: { marginTop: spacing.md },
});
