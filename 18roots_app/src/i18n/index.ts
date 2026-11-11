import { useCallback } from "react";

import { usePreferences } from "@/store/preferences";
import type { TranslationKey } from "./en";
import { localeFor, translate, type Translate } from "./translate";

export type { TranslationKey };
export type { Language, Translate, TranslateParams } from "./translate";
export { localeFor, translate } from "./translate";

export function useT(): Translate {
  const language = usePreferences((state) => state.language);
  return useCallback((key, params) => translate(language, key, params), [language]);
}

export function useLocale(): string {
  return localeFor(usePreferences((state) => state.language));
}
