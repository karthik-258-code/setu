import { describe, expect, it } from "vitest";
import {
  ancestors,
  assertDag,
  buildGraph,
  chapterExternalPrereqs,
  descendants,
  directPrereqs,
  frontier,
  rootCauseGap,
} from "../src/index";
import type { Concept, ConceptGraph } from "../src/index";
import { chapter, concept, fixtureGraph as fixture } from "./fixtures/graph";

describe("buildGraph", () => {
  it("returns an empty graph for empty input", () => {
    const graph = buildGraph([], []);
    expect(graph).toEqual({ concepts: {}, chapters: {}, topoOrder: [] });
    expect(() => assertDag(graph)).not.toThrow();
  });

  it("orders prerequisites before dependants, breaking ties by class level then id", () => {
    const graph = buildGraph(
      [
        concept("M8.D", 8, ["M6.B", "M7.C"]),
        concept("M7.C", 7, ["M6.A"]),
        concept("M6.B", 6, []),
        concept("M6.A", 6, []),
        concept("M7.A", 7, []),
      ],
      [],
    );
    expect(graph.topoOrder).toEqual(["M6.A", "M6.B", "M7.A", "M7.C", "M8.D"]);
    expect(() => assertDag(graph)).not.toThrow();
  });

  it("ignores prerequisites that point to unknown concepts", () => {
    const graph = buildGraph([concept("M6.A", 6, ["M6.MISSING"])], []);
    expect(graph.topoOrder).toEqual(["M6.A"]);
  });
});

