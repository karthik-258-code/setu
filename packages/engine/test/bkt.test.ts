import { describe, expect, it } from "vitest";
import {
  DEFAULT_BKT,
  MASTERY_THRESHOLD,
  bktUpdate,
  buildGraph,
  isMastered,
  paramsFor,
  priorFromPrerequisites,
} from "../src/index";
import type { Concept } from "../src/index";

function concept(id: string, prerequisites: string[], bkt?: Concept["bkt"]): Concept {
  return {
    id,
    classLevel: 7,
    subject: "math",
    chapterId: `CH.${id}`,
    title: { en: id },
    prerequisites,
    boardTags: ["NCERT"],
    ...(bkt ? { bkt } : {}),
  };
}

describe("paramsFor", () => {
  it("returns the defaults when the concept has no overrides", () => {
    expect(paramsFor(concept("M7.A", []))).toEqual(DEFAULT_BKT);
  });

  it("applies per-concept overrides on top of the defaults without mutating DEFAULT_BKT", () => {
    const params = paramsFor(concept("M7.A", [], { pT: 0.5, pS: 0.05 }));
    expect(params).toEqual({ pL0: 0.3, pT: 0.5, pG: 0.2, pS: 0.05 });
    expect(DEFAULT_BKT).toEqual({ pL0: 0.3, pT: 0.2, pG: 0.2, pS: 0.1 });
  });

  it("ignores overrides that are explicitly undefined", () => {
    expect(paramsFor(concept("M7.A", [], { pG: undefined }))).toEqual(DEFAULT_BKT);
  });
});

describe("bktUpdate", () => {
  it("raises pL=0.3 to 0.7268293 after a correct answer with default parameters", () => {
    // posterior = 0.3*0.9 / (0.3*0.9 + 0.7*0.2) = 0.27 / 0.41 = 0.6585366
    // updated   = 0.6585366 + (1 - 0.6585366)*0.2 = 0.6585366 + 0.0682927 = 0.7268293
    expect(bktUpdate(0.3, true, DEFAULT_BKT)).toBeCloseTo(0.7268293, 6);
  });

  it("lowers pL=0.3 to 0.2406780 after a wrong answer with default parameters", () => {
    // posterior = 0.3*0.1 / (0.3*0.1 + 0.7*0.8) = 0.03 / 0.59 = 0.0508475
    // updated   = 0.0508475 + (1 - 0.0508475)*0.2 = 0.0508475 + 0.1898305 = 0.2406780
    expect(bktUpdate(0.3, false, DEFAULT_BKT)).toBeCloseTo(0.240678, 6);
  });

  it("crosses the 0.9 mastery threshold on the second consecutive correct answer from pL0", () => {
    // answer 1: 0.3 -> posterior 0.6585366 -> 0.7268293 (below 0.9)
    // answer 2: posterior = 0.7268293*0.9 / (0.7268293*0.9 + 0.2731707*0.2) = 0.6541463 / 0.7087805 = 0.9229181
    //           updated   = 0.9229181 + 0.0770819*0.2 = 0.9383345 (first value >= 0.9)
    // answer 3: 0.9884850, answer 4: 0.9979344, answer 5: 0.9996322
    const expected = [0.7268293, 0.9383345, 0.988485, 0.9979344, 0.9996322];
    let pKnown = DEFAULT_BKT.pL0;
    const values: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      pKnown = bktUpdate(pKnown, true, DEFAULT_BKT);
      values.push(pKnown);
    }
    values.forEach((value, i) => expect(value).toBeCloseTo(expected[i] as number, 6));
    expect(values.findIndex(isMastered) + 1).toBe(2);
  });

  it("uses per-concept overrides when given the params from paramsFor", () => {
    // pL=0.4, pS=0.05, pG=0.1, pT=0.5, correct:
    // posterior = 0.4*0.95 / (0.4*0.95 + 0.6*0.1) = 0.38 / 0.44 = 0.8636364
    // updated   = 0.8636364 + (1 - 0.8636364)*0.5 = 0.9318182
    const params = paramsFor(concept("M7.A", [], { pT: 0.5, pG: 0.1, pS: 0.05 }));
    expect(bktUpdate(0.4, true, params)).toBeCloseTo(0.9318182, 6);
  });

  it("falls back to the prior before learning when the observation has zero probability", () => {
    // pL=0 and pG=0: a correct answer is impossible, so posterior = pL = 0; updated = 0 + 1*0.2
    const params = { ...DEFAULT_BKT, pG: 0 };
    expect(bktUpdate(0, true, params)).toBeCloseTo(0.2, 6);
  });

  it("throws RangeError for pKnown outside [0, 1]", () => {
    expect(() => bktUpdate(1.2, true, DEFAULT_BKT)).toThrow(RangeError);
    expect(() => bktUpdate(-0.1, false, DEFAULT_BKT)).toThrow(RangeError);
  });

  it("throws RangeError for NaN and infinite pKnown", () => {
    expect(() => bktUpdate(Number.NaN, true, DEFAULT_BKT)).toThrow(RangeError);
    expect(() => bktUpdate(Number.POSITIVE_INFINITY, true, DEFAULT_BKT)).toThrow(RangeError);
  });

  it("throws RangeError for parameters outside [0, 1]", () => {
    expect(() => bktUpdate(0.3, true, { ...DEFAULT_BKT, pT: 1.5 })).toThrow(RangeError);
    expect(() => bktUpdate(0.3, true, { ...DEFAULT_BKT, pS: Number.NaN })).toThrow(RangeError);
  });
});

