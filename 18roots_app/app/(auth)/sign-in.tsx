import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { TextInput } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { toApiError } from "@/api/client";
import { authApi } from "@/api/endpoints";
import { LotusScene } from "@/components/illustrations";
import { Logo } from "@/components/layout";
import { TextField } from "@/components/TextField";
import { Button, Chip } from "@/components/ui";
import { useT } from "@/i18n";
import { isMock } from "@/lib/env";
import { phoneFormSchema, type PhoneForm } from "@/lib/validation";
import { useOtpFlow } from "@/store/otpFlow";
import { usePreferences } from "@/store/preferences";
import { colors, fonts, spacing, type } from "@/theme";

export default function SignIn() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { language, setLanguage } = usePreferences();
  const schema = useMemo(() => phoneFormSchema(t), [t]);
  const { control, handleSubmit } = useForm<PhoneForm>({
    resolver: zodResolver(schema),
    defaultValues: { phone: "" },
  });

  const requestOtp = useMutation({ mutationFn: (phone: string) => authApi.requestOtp(phone) });

  const submit = handleSubmit(async (values) => {
    const phone = `+91${schema.parse(values).phone}`;
    const result = await requestOtp.mutateAsync(phone);
    useOtpFlow.getState().start({
      phone,
      requestId: result.requestId,
      resendAfter: result.resendAfterSeconds,
      demoCode: result.demoCode ?? null,
    });
    router.push("/verify");
  });

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <Logo />
          <View style={styles.languages}>
            <Chip label="EN" selected={language === "en"} onPress={() => setLanguage("en")} />
            <Chip label="தமிழ்" selected={language === "ta"} onPress={() => setLanguage("ta")} />
          </View>
        </View>

        <View style={styles.art}>
          <LotusScene width={260} height={240} />
        </View>

        <Text style={styles.title}>{t("auth.title")}</Text>
        <Text style={[type.body, styles.hint]}>{t("auth.phoneHint")}</Text>

        <TextField
          control={control}
          name="phone"
          label={t("auth.phoneLabel")}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          maxLength={14}
          left={<TextInput.Affix text="+91" />}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        {requestOtp.isError ? <Text style={styles.error}>{toApiError(requestOtp.error).message}</Text> : null}

        <Button label={t("auth.sendCode")} onPress={submit} loading={requestOtp.isPending} style={styles.cta} />
        <Text style={[type.caption, styles.terms]}>{t("auth.terms")}</Text>
        {isMock ? <Text style={[type.caption, styles.terms]}>{t("common.demoMode")}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl, flexGrow: 1 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  languages: { flexDirection: "row", gap: spacing.sm },
  art: { alignItems: "center", marginVertical: spacing.lg },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, color: colors.ink },
  hint: { marginTop: spacing.sm, marginBottom: spacing.lg },
  error: { color: colors.danger, fontFamily: fonts.bodyMedium, marginBottom: spacing.sm },
  cta: { marginTop: spacing.sm },
  terms: { textAlign: "center", marginTop: spacing.lg },
});
