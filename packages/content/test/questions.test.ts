import { describe, expect, it } from "vitest";
import { ancestors, buildGraph } from "@setu/engine";
import type { Chapter, Concept, Question } from "@setu/engine";
import { loadContent } from "../src/load";
import { questionsRule } from "../src/validate";

const { input } = loadContent();
const concepts = input.concepts as Concept[];
const chapters = input.chapters as Chapter[];
const graph = buildGraph(concepts, chapters);
const CHAPTER = "CH.M8.LINEAR_EQ_ONE_VAR";
const WHERE = `(in scope of full chapter ${CHAPTER})`;
const TELUGU = /[\u0C00-\u0C7F]/;

function scope(): string[] {
  const ids = new Set<string>(graph.chapters[CHAPTER]?.conceptIds ?? []);
  for (const id of [...ids]) for (const a of ancestors(graph, id)) ids.add(a);
  return [...ids].sort();
}

const inScope = (Object.values(input.questions).flat() as Question[]).filter((q) =>
  scope().includes(q.conceptId),
);

function tagged(tag: string): number {
  return inScope.filter((q) => (q.tags ?? []).some((t) => t === tag)).length;
}

function option(id: string, isCorrect: boolean, misconceptionCode?: string) {
  return {
    id,
    text: { en: id },
    isCorrect,
    ...(misconceptionCode === undefined ? {} : { misconceptionCode }),
  };
}

function mcq(id: string, conceptId: string, options: unknown[], reviewStatus = "draft") {
  return {
    id,
    conceptId,
    type: "mcq",
    difficulty: 1,
    stem: { en: "stem" },
    options,
    boardTags: ["NCERT"],
    reviewStatus,
  };
}

