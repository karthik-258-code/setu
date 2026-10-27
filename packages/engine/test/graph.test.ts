import { describe, expect, it } from "vitest";
import { assertDag, buildGraph } from "../src/index";
import type { Concept } from "../src/index";

function concept(id: string, classLevel: Concept["classLevel"], prerequisites: string[]): Concept {
  return {
    id,
    classLevel,
    subject: "math",
    chapterId: `CH.${id}`,
    title: { en: id },
    prerequisites,
    boardTags: ["NCERT"],
  };
}

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
