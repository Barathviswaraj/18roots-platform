import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useCarePlan, useSetDoseTaken, useSetGoalDone } from "@/api/queries";
import type { CarePlan, Dose, DoseSlot } from "@/api/schemas";
import { LeafIcon, LeafSprig } from "@/components/illustrations";
import { Screen } from "@/components/layout";
import { ProgressRing } from "@/components/ProgressRing";
import { EmptyState, ErrorState, LoadingCards } from "@/components/states";
import { toast } from "@/components/toast";
import { Avatar, Card, SectionHeader } from "@/components/ui";
import { useLocale, useT } from "@/i18n";
import { formatDate, formatTime } from "@/lib/format";
import { colors, fonts, radius, spacing, type } from "@/theme";

const SLOTS: DoseSlot[] = ["morning", "afternoon", "night"];

export default function CareScreen() {
  const t = useT();
  const plan = useCarePlan();

  return (
    <Screen tab title={t("care.title")} onRefresh={() => plan.refetch()} refreshing={plan.isRefetching}>
      {plan.isPending ? (
        <LoadingCards />
      ) : plan.isError ? (
        <ErrorState error={plan.error} onRetry={() => plan.refetch()} />
      ) : !plan.data ? (
        <EmptyState icon="feather" title={t("care.noPlan")} body={t("care.noPlanBody")} />
      ) : (
        <PlanView plan={plan.data} />
      )}
    </Screen>
  );
}

function PlanView({ plan }: { plan: CarePlan }) {
  const t = useT();
  const locale = useLocale();
  const taken = plan.doses.filter((dose) => dose.takenAt).length;
  const goalsDone = plan.goals.filter((goal) => goal.done).length;

  return (
    <View>
      <Card tone="sage" style={styles.summary}>
        <View style={styles.summaryRow}>
          <ProgressRing percent={plan.progressPercent} size={96} />
          <View style={{ flex: 1 }}>
            <Text style={styles.program}>{plan.programName}</Text>
            <Text style={type.label}>{t("home.weekOf", { week: plan.week, total: plan.totalWeeks })}</Text>
            <View style={styles.doctorRow}>
              <Avatar name={plan.doctor.name} uri={plan.doctor.photoUrl} size={28} shape="circle" />
              <Text style={type.caption} numberOfLines={1}>
                {t("care.guidedBy", { name: plan.doctor.name })}
              </Text>
            </View>
            {plan.nextReviewAt ? (
              <Text style={[type.caption, styles.review]}>
                {t("care.nextReview", {
                  date: formatDate(plan.nextReviewAt, locale, { day: "numeric", month: "short" }),
                })}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.sprig} pointerEvents="none">
          <LeafSprig size={52} opacity={0.7} />
        </View>
      </Card>

      <SectionHeader icon="sun" title={t("care.todayRoutine")} />
      <Text style={[type.caption, styles.sub]}>{t("care.dosesTaken", { taken, total: plan.doses.length })}</Text>
      <Card>
        {SLOTS.map((slot) => {
          const doses = plan.doses.filter((dose) => dose.slot === slot);
          if (!doses.length) return null;
          return (
            <View key={slot} style={styles.slot}>
              <Text style={styles.slotTitle}>{t(`care.slot.${slot}`)}</Text>
              {doses.map((dose) => (
                <DoseRow key={dose.id} dose={dose} locale={locale} />
              ))}
            </View>
          );
        })}
      </Card>

      <SectionHeader iconNode={<LeafIcon size={18} />} title={t("care.lifestyleGoals")} />
      <Text style={[type.caption, styles.sub]}>
        {t("care.goalsDone", { done: goalsDone, total: plan.goals.length })}
      </Text>
      <Card>
        {plan.goals.map((goal) => (
          <GoalRow key={goal.id} goalId={goal.id} title={goal.title} detail={goal.detail} done={goal.done} />
        ))}
      </Card>

      <SectionHeader icon="bar-chart-2" title={t("care.thisWeek")} />
      <Card>
        <View style={styles.week}>
          {plan.weekAdherence.map((day) => {
            const ratio = day.total ? day.taken / day.total : 0;
            return (
              <View key={day.date} style={styles.day}>
                <View style={styles.barTrack}>
                  <View
                    style={[styles.barFill, { height: `${Math.max(ratio * 100, 6)}%`, opacity: ratio ? 1 : 0.35 }]}
                  />
                </View>
                <Text style={styles.dayLabel}>{formatDate(day.date, locale, { weekday: "narrow" })}</Text>
              </View>
            );
          })}
        </View>
      </Card>

      {plan.notes.length ? (
        <>
          <SectionHeader icon="message-circle" title={t("care.doctorNotes")} />
          {plan.notes.map((note) => (
            <Card key={note.id} style={styles.note}>
              <Text style={styles.noteTitle}>{note.title}</Text>
              <Text style={type.body}>{note.body}</Text>
              <Text style={[type.caption, { marginTop: spacing.sm }]}>
                {plan.doctor.name} · {formatDate(note.sharedAt, locale, { day: "numeric", month: "short" })}
              </Text>
            </Card>
          ))}
        </>
      ) : null}
    </View>
  );
}

function DoseRow({ dose, locale }: { dose: Dose; locale: string }) {
  const t = useT();
  const setTaken = useSetDoseTaken();
  const taken = !!dose.takenAt;
  return (
    <Pressable
      onPress={() =>
        setTaken.mutate({ doseId: dose.id, taken: !taken }, { onError: () => toast.error(t("common.errorBody")) })
      }
      accessibilityRole="checkbox"
      accessibilityState={{ checked: taken }}
      style={styles.row}
    >
      <View style={[styles.box, taken && styles.boxDone]}>
        {taken ? <Feather name="check" size={14} color={colors.white} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, taken && styles.doneText]}>{dose.medicine}</Text>
        <Text style={type.caption}>
          {dose.instruction} · {dose.time}
        </Text>
      </View>
      {taken && dose.takenAt ? <Text style={styles.time}>{formatTime(dose.takenAt, locale)}</Text> : null}
    </Pressable>
  );
}

