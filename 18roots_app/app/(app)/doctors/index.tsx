import { router } from "expo-router";
import { useDeferredValue, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Searchbar } from "react-native-paper";

import { useDoctors } from "@/api/queries";
import { Screen } from "@/components/layout";
import { EmptyState, ErrorState, LoadingCards } from "@/components/states";
import { Card, Chip, MetaLine } from "@/components/ui";
import { DoctorHeader } from "@/features/booking/DoctorHeader";
import { useLocale, useT } from "@/i18n";
import { formatDate, formatMoney, formatTime } from "@/lib/format";
import { colors, fonts, spacing } from "@/theme";

const LANGUAGES = ["Tamil", "English", "Malayalam", "Hindi"];

export default function DoctorsScreen() {
  const t = useT();
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<string | undefined>();
  const deferredQuery = useDeferredValue(query.trim());
  const doctors = useDoctors({ query: deferredQuery || undefined, language });

  return (
    <Screen title={t("doctors.title")} onRefresh={() => doctors.refetch()} refreshing={doctors.isRefetching}>
      <Searchbar
        value={query}
        onChangeText={setQuery}
        placeholder={t("doctors.search")}
        style={styles.search}
        inputStyle={styles.searchInput}
        iconColor={colors.muted}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label={t("doctors.all")} selected={!language} onPress={() => setLanguage(undefined)} />
        {LANGUAGES.map((item) => (
          <Chip key={item} label={item} selected={language === item} onPress={() => setLanguage(item)} />
        ))}
      </ScrollView>

      {doctors.isPending ? (
        <LoadingCards count={3} />
      ) : doctors.isError ? (
        <ErrorState error={doctors.error} onRetry={() => doctors.refetch()} />
      ) : doctors.data.length === 0 ? (
        <EmptyState icon="search" title={t("doctors.empty")} />
      ) : (
        doctors.data.map((doctor) => (
          <Card
            key={doctor.id}
            style={styles.card}
            onPress={() => router.push(`/doctors/${doctor.id}`)}
            accessibilityLabel={doctor.name}
          >
            <DoctorHeader doctor={doctor} size={64} />
            <Text style={styles.specialties} numberOfLines={1}>
              {doctor.specialties.join(" · ")}
            </Text>
            <View style={styles.footer}>
              <View>
                <MetaLine icon="message-circle">{doctor.languages.join(", ")}</MetaLine>
                {doctor.nextAvailableAt ? (
                  <MetaLine icon="clock">
                    {t("doctors.nextAvailable", {
                      time: `${formatDate(doctor.nextAvailableAt, locale, { weekday: "short", day: "numeric", month: "short" })}, ${formatTime(doctor.nextAvailableAt, locale)}`,
                    })}
                  </MetaLine>
                ) : null}
              </View>
              <Text style={styles.fee}>{formatMoney(doctor.fee.amount, locale)}</Text>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    elevation: 0,
  },
  searchInput: { fontFamily: fonts.body, fontSize: 15 },
  chips: { gap: spacing.sm, paddingVertical: spacing.lg },
  card: { marginBottom: spacing.md },
  specialties: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.sageDark, marginTop: spacing.md },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  fee: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
});
