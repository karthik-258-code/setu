import type { LocalizedText } from "@setu/engine";

export type UiLang = "en" | "te";

export interface Translated {
  text: string;
  /** True when `lang` was requested but missing, so the English text is shown instead. */
  fallback: boolean;
}

export function translate(text: LocalizedText, lang: UiLang): Translated {
  if (lang === "en") return { text: text.en, fallback: false };
  const value = text[lang];
  if (value !== undefined && value.trim() !== "") return { text: value, fallback: false };
  return { text: text.en, fallback: true };
}
