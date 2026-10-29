/** Marks a student's answer against a pack question and finds the misconception it shows. */
import type { Question } from "@setu/engine";

export type Answer = { optionId: string } | { value: number };

export interface Graded {
  correct: boolean;
  selectedOptionId?: string;
  value?: number;
  misconceptionCode?: string;
}

const DEFAULT_TOLERANCE = 1e-9;

/** Reads a typed number: integers, decimals and simple fractions such as `-3/4`. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(/\u2212/g, "-");
  const fraction = /^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(t);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator === 0 ? null : Number(fraction[1]) / denominator;
  }
  return /^-?\d+(?:\.\d+)?$/.test(t) ? Number(t) : null;
}

export function grade(question: Question, answer: Answer): Graded {
  if (question.type === "mcq") {
    if (!("optionId" in answer)) throw new Error(`Question ${question.id} needs an option`);
    const option = question.options.find((o) => o.id === answer.optionId);
    if (!option) throw new Error(`Unknown option ${answer.optionId} for ${question.id}`);
    return {
      correct: option.isCorrect,
      selectedOptionId: option.id,
      ...(option.misconceptionCode !== undefined
        ? { misconceptionCode: option.misconceptionCode }
        : {}),
    };
  }
  if (!("value" in answer)) throw new Error(`Question ${question.id} needs a number`);
  const tolerance = question.tolerance ?? DEFAULT_TOLERANCE;
  const correct = Math.abs(answer.value - question.answer) <= tolerance;
  const known = correct
    ? undefined
    : question.wrongAnswers?.find((w) => Math.abs(w.value - answer.value) <= tolerance);
  return {
    correct,
    value: answer.value,
    ...(known ? { misconceptionCode: known.misconceptionCode } : {}),
  };
}
