import { en, type TranslationKey } from "./en";
import { ta } from "./ta";

export type Language = "en" | "ta";
export type TranslateParams = Record<string, string | number>;
export type Translate = (key: TranslationKey, params?: TranslateParams) => string;

export const dictionaries: Record<Language, Record<TranslationKey, string>> = { en, ta };

export function translate(language: Language, key: TranslationKey, params?: TranslateParams): string {
  const template = dictionaries[language][key] || en[key] || key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] === undefined ? match : String(params[name]),
  );
}

export function localeFor(language: Language): string {
  return language === "ta" ? "ta-IN" : "en-IN";
}
