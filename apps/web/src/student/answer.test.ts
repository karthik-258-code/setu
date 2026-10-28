import type { NumericQuestion } from "@setu/engine";
import { describe, expect, it } from "vitest";
import { grade, parseNumber } from "./answer";

const numeric: NumericQuestion = {
  id: "M8.LEQ.ONE_SIDE.Q09",
  conceptId: "M8.LEQ.ONE_SIDE",
  type: "numeric",
  difficulty: 1,
  stem: { en: "x + 3 = 7. x = ?" },
  answer: 4,
  wrongAnswers: [{ value: 10, misconceptionCode: "E-TRANSPOSE-SIGN" }],
  boardTags: ["NCERT"],
  reviewStatus: "draft",
};

describe("answers", () => {
  it("reads integers, decimals, fractions and the minus sign, and rejects other text", () => {
    expect(parseNumber(" -3 ")).toBe(-3);
    expect(parseNumber("2.5")).toBe(2.5);
    expect(parseNumber("3/4")).toBe(0.75);
    expect(parseNumber("\u22122")).toBe(-2);
    expect(parseNumber("1/0")).toBeNull();
    expect(parseNumber("x")).toBeNull();
  });

  it("marks a numeric answer and maps a known wrong value to its misconception", () => {
    expect(grade(numeric, { value: 4 })).toEqual({ correct: true, value: 4 });
    expect(grade(numeric, { value: 10 })).toEqual({
      correct: false,
      value: 10,
      misconceptionCode: "E-TRANSPOSE-SIGN",
    });
    expect(grade(numeric, { value: 5 })).toEqual({ correct: false, value: 5 });
  });
});
