import { describe, expect, it } from "vitest";
import { mulberry32, selectQuestions } from "../src/index";
import type { ContentPack, Difficulty, Question, QuestionTag } from "../src/index";
import { fixturePack } from "./fixtures/pack";

const CONCEPT = "M7.ALPHA";

function q(
  id: string,
  difficulty: Difficulty,
  tags?: QuestionTag[],
  conceptId = CONCEPT,
): Question {
  return {
    id,
    conceptId,
    type: "numeric",
    difficulty,
    stem: { en: id },
    answer: 1,
    boardTags: ["NCERT"],
    reviewStatus: "draft",
    ...(tags ? { tags } : {}),
  };
}

/** A pack whose only questions are `questions`. */
function packOf(questions: Question[]): ContentPack {
  return { ...fixturePack(), questions };
}

const ids = (list: Question[]) => list.map((x) => x.id);

describe("selectQuestions", () => {
  const pack = packOf([
    q("a1", 1),
    q("b1", 1),
    q("a2", 2),
    q("b2", 2),
    q("c2", 2),
    q("d2", 2),
    q("a3", 3),
    q("b3", 3),
    q("other", 2, undefined, "M6.ZERO"),
  ]);

  it("returns exactly-matching difficulty questions first", () => {
    const picked = selectQuestions(pack, CONCEPT, 2, [], 3, mulberry32(1));
    expect(picked).toHaveLength(3);
    expect(picked.every((x) => x.difficulty === 2)).toBe(true);
  });

  it("only returns questions of the requested concept", () => {
    const picked = selectQuestions(pack, CONCEPT, 2, [], 20, mulberry32(1));
    expect(picked.every((x) => x.conceptId === CONCEPT)).toBe(true);
    expect(ids(picked)).not.toContain("other");
  });

  it("prefers unseen questions at the exact difficulty over seen ones", () => {
    const picked = selectQuestions(pack, CONCEPT, 2, ["a2", "b2"], 2, mulberry32(3));
    expect(ids(picked).sort()).toEqual(["c2", "d2"]);
  });

  it("fills with seen questions, least recently seen (earliest in exclude) first", () => {
    const picked = selectQuestions(pack, CONCEPT, 2, ["c2", "a2", "d2", "b2"], 4, mulberry32(5));
    expect(ids(picked)).toEqual(["c2", "a2", "d2", "b2"]);
    const fewer = selectQuestions(pack, CONCEPT, 2, ["c2", "a2", "d2", "b2"], 3, mulberry32(5));
    expect(ids(fewer)).toEqual(["c2", "a2", "d2"]);
  });

  it("lists unseen before seen when mixing the two at the exact difficulty", () => {
    const picked = selectQuestions(pack, CONCEPT, 2, ["d2", "a2"], 4, mulberry32(9));
    expect(ids(picked).slice(0, 2).sort()).toEqual(["b2", "c2"]);
    expect(ids(picked).slice(2)).toEqual(["d2", "a2"]);
  });

  it("fills from the nearest difficulty when the exact one runs out", () => {
    const small = packOf([q("m1", 2), q("e1", 1), q("h1", 3), q("h2", 3), q("h3", 3)]);
    const picked = selectQuestions(small, CONCEPT, 1, [], 3, mulberry32(2));
    expect(ids(picked)).toEqual(["e1", "m1", expect.stringMatching(/^h[123]$/)]);
  });

  it("treats the easier and the harder neighbour as the same distance", () => {
    const small = packOf([q("e1", 1), q("m1", 2), q("h1", 3)]);
    const picked = selectQuestions(small, CONCEPT, 2, [], 3, mulberry32(2));
    expect(ids(picked)[0]).toBe("m1");
    expect(ids(picked).slice(1).sort()).toEqual(["e1", "h1"]);
  });

  it("returns fewer than n only when the concept has fewer questions", () => {
    expect(selectQuestions(pack, CONCEPT, 2, [], 50, mulberry32(1))).toHaveLength(8);
    expect(selectQuestions(pack, CONCEPT, 2, ["a1", "a2"], 50, mulberry32(1))).toHaveLength(8);
    expect(selectQuestions(pack, "M6.TWO", 2, [], 3, mulberry32(1))).toEqual([]);
  });

  it("never returns duplicates, even if the pack repeats an id or exclude repeats one", () => {
    const dup = packOf([q("a", 1), q("a", 1), q("b", 1)]);
    expect(ids(selectQuestions(dup, CONCEPT, 1, ["a", "a", "b"], 5, mulberry32(1)))).toEqual([
      "a",
      "b",
    ]);
    const picked = ids(selectQuestions(pack, CONCEPT, 3, [], 8, mulberry32(4)));
    expect(new Set(picked).size).toBe(picked.length);
  });

  it("is deterministic for a seed, independent of pack order, and varies across seeds", () => {
    const run = (seed: number, p = pack) =>
      ids(selectQuestions(p, CONCEPT, 2, [], 4, mulberry32(seed)));
    expect(run(7)).toEqual(run(7));
    const reversed = { ...pack, questions: [...pack.questions].reverse() };
    expect(run(7, reversed)).toEqual(run(7));
    const orders = new Set(Array.from({ length: 20 }, (_, seed) => run(seed).join(",")));
    expect(orders.size).toBeGreaterThan(1);
  });

  it("restricts to the tag when given, and does not mutate its inputs", () => {
    const tagged = packOf([
      q("x1", 3, ["extension"]),
      q("x2", 3, ["extension", "word_problem"]),
      q("x3", 2, ["word_problem"]),
      q("x4", 3),
    ]);
    const exclude = ["x1"];
    const picked = selectQuestions(tagged, CONCEPT, 3, exclude, 5, mulberry32(1), {
      tag: "extension",
    });
    expect(ids(picked)).toEqual(["x2", "x1"]);
    expect(exclude).toEqual(["x1"]);
    expect(tagged.questions).toHaveLength(4);
  });

  it("returns an empty list for n <= 0 and throws for an unknown concept", () => {
    expect(selectQuestions(pack, CONCEPT, 2, [], 0, mulberry32(1))).toEqual([]);
    expect(() => selectQuestions(pack, "NOPE", 2, [], 1, mulberry32(1))).toThrow(
      "Unknown concept id: NOPE",
    );
  });
});
