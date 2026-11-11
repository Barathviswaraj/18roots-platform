import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useSetDoseTaken } from "@/api/queries";
import type { Consultation, Dose, HomeSection, Milestone, Order } from "@/api/schemas";
import { LeafIcon, LeafSprig, MortarIllustration, ProductBox } from "@/components/illustrations";
import { OrderStepper } from "@/components/OrderStepper";
import { ProgressRing } from "@/components/ProgressRing";
import { toast } from "@/components/toast";
import { Avatar, Button, Card, MetaLine, SectionHeader } from "@/components/ui";
import { useLocale, useT, type TranslationKey } from "@/i18n";
import { formatDate, formatTime, isJoinOpen } from "@/lib/format";
import { colors, fonts, radius, spacing, type } from "@/theme";

type SectionData<T extends HomeSection["type"]> = Extract<HomeSection, { type: T }>["data"];

// Renders one server-chosen section. A new type gets a case here; the schema
// filter in homeApi already drops types this version does not know.
export const HomeSectionView = memo(function HomeSectionView({ section }: { section: HomeSection }) {
  switch (section.type) {
    case "care_journey":
      return <CareJourneyCard data={section.data} />;
    case "upcoming_consultation":
      return <UpcomingConsultation consultation={section.data.consultation} />;
    case "medicine_reminder":
      return <MedicineReminder data={section.data} />;
    case "order_tracking":
      return <OrderTracking order={section.data.order} />;
    default: {
      const unknown: never = section;
      return unknown;
    }
  }
});

function MilestoneRow({ milestone }: { milestone: Milestone }) {
  const done = milestone.state === "done";
  const active = milestone.state === "in_progress";
  return (
    <View style={styles.milestone}>
      <View style={[styles.check, done && styles.checkDone, active && styles.checkActive]}>
        <Feather name="check" size={12} color={done ? colors.white : active ? colors.sageDark : colors.faint} />
      </View>
      <Text style={styles.milestoneText} numberOfLines={2}>
        {milestone.label}
      </Text>
    </View>
  );
}

function CareJourneyCard({ data }: { data: SectionData<"care_journey"> }) {
  const t = useT();
  return (
    <Card tone="sage" style={styles.journey} onPress={() => router.push("/care")} accessibilityLabel={data.programName}>
      <View style={styles.sprig} pointerEvents="none">
        <LeafSprig size={46} opacity={0.6} />
      </View>
      <View style={styles.journeyHeader}>
        <Text style={styles.cardTitle}>{t("home.yourProgram", { program: data.programName })}</Text>
        <Text style={type.caption}>{t("home.weekOf", { week: data.week, total: data.totalWeeks })}</Text>
      </View>
      <View style={styles.journeyBody}>
        <ProgressRing percent={data.progressPercent} size={80} stroke={8} />
        <View style={styles.milestones}>
          {data.milestones.map((milestone) => (
            <MilestoneRow key={milestone.id} milestone={milestone} />
          ))}
        </View>
        <View style={styles.chevron}>
          <Feather name="chevron-right" size={18} color={colors.ink} />
        </View>
      </View>
    </Card>
  );
}

