import { describe, expect, it } from "vitest";
import { MAX_GROUPS, buildGapGroups, buildGapMap, gapMapColumns, replay } from "../src/index";
import type { ClassroomStudent, Question } from "../src/index";
import { SPINE_CHAPTER_ID, spinePack } from "./fixtures/readiness";
import { readinessEvents, wrongOn } from "./fixtures/students";

const pack = spinePack();
const UNLIKE = "M6.FRAC.ADD_SUB_UNLIKE";
const LIKE_TERMS = "M7.ALG.LIKE_TERMS";
const MUL_DIV = "M7.INT.MUL_DIV";
const SETUP = "M7.SEQ.SETUP";

function student(id: string, isCorrect?: (q: Question) => boolean): ClassroomStudent {
  const events = isCorrect ? readinessEvents(pack, isCorrect, id) : [];
  return { studentId: id, displayName: id, rollNo: id, state: replay(pack, events, id) };
}

const anjali = student("anjali", () => true);
const ravis = ["ravi1", "ravi2", "ravi3"].map((id) => student(id, wrongOn(UNLIKE)));
const likes = ["like1", "like2"].map((id) => student(id, wrongOn(LIKE_TERMS)));
const sign = student("sign", wrongOn("M7.INT.PROPERTIES", MUL_DIV));
const setup = student("setup", wrongOn(SETUP));
const absent = student("absent");

const classroom = [anjali, ...ravis, ...likes, sign, absent];

describe("gapMapColumns", () => {
  it("puts upstream concepts in topo order on the left and the chapter on the right", () => {
    const { prerequisites, chapter } = gapMapColumns(pack, SPINE_CHAPTER_ID);
    expect(chapter).toEqual(pack.graph.chapters[SPINE_CHAPTER_ID]?.conceptIds);
    expect(prerequisites).toEqual(
      [...prerequisites].sort(
        (a, b) => pack.graph.topoOrder.indexOf(a) - pack.graph.topoOrder.indexOf(b),
      ),
    );
    expect(prerequisites).toEqual(expect.arrayContaining([UNLIKE, "M6.FRAC.EQUIV", "M6.INT.CONCEPT"]));
    expect(prerequisites).not.toContain("M6.DEC.CONCEPT");
    expect(prerequisites.some((id) => chapter.includes(id))).toBe(false);
  });

  it("throws on an unknown chapter", () => {
    expect(() => gapMapColumns(pack, "CH.NOPE")).toThrow(/Unknown chapter id/);
  });
});

describe("buildGapMap", () => {
  const map = buildGapMap(pack, SPINE_CHAPTER_ID, classroom);
  const row = (id: string) => map.rows.find((r) => r.studentId === id);

  it("has one row per student with a cell for every column", () => {
    expect(map.rows.map((r) => r.studentId)).toEqual(classroom.map((s) => s.studentId));
    const columns = [...map.columns.prerequisites, ...map.columns.chapter];
    for (const r of map.rows) expect(Object.keys(r.mastery).sort()).toEqual([...columns].sort());
  });

  it("finds Ravi's root cause in Class 6, not the equivalent fractions he cleared", () => {
    const ravi = row("ravi1");
    expect(ravi?.readinessDone).toBe(true);
    expect(ravi?.rootCauseGap).toBe(UNLIKE);
    expect(ravi?.mastery[UNLIKE]).toBeLessThan(0.9);
  });

  it("Anjali is ready, the absent student has no data", () => {
    expect(row("anjali")?.rootCauseGap).toBeNull();
    expect(row("anjali")?.readinessDone).toBe(true);
    const a = row("absent");
    expect(a?.readinessDone).toBe(false);
    expect(a?.rootCauseGap).toBeNull();
    expect(Object.values(a?.mastery ?? {}).every((v) => v === null)).toBe(true);
    expect(a?.lastEventTs).toBeUndefined();
  });

  it("roots a sign-error student at multiplying integers", () => {
    expect(row("sign")?.rootCauseGap).toBe(MUL_DIV);
    expect(row("like1")?.rootCauseGap).toBe(LIKE_TERMS);
  });
});

describe("buildGapGroups", () => {
  it("groups the class into ready, gap groups by size, and not attempted", () => {
    const groups = buildGapGroups(pack, SPINE_CHAPTER_ID, classroom);
    expect(groups.map((g) => g.id)).toEqual([
      "ready",
      `gap:${UNLIKE}`,
      `gap:${LIKE_TERMS}`,
      `gap:${MUL_DIV}`,
      "not_attempted",
    ]);
    const byId = Object.fromEntries(groups.map((g) => [g.id, g]));
    expect(byId.ready?.studentIds).toEqual(["anjali"]);
    expect(byId.ready?.suggestedAction).toBe("extension");
    expect(byId.not_attempted?.studentIds).toEqual(["absent"]);
    expect(byId.not_attempted?.suggestedAction).toBe("paper_check");

    const fractions = byId[`gap:${UNLIKE}`];
    expect(fractions?.studentIds).toEqual(["ravi1", "ravi2", "ravi3"]);
    expect(fractions?.dominantMisconception).toBe("F-ADD-DENOM");
    expect(fractions?.suggestedAction).toBe("warm_up");
    expect(fractions?.suggestedQuestionIds.length).toBeGreaterThan(0);
    expect(fractions?.suggestedQuestionIds.length).toBeLessThanOrEqual(3);
    expect(fractions?.suggestedQuestionIds.every((id) => id.startsWith(UNLIKE))).toBe(true);

    expect(byId[`gap:${LIKE_TERMS}`]?.dominantMisconception).toBe("A-UNLIKE-COMBINE");
    expect(byId[`gap:${LIKE_TERMS}`]?.suggestedAction).toBe("warm_up");
    expect(byId[`gap:${MUL_DIV}`]?.dominantMisconception).toBe("I-SIGN-MUL");
    expect(byId[`gap:${MUL_DIV}`]?.suggestedAction).toBe("small_group");
  });

  it("never exceeds MAX_GROUPS: the smallest gap groups merge into other", () => {
    const groups = buildGapGroups(pack, SPINE_CHAPTER_ID, [...classroom, setup]);
    expect(groups).toHaveLength(MAX_GROUPS);
    expect(groups.map((g) => g.id)).toEqual([
      "ready",
      `gap:${UNLIKE}`,
      `gap:${LIKE_TERMS}`,
      "other",
      "not_attempted",
    ]);
    const other = groups.find((g) => g.kind === "other");
    expect(new Set(other?.studentIds)).toEqual(new Set(["sign", "setup"]));
    expect(other?.conceptId).toBeUndefined();
  });

  it("every student lands in exactly one group", () => {
    const students = [...classroom, setup];
    const ids = buildGapGroups(pack, SPINE_CHAPTER_ID, students).flatMap((g) => g.studentIds);
    expect([...ids].sort()).toEqual(students.map((s) => s.studentId).sort());
  });

  it("uses the full attempt history when given", () => {
    const groups = buildGapGroups(pack, SPINE_CHAPTER_ID, ravis, {
      ravi1: [],
      ravi2: [],
      ravi3: [],
    });
    const g = groups.find((x) => x.kind === "gap");
    expect(g?.dominantMisconception).toBeUndefined();
    expect(g?.suggestedQuestionIds).toEqual([]);
  });

  it("leaves out empty groups and throws on an unknown chapter", () => {
    expect(buildGapGroups(pack, SPINE_CHAPTER_ID, [])).toEqual([]);
    expect(() => buildGapGroups(pack, "CH.NOPE", classroom)).toThrow(/Unknown chapter id/);
  });
});
