import { Snackbar } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { create } from "zustand";

import { colors, fonts } from "@/theme";

type ToastState = {
  message: string | null;
  tone: "info" | "error";
  show: (message: string, tone?: "info" | "error") => void;
  hide: () => void;
};

export const useToast = create<ToastState>()((set) => ({
  message: null,
  tone: "info",
  show: (message, tone = "info") => set({ message, tone }),
  hide: () => set({ message: null }),
}));

export const toast = {
  info: (message: string) => useToast.getState().show(message, "info"),
  error: (message: string) => useToast.getState().show(message, "error"),
};

export function ToastHost() {
  const { message, tone, hide } = useToast();
  const insets = useSafeAreaInsets();
  return (
    <Snackbar
      visible={!!message}
      onDismiss={hide}
      duration={3500}
      wrapperStyle={{ bottom: insets.bottom + 90 }}
      style={{ backgroundColor: tone === "error" ? colors.danger : colors.ink, borderRadius: 14 }}
      theme={{
        fonts: {
          bodyMedium: {
            fontFamily: fonts.bodyMedium,
            fontSize: 14,
            fontWeight: "500",
            letterSpacing: 0,
            lineHeight: 20,
          },
        },
      }}
      action={{ label: "OK", onPress: hide, textColor: colors.sageLight }}
    >
      {message ?? ""}
    </Snackbar>
  );
}
