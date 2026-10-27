import { describe, expect, it } from "vitest";
import { buildGraph, chapterExternalPrereqs, descendants } from "@setu/engine";
import type { Chapter, Concept } from "@setu/engine";
import { loadContent } from "../src/load";
import { validateContent } from "../src/validate";

const { input, errors: loadErrors } = loadContent();
const concepts = input.concepts as Concept[];
const chapters = input.chapters as Chapter[];

describe("the shipped concept graph (Classes 6 to 10)", () => {
  it("loads and validates without errors", () => {
    expect(loadErrors).toEqual([]);
    expect(validateContent(input)).toEqual([]);
  });

  it("spans Classes 6 to 10 with unique ids", () => {
    const ids = concepts.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(concepts.map((c) => c.classLevel))).toEqual(new Set([6, 7, 8, 9, 10]));
  });

  it("has an English and a Telugu title on every concept and chapter", () => {
    for (const item of [...concepts, ...chapters]) {
      expect(item.title.en.length, item.id).toBeGreaterThan(0);
      expect(item.title.te ?? "", item.id).toMatch(/[\u0C00-\u0C7F]/);
    }
  });

  it("has one full chapter (Class 8 linear equations) and launchable skeletons in Classes 7, 9 and 10", () => {
    const full = chapters.filter((ch) => ch.depth === "full").map((ch) => ch.id);
    expect(full).toEqual(["CH.M8.LINEAR_EQ_ONE_VAR"]);
    for (const id of ["CH.M7.SIMPLE_EQUATIONS", "CH.M9.LINEAR_EQ_TWO_VAR", "CH.M10.PAIR_LINEAR_EQ"]) {
      expect(chapters.find((ch) => ch.id === id)?.depth, id).toBe("skeleton");
    }
  });

  it("gives Class 8 linear equations exactly the seven external prerequisites of BUILD_PLAN 2.1", () => {
    const graph = buildGraph(concepts, chapters);
    expect(new Set(chapterExternalPrereqs(graph, "CH.M8.LINEAR_EQ_ONE_VAR"))).toEqual(
      new Set([
        "M7.SEQ.TRANSPOSE",
        "M7.FRAC.DIV",
        "M7.ALG.LIKE_TERMS",
        "M7.INT.PROPERTIES",
        "M6.FRAC.ADD_SUB_UNLIKE",
        "M7.FRAC.MUL",
        "M7.SEQ.SETUP",
      ]),
    );
  });

  it("lets a Class 9 chapter reach back into Class 8 (the scaling story)", () => {
    const graph = buildGraph(concepts, chapters);
    const external = chapterExternalPrereqs(graph, "CH.M9.LINEAR_EQ_TWO_VAR");
    expect(external).toEqual(expect.arrayContaining(["M8.LEQ.BOTH_SIDES", "M8.LEQ.ONE_SIDE"]));
    expect(descendants(graph, "M6.FRAC.ADD_SUB_UNLIKE")).toEqual(
      expect.arrayContaining(["M8.LEQ.FRACTIONS", "M10.PLE.WORD"]),
    );
  });
});
