import { buildGraph } from "../../src/index";
import type { Chapter, ContentPack, Question } from "../../src/index";
import { chapter, concept } from "./graph";
import { fixturePack } from "./pack";

export const SPINE_CHAPTER_ID = "CH.M8.LINEAR_EQ_ONE_VAR";

/** `concept <- prerequisites`, copied from the BUILD_PLAN 2.1 spine (Classes 6 to 8 only). */
const SPINE_EDGES: Record<string, string[]> = {
  "M6.INT.CONCEPT": [],
  "M6.INT.ADD_SUB": ["M6.INT.CONCEPT"],
  "M6.NUM.LCM_HCF": [],
  "M6.FRAC.CONCEPT": [],
  "M6.FRAC.EQUIV": ["M6.FRAC.CONCEPT"],
  "M6.FRAC.COMPARE": ["M6.FRAC.EQUIV"],
  "M6.FRAC.ADD_SUB_LIKE": ["M6.FRAC.CONCEPT"],
  "M6.FRAC.ADD_SUB_UNLIKE": ["M6.FRAC.ADD_SUB_LIKE", "M6.FRAC.EQUIV", "M6.NUM.LCM_HCF"],
  "M6.DEC.CONCEPT": [],
  "M6.DEC.ADD_SUB": ["M6.DEC.CONCEPT"],
  "M6.ALG.VARIABLE": [],
  "M6.ALG.EQUATION_INTRO": ["M6.ALG.VARIABLE"],
  "M7.INT.MUL_DIV": ["M6.INT.ADD_SUB"],
  "M7.INT.PROPERTIES": ["M7.INT.MUL_DIV"],
  "M7.FRAC.MUL": ["M6.FRAC.EQUIV"],
  "M7.FRAC.DIV": ["M7.FRAC.MUL"],
  "M7.DEC.MUL_DIV": ["M6.DEC.ADD_SUB", "M7.INT.MUL_DIV"],
  "M7.RAT.CONCEPT": ["M7.INT.MUL_DIV", "M6.FRAC.CONCEPT"],
  "M7.ALG.TERMS": ["M6.ALG.VARIABLE"],
  "M7.ALG.LIKE_TERMS": ["M7.ALG.TERMS", "M6.INT.ADD_SUB"],
  "M7.ALG.ADD_SUB_EXPR": ["M7.ALG.LIKE_TERMS"],
  "M7.ALG.VALUE_OF_EXPR": ["M7.ALG.TERMS", "M7.INT.MUL_DIV"],
  "M7.SEQ.SETUP": ["M6.ALG.EQUATION_INTRO", "M7.ALG.TERMS"],
  "M7.SEQ.BALANCE": ["M6.ALG.EQUATION_INTRO", "M6.INT.ADD_SUB"],
  "M7.SEQ.TRANSPOSE": ["M7.SEQ.BALANCE", "M7.INT.MUL_DIV"],
  "M7.SEQ.APPLY": ["M7.SEQ.SETUP", "M7.SEQ.TRANSPOSE"],
  "M8.LEQ.ONE_SIDE": ["M7.SEQ.TRANSPOSE", "M7.FRAC.DIV"],
  "M8.LEQ.BOTH_SIDES": ["M8.LEQ.ONE_SIDE", "M7.ALG.LIKE_TERMS"],
  "M8.LEQ.BRACKETS": ["M8.LEQ.BOTH_SIDES", "M7.INT.PROPERTIES"],
  "M8.LEQ.FRACTIONS": ["M8.LEQ.BOTH_SIDES", "M6.FRAC.ADD_SUB_UNLIKE", "M7.FRAC.MUL"],
  "M8.LEQ.REDUCIBLE": ["M8.LEQ.FRACTIONS", "M8.LEQ.BRACKETS"],
  "M8.LEQ.WORD_NUMBER": ["M8.LEQ.BOTH_SIDES", "M7.SEQ.SETUP"],
  "M8.LEQ.WORD_AGE_PERIMETER": ["M8.LEQ.WORD_NUMBER"],
};

