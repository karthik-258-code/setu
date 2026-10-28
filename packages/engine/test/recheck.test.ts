import { describe, expect, it } from "vitest";
import {
  MASTERY_THRESHOLD,
  RECHECK_QUESTIONS,
  addDays,
  dueRechecks,
  initialState,
  nextSpaced,
  replay,
  scheduleSpaced,
} from "../src/index";
import type { AttemptEvent, Mode, Recheck, StudentEvent } from "../src/index";
import {
  FIXTURE_STUDENT_ID as STUDENT,
  FIXTURE_TEACHER_ID as TEACHER,
  at,
  attempt,
  fixturePack,
} from "./fixtures/pack";

const pack = fixturePack();
/** A root concept (no prerequisites), so its prior is the default pL0 of 0.3. */
const C = "M6.ZERO";

function round(prefix: string, mode: Mode, correct: boolean, start: string): AttemptEvent[] {
  return Array.from({ length: RECHECK_QUESTIONS }, (_, i) =>
    attempt(`${prefix}${i}`, C, { mode, correct, difficulty: 2, ts: addDays(start, 0) }),
  ).map((a, i) => ({ ...a, ts: new Date(Date.parse(start) + i * 60_000).toISOString() }));
}

/** Three correct test answers: 0.3 -> 0.727 -> 0.938 (mastered at at(2)) -> 0.988. */
const mastered: StudentEvent[] = [
  attempt("t1", C, { mode: "test", ts: at(1) }),
  attempt("t2", C, { mode: "test", ts: at(2) }),
  attempt("t3", C, { mode: "test", ts: at(3) }),
];
const MASTERED_AT = at(2);

function spaced(state: { rechecks: Recheck[] }): Recheck[] {
  return state.rechecks.filter((r) => r.conceptId === C && r.kind === "spaced");
}

describe("recheck helpers", () => {
  it("addDays adds whole days in UTC", () => {
    expect(addDays("2026-10-27T10:00:00.000Z", 2)).toBe("2026-10-29T10:00:00.000Z");
    expect(addDays("2026-10-27T10:00:00.000+05:30", 1)).toBe("2026-10-28T04:30:00.000Z");
    expect(() => addDays("not a date", 1)).toThrow(RangeError);
  });

  it("scheduleSpaced starts at 2 days after mastery", () => {
    expect(scheduleSpaced(C, MASTERED_AT)).toEqual([
      { conceptId: C, dueAt: addDays(MASTERED_AT, 2), intervalDays: 2, kind: "spaced" },
    ]);
  });

  it("nextSpaced goes 2 -> 7 -> 21 days from masteredAt, then stops", () => {
    const [first] = scheduleSpaced(C, MASTERED_AT);
    if (!first) throw new Error("no first re-check");
    const second = nextSpaced(first, MASTERED_AT);
    expect(second).toMatchObject({ intervalDays: 7, dueAt: addDays(MASTERED_AT, 7) });
    if (!second) throw new Error("no second re-check");
    const third = nextSpaced(second, MASTERED_AT);
    expect(third).toMatchObject({ intervalDays: 21, dueAt: addDays(MASTERED_AT, 21) });
    if (!third) throw new Error("no third re-check");
    expect(nextSpaced(third, MASTERED_AT)).toBeNull();
  });

  it("dueRechecks keeps due ones, earliest first", () => {
    const state = {
      ...initialState(STUDENT),
      rechecks: [
        { conceptId: "B", dueAt: at(5), intervalDays: 2, kind: "spaced" as const },
        { conceptId: "A", dueAt: at(1), intervalDays: 0, kind: "after_taught" as const },
        { conceptId: "C", dueAt: at(50), intervalDays: 7, kind: "spaced" as const },
      ],
    };
    expect(dueRechecks(state, at(10)).map((r) => r.conceptId)).toEqual(["A", "B"]);
  });
});

