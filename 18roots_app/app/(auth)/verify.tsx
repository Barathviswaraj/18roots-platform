import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

import { toApiError } from "@/api/client";
import { authApi } from "@/api/endpoints";
import { Screen } from "@/components/layout";
import { TextField } from "@/components/TextField";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui";
import { useT } from "@/i18n";
import { formatPhone } from "@/lib/format";
import { otpFormSchema, type OtpForm } from "@/lib/validation";
import { useAuth } from "@/store/auth";
import { useOtpFlow, type OtpFlow } from "@/store/otpFlow";
import { colors, fonts, spacing, type } from "@/theme";

export default function Verify() {
  const flow = useOtpFlow((state) => state.flow);
  // Opened directly (a reload or an old link): start again from sign-in.
  if (!flow) return <Redirect href="/sign-in" />;
  return <VerifyForm flow={flow} />;
}

function VerifyForm({ flow }: { flow: OtpFlow }) {
  const t = useT();
  const [secondsLeft, setSecondsLeft] = useState(flow.resendAfter);
  const schema = useMemo(() => otpFormSchema(t), [t]);
  const { control, handleSubmit, setError } = useForm<OtpForm>({
    resolver: zodResolver(schema),
    defaultValues: { code: "" },
  });

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const verify = useMutation({
    mutationFn: (code: string) => authApi.verifyOtp({ requestId: flow.requestId, phone: flow.phone, code }),
    // Signing in flips the protected routes, which opens the home screen.
    onSuccess: async (session) => {
      await useAuth.getState().signIn(session);
      useOtpFlow.getState().clear();
    },
    onError: (error) => setError("code", { message: toApiError(error).message }),
  });

  const resend = useMutation({
    mutationFn: () => authApi.requestOtp(flow.phone),
    onSuccess: (result) => {
      useOtpFlow.getState().update({ requestId: result.requestId, demoCode: result.demoCode ?? null });
      setSecondsLeft(result.resendAfterSeconds);
      toast.info(t("auth.codeSent"));
    },
    onError: (error) => toast.error(toApiError(error).message),
  });

  const submit = handleSubmit((values) => verify.mutate(values.code));

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen title={t("auth.verifyTitle")}>
        <Text style={[type.body, styles.subtitle]}>{t("auth.verifySubtitle", { phone: formatPhone(flow.phone) })}</Text>
        <TextField
          control={control}
          name="code"
          label={t("auth.codeLabel")}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={6}
          autoFocus
          onSubmitEditing={submit}
        />
        {flow.demoCode ? <Text style={styles.demo}>{t("auth.demoCode", { code: flow.demoCode })}</Text> : null}
        <Button label={t("auth.verify")} onPress={submit} loading={verify.isPending} style={styles.cta} />
        <View style={styles.links}>
          {secondsLeft > 0 ? (
            <Text style={type.caption}>{t("auth.resendIn", { seconds: secondsLeft })}</Text>
          ) : (
            <Button
              label={t("auth.resend")}
              onPress={() => resend.mutate()}
              variant="ghost"
              compact
              loading={resend.isPending}
            />
          )}
          <Button label={t("auth.changeNumber")} onPress={() => router.back()} variant="ghost" compact />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  subtitle: { marginBottom: spacing.lg, fontFamily: fonts.bodyMedium },
  demo: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.sageDark,
    backgroundColor: colors.sageTint,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  cta: { marginTop: spacing.lg },
  links: { marginTop: spacing.lg, alignItems: "center", gap: spacing.sm },
});
