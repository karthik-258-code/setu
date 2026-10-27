import type { LocalizedText } from "@setu/engine";

/** UI chrome strings. Every key has `en` and `te`; student-facing content uses LocalizedText in packs. */
export const strings = {
  appName: { en: "Setu", te: "సేతు" },
  language: { en: "Language", te: "భాష" },
  englishOnly: { en: "English only", te: "ఇంగ్లీష్ మాత్రమే" },
  screen: { en: "Screen", te: "స్క్రీన్" },
  parameters: { en: "Parameters", te: "పారామితులు" },
  roleStudent: { en: "I am a student", te: "నేను విద్యార్థిని" },
  roleTeacher: { en: "I am a teacher", te: "నేను ఉపాధ్యాయుడిని" },
  roleDemo: { en: "Try the demo", te: "డెమో చూడండి" },
  noParameters: { en: "None", te: "ఏవీ లేవు" },
} as const satisfies Record<string, Required<Pick<LocalizedText, "en" | "te">>>;

export type StringKey = keyof typeof strings;

/** Language names are shown in their own script so a student can always find theirs. */
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "te", label: "తెలుగు" },
] as const;
