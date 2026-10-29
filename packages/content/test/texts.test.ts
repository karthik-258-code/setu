import { describe, expect, it } from "vitest";
import { RULE_IDS } from "@setu/engine";
import type { Chapter, LocalizedText, Misconception } from "@setu/engine";
import { loadContent } from "../src/load";
import { misconceptionsRule, reasonsRule } from "../src/validate";

const { input } = loadContent();
const reasons = input.reasons as Record<string, LocalizedText>;
const misconceptions = input.misconceptions as Record<string, Misconception>;
const chapters = input.chapters as Chapter[];
const TELUGU = /[\u0C00-\u0C7F]/;

/** The initial code list of BUILD_PLAN 2.2. */
const PLANNED_CODES = [
  "F-ADD-DENOM",
  "F-EQUIV-ADD",
  "F-COMPARE-NUM-ONLY",
  "F-DIV-NO-RECIP",
  "I-SIGN-ADD",
  "I-SIGN-MUL",
  "A-UNLIKE-COMBINE",
  "A-COEFF-DROP",
  "E-TRANSPOSE-SIGN",
  "E-TRANSPOSE-DIVIDE",
  "E-BOTH-SIDES-ONE",
  "E-DIST-PARTIAL",
  "E-LCM-PARTIAL",
  "E-CROSS-WRONG",
  "W-SETUP-REVERSE",
];

describe("shipped reason templates", () => {
  it("cover every engine rule in English and Telugu", () => {
    expect(Object.keys(reasons).sort()).toEqual([...RULE_IDS].sort());
    for (const id of RULE_IDS) {
      expect(reasons[id]?.en.length, id).toBeGreaterThan(0);
      expect(reasons[id]?.te ?? "", id).toMatch(TELUGU);
    }
    expect(reasonsRule(input.reasons, chapters)).toEqual([]);
  });

  it("keep Ravi's reason from the submission", () => {
    expect(reasons.R5_LEARN?.en).toContain("Before {chapter}, we are learning {concept}");
  });
});

describe("shipped misconceptions", () => {
  it("are the fifteen planned codes, each with Telugu label and teacher note", () => {
    expect(Object.keys(misconceptions).sort()).toEqual([...PLANNED_CODES].sort());
    for (const m of Object.values(misconceptions)) {
      expect(m.label.te ?? "", m.code).toMatch(TELUGU);
      expect(m.teacherNote?.en.length ?? 0, m.code).toBeGreaterThan(0);
      expect(m.teacherNote?.te ?? "", m.code).toMatch(TELUGU);
    }
    expect(misconceptionsRule(input.misconceptions, chapters)).toEqual([]);
  });
});

describe("text rules", () => {
  const oneChapter = chapters.slice(0, 1);

  it("report a missing rule, missing Telugu and mismatched placeholders", () => {
    const broken = {
      ...reasons,
      R9_DONE: undefined,
      R0_READINESS: { en: "Start {chapter}" },
      R7_SOLVE: { en: "Practise {concept}", te: "అభ్యాసం {chapter}" },
      R8_EXTENSION: { en: "Try {nonsense}", te: "{nonsense}" },
    };
    delete broken.R9_DONE;
    const messages = reasonsRule(broken, oneChapter).map((e) => e.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        "R9_DONE: missing reason template",
        "R0_READINESS: missing Telugu (te)",
        "R7_SOLVE: en and te use different placeholders",
        "R8_EXTENSION: unknown placeholder {nonsense}",
      ]),
    );
  });

  it("report a misconception keyed by the wrong code or without Telugu", () => {
    const messages = misconceptionsRule(
      { "X-ONE": { code: "X-TWO", label: { en: "x" } } },
      oneChapter,
    ).map((e) => e.message);
    expect(messages).toEqual(["X-ONE: code is \"X-TWO\"", "X-ONE: label has no Telugu (te)"]);
  });

  it("are skipped while there are no chapters", () => {
    expect(reasonsRule({}, [])).toEqual([]);
    expect(misconceptionsRule({}, [])).toEqual([]);
  });
});
