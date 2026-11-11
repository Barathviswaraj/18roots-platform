import { Feather } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { toApiError } from "@/api/client";
import { useConfirmPayment, useCreateBooking, useDoctor } from "@/api/queries";
import { Screen } from "@/components/layout";
import { ErrorState, LoadingCards } from "@/components/states";
import { TextField } from "@/components/TextField";
import { toast } from "@/components/toast";
import { Button, Card, Divider, MetaLine, SectionHeader } from "@/components/ui";
import { DoctorHeader } from "@/features/booking/DoctorHeader";
import { collectPayment } from "@/features/booking/payment";
import { useLocale, useT } from "@/i18n";
import { isMock } from "@/lib/env";
import { formatDate, formatMoney, formatTime, newIdempotencyKey } from "@/lib/format";
import { bookingFormSchema, type BookingForm } from "@/lib/validation";
import { colors, fonts, spacing, type } from "@/theme";

export default function ReviewScreen() {
  const t = useT();
  const locale = useLocale();
  const { doctorId, slotId, startsAt } = useLocalSearchParams<{ doctorId: string; slotId: string; startsAt: string }>();
  const doctor = useDoctor(doctorId);
  const createBooking = useCreateBooking();
  const confirmPayment = useConfirmPayment();
  // One key for this booking attempt. Retries reuse it, so the backend returns
  // the same booking instead of creating and charging a second one.
  const [idempotencyKey] = useState(() => newIdempotencyKey("booking"));
  const [stage, setStage] = useState<"idle" | "paying" | "waiting">("idle");

  const schema = useMemo(() => bookingFormSchema(t), [t]);
  const { control, handleSubmit } = useForm<BookingForm>({
    resolver: zodResolver(schema),
    defaultValues: { reason: "", consent: false },
  });

  const pay = handleSubmit(async ({ reason }) => {
    if (stage !== "idle") return;
    setStage("paying");
    try {
      const booking = await createBooking.mutateAsync({
        input: { doctorId, slotId, reason: reason.trim() || null, consent: true },
        idempotencyKey,
      });
      const confirmed = await collectPayment(
        booking,
        (bookingId, paymentId) => confirmPayment.mutateAsync({ bookingId, paymentId }),
        () => setStage("waiting"),
      );
      router.replace(`/booking/confirmed/${confirmed.consultation.id}`);
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === "slot_unavailable") {
        toast.error(t("booking.slotTaken"));
        router.back();
      } else {
        toast.error(apiError.isNetwork ? t("common.errorBody") : t("booking.paymentFailed"));
      }
    } finally {
      setStage("idle");
    }
  });

  if (doctor.isPending) {
    return (
      <Screen title={t("booking.reviewTitle")}>
        <LoadingCards count={2} />
      </Screen>
    );
  }
  if (doctor.isError) {
    return (
      <Screen title={t("booking.reviewTitle")}>
        <ErrorState error={doctor.error} onRetry={() => doctor.refetch()} />
      </Screen>
    );
  }
  const data = doctor.data;
  const fee = data.fee.amount;

  return (
    <Screen
      title={t("booking.reviewTitle")}
      footer={
        <View>
          {isMock ? <Text style={[type.caption, styles.demo]}>{t("booking.demoPayment")}</Text> : null}
          {stage === "waiting" ? <Text style={[type.caption, styles.demo]}>{t("booking.waitingPayment")}</Text> : null}
          <Button
            label={stage === "idle" ? t("booking.pay", { amount: formatMoney(fee, locale) }) : t("booking.processing")}
            onPress={pay}
            loading={stage !== "idle"}
            icon="lock"
          />
        </View>
      }
    >
      <Card>
        <DoctorHeader doctor={data} />
        <Divider />
        <Text style={type.caption}>{t("booking.when")}</Text>
        <MetaLine icon="calendar">{formatDate(startsAt, locale)}</MetaLine>
        <MetaLine icon="clock">
          {formatTime(startsAt, locale)} · {t("doctors.duration", { minutes: data.consultationMinutes })} ·{" "}
          {t("consult.mode")}
        </MetaLine>
        <MetaLine icon="message-circle">{data.languages.join(", ")}</MetaLine>
      </Card>

      <SectionHeader icon="credit-card" title={t("booking.payment")} />
      <Card>
        <Line label={t("booking.consultationFee")} value={formatMoney(fee, locale)} />
        <Line label={t("booking.platformFee")} value={formatMoney(0, locale)} />
        <Divider />
        <Line label={t("booking.total")} value={formatMoney(fee, locale)} strong />
      </Card>

      <SectionHeader icon="shield" title={t("doctors.cancellationPolicy")} />
      <Text style={type.body}>{data.cancellationPolicy}</Text>

      <View style={styles.form}>
        <TextField
          control={control}
          name="reason"
          label={t("booking.reasonLabel")}
          multiline
          numberOfLines={3}
          maxLength={500}
        />
        <Controller
          control={control}
          name="consent"
          render={({ field: { value, onChange }, fieldState: { error } }) => (
            <View>
              <Pressable
                onPress={() => onChange(!value)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: value }}
                style={styles.consent}
              >
                <View style={[styles.box, value && styles.boxChecked]}>
                  {value ? <Feather name="check" size={14} color={colors.white} /> : null}
                </View>
                <Text style={[type.body, { flex: 1 }]}>{t("booking.consent")}</Text>
              </Pressable>
              {error ? <Text style={styles.error}>{error.message}</Text> : null}
            </View>
          )}
        />
      </View>
    </Screen>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={strong ? type.bodyStrong : type.body}>{label}</Text>
      <Text style={strong ? styles.total : type.bodyStrong}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  total: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  form: { marginTop: spacing.xl },
  consent: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", paddingVertical: spacing.sm },
  box: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.sage,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  boxChecked: { backgroundColor: colors.sageDark, borderColor: colors.sageDark },
  error: { color: colors.danger, fontFamily: fonts.body, fontSize: 12, marginLeft: 36 },
  demo: { textAlign: "center", marginBottom: spacing.sm },
});
