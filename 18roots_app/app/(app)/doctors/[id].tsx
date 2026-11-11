import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useDoctor, useSlots } from "@/api/queries";
import type { Slot } from "@/api/schemas";
import { Screen } from "@/components/layout";
import { ErrorState, LoadingCards, Skeleton } from "@/components/states";
import { Button, Card, SectionHeader } from "@/components/ui";
import { DoctorHeader } from "@/features/booking/DoctorHeader";
import { useLocale, useT } from "@/i18n";
import { formatDayChip, formatMoney, formatTime, toDateKey } from "@/lib/format";
import { colors, fonts, radius, spacing, type } from "@/theme";

function nextDays(count: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() + index);
    return day;
  });
}

export default function DoctorScreen() {
  const t = useT();
  const locale = useLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const doctor = useDoctor(id);
  const days = useMemo(() => nextDays(7), []);
  const [dayKey, setDayKey] = useState(() => toDateKey(days[0]));
  const slots = useSlots(id, dayKey);
  const [selected, setSelected] = useState<Slot | null>(null);

  if (doctor.isPending) {
    return (
      <Screen title={t("doctors.title")}>
        <LoadingCards count={2} />
      </Screen>
    );
  }
  if (doctor.isError) {
    return (
      <Screen title={t("doctors.title")}>
        <ErrorState error={doctor.error} onRetry={() => doctor.refetch()} />
      </Screen>
    );
  }
  const data = doctor.data;

  return (
    <Screen
      title={data.name}
      footer={
        <Button
          label={
            selected ? `${t("common.continue")} · ${formatTime(selected.startsAt, locale)}` : t("doctors.selectTime")
          }
          disabled={!selected}
          onPress={() =>
            selected &&
            router.push({
              pathname: "/booking/review",
              params: { doctorId: data.id, slotId: selected.id, startsAt: selected.startsAt },
            })
          }
        />
      }
    >
      <Card>
        <DoctorHeader doctor={data} />
        <View style={styles.facts}>
          <Fact label={t("doctors.fee")} value={formatMoney(data.fee.amount, locale)} />
          <Fact label={t("doctors.languages")} value={data.languages.join(", ")} />
          <Fact label={t("doctors.qualifications")} value={data.qualifications.join(", ")} />
        </View>
        <Text style={type.caption}>{t("doctors.registration", { number: data.registrationNumber })}</Text>
      </Card>

      <SectionHeader icon="calendar" title={t("doctors.selectTime")} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
        {days.map((day) => {
          const key = toDateKey(day);
          const chip = formatDayChip(day, locale);
          const active = key === dayKey;
          return (
            <Pressable
              key={key}
              onPress={() => {
                setDayKey(key);
                setSelected(null);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.day, active && styles.dayActive]}
            >
              <Text style={[styles.dayWeek, active && styles.onActive]}>{chip.weekday}</Text>
              <Text style={[styles.dayNumber, active && styles.onActive]}>{chip.day}</Text>
              <Text style={[styles.dayWeek, active && styles.onActive]}>{chip.month}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {slots.isPending ? (
        <Skeleton height={120} />
      ) : slots.isError ? (
        <ErrorState error={slots.error} onRetry={() => slots.refetch()} />
      ) : slots.data.filter((slot) => slot.available).length === 0 ? (
        <Text style={[type.body, styles.empty]}>{t("doctors.noSlots")}</Text>
      ) : (
        <View style={styles.slots}>
          {slots.data.map((slot) => {
            const active = selected?.id === slot.id;
            return (
              <Pressable
                key={slot.id}
                disabled={!slot.available}
                onPress={() => setSelected(slot)}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: !slot.available }}
                style={[styles.slot, active && styles.slotActive, !slot.available && styles.slotTaken]}
              >
                <Text style={[styles.slotText, active && styles.onActive, !slot.available && styles.slotTakenText]}>
                  {formatTime(slot.startsAt, locale)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <Text style={[type.caption, styles.duration]}>
        {t("doctors.duration", { minutes: data.consultationMinutes })}
      </Text>

      <SectionHeader icon="info" title={t("doctors.about")} />
      <Text style={type.body}>{data.about}</Text>
      <SectionHeader icon="shield" title={t("doctors.cancellationPolicy")} />
      <Text style={type.body}>{data.cancellationPolicy}</Text>
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={type.caption}>{label}</Text>
      <Text style={type.bodyStrong}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  facts: { marginVertical: spacing.lg, gap: spacing.md },
  fact: { gap: 2 },
  days: { gap: spacing.sm, paddingBottom: spacing.lg },
  day: {
    width: 62,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayActive: { backgroundColor: colors.sageDark, borderColor: colors.sageDark },
  dayWeek: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.muted },
  dayNumber: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  onActive: { color: colors.white },
  slots: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  slot: {
    width: "31%",
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  slotActive: { backgroundColor: colors.sageDark, borderColor: colors.sageDark },
  slotTaken: { backgroundColor: colors.surfaceMuted, borderColor: colors.surfaceMuted },
  slotText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  slotTakenText: { color: colors.faint, textDecorationLine: "line-through" },
  empty: { textAlign: "center", paddingVertical: spacing.lg },
  duration: { marginTop: spacing.md },
});
