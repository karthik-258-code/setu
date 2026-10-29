import { describe, expect, it } from "vitest";
import type { Chapter, Concept, Question, QuestionTemplate } from "@setu/engine";
import { generateTemplate } from "../src/generate";
import { loadContent } from "../src/load";
import { questionCounts } from "../src/pack";
import { templatesRule, validateContent } from "../src/validate";

const { input } = loadContent();
const concepts = input.concepts as Concept[];
const chapters = input.chapters as Chapter[];
const templates = Object.values(input.templates).flat() as QuestionTemplate[];
const CHAPTER = "CH.M8.LINEAR_EQ_ONE_VAR";

function template(overrides: Partial<QuestionTemplate>): QuestionTemplate {
  return {
    id: "M6.INT.ADD_SUB.T01",
    conceptId: "M6.INT.ADD_SUB",
    difficulty: 1,
    generator: "integer_add_sub",
    paramSpace: { a: [-12, 12], b: [-12, 12], op: [0, 0] },
    count: 2,
    boardTags: ["NCERT"],
    reviewStatus: "draft",
    ...overrides,
  };
}

describe("shipped templates", () => {
  it("pass the templates rule, and all content including generated questions validates", () => {
    expect(templatesRule(concepts, input.templates).errors).toEqual([]);
    expect(validateContent(input)).toEqual([]);
  });

  it("use all eight generators across sixteen templates", () => {
    expect(templates).toHaveLength(16);
    expect(new Set(templates.map((t) => t.generator)).size).toBe(8);
  });

  it("expand to the same questions on every run", () => {
    for (const t of templates) {
      const first = generateTemplate(t);
      expect(generateTemplate(JSON.parse(JSON.stringify(t)) as QuestionTemplate), t.id).toEqual(first);
      expect(first, t.id).toHaveLength(t.count);
    }
  });

  it("bring the Class 8 pack to roughly 300 questions, as the builder reports", () => {
    const handAuthored = Object.values(input.questions).flat() as Question[];
    const generated = Object.values(templatesRule(concepts, input.templates).generated).flat();
    const counts = questionCounts(concepts, chapters, [...handAuthored, ...generated]);
    const m8 = counts.find((c) => c.chapterId === CHAPTER);
    expect(m8?.generated).toBe(templates.reduce((n, t) => n + t.count, 0));
    expect(m8?.handAuthored ?? 0).toBeGreaterThanOrEqual(120);
    expect(m8?.total ?? 0).toBeGreaterThanOrEqual(280);
    expect(counts.map((c) => c.chapterId).sort()).toEqual(chapters.map((c) => c.id).sort());
  });
});

describe("templates rule", () => {
  it("reports a misplaced, misnamed, duplicate or unknown-generator template and bad parameter spaces", () => {
    const bad = template({ paramSpace: { a: [-5, 5], b: [3, 1], extra: [1, 2] } });
    const messages = templatesRule(concepts, {
      "templates/M6.INT.CONCEPT.json": [
        bad,
        bad,
        template({ id: "M6.INT.ADD_SUB.1", generator: "nope" }),
      ],
    }).errors.map((e) => e.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        'M6.INT.ADD_SUB.T01: conceptId "M6.INT.ADD_SUB" does not match the file name',
        'M6.INT.ADD_SUB.T01: paramSpace needs "op"',
        'M6.INT.ADD_SUB.T01: paramSpace has unknown parameter "extra"',
        'M6.INT.ADD_SUB.T01: paramSpace "b" range [3, 1] is empty',
        "M6.INT.ADD_SUB.T01: duplicate template id",
        "M6.INT.ADD_SUB.1: id must be M6.INT.ADD_SUB.Tnn",
        'M6.INT.ADD_SUB.1: unknown generator "nope"',
      ]),
    );
  });

  it("reports a template whose parameter space cannot produce its count", () => {
    const result = templatesRule(concepts, {
      "templates/M6.INT.ADD_SUB.json": [
        template({ paramSpace: { a: [-1, -1], b: [2, 2], op: [0, 0] } }),
      ],
    });
    expect(result.errors.map((e) => e.message)).toEqual([
      "M6.INT.ADD_SUB.T01: only 1 of 2 distinct questions after 100 seeds",
    ]);
    expect(result.generated["templates/M6.INT.ADD_SUB.json"]).toEqual([]);
  });

  it("returns generated questions that the questions rule accepts", () => {
    const result = templatesRule(concepts, {
      "templates/M6.INT.ADD_SUB.json": [template({})],
    });
    expect(result.errors).toEqual([]);
    const questions = result.generated["templates/M6.INT.ADD_SUB.json"] ?? [];
    expect(questions.map((q) => q.templateId)).toEqual(["M6.INT.ADD_SUB.T01", "M6.INT.ADD_SUB.T01"]);
    expect(validateContent({ ...input, templates: { "templates/M6.INT.ADD_SUB.json": [template({})] } })).toEqual([]);
  });
});
