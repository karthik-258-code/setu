import { describe, expect, it } from "vitest";
import { buildWeeklyView } from "../src/index";
import type { AttemptEvent, Question, StudentEvent, WeeklyStudent } from "../src/index";
import { at, attempt } from "./fixtures/pack";
import { SPINE_CHAPTER_ID, spinePack } from "./fixtures/readiness";
import { readinessEvents, wrongOn } from "./fixtures/students";

const pack = spinePack();
const UNLIKE = "M6.FRAC.ADD_SUB_UNLIKE";
const LIKE_TERMS = "M7.ALG.LIKE_TERMS";

function student(
  id: string,
  isCorrect?: (q: Question) => boolean,
  extra: StudentEvent[] = [],
): WeeklyStudent {
  const checked = isCorrect ? readinessEvents(pack, isCorrect, id) : [];
  return { studentId: id, displayName: id, rollNo: id, events: [...checked, ...extra] };
}

function taught(id: string, conceptId: string, minute: number): StudentEvent {
  return {
    id: `${id}-taught-${minute}`,
    type: "mark_taught",
    studentId: id,
    ts: at(minute),
    teacherId: "teacher-1",
    conceptId,
  };
}

function recheck(id: string, conceptId: string, minute: number, correct: boolean): AttemptEvent {
  return attempt(`${id}-recheck-${minute}`, conceptId, {
    studentId: id,
    mode: "recheck",
    ts: at(minute),
    correct,
  });
}

describe("buildWeeklyView", () => {
  it("moves students who took the Readiness Check during the week out of not attempted", () => {
    const students = [
      student("anjali", () => true),
      student("ravi", wrongOn(UNLIKE)),
      student("absent"),
    ];
    const view = buildWeeklyView(pack, SPINE_CHAPTER_ID, students, at(0), at(60));
    expect(view.chapterId).toBe(SPINE_CHAPTER_ID);
    expect(view.from).toBe(at(0));
    expect(view.to).toBe(at(60));
    expect(view.moved).toEqual([
      { studentId: "anjali", fromGroupId: "not_attempted", toGroupId: "ready" },
      { studentId: "ravi", fromGroupId: "not_attempted", toGroupId: `gap:${UNLIKE}` },
    ]);
  });

  it("does not list a student whose group did not change", () => {
    const view = buildWeeklyView(
      pack,
      SPINE_CHAPTER_ID,
      [student("ravi", wrongOn(UNLIKE))],
      at(45),
      at(60),
    );
    expect(view.moved).toEqual([]);
  });

  it("counts the students blocked on each concept at the end of the week, most first", () => {
    const students = [
      student("anjali", () => true),
      ...["ravi1", "ravi2", "ravi3"].map((id) => student(id, wrongOn(UNLIKE))),
      ...["like1", "like2"].map((id) => student(id, wrongOn(LIKE_TERMS))),
    ];
    const view = buildWeeklyView(pack, SPINE_CHAPTER_ID, students, at(0), at(60));
    expect(view.blockingConcepts).toEqual([
      { conceptId: UNLIKE, studentCount: 3 },
      { conceptId: LIKE_TERMS, studentCount: 2 },
    ]);
  });

  it("reports after-taught re-check results, counting only students who finished the round", () => {
    const students = [
      student("passes", wrongOn(UNLIKE), [
        taught("passes", UNLIKE, 40),
        recheck("passes", UNLIKE, 41, true),
        recheck("passes", UNLIKE, 42, true),
        recheck("passes", UNLIKE, 43, true),
      ]),
      student("fails", wrongOn(UNLIKE), [
        taught("fails", UNLIKE, 41),
        recheck("fails", UNLIKE, 42, false),
        recheck("fails", UNLIKE, 43, false),
        recheck("fails", UNLIKE, 44, false),
      ]),
      student("unfinished", wrongOn(UNLIKE), [
        taught("unfinished", UNLIKE, 45),
        recheck("unfinished", UNLIKE, 46, true),
      ]),
      student("untaught", wrongOn(UNLIKE)),
    ];
    const view = buildWeeklyView(pack, SPINE_CHAPTER_ID, students, at(0), at(60));
    expect(view.recheckResults).toEqual([
      { conceptId: UNLIKE, taughtAt: at(40), passed: 1, failed: 1 },
    ]);
  });

  it("ignores concepts marked taught outside the window", () => {
    const students = [student("ravi", wrongOn(UNLIKE), [taught("ravi", UNLIKE, 40)])];
    expect(buildWeeklyView(pack, SPINE_CHAPTER_ID, students, at(45), at(60)).recheckResults).toEqual([]);
  });

  it("is empty for an empty classroom and throws when from is after to", () => {
    expect(buildWeeklyView(pack, SPINE_CHAPTER_ID, [], at(0), at(60))).toEqual({
      chapterId: SPINE_CHAPTER_ID,
      from: at(0),
      to: at(60),
      moved: [],
      blockingConcepts: [],
      recheckResults: [],
    });
    expect(() => buildWeeklyView(pack, SPINE_CHAPTER_ID, [], at(60), at(0))).toThrow(RangeError);
  });
});