const SPINE_CHAPTER_CONCEPTS = [
  "M8.LEQ.ONE_SIDE",
  "M8.LEQ.BOTH_SIDES",
  "M8.LEQ.BRACKETS",
  "M8.LEQ.FRACTIONS",
  "M8.LEQ.REDUCIBLE",
  "M8.LEQ.WORD_NUMBER",
  "M8.LEQ.WORD_AGE_PERIMETER",
];

/** Misconception that the wrong option of a concept's questions diagnoses; others have none. */
const SPINE_MISCONCEPTIONS: Record<string, string> = {
  "M6.FRAC.ADD_SUB_UNLIKE": "F-ADD-DENOM",
  "M7.ALG.LIKE_TERMS": "A-UNLIKE-COMBINE",
  "M7.INT.MUL_DIV": "I-SIGN-MUL",
};

/**
 * One easy, two medium (`.Q02`, `.Q03`) and one hard question per concept. The wrong option
 * carries the concept's misconception code when it has one.
 */
export function questionsFor(
  conceptIds: readonly string[],
  codes: Record<string, string> = {},
): Question[] {
  const questions: Question[] = [];
  for (const conceptId of conceptIds) {
    for (const [n, difficulty] of [
      ["Q01", 1],
      ["Q02", 2],
      ["Q03", 2],
      ["Q04", 3],
    ] as const) {
      const code = codes[conceptId];
      questions.push({
        id: `${conceptId}.${n}`,
        conceptId,
        type: "mcq",
        difficulty,
        stem: { en: `${n} on ${conceptId}` },
        options: [
          { id: "a", text: { en: "right" }, isCorrect: true },
          {
            id: "b",
            text: { en: "wrong" },
            isCorrect: false,
            ...(code !== undefined ? { misconceptionCode: code } : {}),
          },
        ],
        boardTags: ["NCERT"],
        reviewStatus: "draft",
      });
    }
  }
  return questions;
}

/** Classes 6 to 8 of the real spine, with `CH.M8.LINEAR_EQ_ONE_VAR` as the chapter. */
export function spinePack(): ContentPack {
  const ids = Object.keys(SPINE_EDGES);
  const level = (id: string): 6 | 7 | 8 => (id.startsWith("M6") ? 6 : id.startsWith("M7") ? 7 : 8);
  const chapters: Chapter[] = [chapter(SPINE_CHAPTER_ID, 8, SPINE_CHAPTER_CONCEPTS)];
  const graph = buildGraph(
    ids.map((id) => concept(id, level(id), SPINE_EDGES[id] ?? [])),
    chapters,
  );
  const base = fixturePack();
  return {
    ...base,
    chapterId: SPINE_CHAPTER_ID,
    graph,
    questions: questionsFor(ids, SPINE_MISCONCEPTIONS),
    misconceptions: {
      "F-ADD-DENOM": { code: "F-ADD-DENOM", label: { en: "Adds denominators" } },
      "A-UNLIKE-COMBINE": { code: "A-UNLIKE-COMBINE", label: { en: "Combines unlike terms" } },
      "I-SIGN-MUL": { code: "I-SIGN-MUL", label: { en: "Sign error when multiplying" } },
    },
  };
}

export const CHAIN_CHAPTER_ID = "CH.M8.CHAIN";

/**
 * A straight line of six concepts, `C0 <- C1 <- ... <- C5`, with the chapter holding only `C5`.
 * Its single external prerequisite is `C4`; failing every question reaches `C0` only if the
 * depth cap is ignored (C4 depth 0, C3 depth 1, C2 depth 2, C1 depth 3, C0 depth 4).
 */
export function chainPack(): ContentPack {
  const ids = ["M6.C0", "M6.C1", "M7.C2", "M7.C3", "M7.C4", "M8.C5"];
  const level = (id: string): 6 | 7 | 8 => (id.startsWith("M6") ? 6 : id.startsWith("M7") ? 7 : 8);
  const graph = buildGraph(
    ids.map((id, i) => concept(id, level(id), i === 0 ? [] : [ids[i - 1] as string])),
    [chapter(CHAIN_CHAPTER_ID, 8, ["M8.C5"])],
  );
  return { ...fixturePack(), chapterId: CHAIN_CHAPTER_ID, graph, questions: questionsFor(ids) };
}
