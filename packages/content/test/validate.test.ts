import { describe, expect, it } from "vitest";
import { validateContent } from "../src/validate";
import type { ContentInput } from "../src/validate";

const emptyInput: ContentInput = {
  concepts: [],
  chapters: [],
  misconceptions: {},
  reasons: {},
  questions: {},
  templates: {},
  resources: {},
};

function concept(id: string, prerequisites: string[], title: unknown = { en: id }) {
  return {
    id,
    classLevel: 6,
    subject: "math",
    chapterId: "CH.M6.FOUNDATIONS",
    title,
    prerequisites,
    boardTags: ["NCERT", "TS_SCERT"],
  };
}

describe("validateContent", () => {
  it("passes on the empty content set", () => {
    expect(validateContent(emptyInput)).toEqual([]);
  });

  it("passes on a small valid DAG", () => {
    const concepts = [
      concept("M6.A", []),
      concept("M6.B", ["M6.A"]),
      concept("M6.C", ["M6.A", "M6.B"]),
    ];
    expect(validateContent({ ...emptyInput, concepts })).toEqual([]);
  });

  it("fails on a planted 3-node cycle and names it", () => {
    const concepts = [
      concept("M6.A", ["M6.C"]),
      concept("M6.B", ["M6.A"]),
      concept("M6.C", ["M6.B"]),
    ];
    const errors = validateContent({ ...emptyInput, concepts });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.file).toBe("graph/concepts.json");
    expect(errors[0]?.message).toContain("cycle: M6.A -> M6.C -> M6.B -> M6.A");
  });

  it("fails on an unknown prerequisite and names the concept and the missing id", () => {
    const concepts = [concept("M6.A", []), concept("M6.B", ["M6.NOPE"])];
    const errors = validateContent({ ...emptyInput, concepts });
    expect(errors).toEqual([
      { file: "graph/concepts.json", message: 'M6.B: unknown prerequisite "M6.NOPE"' },
    ]);
  });

  it("fails when a localized title is missing `en`", () => {
    const concepts = [concept("M6.A", [], { te: "తెలుగు" })];
    const errors = validateContent({ ...emptyInput, concepts });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.file).toBe("graph/concepts.json");
    expect(errors[0]?.message).toContain("0.title.en");
  });

  it("reports schema errors with the file path of a questions file", () => {
    const question = {
      id: "M6.A.Q01",
      type: "numeric",
      conceptId: "M6.A",
      difficulty: 1,
      stem: { te: "x" },
      answer: 4,
      boardTags: ["NCERT"],
      reviewStatus: "draft",
    };
    const errors = validateContent({
      ...emptyInput,
      questions: { "questions/M6.A.json": [question] },
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.file).toBe("questions/M6.A.json");
    expect(errors[0]?.message).toContain("stem.en");
  });

  it("rejects an unknown question type through the discriminated union", () => {
    const errors = validateContent({
      ...emptyInput,
      questions: { "questions/M6.A.json": [{ type: "essay" }] },
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.file).toBe("questions/M6.A.json");
  });

  it("skips graph rules when the concept file fails its schema", () => {
    const errors = validateContent({ ...emptyInput, concepts: [{ id: "M6.A" }] });
    expect(errors.every((e) => e.file === "graph/concepts.json")).toBe(true);
    expect(errors.some((e) => e.message.includes("cycle"))).toBe(false);
  });
});
