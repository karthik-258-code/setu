import type { ReadinessCompletedEvent, StudentEvent } from "@setu/engine";
import { describe, expect, it } from "vitest";
import { DEMO_CHAPTER_ID, buildDemoSeed, uuidFrom } from "../src/demo/seed";
import { loadContent } from "../src/load";
import { buildPack, packSources } from "../src/pack";

const pack = buildPack(packSources(loadContent().input), DEMO_CHAPTER_ID, "2026-10-28T00:00:00.000Z");
const seed = buildDemoSeed(pack);

function summaryOf(studentId: string) {
  const done = seed.events.find(
    (e: StudentEvent): e is ReadinessCompletedEvent =>
      e.type === "readiness_completed" && e.studentId === studentId,
  );
  return done?.summary;
}

describe("demo seed", () => {
  it("gives all 46 students a Readiness Check", () => {
    expect(seed.students).toHaveLength(46);
    const completed = seed.events.filter((e) => e.type === "readiness_completed");
    expect(completed).toHaveLength(46);
    expect(new Set(seed.students.map((s) => s.studentId)).size).toBe(46);
    expect(new Set(completed.map((event) => event.studentId)).size).toBe(46);
  });

  it("keeps every check within 12 items and gives every event a UUID", () => {
    for (const e of seed.events) {
      expect(e.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      if (e.type === "readiness_completed") expect(e.summary.itemsUsed).toBeLessThanOrEqual(12);
    }
  });

  it("clears Anjali for the chapter with an advanced entry", () => {
    const anjali = summaryOf("demo-anjali");
    expect(anjali?.failed).toEqual([]);
    expect(anjali?.uncertain).toEqual([]);
    expect(anjali?.advancedEntry).toBe(true);
  });

  it("finds Ravi's fraction gap and his adds-denominators misconception", () => {
    const ravi = summaryOf("demo-ravi");
    expect(ravi?.failed.length).toBeGreaterThan(0);
    expect(ravi?.misconceptions["F-ADD-DENOM"]).toBeGreaterThan(0);
    expect(ravi?.advancedEntry).toBe(false);
  });

  it("is the same for the same seed", () => {
    expect(buildDemoSeed(pack)).toEqual(seed);
    let k = 0;
    const fixed = () => [0.1, 0.5, 0.9][k++ % 3] ?? 0;
    expect(uuidFrom(fixed)).toBe(uuidFrom(((j) => () => [0.1, 0.5, 0.9][j++ % 3] ?? 0)(0)));
  });
});
