import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { StyleSheet, View } from "react-native";
import { HelperText, TextInput, type TextInputProps } from "react-native-paper";

import { colors, fonts } from "@/theme";

type Props<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  label: string;
  hint?: string;
  left?: TextInputProps["left"];
} & Omit<TextInputProps, "value" | "onChangeText" | "onBlur" | "label" | "error" | "left">;

// A Paper text input wired to React Hook Form, with its error shown below.
export function TextField<T extends FieldValues>({ control, name, label, hint, left, ...inputProps }: Props<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
        <View style={styles.wrapper}>
          <TextInput
            mode="outlined"
            label={label}
            value={value ?? ""}
            onChangeText={onChange}
            onBlur={onBlur}
            error={!!error}
            left={left}
            outlineColor={colors.border}
            activeOutlineColor={colors.sageDark}
            outlineStyle={styles.outline}
            style={styles.input}
            contentStyle={styles.content}
            accessibilityLabel={label}
            {...inputProps}
          />
          <HelperText type={error ? "error" : "info"} visible={!!error || !!hint} style={styles.helper}>
            {error?.message ?? hint}
          </HelperText>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 2 },
  input: { backgroundColor: colors.surface },
  outline: { borderRadius: 14 },
  content: { fontFamily: fonts.body, fontSize: 16 },
  helper: { fontFamily: fonts.body },
});