describe("assertDag", () => {
  it("names the concepts of a 3-node cycle", () => {
    const graph = buildGraph(
      [
        concept("M6.A", 6, ["M6.C"]),
        concept("M6.B", 6, ["M6.A"]),
        concept("M6.C", 6, ["M6.B"]),
        concept("M6.OK", 6, []),
      ],
      [],
    );
    expect(() => assertDag(graph)).toThrow(/cycle: M6\.A -> M6\.C -> M6\.B -> M6\.A/);
  });

  it("reports a cycle even when other concepts only depend on it", () => {
    const graph = buildGraph(
      [concept("M6.A", 6, ["M6.B"]), concept("M6.B", 6, ["M6.A"]), concept("M7.X", 7, ["M6.A"])],
      [],
    );
    expect(() => assertDag(graph)).toThrow(/cycle: M6\.A -> M6\.B -> M6\.A/);
  });

  it("rejects a self-loop", () => {
    const graph = buildGraph([concept("M6.A", 6, ["M6.A"])], []);
    expect(() => assertDag(graph)).toThrow(/M6\.A -> M6\.A/);
  });
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Mastery view from `[id, pKnown]` pairs; ids not listed are untouched. */
function mastery(entries: Record<string, number>): Record<string, { pKnown: number }> {
  return Object.fromEntries(Object.entries(entries).map(([id, pKnown]) => [id, { pKnown }]));
}

describe("topoOrder on the 10-node fixture", () => {
  it("is Kahn order with ties broken by class level, then id", () => {
    const graph = fixture();
    expect(graph.topoOrder).toEqual([
      "M6.ONE",
      "M6.ZERO",
      "M6.TWO",
      "M7.ALPHA",
      "M7.BETA",
      "M7.DELTA",
      "M7.GAMMA",
      "M8.HEX",
      "M8.IOTA",
      "M8.KAPPA",
    ]);
    expect(() => assertDag(graph)).not.toThrow();
  });

  it("puts a ready Class 6 concept ahead of a ready Class 7 concept with a smaller id", () => {
    const graph = buildGraph([concept("M7.AAA", 7, []), concept("M6.ZZZ", 6, [])], []);
    expect(graph.topoOrder).toEqual(["M6.ZZZ", "M7.AAA"]);
  });
});

describe("directPrereqs", () => {
  it("returns direct prerequisites only, in topo order", () => {
    const graph = fixture();
    expect(directPrereqs(graph, "M8.HEX")).toEqual(["M7.DELTA", "M7.GAMMA"]);
    expect(directPrereqs(graph, "M6.ONE")).toEqual([]);
  });

  it("ignores prerequisites that point to unknown concepts", () => {
    const graph = buildGraph([concept("M6.A", 6, ["M6.MISSING"])], []);
    expect(directPrereqs(graph, "M6.A")).toEqual([]);
  });

  it("throws a clear error for an unknown id", () => {
    expect(() => directPrereqs(fixture(), "M6.NOPE")).toThrow("Unknown concept id: M6.NOPE");
  });
});

describe("ancestors and descendants", () => {
  it("returns transitive ancestors in topo order across classes, excluding the node", () => {
    const graph = fixture();
    expect(ancestors(graph, "M8.HEX")).toEqual([
      "M6.ONE",
      "M6.ZERO",
      "M7.ALPHA",
      "M7.BETA",
      "M7.DELTA",
      "M7.GAMMA",
    ]);
    expect(ancestors(graph, "M7.GAMMA")).toEqual(["M6.ZERO", "M7.ALPHA", "M7.BETA"]);
    expect(ancestors(graph, "M6.ONE")).toEqual([]);
  });

  it("lists a diamond's shared ancestor once", () => {
    expect(ancestors(fixture(), "M7.GAMMA").filter((id) => id === "M6.ZERO")).toHaveLength(1);
  });

  it("returns transitive descendants in topo order, excluding the node", () => {
    const graph = fixture();
    expect(descendants(graph, "M6.ZERO")).toEqual([
      "M6.TWO",
      "M7.ALPHA",
      "M7.BETA",
      "M7.GAMMA",
      "M8.HEX",
      "M8.IOTA",
      "M8.KAPPA",
    ]);
    expect(descendants(graph, "M7.DELTA")).toEqual(["M8.HEX", "M8.IOTA", "M8.KAPPA"]);
    expect(descendants(graph, "M8.IOTA")).toEqual([]);
  });

  it("throws a clear error for an unknown id", () => {
    expect(() => ancestors(fixture(), "M6.NOPE")).toThrow("Unknown concept id: M6.NOPE");
    expect(() => descendants(fixture(), "M6.NOPE")).toThrow("Unknown concept id: M6.NOPE");
  });
});

describe("chapterExternalPrereqs", () => {
  it("lists prerequisites outside the chapter once each, in topo order", () => {
    // M7.DELTA is a direct prerequisite of all three chapter concepts.
    expect(chapterExternalPrereqs(fixture(), "CH.M8.X")).toEqual([
      "M6.TWO",
      "M7.DELTA",
      "M7.GAMMA",
    ]);
  });

  it("excludes prerequisites that are chapter concepts themselves", () => {
    // M8.IOTA requires M8.HEX, which is inside the chapter.
    expect(chapterExternalPrereqs(fixture(), "CH.M8.X")).not.toContain("M8.HEX");
  });

  it("returns an empty list for a chapter with no outside prerequisites", () => {
    const graph = buildGraph(
      [concept("M6.A", 6, []), concept("M6.B", 6, ["M6.A"])],
      [chapter("CH.M6.ALL", 6, ["M6.A", "M6.B"])],
    );
    expect(chapterExternalPrereqs(graph, "CH.M6.ALL")).toEqual([]);
  });

  it("throws a clear error for an unknown chapter", () => {
    expect(() => chapterExternalPrereqs(fixture(), "CH.NOPE")).toThrow(
      "Unknown chapter id: CH.NOPE",
    );
  });
});

describe("frontier", () => {
  const everything = (graph: ConceptGraph) => Object.keys(graph.concepts);

  it("is the set of concepts without prerequisites when nothing is touched", () => {
    const graph = fixture();
    expect(frontier(graph, {}, everything(graph), 0.9)).toEqual(["M6.ONE", "M6.ZERO"]);
  });

  it("treats untouched concepts as not mastered, so they block their dependants", () => {
    const graph = fixture();
    // M6.ZERO mastered; M6.ONE untouched keeps M7.DELTA (and everything under it) off the frontier.
    expect(frontier(graph, mastery({ "M6.ZERO": 0.95 }), everything(graph), 0.9)).toEqual([
      "M6.ONE",
      "M6.TWO",
      "M7.ALPHA",
      "M7.BETA",
    ]);
  });

  it("handles partially mastered prerequisites and a pKnown exactly at the threshold", () => {
    const graph = fixture();
    const state = mastery({
      "M6.ONE": 0.95,
      "M6.ZERO": 0.9, // exactly the threshold counts as mastered
      "M7.ALPHA": 0.95,
      "M7.BETA": 0.5, // not mastered: GAMMA stays blocked
    });
    expect(frontier(graph, state, everything(graph), 0.9)).toEqual([
      "M6.TWO",
      "M7.BETA",
      "M7.DELTA",
    ]);
  });

  it("excludes mastered concepts and honours the threshold argument", () => {
    const graph = fixture();
    const state = mastery({ "M6.ONE": 0.85, "M6.ZERO": 0.85 });
    expect(frontier(graph, state, everything(graph), 0.9)).toEqual(["M6.ONE", "M6.ZERO"]);
    expect(frontier(graph, state, everything(graph), 0.8)).toEqual([
      "M6.TWO",
      "M7.ALPHA",
      "M7.BETA",
      "M7.DELTA",
    ]);
  });

  it("only returns concepts inside the scope", () => {
    const graph = fixture();
    const state = mastery({ "M6.ONE": 0.95, "M6.ZERO": 0.95 });
    expect(frontier(graph, state, ["M7.ALPHA", "M8.HEX"], 0.9)).toEqual(["M7.ALPHA"]);
  });

  it("orders by lowest class level before topo order", () => {
    // Topo order is EARLY, GATE, LATE, but LATE is Class 6 so it comes first on the frontier.
    const graph = buildGraph(
      [concept("M7.EARLY", 7, []), concept("M7.GATE", 7, []), concept("M6.LATE", 6, ["M7.GATE"])],
      [],
    );
    expect(graph.topoOrder).toEqual(["M7.EARLY", "M7.GATE", "M6.LATE"]);
    expect(frontier(graph, mastery({ "M7.GATE": 0.95 }), everything(graph), 0.9)).toEqual([
      "M6.LATE",
      "M7.EARLY",
    ]);
  });

  it("throws a clear error for an unknown concept in scope", () => {
    expect(() => frontier(fixture(), {}, ["M6.NOPE"], 0.9)).toThrow("Unknown concept id: M6.NOPE");
  });
});

describe("rootCauseGap", () => {
  it("picks the Class 6 blocker over a Class 7 dependent", () => {
    const state = mastery({ "M6.ZERO": 0.4, "M7.ALPHA": 0.3, "M7.GAMMA": 0.2 });
    expect(rootCauseGap(fixture(), state, "CH.M8.X")).toBe("M6.ZERO");
  });

  it("breaks ties between independent blockers by lowest class level", () => {
    const state = mastery({ "M6.ZERO": 0.95, "M7.ALPHA": 0.5, "M6.TWO": 0.5 });
    expect(rootCauseGap(fixture(), state, "CH.M8.X")).toBe("M6.TWO");
  });

  it("breaks ties within a class by topo order", () => {
    const state = mastery({ "M7.DELTA": 0.5, "M7.ALPHA": 0.5, "M6.ZERO": 0.95, "M6.ONE": 0.95 });
    expect(rootCauseGap(fixture(), state, "CH.M8.X")).toBe("M7.ALPHA");
  });

  it("treats untouched prerequisites as clear, so the touched unmastered concept is the blocker", () => {
    expect(rootCauseGap(fixture(), mastery({ "M7.GAMMA": 0.3 }), "CH.M8.X")).toBe("M7.GAMMA");
  });

  it("ignores untouched concepts, weak chapter concepts and mastered concepts", () => {
    const state = mastery({ "M8.HEX": 0.1, "M7.GAMMA": 0.95, "M7.DELTA": 0.99 });
    expect(rootCauseGap(fixture(), state, "CH.M8.X")).toBeNull();
  });

  it("returns null when everything is mastered", () => {
    const graph = fixture();
    const state = mastery(Object.fromEntries(Object.keys(graph.concepts).map((id) => [id, 0.97])));
    expect(rootCauseGap(graph, state, "CH.M8.X")).toBeNull();
  });

  it("returns null for a student with no mastery data", () => {
    expect(rootCauseGap(fixture(), {}, "CH.M8.X")).toBeNull();
  });

  it("throws a clear error for an unknown chapter", () => {
    expect(() => rootCauseGap(fixture(), {}, "CH.NOPE")).toThrow("Unknown chapter id: CH.NOPE");
  });
});

describe("BUILD_PLAN 2.1 concept spine", () => {
  // Prerequisite edges copied from docs/BUILD_PLAN.md (concept <- prerequisites).
  const EDGES: Record<string, string[]> = {
    "M6.INT.CONCEPT": [],
    "M6.NUM.LCM_HCF": [],
    "M6.FRAC.CONCEPT": [],
    "M6.DEC.CONCEPT": [],
    "M6.ALG.VARIABLE": [],
    "M6.INT.ADD_SUB": ["M6.INT.CONCEPT"],
    "M6.FRAC.EQUIV": ["M6.FRAC.CONCEPT"],
    "M6.FRAC.COMPARE": ["M6.FRAC.EQUIV"],
    "M6.FRAC.ADD_SUB_LIKE": ["M6.FRAC.CONCEPT"],
    "M6.FRAC.ADD_SUB_UNLIKE": ["M6.FRAC.ADD_SUB_LIKE", "M6.FRAC.EQUIV", "M6.NUM.LCM_HCF"],
    "M6.DEC.ADD_SUB": ["M6.DEC.CONCEPT"],
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
    "M9.POLY.CONCEPT": ["M7.ALG.TERMS"],
    "M9.COORD.PLOT": ["M6.INT.CONCEPT"],
    "M9.LE2V.CONCEPT": ["M8.LEQ.BOTH_SIDES", "M6.ALG.VARIABLE"],
    "M9.LE2V.SOLUTIONS": ["M9.LE2V.CONCEPT", "M8.LEQ.ONE_SIDE"],
    "M9.LE2V.GRAPH": ["M9.LE2V.SOLUTIONS", "M9.COORD.PLOT"],
    "M10.PLE.GRAPHICAL": ["M9.LE2V.GRAPH"],
    "M10.PLE.SUBSTITUTION": ["M9.LE2V.SOLUTIONS", "M8.LEQ.BRACKETS"],
    "M10.PLE.ELIMINATION": ["M10.PLE.SUBSTITUTION"],
    "M10.PLE.WORD": ["M10.PLE.ELIMINATION", "M8.LEQ.WORD_AGE_PERIMETER"],
  };

  const M8_CHAPTER = [
    "M8.LEQ.ONE_SIDE",
    "M8.LEQ.BOTH_SIDES",
    "M8.LEQ.BRACKETS",
    "M8.LEQ.FRACTIONS",
    "M8.LEQ.REDUCIBLE",
    "M8.LEQ.WORD_NUMBER",
    "M8.LEQ.WORD_AGE_PERIMETER",
  ];

  function spine(): ConceptGraph {
    const concepts = Object.entries(EDGES).map(([id, prereqs]) =>
      concept(id, Number(/^M(\d+)\./.exec(id)?.[1]) as Concept["classLevel"], prereqs),
    );
    return buildGraph(concepts, [chapter("CH.M8.LINEAR_EQ_ONE_VAR", 8, M8_CHAPTER)]);
  }

  it("is a DAG", () => {
    const graph = spine();
    expect(Object.keys(graph.concepts)).toHaveLength(Object.keys(EDGES).length);
    expect(() => assertDag(graph)).not.toThrow();
  });

  it("gives CH.M8.LINEAR_EQ_ONE_VAR exactly the seven external prerequisites listed in BUILD_PLAN", () => {
    const external = chapterExternalPrereqs(spine(), "CH.M8.LINEAR_EQ_ONE_VAR");
    const listed = [
      "M7.SEQ.TRANSPOSE",
      "M7.FRAC.DIV",
      "M7.ALG.LIKE_TERMS",
      "M7.INT.PROPERTIES",
      "M6.FRAC.ADD_SUB_UNLIKE",
      "M7.FRAC.MUL",
      "M7.SEQ.SETUP",
    ];
    expect(external).toHaveLength(7);
    expect(new Set(external)).toEqual(new Set(listed));
    // Order we get (topo: class level, then id, prerequisites first); BUILD_PLAN's order differs.
    expect(external).toEqual([
      "M6.FRAC.ADD_SUB_UNLIKE",
      "M7.ALG.LIKE_TERMS",
      "M7.FRAC.MUL",
      "M7.FRAC.DIV",
      "M7.INT.PROPERTIES",
      "M7.SEQ.SETUP",
      "M7.SEQ.TRANSPOSE",
    ]);
  });
});
