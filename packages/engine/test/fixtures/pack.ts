import { fixtureGraph } from "./graph";
import type {
  AttemptEvent,
  ContentPack,
  Difficulty,
  Question,
  StudentEvent,
} from "../../src/index";

export const FIXTURE_CHAPTER_ID = "CH.M8.X";
export const FIXTURE_STUDENT_ID = "stu-1";
export const FIXTURE_TEACHER_ID = "teacher-1";

/**
 * ContentPack over the 10-node graph: three MCQs per concept (one per difficulty, ids
 * `<conceptId>.Q1` to `.Q3`) and one misconception, F-ADD-DENOM. No resources and no
 * reason templates; tasks that need them should extend this fixture.
 */
export function fixturePack(): ContentPack {
  const graph = fixtureGraph();
  const questions: Question[] = [];
  for (const conceptId of Object.keys(graph.concepts).sort()) {
    for (const difficulty of [1, 2, 3] as const) {
      questions.push({
        id: `${conceptId}.Q${difficulty}`,
        conceptId,
        type: "mcq",
        difficulty,
        stem: { en: `Question ${difficulty} on ${conceptId}` },
        options: [
          { id: "a", text: { en: "right" }, isCorrect: true },
          { id: "b", text: { en: "wrong" }, isCorrect: false, misconceptionCode: "F-ADD-DENOM" },
        ],
        boardTags: ["NCERT"],
        reviewStatus: "draft",
      });
    }
  }
  return {
    packVersion: "fixture-1",
    builtAt: "2026-10-27T00:00:00.000Z",
    chapterId: FIXTURE_CHAPTER_ID,
    graph,
    questions,
    resources: [],
    misconceptions: { "F-ADD-DENOM": { code: "F-ADD-DENOM", label: { en: "Adds denominators" } } },
    reasonTemplates: {},
  };
}

/** `2026-10-27T10:00:00.000Z` plus `minutes`. */
export function at(minutes: number): string {
  return new Date(Date.UTC(2026, 9, 27, 10, minutes)).toISOString();
}

type Overrides<T extends StudentEvent> = Partial<Omit<T, "type">>;

/** Attempt event with sensible defaults (correct, solve mode, difficulty 1). */
export function attempt(
  id: string,
  conceptId: string,
  overrides: Overrides<AttemptEvent> = {},
): AttemptEvent {
  const difficulty: Difficulty = overrides.difficulty ?? 1;
  return {
    id,
    type: "attempt",
    studentId: FIXTURE_STUDENT_ID,
    ts: at(0),
    questionId: `${conceptId}.Q${difficulty}`,
    conceptId,
    mode: "solve",
    difficulty,
    correct: true,
    hintsUsed: 0,
    timeMs: 5000,
    ...overrides,
  };
}