function GoalRow({
  goalId,
  title,
  detail,
  done,
}: {
  goalId: string;
  title: string;
  detail: string | null;
  done: boolean;
}) {
  const t = useT();
  const setDone = useSetGoalDone();
  return (
    <Pressable
      onPress={() => setDone.mutate({ goalId, done: !done }, { onError: () => toast.error(t("common.errorBody")) })}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      style={styles.row}
    >
      <View style={[styles.box, styles.round, done && styles.boxDone]}>
        {done ? <Feather name="check" size={14} color={colors.white} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, done && styles.doneText]}>{title}</Text>
        {detail ? <Text style={type.caption}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summary: { overflow: "hidden" },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  program: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, color: colors.ink },
  doctorRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.md, paddingRight: spacing.xl },
  review: { marginTop: 6 },
  sprig: { position: "absolute", right: 6, bottom: 0 },
  sub: { marginTop: -spacing.sm, marginBottom: spacing.md },
  slot: { marginBottom: spacing.sm },
  slotTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 10, minHeight: 52 },
  box: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.sage,
    alignItems: "center",
    justifyContent: "center",
  },
  round: { borderRadius: 13 },
  boxDone: { backgroundColor: colors.sage },
  doneText: { color: colors.muted, textDecorationLine: "line-through" },
  time: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.sageDark },
  week: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 110 },
  day: { alignItems: "center", flex: 1, gap: 6 },
  barTrack: {
    height: 80,
    width: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.sageTint,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: { width: "100%", backgroundColor: colors.sage, borderRadius: radius.pill },
  dayLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted },
  note: { marginBottom: spacing.md },
  noteTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.ink, marginBottom: 4 },
});