describe("shipped questions", () => {
  it("pass the questions rule", () => {
    expect(questionsRule(concepts, chapters, input.questions, input.misconceptions)).toEqual([]);
  });

  it("number at least 120, with at least 2 per difficulty for each of the 25 concepts in scope", () => {
    expect(scope()).toHaveLength(25);
    expect(inScope.length).toBeGreaterThanOrEqual(120);
    for (const id of scope()) {
      for (const d of [1, 2, 3]) {
        const n = inScope.filter((q) => q.conceptId === id && q.difficulty === d).length;
        expect(n, `${id} difficulty ${d}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("tag at least 10 word problems and 8 extension items", () => {
    expect(tagged("word_problem")).toBeGreaterThanOrEqual(10);
    expect(tagged("extension")).toBeGreaterThanOrEqual(8);
  });

  it("give every chapter concept answers tagged with a misconception", () => {
    for (const id of graph.chapters[CHAPTER]?.conceptIds ?? []) {
      const coded = inScope
        .filter((q) => q.conceptId === id)
        .some((q) =>
          q.type === "mcq"
            ? q.options.some((o) => o.misconceptionCode !== undefined)
            : (q.wrongAnswers ?? []).length > 0,
        );
      expect(coded, id).toBe(true);
    }
  });

  it("are drafts with a Telugu stem, in Telugu script wherever the English has words", () => {
    for (const q of inScope) {
      expect(q.reviewStatus, q.id).toBe("draft");
      expect((q.stem.te ?? "").trim().length, q.id).toBeGreaterThan(0);
      // A pure expression such as "2/7 + 3/7 = ?" is the same in both languages.
      if (/[A-Za-z]{3,}/.test(q.stem.en)) expect(q.stem.te ?? "", q.id).toMatch(TELUGU);
    }
  });
});

describe("questions rule", () => {
  it("reports a misplaced, misnamed, duplicate, unknown-concept or machine-drafted question", () => {
    const twoOptions = [option("a", true), option("b", false)];
    const misplaced = mcq("M6.INT.CONCEPT.Q01", "M6.INT.CONCEPT", twoOptions, "machine_draft");
    const misnamed = mcq("M6.FRAC.CONCEPT.1", "M6.FRAC.CONCEPT", twoOptions);
    const unknown = mcq("M6.NOPE.Q01", "M6.NOPE", twoOptions);
    const messages = questionsRule(
      concepts,
      [],
      {
        "questions/M6.FRAC.CONCEPT.json": [misplaced, misplaced, misnamed],
        "questions/M6.NOPE.json": [unknown],
      },
      input.misconceptions,
    ).map((e) => e.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        'M6.INT.CONCEPT.Q01: conceptId "M6.INT.CONCEPT" does not match the file name',
        "M6.INT.CONCEPT.Q01: duplicate question id",
        "M6.INT.CONCEPT.Q01: machine_draft items must be reviewed before build",
        "M6.FRAC.CONCEPT.1: id must be M6.FRAC.CONCEPT.Qnn",
        'M6.NOPE.Q01: unknown concept "M6.NOPE"',
      ]),
    );
  });

  it("reports correct-option counts, duplicate options, unknown codes and a wrong answer equal to the answer", () => {
    const numeric = {
      id: "M6.INT.CONCEPT.Q04",
      conceptId: "M6.INT.CONCEPT",
      type: "numeric",
      difficulty: 1,
      stem: { en: "stem" },
      answer: 4,
      wrongAnswers: [
        { value: 4, misconceptionCode: "I-SIGN-ADD" },
        { value: 5, misconceptionCode: "NOPE" },
      ],
      boardTags: ["NCERT"],
      reviewStatus: "draft",
    };
    const messages = questionsRule(
      concepts,
      [],
      {
        "questions/M6.INT.CONCEPT.json": [
          mcq("M6.INT.CONCEPT.Q01", "M6.INT.CONCEPT", [
            option("a", true),
            option("b", true),
            option("b", false, "NOPE"),
          ]),
          mcq("M6.INT.CONCEPT.Q02", "M6.INT.CONCEPT", [
            option("a", true, "I-SIGN-ADD"),
            option("b", false),
          ]),
          mcq("M6.INT.CONCEPT.Q03", "M6.INT.CONCEPT", [option("a", false)]),
          numeric,
        ],
      },
      input.misconceptions,
    ).map((e) => e.message);
    expect(messages).toEqual([
      'M6.INT.CONCEPT.Q01: duplicate option id "b"',
      'M6.INT.CONCEPT.Q01: option b: unknown misconception "NOPE"',
      "M6.INT.CONCEPT.Q01: needs exactly one correct option (has 2)",
      "M6.INT.CONCEPT.Q02: correct option a carries a misconception code",
      "M6.INT.CONCEPT.Q03: needs at least 2 options",
      "M6.INT.CONCEPT.Q03: needs exactly one correct option (has 0)",
      "M6.INT.CONCEPT.Q04: wrong answer 4 matches the answer",
      'M6.INT.CONCEPT.Q04: wrong answer 5: unknown misconception "NOPE"',
    ]);
  });

  it("reports too few questions or a missing difficulty for a concept in scope of a full chapter", () => {
    const messages = questionsRule(concepts, chapters, {}, input.misconceptions).map(
      (e) => e.message,
    );
    expect(messages).toContain(`M8.LEQ.ONE_SIDE: needs at least 6 questions, has 0 ${WHERE}`);
    expect(messages).toContain(
      `M6.FRAC.ADD_SUB_UNLIKE: needs at least 2 questions at difficulty 3, has 0 ${WHERE}`,
    );
    expect(messages.some((m) => m.startsWith("M9.") && m.includes("full chapter"))).toBe(false);
  });

  it("reports a question in scope of a full chapter without Telugu", () => {
    const file = "questions/M8.LEQ.ONE_SIDE.json";
    const shipped = input.questions[file] as Question[];
    const englishOnly = shipped.map((q, i) => (i === 0 ? { ...q, stem: { en: q.stem.en } } : q));
    const messages = questionsRule(
      concepts,
      chapters,
      { ...input.questions, [file]: englishOnly },
      input.misconceptions,
    ).map((e) => e.message);
    expect(messages).toEqual([`M8.LEQ.ONE_SIDE.Q01: stem has no Telugu (te) ${WHERE}`]);
  });

  it("skips coverage while there are no chapters", () => {
    expect(questionsRule(concepts, [], {}, input.misconceptions)).toEqual([]);
  });
});
