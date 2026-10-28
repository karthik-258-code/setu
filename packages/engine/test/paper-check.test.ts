import { describe, expect, it } from "vitest";
import { buildGraph } from "../src/graph";
import { paperCheckQuestions } from "../src/readiness";
import type { Concept, ContentPack, Difficulty, Question } from "../src/types";

function concept(id: string, classLevel: 7 | 8, prerequisites: string[], chapterId: string): Concept {
  return { id, classLevel, subject: "math", chapterId, title: { en: id }, prerequisites, boardTags: ["NCERT"] };
}

function question(id: string, conceptId: string, difficulty: Difficulty, paper = false): Question {
  return {
    id,
    conceptId,
    type: "numeric",
    difficulty,
    stem: { en: id },
    answer: 1,
    boardTags: ["NCERT"],
    ...(paper ? { tags: ["paper_friendly" as const] } : {}),
    reviewStatus: "draft",
  };
}

const graph = buildGraph(
  [
    concept("M7.A", 7, [], "CH.M7"),
    concept("M7.B", 7, [], "CH.M7"),
    concept("M8.C", 8, ["M7.A", "M7.B"], "CH.M8"),
  ],
  [
    { id: "CH.M7", classLevel: 7, subject: "math", title: { en: "7" }, conceptIds: ["M7.A", "M7.B"], boardTags: ["NCERT"], depth: "skeleton" },
    { id: "CH.M8", classLevel: 8, subject: "math", title: { en: "8" }, conceptIds: ["M8.C"], boardTags: ["NCERT"], depth: "full" },
  ],
);

const pack: ContentPack = {
  packVersion: "t",
  builtAt: "2026-10-28T00:00:00.000Z",
  chapterId: "CH.M8",
  graph,
  questions: [
    question("M7.A.Q3", "M7.A", 2),
    question("M7.A.Q2", "M7.A", 2),
    question("M7.A.Q1", "M7.A", 1),
    question("M7.A.Q9", "M7.A", 2, true),
    question("M7.B.Q1", "M7.B", 2),
    question("M8.C.Q1", "M8.C", 2),
  ],
  resources: [],
  misconceptions: {},
  reasonTemplates: {},
};

describe("paperCheckQuestions", () => {
  it("deals difficulty-2 prerequisite questions round-robin, paper-friendly first", () => {
    expect(paperCheckQuestions(pack, "CH.M8", []).map((q) => q.id)).toEqual([
      "M7.A.Q9",
      "M7.B.Q1",
      "M7.A.Q2",
      "M7.A.Q3",
    ]);
  });

  it("skips teacher-trimmed prerequisites and stops at the count", () => {
    expect(paperCheckQuestions(pack, "CH.M8", ["M7.A"]).map((q) => q.id)).toEqual(["M7.B.Q1"]);
    expect(paperCheckQuestions(pack, "CH.M8", [], 2)).toHaveLength(2);
  });
});
