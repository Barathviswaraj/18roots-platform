import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { toApiError } from "@/api/client";
import { getCallCredentials, type CallCredentials } from "@/api/meeting";
import { useConsultation } from "@/api/queries";
import { LotusScene } from "@/components/illustrations";
import { ErrorState, LoadingCards } from "@/components/states";
import { Avatar, Button, Card } from "@/components/ui";
import { CallRoom } from "@/features/call/CallRoom";
import { useLocale, useT, type TranslationKey } from "@/i18n";
import { formatTime, isJoinOpen } from "@/lib/format";
import { colors, fonts, spacing, type } from "@/theme";

type Phase = "lobby" | "joining" | "in_call" | "left" | "failed";

const TIPS: { icon: "lock" | "headphones" | "battery-charging"; key: TranslationKey }[] = [
  { icon: "lock", key: "call.tip.private" },
  { icon: "headphones", key: "call.tip.earphones" },
  { icon: "battery-charging", key: "call.tip.battery" },
];

export default function CallScreen() {
  const t = useT();
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const consultation = useConsultation(id);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [credentials, setCredentials] = useState<CallCredentials | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  // A fresh token every time: join tokens last 10 minutes, so rejoining after a
  // drop always asks the meeting service again.
  const join = async () => {
    if (!consultation.data) return;
    setPhase("joining");
    setFailure(null);
    try {
      setCredentials(await getCallCredentials(consultation.data));
      setPhase("in_call");
    } catch (error) {
      const apiError = toApiError(error);
      setFailure(apiError.code === "call_unavailable" ? t("call.demoUnavailable") : t("call.failed"));
      setPhase("failed");
    }
  };

  if (phase === "in_call" && credentials && consultation.data) {
    return (
      <CallRoom
        credentials={credentials}
        doctorName={consultation.data.doctor.name}
        onLeave={() => setPhase("left")}
        onFailed={(message) => {
          // LiveKit already provides a useful connection error (for example,
          // an invalid token or a blocked camera). Keep it visible so people
          // can act on the real problem instead of a generic retry message.
          setFailure(message || t("call.failed"));
          setPhase("failed");
        }}
      />
    );
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.lg }]}>
      <Pressable
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel={t("common.close")}
        style={styles.close}
        hitSlop={10}
      >
        <Feather name="x" size={24} color={colors.ink} />
      </Pressable>

      {consultation.isPending ? (
        <LoadingCards count={1} />
      ) : consultation.isError ? (
        <ErrorState error={consultation.error} onRetry={() => consultation.refetch()} />
      ) : (
        <View style={styles.body}>
          <View style={styles.art} pointerEvents="none">
            <LotusScene width={200} height={190} />
          </View>
          <Avatar
            name={consultation.data.doctor.name}
            uri={consultation.data.doctor.photoUrl}
            size={92}
            shape="circle"
          />
          <Text style={styles.title}>{phase === "left" ? t("call.left") : t("call.lobbyTitle")}</Text>
          <Text style={[type.body, styles.center]}>
            {consultation.data.doctor.name} · {formatTime(consultation.data.startsAt, locale)}
          </Text>

          {phase === "failed" && failure ? (
            <Card tone="rose" style={styles.notice}>
              <Text style={type.body}>{failure}</Text>
            </Card>
          ) : null}

          {phase === "lobby" || phase === "joining" ? (
            <Card style={styles.tips}>
              <Text style={[type.label, styles.tipsTitle]}>{t("call.lobbyBody")}</Text>
              {TIPS.map((tip) => (
                <View key={tip.key} style={styles.tip}>
                  <Feather name={tip.icon} size={16} color={colors.sageDark} />
                  <Text style={type.body}>{t(tip.key)}</Text>
                </View>
              ))}
            </Card>
          ) : null}

          <View style={styles.actions}>
            {isJoinOpen(consultation.data) ? (
              <Button
                label={
                  phase === "lobby" || phase === "joining"
                    ? t("call.joinNow")
                    : phase === "left"
                      ? t("call.rejoin")
                      : t("common.retry")
                }
                icon="video"
                variant="rose"
                loading={phase === "joining"}
                onPress={join}
              />
            ) : (
              <Text style={[type.body, styles.center]}>{t("call.notOpen")}</Text>
            )}
            <Button label={t("common.back")} variant="outline" onPress={close} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  body: { flex: 1, alignItems: "center", paddingTop: spacing.lg },
  art: { position: "absolute", right: -30, top: -30, opacity: 0.55 },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.ink, marginTop: spacing.lg, textAlign: "center" },
  center: { textAlign: "center" },
  notice: { marginTop: spacing.lg, alignSelf: "stretch" },
  tips: { marginTop: spacing.xl, alignSelf: "stretch", gap: spacing.md },
  tipsTitle: { marginBottom: 2 },
  tip: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  actions: { marginTop: "auto", alignSelf: "stretch", gap: spacing.md },
});
