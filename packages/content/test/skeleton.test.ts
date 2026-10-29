import { describe, expect, it } from "vitest";
import {
  buildGraph,
  initialState,
  mulberry32,
  nextReadinessQuestion,
  readinessSummary,
  recordReadinessAnswer,
  startReadiness,
} from "@setu/engine";
import type {
  AttemptEvent,
  Chapter,
  Concept,
  ContentPack,
  LocalizedText,
  Misconception,
  Question,
  Resource,
  RuleId,
} from "@setu/engine";
import { loadContent } from "../src/load";
import { chapterScope } from "../src/pack";
import { questionsRule, resourcesRule, templatesRule } from "../src/validate";

const { input } = loadContent();
const concepts = input.concepts as Concept[];
const chapters = input.chapters as Chapter[];
const graph = buildGraph(concepts, chapters);
const generated = templatesRule(concepts, input.templates).generated;
const questions = [
  ...(Object.values(input.questions).flat() as Question[]),
  ...Object.values(generated).flat(),
];
const resources = Object.values(input.resources).flat() as Resource[];
const skeletons = chapters.filter((c) => c.depth === "skeleton");
const TELUGU = /[\u0C00-\u0C7F]/;

function packFor(chapterId: string): ContentPack {
  const scope = chapterScope(graph, chapterId);
  return {
    packVersion: "test",
    builtAt: "2026-10-28T00:00:00.000Z",
    chapterId,
    graph,
    questions: questions.filter((q) => scope.has(q.conceptId)),
    resources: resources.filter((r) => scope.has(r.conceptId)),
    misconceptions: input.misconceptions as Record<string, Misconception>,
    reasonTemplates: input.reasons as Record<RuleId, LocalizedText>,
  };
}

/** A Readiness Check for a student who answers every question wrong: class levels asked, items used. */
function runAllWrong(chapterId: string): { classes: Set<number>; itemsUsed: number } {
  const pack = packFor(chapterId);
  const rng = mulberry32(7);
  let session = startReadiness(pack, initialState("s1"), chapterId, []);
  const classes = new Set<number>();
  for (let i = 0; i < 20; i++) {
    const next = nextReadinessQuestion(pack, session, rng);
    session = next.session;
    const current = session.current;
    if (!next.question || !current) break;
    classes.add(graph.concepts[current.conceptId]?.classLevel ?? 0);
    const attempt: AttemptEvent = {
      id: `a${i}`,
      type: "attempt",
      studentId: "s1",
      ts: "2026-10-28T10:00:00.000Z",
      questionId: next.question.id,
      conceptId: current.conceptId,
      mode: "readiness",
      difficulty: next.question.difficulty,
      correct: false,
      hintsUsed: 0,
      timeMs: 1000,
    };
    session = recordReadinessAnswer(pack, session, attempt);
  }
  return { classes, itemsUsed: readinessSummary(session, "2026-10-28T10:10:00.000Z").itemsUsed };
}

describe("skeleton chapters", () => {
  it("are the three planned chapters plus the stub foundations chapters", () => {
    expect(skeletons.map((c) => c.id).sort()).toEqual([
      "CH.M10.PAIR_LINEAR_EQ",
      "CH.M6.FOUNDATIONS",
      "CH.M7.FOUNDATIONS",
      "CH.M7.SIMPLE_EQUATIONS",
      "CH.M9.FOUNDATIONS",
      "CH.M9.LINEAR_EQ_TWO_VAR",
    ]);
  });

  it("give every concept at least 3 questions and an explanation in English and Telugu", () => {
    for (const chapter of skeletons) {
      for (const id of chapter.conceptIds) {
        expect(questions.filter((q) => q.conceptId === id).length, id).toBeGreaterThanOrEqual(3);
        const explanation = resources.find((r) => r.conceptId === id && r.type === "explanation");
        expect(explanation?.body.en.length ?? 0, id).toBeGreaterThan(0);
        expect(explanation?.body.te ?? "", id).toMatch(TELUGU);
      }
    }
  });

  it("pass the questions and resources rules", () => {
    expect(
      questionsRule(concepts, chapters, { ...input.questions, ...generated }, input.misconceptions),
    ).toEqual([]);
    expect(resourcesRule(concepts, chapters, input.resources, input.misconceptions)).toEqual([]);
  });

  it("report a skeleton concept with too few questions or no explanation", () => {
    expect(questionsRule(concepts, chapters, {}, input.misconceptions).map((e) => e.message)).toContain(
      "M9.LE2V.CONCEPT: needs at least 3 questions, has 0 (in skeleton chapter CH.M9.LINEAR_EQ_TWO_VAR)",
    );
    expect(resourcesRule(concepts, chapters, {}, input.misconceptions).map((e) => e.message)).toContain(
      "M10.PLE.WORD: needs an explanation (in skeleton chapter CH.M10.PAIR_LINEAR_EQ)",
    );
  });

  it("let a teacher launch Class 9 two-variable equations and see the check reach Class 8 and 7", () => {
    const run = runAllWrong("CH.M9.LINEAR_EQ_TWO_VAR");
    expect(run.classes.has(8)).toBe(true);
    expect(run.classes.has(7)).toBe(true);
    expect(run.itemsUsed).toBeGreaterThan(0);
    expect(run.itemsUsed).toBeLessThanOrEqual(12);
  });

  it("let the Class 10 pair-of-equations check reach Class 9 and 8", () => {
    const run = runAllWrong("CH.M10.PAIR_LINEAR_EQ");
    expect(run.classes.has(9)).toBe(true);
    expect(run.classes.has(8)).toBe(true);
    expect(run.itemsUsed).toBeLessThanOrEqual(12);
  });
});
