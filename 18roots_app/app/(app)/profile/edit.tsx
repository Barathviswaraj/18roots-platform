import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { KeyboardAvoidingView, Platform, StyleSheet } from "react-native";

import { toApiError } from "@/api/client";
import { useProfile, useUpdateProfile } from "@/api/queries";
import { Screen } from "@/components/layout";
import { ErrorState, LoadingCards } from "@/components/states";
import { TextField } from "@/components/TextField";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui";
import { useT } from "@/i18n";
import { profileFormSchema, type ProfileForm } from "@/lib/validation";
import { colors } from "@/theme";

export default function EditProfileScreen() {
  const t = useT();
  const profile = useProfile();

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {profile.isPending ? (
        <Screen title={t("profile.edit")}>
          <LoadingCards count={2} />
        </Screen>
      ) : profile.isError ? (
        <Screen title={t("profile.edit")}>
          <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
        </Screen>
      ) : (
        <ProfileFormView
          defaults={{
            name: profile.data.name,
            email: profile.data.email ?? "",
            dateOfBirth: profile.data.dateOfBirth ?? "",
            city: profile.data.city ?? "",
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

function ProfileFormView({ defaults }: { defaults: ProfileForm }) {
  const t = useT();
  const update = useUpdateProfile();
  const schema = useMemo(() => profileFormSchema(t), [t]);
  const { control, handleSubmit, formState } = useForm<ProfileForm>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const save = handleSubmit((values) =>
    update.mutate(
      { name: values.name, email: values.email || null, dateOfBirth: values.dateOfBirth || null, city: values.city },
      {
        onSuccess: () => {
          toast.info(t("profile.saved"));
          router.back();
        },
        onError: (error) => toast.error(toApiError(error).message),
      },
    ),
  );

  return (
    <Screen
      title={t("profile.edit")}
      footer={
        <Button label={t("common.save")} onPress={save} loading={update.isPending} disabled={!formState.isDirty} />
      }
    >
      <TextField
        control={control}
        name="name"
        label={t("profile.fullName")}
        autoComplete="name"
        textContentType="name"
      />
      <TextField
        control={control}
        name="email"
        label={t("profile.email")}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <TextField
        control={control}
        name="dateOfBirth"
        label={t("profile.dob")}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />
      <TextField control={control} name="city" label={t("profile.city")} autoComplete="postal-address-locality" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
});
