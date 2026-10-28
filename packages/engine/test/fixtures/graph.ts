import { buildGraph } from "../../src/index";
import type { Chapter, Concept, ConceptGraph } from "../../src/index";

export function concept(
  id: string,
  classLevel: Concept["classLevel"],
  prerequisites: string[],
): Concept {
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

export function chapter(
  id: string,
  classLevel: Chapter["classLevel"],
  conceptIds: string[],
): Chapter {
  return {
    id,
    classLevel,
    subject: "math",
    title: { en: id },
    conceptIds,
    boardTags: ["NCERT"],
    depth: "full",
  };
}

/**
 * 10 nodes (concept <- prerequisites). Ids are chosen so that topo order differs from
 * alphabetical order.
 *
 *   M6.ZERO  <- (none)            M6.ONE   <- (none)
 *   M6.TWO   <- M6.ZERO           M7.ALPHA <- M6.ZERO     M7.BETA <- M6.ZERO
 *   M7.GAMMA <- M7.ALPHA, M7.BETA M7.DELTA <- M6.ONE
 *   M8.HEX   <- M7.GAMMA, M7.DELTA
 *   M8.IOTA  <- M8.HEX, M7.DELTA
 *   M8.KAPPA <- M6.TWO, M7.DELTA
 *
 * Diamond: ZERO -> {ALPHA, BETA} -> GAMMA.
 * Cross-class chain: ZERO (Class 6) -> ALPHA (7) -> GAMMA (7) -> HEX (8).
 * Chapter CH.M8.X = HEX, IOTA, KAPPA.
 */
export function fixtureGraph(): ConceptGraph {
  return buildGraph(
    [
      concept("M8.KAPPA", 8, ["M6.TWO", "M7.DELTA"]),
      concept("M8.IOTA", 8, ["M8.HEX", "M7.DELTA"]),
      concept("M8.HEX", 8, ["M7.GAMMA", "M7.DELTA"]),
      concept("M7.GAMMA", 7, ["M7.ALPHA", "M7.BETA"]),
      concept("M7.DELTA", 7, ["M6.ONE"]),
      concept("M7.BETA", 7, ["M6.ZERO"]),
      concept("M7.ALPHA", 7, ["M6.ZERO"]),
      concept("M6.TWO", 6, ["M6.ZERO"]),
      concept("M6.ZERO", 6, []),
      concept("M6.ONE", 6, []),
    ],
    [chapter("CH.M8.X", 8, ["M8.HEX", "M8.IOTA", "M8.KAPPA"])],
  );
}
