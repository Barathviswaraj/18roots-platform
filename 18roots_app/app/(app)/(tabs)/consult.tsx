import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useConsultations } from "@/api/queries";
import { LeafSprig } from "@/components/illustrations";
import { Screen } from "@/components/layout";
import { EmptyState, ErrorState, LoadingCards } from "@/components/states";
import { Button, Card, Chip } from "@/components/ui";
import { ConsultationCard } from "@/features/consult/ConsultationCard";
import { useT } from "@/i18n";
import { colors, fonts, spacing, type } from "@/theme";

export default function ConsultScreen() {
  const t = useT();
  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");
  const consultations = useConsultations(scope);

  return (
    <Screen
      tab
      title={t("consult.title")}
      onRefresh={() => consultations.refetch()}
      refreshing={consultations.isRefetching}
    >
      <Card tone="rose" style={styles.book}>
        <View style={{ flex: 1, paddingRight: spacing.xl }}>
          <Text style={styles.bookTitle}>{t("consult.bookTitle")}</Text>
          <Text style={type.body}>{t("consult.bookBody")}</Text>
          <Button
            label={t("home.bookNow")}
            icon="plus"
            compact
            onPress={() => router.push("/doctors")}
            style={styles.bookButton}
          />
        </View>
        <View style={styles.sprig} pointerEvents="none">
          <LeafSprig size={70} opacity={0.8} />
        </View>
      </Card>

      <View style={styles.tabs}>
        <Chip label={t("consult.upcoming")} selected={scope === "upcoming"} onPress={() => setScope("upcoming")} />
        <Chip label={t("consult.past")} selected={scope === "past"} onPress={() => setScope("past")} />
      </View>

      {consultations.isPending ? (
        <LoadingCards count={2} />
      ) : consultations.isError ? (
        <ErrorState error={consultations.error} onRetry={() => consultations.refetch()} />
      ) : consultations.data.length === 0 ? (
        <EmptyState
          icon="calendar"
          title={scope === "upcoming" ? t("consult.emptyUpcoming") : t("consult.emptyPast")}
        />
      ) : (
        consultations.data.map((item) => <ConsultationCard key={item.id} consultation={item} />)
      )}
      {scope === "upcoming" && consultations.data?.length ? (
        <Text style={[type.caption, styles.note]}>{t("consult.joinOpens")}</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  book: { overflow: "hidden", flexDirection: "row" },
  bookTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.ink, marginBottom: 4 },
  bookButton: { alignSelf: "flex-start", marginTop: spacing.md },
  sprig: { position: "absolute", right: 0, bottom: -4 },
  tabs: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.lg },
  note: { textAlign: "center", marginTop: spacing.sm },
});
