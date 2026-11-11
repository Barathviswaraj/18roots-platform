import { Feather } from "@expo/vector-icons";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { Doctor } from "@/api/schemas";
import { Avatar } from "@/components/ui";
import { useT } from "@/i18n";
import { colors, fonts, spacing, type } from "@/theme";

// Name, verification and credentials, shown together before anyone pays.
export const DoctorHeader = memo(function DoctorHeader({ doctor, size = 72 }: { doctor: Doctor; size?: number }) {
  const t = useT();
  return (
    <View style={styles.row}>
      <Avatar name={doctor.name} uri={doctor.photoUrl} size={size} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{doctor.name}</Text>
        <Text style={type.caption}>{doctor.title}</Text>
        <View style={styles.badges}>
          {doctor.verified ? (
            <View style={styles.verified}>
              <Feather name="shield" size={12} color={colors.sageDark} />
              <Text style={styles.verifiedText}>{t("doctors.verified")}</Text>
            </View>
          ) : null}
          {doctor.rating ? (
            <View style={styles.rating}>
              <Feather name="star" size={12} color={colors.warning} />
              <Text style={styles.ratingText}>{doctor.rating.toFixed(1)}</Text>
            </View>
          ) : null}
          <Text style={type.caption}>{t("doctors.experience", { years: doctor.experienceYears })}</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  name: { fontFamily: fonts.display, fontSize: 21, lineHeight: 25, color: colors.ink },
  badges: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 6 },
  verified: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.sageLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  verifiedText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.sageDark },
  rating: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink },
});
