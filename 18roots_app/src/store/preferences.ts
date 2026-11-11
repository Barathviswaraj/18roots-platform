import { getLocales } from "expo-localization";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { secureStorage } from "@/lib/storage";

import type { Language } from "@/i18n/translate";

export type { Language };

type PreferencesState = {
  language: Language;
  remindersEnabled: boolean;
  hydrated: boolean;
  setLanguage: (language: Language) => void;
  setRemindersEnabled: (enabled: boolean) => void;
};

function deviceLanguage(): Language {
  try {
    return getLocales()[0]?.languageCode === "ta" ? "ta" : "en";
  } catch {
    return "en";
  }
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      language: deviceLanguage(),
      remindersEnabled: false,
      hydrated: false,
      setLanguage: (language) => set({ language }),
      setRemindersEnabled: (remindersEnabled) => set({ remindersEnabled }),
    }),
    {
      name: "roots18.preferences",
      storage: createJSONStorage(() => secureStorage),
      partialize: ({ language, remindersEnabled }) => ({ language, remindersEnabled }),
      onRehydrateStorage: () => () => usePreferences.setState({ hydrated: true }),
    },
  ),
);