function UpcomingConsultation({ consultation }: { consultation: Consultation | null }) {
  const t = useT();
  const locale = useLocale();
  return (
    <View>
      <SectionHeader
        icon="calendar"
        title={t("home.upcomingConsultation")}
        actionLabel={t("common.viewAll")}
        onAction={() => router.push("/consult")}
      />
      {consultation ? (
        <Card
          onPress={() => router.push(`/consultations/${consultation.id}`)}
          accessibilityLabel={consultation.doctor.name}
          hasActions
        >
          <View style={styles.sprig} pointerEvents="none">
            <LeafSprig size={36} opacity={0.45} />
          </View>
          <View style={styles.consultRow}>
            <Avatar name={consultation.doctor.name} uri={consultation.doctor.photoUrl} size={76} />
            <View style={styles.consultInfo}>
              <View style={styles.consultTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {consultation.doctor.name}
                  </Text>
                  <Text style={type.caption}>{consultation.doctor.title}</Text>
                </View>
                {isJoinOpen(consultation) ? (
                  <Button
                    label={t("home.join")}
                    variant="rose"
                    compact
                    onPress={() => router.push(`/call/${consultation.id}`)}
                  />
                ) : (
                  <Button
                    label={t("home.details")}
                    variant="outline"
                    compact
                    onPress={() => router.push(`/consultations/${consultation.id}`)}
                  />
                )}
              </View>
              <MetaLine icon="calendar">{formatDate(consultation.startsAt, locale)}</MetaLine>
              <MetaLine icon="clock">
                {formatTime(consultation.startsAt, locale)} | {t("home.videoConsultation")}
              </MetaLine>
            </View>
          </View>
        </Card>
      ) : (
        <Card>
          <Text style={type.body}>{t("home.noConsultation")}</Text>
          <Button
            label={t("home.bookNow")}
            onPress={() => router.push("/doctors")}
            compact
            style={styles.inlineButton}
          />
        </Card>
      )}
    </View>
  );
}

const DOSE_TITLES: Record<Dose["slot"], TranslationKey> = {
  morning: "home.takeDose.morning",
  afternoon: "home.takeDose.afternoon",
  night: "home.takeDose.night",
};

function MedicineReminder({ data }: { data: SectionData<"medicine_reminder"> }) {
  const t = useT();
  const locale = useLocale();
  const setTaken = useSetDoseTaken();
  const dose = data.dose;

  return (
    <View>
      <SectionHeader
        iconNode={<LeafIcon size={18} />}
        title={t("home.medicineReminder")}
        actionLabel={t("home.viewPlan")}
        onAction={() => router.push("/care")}
      />
      <Card tone="rose">
        {dose ? (
          <View style={styles.doseRow}>
            <MortarIllustration size={64} />
            <View style={styles.doseText}>
              <Text style={styles.cardTitle}>{t(DOSE_TITLES[dose.slot])}</Text>
              <Text style={type.caption}>{dose.medicine}</Text>
              <View style={styles.doseMeta}>
                <Feather name="clock" size={12} color={colors.roseDark} />
                <Text style={styles.doseInstruction}>{dose.instruction}</Text>
              </View>
              {dose.takenAt ? (
                <View style={styles.takenPill}>
                  <Feather name="check-circle" size={16} color={colors.sageDark} />
                  <Text style={styles.takenText}>{t("home.taken", { time: formatTime(dose.takenAt, locale) })}</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() =>
                    setTaken.mutate(
                      { doseId: dose.id, taken: true },
                      { onError: () => toast.error(t("common.errorBody")) },
                    )
                  }
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.markButton, pressed && { opacity: 0.8 }]}
                >
                  <Feather name="check-circle" size={16} color={colors.sageDark} />
                  <Text style={styles.markText}>{t("home.markTaken")}</Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.doseRow}>
            <MortarIllustration size={56} />
            <Text style={[type.bodyStrong, { flex: 1 }]}>{t("home.allDosesDone")}</Text>
          </View>
        )}
      </Card>
    </View>
  );
}

function OrderTracking({ order }: { order: Order }) {
  const t = useT();
  return (
    <View>
      <SectionHeader
        icon="package"
        title={t("home.medicineOrder")}
        actionLabel={t("home.trackAll")}
        onAction={() => router.push("/orders")}
      />
      <Card
        onPress={() => router.push(`/orders/${order.id}`)}
        accessibilityLabel={t("home.order", { number: order.number })}
      >
        <View style={styles.orderRow}>
          <ProductBox size={68} />
          <View style={{ flex: 1 }}>
            <Text style={type.caption}>{t("home.order", { number: order.number })}</Text>
            <Text style={styles.cardTitle}>{t(`orders.status.${order.status}`)}</Text>
          </View>
          <View style={styles.chevron}>
            <Feather name="chevron-right" size={18} color={colors.ink} />
          </View>
        </View>
        <View style={styles.stepper}>
          <OrderStepper status={order.status} />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24, color: colors.ink },
  journey: { overflow: "hidden", marginTop: spacing.md },
  journeyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  journeyBody: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  milestones: { flex: 1, gap: 9 },
  milestone: { flexDirection: "row", alignItems: "center", gap: 7 },
  milestoneText: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 16, color: colors.inkSoft, flex: 1 },
  check: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.faint,
    alignItems: "center",
    justifyContent: "center",
  },
  checkDone: { backgroundColor: colors.sage, borderColor: colors.sage },
  checkActive: { borderColor: colors.sageDark },
  chevron: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sprig: { position: "absolute", right: 4, bottom: 0 },
  consultRow: { flexDirection: "row", gap: spacing.md },
  consultInfo: { flex: 1 },
  consultTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  inlineButton: { marginTop: spacing.md, alignSelf: "flex-start" },
  doseRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  doseText: { flex: 1, alignItems: "flex-start" },
  doseMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  doseInstruction: { fontFamily: fonts.body, fontSize: 12, color: colors.roseDark },
  markButton: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  markText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink },
  takenPill: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.sageTint,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  takenText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.sageDark, flexShrink: 1 },
  orderRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepper: { marginTop: spacing.lg, paddingHorizontal: 2 },
});
