import { describe, expect, it } from "vitest";
import { DEMO_CHAPTER_ID } from "../src/demo/seed";
import { loadContent } from "../src/load";
import { buildPack, packSources } from "../src/pack";
import { PRACTICE_CAP, gapCandidates, renderEvaluation, runSimulation } from "../src/sim/simulate";

const pack = buildPack(packSources(loadContent().input), DEMO_CHAPTER_ID, "2026-10-29T00:00:00.000Z");
const report = runSimulation(pack, DEMO_CHAPTER_ID, 24, 7);

describe("simulation", () => {
  it("plants gaps only in prerequisites outside the chapter", () => {
    const chapter = pack.graph.chapters[DEMO_CHAPTER_ID];
    const candidates = gapCandidates(pack, DEMO_CHAPTER_ID);
    expect(candidates.length).toBeGreaterThan(1);
    expect(candidates.some((id) => chapter?.conceptIds.includes(id))).toBe(false);
  });

  it("keeps every Readiness Check within 12 items and reports rates between 0 and 1", () => {
    for (const r of report.readiness) {
      expect(r.students).toBe(12);
      expect(r.maxItems).toBeLessThanOrEqual(12);
      expect(r.recall).toBeGreaterThanOrEqual(0);
      expect(r.recall).toBeLessThanOrEqual(1);
      expect(r.rootCauseHit).toBeLessThanOrEqual(1);
    }
  });

  it("runs both practice strategies for three learning rates within the item cap", () => {
    expect(report.practice).toHaveLength(6);
    for (const p of report.practice) {
      expect(p.students).toBe(8);
      if (p.medianItemsToMastery !== null) expect(p.medianItemsToMastery).toBeLessThanOrEqual(PRACTICE_CAP);
      expect(p.inBandShare).toBeLessThanOrEqual(1);
    }
  });

  it("gives the same report for the same seed and renders the evaluation tables", () => {
    expect(runSimulation(pack, DEMO_CHAPTER_ID, 24, 7)).toEqual(report);
    const md = renderEvaluation(report);
    expect(md).toContain("## Readiness Check: finding planted gaps within 12 items");
    expect(md).toContain("| single | 12 |");
    expect(md).toContain("## Practice: ladder versus fixed difficulty");
  });
});