describe("priorFromPrerequisites", () => {
  const graph = buildGraph(
    [
      concept("M6.ROOT", []),
      concept("M6.OTHER", []),
      concept("M7.ONE", ["M6.ROOT"]),
      concept("M7.TWO", ["M6.ROOT", "M6.OTHER"]),
    ],
    [],
  );

  it("returns pL0 unchanged for a concept with no prerequisites", () => {
    expect(priorFromPrerequisites(graph, "M6.ROOT", {}, DEFAULT_BKT)).toBeCloseTo(0.3, 6);
  });

  it("does not clamp the prior of a concept with no prerequisites", () => {
    // pL0 = 0.01 is below the 0.05 floor but is returned as is
    const params = { ...DEFAULT_BKT, pL0: 0.01 };
    expect(priorFromPrerequisites(graph, "M6.ROOT", {}, params)).toBeCloseTo(0.01, 6);
  });

  it("treats an unseen prerequisite as pL0", () => {
    // minPrereq = 0.3; 0.3 * (0.4 + 0.6*0.3) = 0.3 * 0.58 = 0.174
    expect(priorFromPrerequisites(graph, "M7.ONE", {}, DEFAULT_BKT)).toBeCloseTo(0.174, 6);
  });

  it("lowers the prior for a weak prerequisite without reaching the 0.05 floor", () => {
    // minPrereq = 0.2; 0.3 * (0.4 + 0.6*0.2) = 0.3 * 0.52 = 0.156
    const mastery = { "M6.ROOT": { pKnown: 0.2 } };
    expect(priorFromPrerequisites(graph, "M7.ONE", mastery, DEFAULT_BKT)).toBeCloseTo(0.156, 6);
  });

  it("hits the 0.05 floor when the scaled prior falls below it", () => {
    // pL0 = 0.1, minPrereq = 0; 0.1 * 0.4 = 0.04 -> clamped up to 0.05
    const params = { ...DEFAULT_BKT, pL0: 0.1 };
    const mastery = { "M6.ROOT": { pKnown: 0 } };
    expect(priorFromPrerequisites(graph, "M7.ONE", mastery, params)).toBeCloseTo(0.05, 6);
  });

  it("returns pL0 when every prerequisite is at 1.0", () => {
    // 0.3 * (0.4 + 0.6*1) = 0.3
    const mastery = { "M6.ROOT": { pKnown: 1 }, "M6.OTHER": { pKnown: 1 } };
    expect(priorFromPrerequisites(graph, "M7.TWO", mastery, DEFAULT_BKT)).toBeCloseTo(0.3, 6);
  });

  it("caps the prior at 0.95", () => {
    // pL0 = 0.99, minPrereq = 1: 0.99 * 1 = 0.99 -> clamped down to 0.95
    const params = { ...DEFAULT_BKT, pL0: 0.99 };
    const mastery = { "M6.ROOT": { pKnown: 1 } };
    expect(priorFromPrerequisites(graph, "M7.ONE", mastery, params)).toBeCloseTo(0.95, 6);
  });

  it("uses the weakest of several prerequisites, mixing seen and unseen", () => {
    // M6.ROOT = 0.9, M6.OTHER unseen -> 0.3; minPrereq = 0.3; 0.3 * 0.58 = 0.174
    const mastery = { "M6.ROOT": { pKnown: 0.9 } };
    expect(priorFromPrerequisites(graph, "M7.TWO", mastery, DEFAULT_BKT)).toBeCloseTo(0.174, 6);
    // M6.ROOT = 0.9, M6.OTHER = 0.5 -> minPrereq 0.5; 0.3 * (0.4 + 0.3) = 0.21
    const both = { "M6.ROOT": { pKnown: 0.9 }, "M6.OTHER": { pKnown: 0.5 } };
    expect(priorFromPrerequisites(graph, "M7.TWO", both, DEFAULT_BKT)).toBeCloseTo(0.21, 6);
  });

  it("throws for an unknown concept and RangeError for an invalid prerequisite estimate", () => {
    expect(() => priorFromPrerequisites(graph, "M9.NOPE", {}, DEFAULT_BKT)).toThrow(
      "Unknown concept id: M9.NOPE",
    );
    const bad = { "M6.ROOT": { pKnown: Number.NaN } };
    expect(() => priorFromPrerequisites(graph, "M7.ONE", bad, DEFAULT_BKT)).toThrow(RangeError);
  });
});

describe("isMastered", () => {
  it("is true at exactly the threshold and above, false just below", () => {
    expect(MASTERY_THRESHOLD).toBe(0.9);
    expect(isMastered(0.9)).toBe(true);
    expect(isMastered(0.93)).toBe(true);
    expect(isMastered(0.8999)).toBe(false);
  });
});
