import { describe, expect, it } from "vitest";
import type { QuestionTemplate } from "@setu/engine";
import { GENERATORS } from "../src/generators/index";
import type { Draft } from "../src/generators/types";
import { generateTemplate, hashString, variantRng } from "../src/generate";

const TELUGU = /[\u0C00-\u0C7F]/;

function draft(id: string, params: Record<string, number>): Draft {
  const generator = GENERATORS[id];
  if (!generator) throw new Error(`no generator ${id}`);
  const d = generator.generate(params);
  if (!d) throw new Error(`${id} rejected ${JSON.stringify(params)}`);
  return d;
}

function coded(d: Draft): [string, string][] {
  return d.distractors.flatMap((x) =>
    x.misconceptionCode === undefined ? [] : [[x.text.en, x.misconceptionCode] as [string, string]],
  );
}

function expectBilingual(d: Draft): void {
  expect(d.stem.te ?? "").toMatch(TELUGU);
  expect(d.solution.te ?? "").toMatch(TELUGU);
  expect(d.answer.te).toBe(d.answer.en);
}

const sample: QuestionTemplate = {
  id: "M8.LEQ.BOTH_SIDES.T99",
  conceptId: "M8.LEQ.BOTH_SIDES",
  difficulty: 2,
  generator: "linear_both_sides",
  paramSpace: { a: [3, 9], b: [-12, 12], c: [1, 8], x: [1, 10] },
  count: 10,
  boardTags: ["NCERT", "TS_SCERT"],
  reviewStatus: "draft",
};

describe("generators", () => {
  it("are the eight planned generators", () => {
    expect(Object.keys(GENERATORS).sort()).toEqual([
      "add_unlike_fractions",
      "combine_like_terms",
      "integer_add_sub",
      "integer_mul_div",
      "linear_both_sides",
      "linear_brackets",
      "linear_fraction_coeff",
      "transpose_linear",
    ]);
  });

  it("add_unlike_fractions sums over the LCM and offers (a+c)/(b+d) as F-ADD-DENOM", () => {
    const d = draft("add_unlike_fractions", { a: 1, b: 2, c: 1, d: 3 });
    expect(d.stem).toEqual({ en: "Find 1/2 + 1/3.", te: "1/2 + 1/3 విలువ కనుగొను." });
    expect(d.answer.en).toBe("5/6");
    expect(coded(d)).toEqual([["2/5", "F-ADD-DENOM"]]);
    expect(d.solution.en).toBe(
      "The LCM of 2 and 3 is 6, so 1/2 = 3/6 and 1/3 = 2/6. Then 1/2 + 1/3 = 5/6.",
    );
    expectBilingual(d);
    expect(GENERATORS.add_unlike_fractions?.generate({ a: 1, b: 4, c: 3, d: 4 })).toBeNull();
  });

  it("integer_add_sub offers sign slips as I-SIGN-ADD for addition and subtraction", () => {
    const add = draft("integer_add_sub", { a: -7, b: 3, op: 0 });
    expect(add.stem.en).toBe("Find -7 + 3.");
    expect(add.answer.en).toBe("-4");
    expect(coded(add)).toEqual([
      ["4", "I-SIGN-ADD"],
      ["-10", "I-SIGN-ADD"],
    ]);
    const sub = draft("integer_add_sub", { a: 5, b: -3, op: 1 });
    expect(sub.stem.en).toBe("Find 5 - (-3).");
    expect(sub.answer.en).toBe("8");
    expect(coded(sub)).toEqual([
      ["2", "I-SIGN-ADD"],
      ["-8", "I-SIGN-ADD"],
    ]);
    expect(sub.solution.en).toBe("Subtracting (-3) is the same as adding 3: 5 - (-3) = 5 + 3 = 8.");
    expectBilingual(sub);
    expect(GENERATORS.integer_add_sub?.generate({ a: 4, b: 3, op: 0 })).toBeNull();
  });

  it("integer_mul_div offers the opposite sign as I-SIGN-MUL and keeps quotients whole", () => {
    const mul = draft("integer_mul_div", { a: -4, b: -3, op: 0 });
    expect(mul.stem.en).toBe("Find (-4) × (-3).");
    expect(mul.answer.en).toBe("12");
    expect(coded(mul)).toEqual([["-12", "I-SIGN-MUL"]]);
    expect(mul.solution.en).toBe("Same signs give a positive result: 4 × 3 = 12, so (-4) × (-3) = 12.");
    const div = draft("integer_mul_div", { a: 6, b: -2, op: 1 });
    expect(div.stem.en).toBe("Find (-12) ÷ (-2).");
    expect(div.answer.en).toBe("6");
    expectBilingual(div);
  });

  it("combine_like_terms offers A-UNLIKE-COMBINE and A-COEFF-DROP", () => {
    const d = draft("combine_like_terms", { p: 3, q: 2, r: 5, v: 0 });
    expect(d.stem.en).toBe("Simplify: 3x + 5 + 2x");
    expect(d.answer.en).toBe("5x + 5");
    expect(coded(d)).toEqual([
      ["10x", "A-UNLIKE-COMBINE"],
      ["4x + 5", "A-COEFF-DROP"],
    ]);
    expectBilingual(d);
    expect(draft("combine_like_terms", { p: 4, q: -1, r: 7, v: 1 }).stem.en).toBe(
      "Simplify: 4y + 7 - y",
    );
  });

  it("transpose_linear offers E-TRANSPOSE-SIGN and E-TRANSPOSE-DIVIDE", () => {
    const d = draft("transpose_linear", { a: 3, x: 5, b: -4 });
    expect(d.stem.en).toBe("Solve 3x - 4 = 11.");
    expect(d.answer.en).toBe("x = 5");
    expect(coded(d)).toEqual([
      ["x = 7/3", "E-TRANSPOSE-SIGN"],
      ["x = 12", "E-TRANSPOSE-DIVIDE"],
    ]);
    expect(d.solution.en).toBe("3x = 11 + 4 = 15, so x = 15 ÷ 3 = 5.");
    expectBilingual(d);
  });

  it("linear_both_sides collects terms and offers sign and divide slips", () => {
    const d = draft("linear_both_sides", { a: 5, b: -4, c: 2, x: 5 });
    expect(d.stem.en).toBe("Solve 5x - 4 = 2x + 11.");
    expect(d.answer.en).toBe("x = 5");
    expect(coded(d)).toEqual([
      ["x = 1", "E-TRANSPOSE-SIGN"],
      ["x = 15/7", "E-TRANSPOSE-SIGN"],
      ["x = 12", "E-TRANSPOSE-DIVIDE"],
    ]);
    expect(d.solution.en).toBe(
      "Collect the x terms on one side and the numbers on the other: 5x - 2x = 11 + 4, so 3x = 15 and x = 5.",
    );
    expectBilingual(d);
  });

  it("linear_brackets offers E-DIST-PARTIAL for distributing to the first term only", () => {
    const d = draft("linear_brackets", { k: 2, p: 3, x: 4 });
    expect(d.stem.en).toBe("Solve 2(x + 3) = 14.");
    expect(d.answer.en).toBe("x = 4");
    expect(coded(d)).toEqual([
      ["x = 11/2", "E-DIST-PARTIAL"],
      ["x = 10", "E-TRANSPOSE-SIGN"],
      ["x = 6", "E-TRANSPOSE-DIVIDE"],
    ]);
    expect(d.solution.en).toBe("Open the bracket: 2x + 6 = 14. Then 2x = 14 - 6 = 8, so x = 4.");
    expectBilingual(d);
  });

  it("linear_fraction_coeff offers E-LCM-PARTIAL and F-ADD-DENOM", () => {
    const d = draft("linear_fraction_coeff", { a: 2, b: 3, n: 2 });
    expect(d.stem.en).toBe("Solve x/2 + x/3 = 10.");
    expect(d.answer.en).toBe("x = 12");
    expect(coded(d)).toEqual([
      ["x = 2", "E-LCM-PARTIAL"],
      ["x = 25", "F-ADD-DENOM"],
    ]);
    expect(d.solution.en).toBe(
      "Multiply every term by 6, the LCM of 2 and 3, including the 10: 3x + 2x = 60, so 5x = 60 and x = 12.",
    );
    expectBilingual(d);
  });
});

