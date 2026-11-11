import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";

import { toApiError } from "@/api/client";
import { useCancelConsultation, useConsultation } from "@/api/queries";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Screen } from "@/components/layout";
import { ErrorState, LoadingCards } from "@/components/states";
import { toast } from "@/components/toast";
import { Avatar, Button, Card, Divider, ListRow, MetaLine, SectionHeader, StatusPill } from "@/components/ui";
import { STATUS_TONE } from "@/features/consult/ConsultationCard";
import { useLocale, useT } from "@/i18n";
import { env } from "@/lib/env";
import { formatDate, formatTime, isJoinOpen } from "@/lib/format";
import { colors, fonts, spacing, type } from "@/theme";

export default function ConsultationScreen() {
  const t = useT();
  const locale = useLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const consultation = useConsultation(id);
  const cancel = useCancelConsultation();
  const [confirming, setConfirming] = useState(false);

  if (consultation.isPending) {
    return (
      <Screen title={t("consult.detailTitle")}>
        <LoadingCards count={2} />
      </Screen>
    );
  }
  if (consultation.isError) {
    return (
      <Screen title={t("consult.detailTitle")}>
        <ErrorState error={consultation.error} onRetry={() => consultation.refetch()} />
      </Screen>
    );
  }
  const item = consultation.data;
  const open = isJoinOpen(item);

  return (
    <Screen
      title={t("consult.detailTitle")}
      onRefresh={() => consultation.refetch()}
      refreshing={consultation.isRefetching}
      footer={
        open ? (
          <Button
            label={t("consult.joinConsultation")}
            icon="video"
            variant="rose"
            onPress={() => router.push(`/call/${item.id}`)}
          />
        ) : undefined
      }
    >
      <Card>
        <View style={styles.row}>
          <Avatar name={item.doctor.name} uri={item.doctor.photoUrl} size={72} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.doctor.name}</Text>
            <Text style={[type.caption, styles.title]}>{item.doctor.title}</Text>
            <StatusPill label={t(`consult.status.${item.status}`)} tone={STATUS_TONE[item.status]} />
          </View>
        </View>
        <Divider />
        <MetaLine icon="calendar">{formatDate(item.startsAt, locale)}</MetaLine>
        <MetaLine icon="clock">
          {formatTime(item.startsAt, locale)} – {formatTime(item.endsAt, locale)}
        </MetaLine>
        <MetaLine icon="video">{t("consult.mode")}</MetaLine>
        {!open && ["confirmed", "pending_payment"].includes(item.status) ? (
          <Text style={[type.caption, styles.hint]}>{t("consult.joinOpens")}</Text>
        ) : null}
      </Card>

      {item.reason ? (
        <>
          <SectionHeader icon="edit-3" title={t("consult.reason")} />
          <Text style={type.body}>{item.reason}</Text>
        </>
      ) : null}

      {item.followUp.length ? (
        <>
          <SectionHeader icon="message-circle" title={t("consult.followUp")} />
          {item.followUp.map((note) => (
            <Card key={note.id} style={styles.note}>
              <Text style={styles.noteTitle}>{note.title}</Text>
              <Text style={type.body}>{note.body}</Text>
            </Card>
          ))}
        </>
      ) : null}

      <SectionHeader icon="shield" title={t("doctors.cancellationPolicy")} />
      <Text style={type.body}>{item.cancellationPolicy}</Text>

      <Card style={styles.actions}>
        <ListRow
          icon="phone"
          title={t("profile.help")}
          subtitle={env.supportPhone}
          onPress={() => Linking.openURL(`tel:${env.supportPhone}`)}
        />
        {item.canCancel ? (
          <>
            <Divider />
            <ListRow icon="x-circle" title={t("consult.cancel")} danger onPress={() => setConfirming(true)} />
          </>
        ) : null}
      </Card>

      <ConfirmDialog
        visible={confirming}
        message={t("consult.cancelConfirm", { policy: item.cancellationPolicy })}
        confirmLabel={t("consult.cancel")}
        danger
        loading={cancel.isPending}
        onDismiss={() => setConfirming(false)}
        onConfirm={() =>
          cancel.mutate(item.id, {
            onSuccess: () => {
              setConfirming(false);
              toast.info(t("consult.cancelled"));
            },
            onError: (error) => {
              setConfirming(false);
              toast.error(toApiError(error).message);
            },
          })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  name: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  title: { marginBottom: 6 },
  hint: { marginTop: spacing.md },
  note: { marginBottom: spacing.md },
  noteTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.ink, marginBottom: 4 },
  actions: { marginTop: spacing.xl, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
});
