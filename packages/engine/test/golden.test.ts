import { describe, expect, it } from "vitest";
import { replay } from "../src/index";
import { goldenPack, goldenVectors } from "./golden/load";

function checkFields(
  actual: object | undefined,
  expected: Record<string, unknown>,
  path: string,
): void {
  expect(actual, path).toBeDefined();
  const got = (actual ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(expected)) {
    const where = `${path}.${key}`;
    if (value === null) expect(got[key], where).toBeUndefined();
    else if (key === "pKnown" && typeof value === "number") {
      expect(got[key], where).toBeTypeOf("number");
      expect(got[key] as number, where).toBeCloseTo(value, 6);
    } else expect(got[key], where).toEqual(value);
  }
}

const pack = goldenPack();

describe("golden vectors", () => {
  it("there are three of them", () => {
    expect(goldenVectors.map((v) => v.name)).toEqual([
      "mastery-run",
      "override-verify-fail",
      "readiness-gap",
    ]);
  });

  for (const vector of goldenVectors) {
    describe(vector.name, () => {
      const state = replay(pack, vector.events, vector.studentId);
      const { expected } = vector;

      it("matches the expected counters", () => {
        expect(state.studentId).toBe(vector.studentId);
        expect(state.eventCount).toBe(expected.eventCount);
        expect(state.lastEventTs).toBe(expected.lastEventTs);
      });

      it("matches the expected mastery", () => {
        expect(Object.keys(state.mastery).sort()).toEqual(Object.keys(expected.mastery).sort());
        for (const [id, fields] of Object.entries(expected.mastery)) {
          checkFields(state.mastery[id], fields, `mastery.${id}`);
        }
      });

      it("matches the expected progress", () => {
        for (const [id, fields] of Object.entries(expected.progress)) {
          checkFields(state.progress[id], fields, `progress.${id}`);
        }
      });

      it("matches the expected re-checks and readiness", () => {
        expect(state.rechecks).toEqual(expected.rechecks);
        expect(state.readiness).toEqual(expected.readiness);
      });

      it("does not depend on the order the events arrive in", () => {
        expect(replay(pack, [...vector.events].reverse(), vector.studentId)).toEqual(state);
      });
    });
  }
});