describe("re-checks in replay", () => {
  it("schedules the first spaced re-check when a concept is mastered", () => {
    const state = replay(pack, mastered, STUDENT);
    expect(state.mastery[C]?.masteredAt).toBe(MASTERED_AT);
    expect(spaced(state)).toEqual(scheduleSpaced(C, MASTERED_AT));
  });

  it("a passed spaced re-check advances to the next interval", () => {
    const events = [...mastered, ...round("p", "recheck", true, addDays(MASTERED_AT, 2))];
    const state = replay(pack, events, STUDENT);
    expect(spaced(state)).toEqual([
      { conceptId: C, dueAt: addDays(MASTERED_AT, 7), intervalDays: 7, kind: "spaced" },
    ]);
    expect(state.mastery[C]?.masteredAt).toBe(MASTERED_AT);
  });

  it("after passing the 21-day re-check no spaced re-check is left", () => {
    const events = [
      ...mastered,
      ...round("p2", "recheck", true, addDays(MASTERED_AT, 2)),
      ...round("p7", "recheck", true, addDays(MASTERED_AT, 7)),
      ...round("p21", "recheck", true, addDays(MASTERED_AT, 21)),
    ];
    expect(spaced(replay(pack, events, STUDENT))).toEqual([]);
  });

  it("a failed spaced re-check reopens the concept", () => {
    const events = [...mastered, ...round("f", "recheck", false, addDays(MASTERED_AT, 2))];
    const state = replay(pack, events, STUDENT);
    expect(state.mastery[C]?.pKnown).toBeLessThan(MASTERY_THRESHOLD);
    expect(state.mastery[C]?.masteredAt).toBeUndefined();
    expect(spaced(state)).toEqual([]);
    expect(state.progress[C]).toMatchObject({
      difficulty: 1,
      learnViewed: false,
      solveAttempts: 0,
      testAttempts: 0,
    });
  });

  it("a round is not judged before three attempts, nor before the re-check is due", () => {
    const early = [...mastered, ...round("e", "recheck", false, at(10))];
    expect(spaced(replay(pack, early, STUDENT))).toEqual(scheduleSpaced(C, MASTERED_AT));
    const partial = [
      ...mastered,
      ...round("q", "recheck", true, addDays(MASTERED_AT, 2)).slice(0, RECHECK_QUESTIONS - 1),
    ];
    expect(spaced(replay(pack, partial, STUDENT))).toEqual(scheduleSpaced(C, MASTERED_AT));
  });

  it("a passed after-taught re-check is removed", () => {
    const taught: StudentEvent = {
      id: "mt",
      type: "mark_taught",
      studentId: STUDENT,
      ts: at(1),
      teacherId: TEACHER,
      conceptId: C,
    };
    const events = [taught, ...round("a", "recheck", true, at(2))];
    const state = replay(pack, events, STUDENT);
    expect(state.rechecks.filter((r) => r.kind === "after_taught")).toEqual([]);
  });

  const override: StudentEvent = {
    id: "ov",
    type: "teacher_override",
    studentId: STUDENT,
    ts: at(1),
    teacherId: TEACHER,
    conceptId: C,
    mastered: true,
  };

  it("a passed verification confirms the override", () => {
    const state = replay(pack, [override, ...round("v", "verify", true, at(2))], STUDENT);
    const m = state.mastery[C];
    expect(m?.pendingVerification).toBeUndefined();
    expect(m?.modelPKnown).toBeUndefined();
    expect(m?.pKnown).toBeGreaterThanOrEqual(MASTERY_THRESHOLD);
    expect(m?.masteredAt).toBeDefined();
    expect(state.rechecks.filter((r) => r.kind === "verify_override")).toEqual([]);
    expect(spaced(state)).toHaveLength(1);
  });

  it("a failed verification restores the model estimate", () => {
    const state = replay(pack, [override, ...round("v", "verify", false, at(2))], STUDENT);
    const m = state.mastery[C];
    expect(m?.pKnown).toBeCloseTo(0.3, 6);
    expect(m?.source).toBe("model");
    expect(m?.pendingVerification).toBeUndefined();
    expect(m?.masteredAt).toBeUndefined();
    expect(state.rechecks.filter((r) => r.conceptId === C)).toEqual([]);
  });
});
