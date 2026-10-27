import { buildGraph } from "../../src/index";
import type {
  Chapter,
  Concept,
  ContentPack,
  Difficulty,
  Misconception,
  Question,
  Resource,
  StudentEvent,
} from "../../src/index";
import packJson from "./pack.json";
import masteryRun from "./mastery-run.json";
import overrideVerifyFail from "./override-verify-fail.json";
import readinessGap from "./readiness-gap.json";

/**
 * Golden vectors: `(pack, events) -> expected StudentState` (ARCHITECTURE 5.7). The same JSON
 * files are loaded by the API tests so the browser and server builds are held to one answer.
 * In `expected`, `null` means "this field must be absent"; `pKnown` is compared to 6 decimals;
 * every other listed field must be equal. Fields not listed are not checked.
 */
export interface GoldenVector {
  name: string;
  description: string;
  studentId: string;
  events: StudentEvent[];
  expected: {
    eventCount: number;
    lastEventTs: string;
    mastery: Record<string, Record<string, unknown>>;
    progress: Record<string, Record<string, unknown>>;
    rechecks: unknown[];
    readiness: Record<string, unknown>;
  };
}

/** The golden pack: three concepts A <- B <- C, three MCQs each (difficulty 1 to 3). */
export function goldenPack(): ContentPack {
  const concepts = packJson.concepts as unknown as Concept[];
  const chapters = packJson.chapters as unknown as Chapter[];
  const questions: Question[] = concepts.flatMap((c) =>
    (packJson.questionDifficulties as Difficulty[]).map(
      (difficulty): Question => ({
        id: `${c.id}.Q${difficulty}`,
        conceptId: c.id,
        type: "mcq",
        difficulty,
        stem: { en: `Question ${difficulty} on ${c.id}` },
        options: [
          { id: "a", text: { en: "right" }, isCorrect: true },
          { id: "b", text: { en: "wrong" }, isCorrect: false, misconceptionCode: "F-ADD-DENOM" },
        ],
        boardTags: ["NCERT"],
        reviewStatus: "draft",
      }),
    ),
  );
  return {
    packVersion: packJson.packVersion,
    builtAt: packJson.builtAt,
    chapterId: packJson.chapterId,
    graph: buildGraph(concepts, chapters),
    questions,
    resources: packJson.resources as unknown as Resource[],
    misconceptions: packJson.misconceptions as unknown as Record<string, Misconception>,
    reasonTemplates: {},
  };
}

export const goldenVectors: GoldenVector[] = [
  masteryRun as unknown as GoldenVector,
  overrideVerifyFail as unknown as GoldenVector,
  readinessGap as unknown as GoldenVector,
];
