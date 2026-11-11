import { StyleSheet } from "react-native";
import { Button as PaperButton, Dialog, Portal, Text } from "react-native-paper";

import { useT } from "@/i18n";
import { colors, fonts } from "@/theme";

export function ConfirmDialog({
  visible,
  message,
  confirmLabel,
  onConfirm,
  onDismiss,
  danger,
  loading,
}: {
  visible: boolean;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
  danger?: boolean;
  loading?: boolean;
}) {
  const t = useT();
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Content>
          <Text style={styles.message}>{message}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <PaperButton onPress={onDismiss} textColor={colors.inkSoft}>
            {t("common.cancel")}
          </PaperButton>
          <PaperButton
            onPress={onConfirm}
            loading={loading}
            disabled={loading}
            textColor={danger ? colors.danger : colors.sageDark}
          >
            {confirmLabel}
          </PaperButton>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: { backgroundColor: colors.surface, borderRadius: 20 },
  message: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 23, color: colors.ink },
});
