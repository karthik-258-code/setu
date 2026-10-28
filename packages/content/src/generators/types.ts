import type { LocalizedText } from "@setu/engine";

/** A wrong answer. `misconceptionCode` is set when the value is what a known error produces. */
export interface Distractor {
  text: LocalizedText;
  misconceptionCode?: string;
}

/**
 * What a generator produces for one parameter set. Distractors are listed misconception-coded
 * first, then plain near misses; `generateTemplate` keeps the first three distinct ones.
 */
export interface Draft {
  stem: LocalizedText;
  solution: LocalizedText;
  answer: LocalizedText;
  distractors: Distractor[];
}

/** One generator per template `generator` id (ARCHITECTURE 6.4). */
export interface Generator<K extends string = string> {
  readonly id: string;
  /** Parameters the template's `paramSpace` must define, and only these. */
  readonly params: readonly K[];
  /** Returns null when the parameters do not make a sensible question (the seed is skipped). */
  generate(params: Readonly<Record<K, number>>): Draft | null;
}

/** Text that is written the same in every language, such as `x = 5` or `3/4`. */
export function same(text: string): LocalizedText {
  return { en: text, te: text };
}
