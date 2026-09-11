import { LanguageOption } from "../types";

export type LocaleTranslations = Record<string, string>;

export interface DomainTranslations {
  vi: LocaleTranslations;
  en: LocaleTranslations;
}

export type TranslateFunction = (key: string, params?: Record<string, string | number>) => string;

export interface I18nContextState {
  language: LanguageOption;
  t: TranslateFunction;
}
