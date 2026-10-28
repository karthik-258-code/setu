import { RULE_IDS, buildGraph } from "@setu/engine";
import type { Chapter, Concept, ContentPack, Difficulty, Question } from "@setu/engine";

export const TINY_CHAPTER = "CH.M8.LINEAR_EQ_ONE_VAR";

function concept(id: string, classLevel: 7 | 8, prerequisites: string[], chapterId: string): Concept {
  return {
    id,
    classLevel,
    subject: "math",
    chapterId,
    title: { en: id, te: id },
    prerequisites,
    boardTags: ["NCERT"],
  };
}

function chapter(
  id: string,
  classLevel: 7 | 8,
  conceptIds: string[],
  depth: Chapter["depth"],
): Chapter {
  return { id, classLevel, subject: "math", title: { en: id }, conceptIds, boardTags: ["NCERT"], depth };
}

/** A two-concept pack (Class 7 transpose, then Class 8 one-side equations) that passes the shared schema. */
export function tinyPack(packVersion = "tiny-1"): ContentPack {
  const graph = buildGraph(
    [
      concept("M7.SEQ.TRANSPOSE", 7, [], "CH.M7.SIMPLE_EQUATIONS"),
      concept("M8.LEQ.ONE_SIDE", 8, ["M7.SEQ.TRANSPOSE"], TINY_CHAPTER),
    ],
    [
      chapter("CH.M7.SIMPLE_EQUATIONS", 7, ["M7.SEQ.TRANSPOSE"], "skeleton"),
      chapter(TINY_CHAPTER, 8, ["M8.LEQ.ONE_SIDE"], "full"),
    ],
  );
  const questions: Question[] = [];
  for (const conceptId of ["M7.SEQ.TRANSPOSE", "M8.LEQ.ONE_SIDE"]) {
    for (const difficulty of [1, 2, 3] as Difficulty[]) {
      questions.push({
        id: `${conceptId}.Q0${difficulty}`,
        conceptId,
        type: "mcq",
        difficulty,
        stem: { en: `Question ${difficulty}` },
        options: [
          { id: "a", text: { en: "4" }, isCorrect: true },
          { id: "b", text: { en: "7" }, isCorrect: false, misconceptionCode: "E-TRANSPOSE-SIGN" },
        ],
        boardTags: ["NCERT"],
        reviewStatus: "draft",
      });
    }
  }
  return {
    packVersion,
    builtAt: "2026-10-28T00:00:00.000Z",
    chapterId: TINY_CHAPTER,
    graph,
    questions,
    resources: [],
    misconceptions: {
      "E-TRANSPOSE-SIGN": {
        code: "E-TRANSPOSE-SIGN",
        label: { en: "Keeps the sign when moving a term" },
      },
    },
    reasonTemplates: Object.fromEntries(
      RULE_IDS.map((id) => [id, { en: id }]),
    ) as ContentPack["reasonTemplates"],
  };
}
