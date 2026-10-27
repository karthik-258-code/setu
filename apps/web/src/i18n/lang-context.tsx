import type { LocalizedText } from "@setu/engine";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { strings } from "./strings";
import type { StringKey } from "./strings";
import { translate } from "./translate";
import type { Translated, UiLang } from "./translate";

export const LANG_STORAGE_KEY = "setu.lang";

interface LangContextValue {
  lang: UiLang;
  setLang: (lang: UiLang) => void;
  /** Resolve student-facing LocalizedText, reporting whether English was used as a fallback. */
  t: (text: LocalizedText) => Translated;
  /** Resolve a UI chrome string. */
  ui: (key: StringKey) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

function readStoredLang(): UiLang {
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    return stored === "te" ? "te" : "en";
  } catch {
    return "en";
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLang>(readStoredLang);

  const setLang = useCallback((next: UiLang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // Storage can be blocked (private mode); the choice still applies for this session.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      setLang,
      t: (text) => translate(text, lang),
      ui: (key) => translate(strings[key], lang).text,
    }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const value = useContext(LangContext);
  if (value === null) throw new Error("useLang must be used inside <LangProvider>");
  return value;
}