describe("template expansion", () => {
  it("gives the same questions every time for the same template", () => {
    const first = generateTemplate(sample);
    const again = generateTemplate(JSON.parse(JSON.stringify(sample)) as QuestionTemplate);
    expect(again).toEqual(first);
    expect(first).toHaveLength(10);
    expect(new Set(first.map((q) => q.id)).size).toBe(10);
    expect(new Set(first.map((q) => q.stem.en)).size).toBe(10);
    for (const q of first) {
      expect(q.id).toMatch(/^M8\.LEQ\.BOTH_SIDES\.T99\.\d+$/);
      expect(q.templateId).toBe(sample.id);
      expect(q.reviewStatus).toBe("draft");
      expect(q.options.map((o) => o.id)).toEqual(["a", "b", "c", "d"]);
      expect(q.options.filter((o) => o.isCorrect)).toHaveLength(1);
      expect(q.options.some((o) => o.misconceptionCode !== undefined)).toBe(true);
      expect(new Set(q.options.map((o) => o.text.en)).size).toBe(4);
    }
  });

  it("derives each variant's randomness from the template id and the seed", () => {
    expect(hashString("")).toBe(-2128831035);
    expect(variantRng("T", 1)()).toBe(variantRng("T", 1)());
    expect(variantRng("T", 1)()).not.toBe(variantRng("T", 2)());
    expect(variantRng("T", 1)()).not.toBe(variantRng("U", 1)());
  });

  it("fails loudly on an unknown generator or a parameter space too small for the count", () => {
    const tiny: QuestionTemplate = {
      ...sample,
      id: "M6.FRAC.ADD_SUB_UNLIKE.T99",
      conceptId: "M6.FRAC.ADD_SUB_UNLIKE",
      generator: "add_unlike_fractions",
      paramSpace: { a: [1, 1], b: [2, 2], c: [1, 1], d: [3, 3] },
      count: 2,
    };
    expect(() => generateTemplate({ ...tiny, generator: "nope" })).toThrow('unknown generator "nope"');
    expect(() => generateTemplate(tiny)).toThrow("only 1 of 2 distinct questions");
  });
});
