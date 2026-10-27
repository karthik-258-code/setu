import { describe, expect, it } from "vitest";
import { ancestors, buildGraph } from "@setu/engine";
import type { Chapter, Concept, Resource } from "@setu/engine";
import { loadContent } from "../src/load";
import { resourcesRule } from "../src/validate";

const { input } = loadContent();
const concepts = input.concepts as Concept[];
const chapters = input.chapters as Chapter[];
const graph = buildGraph(concepts, chapters);
const CHAPTER = "CH.M8.LINEAR_EQ_ONE_VAR";

function scope(): string[] {
  const ids = new Set<string>(graph.chapters[CHAPTER]?.conceptIds ?? []);
  for (const id of [...ids]) for (const a of ancestors(graph, id)) ids.add(a);
  return [...ids].sort();
}

const all = Object.values(input.resources).flat() as Resource[];

describe("shipped resources", () => {
  it("pass the resources rule", () => {
    expect(resourcesRule(concepts, chapters, input.resources, input.misconceptions)).toEqual([]);
  });

  it("cover the 25 concepts of Class 8 linear equations and its prerequisites", () => {
    expect(scope()).toHaveLength(25);
    for (const id of scope()) {
      const mine = all.filter((r) => r.conceptId === id);
      expect(mine.map((r) => r.type).sort(), id).toEqual(
        expect.arrayContaining(["explanation", "hint", "worked_example"]),
      );
    }
  });

  it("have a targeted worked example for every misconception used in this scope", () => {
    const targeted = new Set(all.map((r) => r.targetsMisconception).filter(Boolean));
    for (const code of [
      "F-ADD-DENOM",
      "F-EQUIV-ADD",
      "F-DIV-NO-RECIP",
      "I-SIGN-ADD",
      "I-SIGN-MUL",
      "A-UNLIKE-COMBINE",
      "A-COEFF-DROP",
      "E-TRANSPOSE-SIGN",
      "E-TRANSPOSE-DIVIDE",
      "E-BOTH-SIDES-ONE",
      "E-DIST-PARTIAL",
      "E-LCM-PARTIAL",
      "E-CROSS-WRONG",
      "W-SETUP-REVERSE",
    ]) {
      expect(targeted.has(code), code).toBe(true);
    }
  });

  it("are bilingual throughout", () => {
    for (const r of all) expect(r.body.te ?? "", r.id).toMatch(/[\u0C00-\u0C7F]/);
  });
});

describe("resources rule", () => {
  it("reports every missing piece of coverage when there are no resources", () => {
    const messages = resourcesRule(concepts, chapters, {}, input.misconceptions).map((e) => e.message);
    expect(messages).toContain(
      `M8.LEQ.ONE_SIDE: needs an explanation (in scope of full chapter ${CHAPTER})`,
    );
    expect(messages).toContain(
      `M6.FRAC.ADD_SUB_UNLIKE: needs a hint (in scope of full chapter ${CHAPTER})`,
    );
    expect(messages.some((m) => m.startsWith("M9."))).toBe(false);
  });

  it("reports a misplaced, duplicate, unknown-code or machine-drafted resource", () => {
    const r = {
      id: "X.1",
      conceptId: "M6.INT.CONCEPT",
      type: "hint",
      body: { en: "x" },
      targetsMisconception: "NOPE",
      reviewStatus: "machine_draft",
    };
    const messages = resourcesRule(
      concepts,
      [],
      { "resources/M6.FRAC.CONCEPT.json": [r, r] },
      input.misconceptions,
    ).map((e) => e.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        'X.1: conceptId "M6.INT.CONCEPT" does not match the file name',
        "X.1: duplicate resource id",
        'X.1: unknown misconception "NOPE"',
        "X.1: machine_draft items must be reviewed before build",
      ]),
    );
  });
});
