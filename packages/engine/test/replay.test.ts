import { describe, expect, it } from "vitest";
import {
  MASTERY_THRESHOLD,
  RECENT_ATTEMPTS_KEPT,
  applyEvent,
  bktUpdate,
  initialState,
  replay,
} from "../src/index";
import type { ReadinessSummary, StudentEvent, StudentState } from "../src/index";
import {
  FIXTURE_CHAPTER_ID,
  FIXTURE_STUDENT_ID as STUDENT,
  FIXTURE_TEACHER_ID as TEACHER,
  at,
  attempt,
  fixturePack,
} from "./fixtures/pack";

const pack = fixturePack();
const DEFAULTS = { pL0: 0.3, pT: 0.2, pG: 0.2, pS: 0.1 };

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function base(id: string, minutes: number) {
  return { id, studentId: STUDENT, ts: at(minutes) };
}

function summary(overrides: Partial<ReadinessSummary> = {}): ReadinessSummary {
  return {
    chapterId: FIXTURE_CHAPTER_ID,
    cleared: [],
    failed: [],
    uncertain: [],
    pending: [],
    itemsUsed: 4,
    advancedEntry: false,
    misconceptions: {},
    completedAt: at(9),
    ...overrides,
  };
}

function mastery(state: StudentState, id: string) {
  const entry = state.mastery[id];
  if (!entry) throw new Error(`no mastery for ${id}`);
  return entry;
}

describe("initialState", () => {
  it("is empty for the given student", () => {
    expect(initialState("s9")).toEqual({
      studentId: "s9",
      mastery: {},
      progress: {},
      readiness: {},
      rechecks: [],
      assigned: [],
      extensionLocked: false,
      recentAttempts: [],
      eventCount: 0,
    });
  });
});

describe("replay ordering and filtering", () => {
  const events: StudentEvent[] = [
    attempt("e1", "M6.ZERO", { ts: at(1), correct: false }),
    { ...base("e2", 2), type: "learn_viewed", conceptId: "M6.ZERO", resourceId: "R1" },
    attempt("e3", "M6.ZERO", { ts: at(3), mode: "test" }),
    attempt("e4", "M6.TWO", { ts: at(4), misconceptionCode: "F-ADD-DENOM", correct: false }),
    { ...base("e5", 5), type: "mark_taught", teacherId: TEACHER, conceptId: "M6.ZERO" },
    {
      ...base("e6", 6),
      type: "teacher_override",
      teacherId: TEACHER,
      conceptId: "M7.ALPHA",
      mastered: true,
    },
    {
      ...base("e7", 7),
      type: "assign",
      teacherId: TEACHER,
      conceptId: "M7.BETA",
      questionIds: ["q1"],
    },
    attempt("e8", "M6.ZERO", { ts: at(8), mode: "recheck" }),
    {
      ...base("e9", 9),
      type: "readiness_completed",
      chapterId: FIXTURE_CHAPTER_ID,
      summary: summary({ cleared: ["M6.ONE"] }),
    },
  ];

  it("gives the same state for every shuffle of events with distinct timestamps", () => {
    const expected = replay(pack, events, STUDENT);
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let run = 0; run < 25; run++) {
      const shuffled = [...events];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j] as StudentEvent, shuffled[i] as StudentEvent];
      }
      expect(replay(pack, shuffled, STUDENT)).toEqual(expected);
    }
    expect(expected.eventCount).toBe(events.length);
  });

  it("breaks timestamp ties by event id", () => {
    const wrong = attempt("a", "M6.ZERO", { ts: at(1), correct: false });
    const right = attempt("b", "M6.ZERO", { ts: at(1), correct: true });
    const forward = replay(pack, [wrong, right], STUDENT);
    expect(replay(pack, [right, wrong], STUDENT)).toEqual(forward);
    expect(forward.recentAttempts.map((a) => a.id)).toEqual(["a", "b"]);
  });

  it("orders by instant, not by string, when timestamps use different offsets", () => {
    const early = attempt("z", "M6.ZERO", { ts: "2026-10-27T10:00:00.000Z" });
    const late = attempt("a", "M6.ZERO", { ts: "2026-10-27T15:00:00.000+05:30" }); // 09:30Z
    expect(replay(pack, [early, late], STUDENT).recentAttempts.map((a) => a.id)).toEqual([
      "a",
      "z",
    ]);
  });

  it("ignores events of other students", () => {
    const other = attempt("o1", "M6.ZERO", { studentId: "someone-else" });
    const mine = attempt("m1", "M6.ZERO");
    const state = replay(pack, [other, mine], STUDENT);
    expect(state.eventCount).toBe(1);
    expect(state.studentId).toBe(STUDENT);
    expect(state).toEqual(replay(pack, [mine], STUDENT));
  });

  it("returns the initial state for no events", () => {
    expect(replay(pack, [], STUDENT)).toEqual(initialState(STUDENT));
  });

  it("does not reorder the caller's array", () => {
    const input = [attempt("b", "M6.ZERO", { ts: at(2) }), attempt("a", "M6.ZERO", { ts: at(1) })];
    replay(pack, input, STUDENT);
    expect(input.map((e) => e.id)).toEqual(["b", "a"]);
  });
});

describe("immutability", () => {
  it("never mutates a deep-frozen state or event, for every event type", () => {
    const events: StudentEvent[] = [
      attempt("e1", "M6.ZERO", { misconceptionCode: "F-ADD-DENOM", correct: false }),
      attempt("e2", "M6.ZERO", { ts: at(1), mode: "test" }),
      { ...base("e3", 2), type: "learn_viewed", conceptId: "M6.ZERO", resourceId: "R1" },
      {
        ...base("e4", 3),
        type: "readiness_completed",
        chapterId: FIXTURE_CHAPTER_ID,
        summary: summary({ cleared: ["M6.ONE"] }),
      },
      {
        ...base("e5", 4),
        type: "teacher_override",
        teacherId: TEACHER,
        conceptId: "M7.ALPHA",
        mastered: true,
      },
      {
        ...base("e6", 5),
        type: "teacher_override",
        teacherId: TEACHER,
        conceptId: "M7.ALPHA",
        mastered: false,
      },
      { ...base("e7", 6), type: "mark_taught", teacherId: TEACHER, conceptId: "M6.ZERO" },
      {
        ...base("e8", 7),
        type: "assign",
        teacherId: TEACHER,
        conceptId: "M7.BETA",
        questionIds: ["q1"],
      },
      {
        ...base("e9", 8),
        type: "assign",
        teacherId: TEACHER,
        conceptId: "M7.BETA",
        questionIds: ["q2"],
      },
      { ...base("e10", 9), type: "extension_lock", teacherId: TEACHER, locked: true },
      {
        ...base("e11", 10),
        type: "group_edit",
        teacherId: TEACHER,
        chapterId: FIXTURE_CHAPTER_ID,
        action: "accept",
      },
    ];
    deepFreeze(events);
    let state = deepFreeze(initialState(STUDENT));
    for (const event of events) {
      const next = applyEvent(pack, state, event);
      expect(next).not.toBe(state);
      state = deepFreeze(next);
    }
    expect(state.eventCount).toBe(events.length);
    expect(() => replay(pack, events, STUDENT)).not.toThrow();
  });

  it("leaves the input state equal to its snapshot after applying an attempt", () => {
    const start = replay(pack, [attempt("e1", "M6.ZERO")], STUDENT);
    const snapshot = structuredClone(start);
    applyEvent(pack, start, attempt("e2", "M6.ZERO", { ts: at(1) }));
    expect(start).toEqual(snapshot);
  });
});

describe("attempt events", () => {
  it("seeds an untouched concept's prior from its prerequisites before the BKT update", () => {
    // M6.TWO requires M6.ZERO. M6.ZERO untouched: minPrereq = pL0 = 0.3.
    const cold = replay(pack, [attempt("a", "M6.TWO")], STUDENT);
    const coldPrior = 0.3 * (0.4 + 0.6 * 0.3);
    expect(mastery(cold, "M6.TWO").pKnown).toBeCloseTo(bktUpdate(coldPrior, true, DEFAULTS), 10);

    // M6.ZERO known at 0.9 (two correct tests): the prior is higher.
    const zero = [
      attempt("z1", "M6.ZERO", { ts: at(1), mode: "test" }),
      attempt("z2", "M6.ZERO", { ts: at(2), mode: "test" }),
    ];
    const warm = replay(pack, [...zero, attempt("a", "M6.TWO", { ts: at(3) })], STUDENT);
    const zeroP = mastery(warm, "M6.ZERO").pKnown;
    const warmPrior = 0.3 * (0.4 + 0.6 * zeroP);
    expect(mastery(warm, "M6.TWO").pKnown).toBeCloseTo(bktUpdate(warmPrior, true, DEFAULTS), 10);
    expect(mastery(warm, "M6.TWO").pKnown).toBeGreaterThan(mastery(cold, "M6.TWO").pKnown);
  });

  it("uses pL0 for a concept without prerequisites and honours per-concept BKT overrides", () => {
    const state = replay(pack, [attempt("a", "M6.ZERO")], STUDENT);
    expect(mastery(state, "M6.ZERO").pKnown).toBeCloseTo(0.7268293, 6);

    const custom = fixturePack();
    const zero = custom.graph.concepts["M6.ZERO"];
    if (!zero) throw new Error("fixture changed");
    custom.graph.concepts["M6.ZERO"] = { ...zero, bkt: { pL0: 0.5 } };
    const withOverride = replay(custom, [attempt("a", "M6.ZERO")], STUDENT);
    expect(mastery(withOverride, "M6.ZERO").pKnown).toBeCloseTo(
      bktUpdate(0.5, true, { ...DEFAULTS, pL0: 0.5 }),
      10,
    );
  });

  it("sets masteredAt when the threshold is crossed in test, recheck or verify mode", () => {
    for (const mode of ["test", "recheck", "verify"] as const) {
      const state = replay(
        pack,
        [
          attempt("a", "M6.ZERO", { ts: at(1), mode }),
          attempt("b", "M6.ZERO", { ts: at(2), mode }),
        ],
        STUDENT,
      );
      expect(mastery(state, "M6.ZERO").pKnown).toBeGreaterThanOrEqual(MASTERY_THRESHOLD);
      expect(mastery(state, "M6.ZERO").masteredAt).toBe(at(2));
    }
  });

  it("does not set masteredAt in solve, learn, readiness or extension mode", () => {
    for (const mode of ["solve", "learn", "readiness", "extension"] as const) {
      const state = replay(
        pack,
        [
          attempt("a", "M6.ZERO", { ts: at(1), mode }),
          attempt("b", "M6.ZERO", { ts: at(2), mode }),
        ],
        STUDENT,
      );
      expect(mastery(state, "M6.ZERO").pKnown).toBeGreaterThanOrEqual(MASTERY_THRESHOLD);
      expect(mastery(state, "M6.ZERO").masteredAt).toBeUndefined();
    }
  });

  it("sets masteredAt on the first threshold-crossing test attempt after solve got there first", () => {
    const state = replay(
      pack,
      [
        attempt("a", "M6.ZERO", { ts: at(1) }),
        attempt("b", "M6.ZERO", { ts: at(2) }),
        attempt("c", "M6.ZERO", { ts: at(3), mode: "test" }),
        attempt("d", "M6.ZERO", { ts: at(4), mode: "test" }),
      ],
      STUDENT,
    );
    expect(mastery(state, "M6.ZERO").masteredAt).toBe(at(3));
  });

  it("does not set masteredAt for a test attempt below the threshold", () => {
    const state = replay(pack, [attempt("a", "M6.ZERO", { mode: "test" })], STUDENT);
    expect(mastery(state, "M6.ZERO").masteredAt).toBeUndefined();
  });

  it("updates BKT for readiness-mode attempts", () => {
    const state = replay(pack, [attempt("a", "M6.ZERO", { mode: "readiness" })], STUDENT);
    expect(mastery(state, "M6.ZERO").pKnown).toBeCloseTo(0.7268293, 6);
    expect(state.progress["M6.ZERO"]?.solveAttempts).toBe(0);
    expect(state.progress["M6.ZERO"]?.testAttempts).toBe(0);
  });

  it("tracks attempts, correct and the last (correct) attempt times", () => {
    const state = replay(
      pack,
      [
        attempt("a", "M6.ZERO", { ts: at(1) }),
        attempt("b", "M6.ZERO", { ts: at(2), correct: false }),
      ],
      STUDENT,
    );
    expect(mastery(state, "M6.ZERO")).toMatchObject({
      attempts: 2,
      correct: 1,
      lastAttemptAt: at(2),
      lastCorrectAt: at(1),
      source: "model",
    });
  });

  it("creates progress at difficulty 1 and tracks streaks, mode counters and seen questions", () => {
    const state = replay(
      pack,
      [
        attempt("a", "M6.ZERO", { ts: at(1), mode: "solve" }),
        attempt("b", "M6.ZERO", { ts: at(2), mode: "solve" }),
        attempt("c", "M6.ZERO", {
          ts: at(3),
          mode: "test",
          correct: false,
          misconceptionCode: "F-ADD-DENOM",
        }),
        attempt("d", "M6.ZERO", { ts: at(4), mode: "test", correct: false }),
      ],
      STUDENT,
    );
    expect(state.progress["M6.ZERO"]).toEqual({
      conceptId: "M6.ZERO",
      difficulty: 1,
      streakCorrect: 0,
      streakWrong: 2,
      solveAttempts: 2,
      testAttempts: 2,
      learnViewed: false,
      clearedByReadiness: false,
      lastMisconception: "F-ADD-DENOM",
      seenQuestionIds: ["M6.ZERO.Q1"],
    });
  });

  it("resets the wrong streak on a correct answer and keeps lastMisconception", () => {
    const state = replay(
      pack,
      [
        attempt("a", "M6.ZERO", { ts: at(1), correct: false, misconceptionCode: "F-ADD-DENOM" }),
        attempt("b", "M6.ZERO", { ts: at(2) }),
      ],
      STUDENT,
    );
    expect(state.progress["M6.ZERO"]).toMatchObject({
      streakCorrect: 1,
      streakWrong: 0,
      lastMisconception: "F-ADD-DENOM",
    });
  });

  it("dedupes seenQuestionIds and keeps first-seen order", () => {
    const state = replay(
      pack,
      [
        attempt("a", "M6.ZERO", { ts: at(1), questionId: "q2" }),
        attempt("b", "M6.ZERO", { ts: at(2), questionId: "q1" }),
        attempt("c", "M6.ZERO", { ts: at(3), questionId: "q2" }),
      ],
      STUDENT,
    );
    expect(state.progress["M6.ZERO"]?.seenQuestionIds).toEqual(["q2", "q1"]);
  });

  it("caps recentAttempts at RECENT_ATTEMPTS_KEPT, newest last", () => {
    const total = RECENT_ATTEMPTS_KEPT + 7;
    const events = Array.from({ length: total }, (_, i) =>
      attempt(`e${String(i).padStart(3, "0")}`, "M6.ZERO", { ts: at(i) }),
    );
    const state = replay(pack, events, STUDENT);
    expect(state.recentAttempts).toHaveLength(RECENT_ATTEMPTS_KEPT);
    expect(state.recentAttempts[0]?.id).toBe("e007");
    expect(state.recentAttempts.at(-1)?.id).toBe(`e${String(total - 1).padStart(3, "0")}`);
    expect(state.eventCount).toBe(total);
    expect(mastery(state, "M6.ZERO").attempts).toBe(total);
  });

  it("throws a clear error for an unknown concept id", () => {
    expect(() => replay(pack, [attempt("a", "M9.NOPE")], STUDENT)).toThrow(
      "Unknown concept id: M9.NOPE",
    );
  });
});

describe("learn_viewed", () => {
  it("sets learnViewed, creating progress if needed", () => {
    const state = replay(
      pack,
      [{ ...base("a", 1), type: "learn_viewed", conceptId: "M7.ALPHA", resourceId: "R1" }],
      STUDENT,
    );
    expect(state.progress["M7.ALPHA"]).toMatchObject({ learnViewed: true, difficulty: 1 });
    expect(state.mastery["M7.ALPHA"]).toBeUndefined();
  });

  it("throws for an unknown concept id", () => {
    expect(() =>
      replay(
        pack,
        [{ ...base("a", 1), type: "learn_viewed", conceptId: "X", resourceId: "R" }],
        STUDENT,
      ),
    ).toThrow("Unknown concept id: X");
  });
});

describe("readiness_completed", () => {
  it("stores the summary by chapter and flags cleared concepts only", () => {
    const s = summary({
      cleared: ["M6.ONE", "M7.DELTA"],
      failed: ["M7.GAMMA"],
      pending: ["M6.ZERO"],
    });
    const state = replay(
      pack,
      [
        attempt("a", "M7.DELTA", { ts: at(1), mode: "readiness" }),
        { ...base("b", 2), type: "readiness_completed", chapterId: FIXTURE_CHAPTER_ID, summary: s },
      ],
      STUDENT,
    );
    expect(state.readiness[FIXTURE_CHAPTER_ID]).toEqual(s);
    expect(state.progress["M6.ONE"]?.clearedByReadiness).toBe(true);
    expect(state.progress["M7.DELTA"]).toMatchObject({
      clearedByReadiness: true,
      streakCorrect: 1,
    });
    expect(state.progress["M7.GAMMA"]).toBeUndefined();
    expect(state.progress["M6.ZERO"]).toBeUndefined();
  });

  it("throws for an unknown chapter or an unknown concept in the summary", () => {
    const bad = (chapterId: string, s: ReadinessSummary): StudentEvent => ({
      ...base("a", 1),
      type: "readiness_completed",
      chapterId,
      summary: s,
    });
    expect(() => replay(pack, [bad("CH.NOPE", summary())], STUDENT)).toThrow(
      "Unknown chapter id: CH.NOPE",
    );
    expect(() =>
      replay(pack, [bad(FIXTURE_CHAPTER_ID, summary({ failed: ["M0.NOPE"] }))], STUDENT),
    ).toThrow("Unknown concept id: M0.NOPE");
  });
});

describe("teacher_override", () => {
  const override = (
    id: string,
    minutes: number,
    mastered: boolean,
    conceptId = "M6.ZERO",
  ): StudentEvent => ({
    ...base(id, minutes),
    type: "teacher_override",
    teacherId: TEACHER,
    conceptId,
    mastered,
  });

  it("mastered=true sets 0.9, flags verification, keeps the model estimate and schedules a verify_override", () => {
    const state = replay(
      pack,
      [attempt("a", "M6.ZERO", { ts: at(1), correct: false }), override("o", 2, true)],
      STUDENT,
    );
    const modelEstimate = bktUpdate(0.3, false, DEFAULTS);
    expect(mastery(state, "M6.ZERO")).toMatchObject({
      pKnown: 0.9,
      source: "teacher_override",
      pendingVerification: true,
      attempts: 1,
    });
    expect(mastery(state, "M6.ZERO").modelPKnown).toBeCloseTo(modelEstimate, 10);
    expect(mastery(state, "M6.ZERO").masteredAt).toBeUndefined();
    expect(state.rechecks).toEqual([
      { conceptId: "M6.ZERO", dueAt: at(2), intervalDays: 0, kind: "verify_override" },
    ]);
  });

  it("seeds the model estimate from prerequisites when the concept was untouched", () => {
    const state = replay(pack, [override("o", 1, true, "M6.TWO")], STUDENT);
    expect(mastery(state, "M6.TWO").modelPKnown).toBeCloseTo(0.3 * (0.4 + 0.6 * 0.3), 10);
    expect(mastery(state, "M6.TWO")).toMatchObject({ attempts: 0, correct: 0, pKnown: 0.9 });
  });

  it("a second mastered override does not overwrite the model estimate or duplicate the recheck", () => {
    const once = replay(pack, [override("o1", 1, true)], STUDENT);
    const twice = replay(pack, [override("o1", 1, true), override("o2", 2, true)], STUDENT);
    expect(mastery(twice, "M6.ZERO").modelPKnown).toBe(mastery(once, "M6.ZERO").modelPKnown);
    expect(twice.rechecks).toHaveLength(1);
    expect(twice.rechecks[0]?.dueAt).toBe(at(2));
  });

  it("the verification recheck is scheduled and attempts after it still run BKT from 0.9", () => {
    const state = replay(
      pack,
      [
        override("o", 1, true),
        attempt("v", "M6.ZERO", { ts: at(2), mode: "verify", correct: false }),
      ],
      STUDENT,
    );
    expect(state.rechecks.map((r) => r.kind)).toEqual(["verify_override"]);
    expect(mastery(state, "M6.ZERO").pKnown).toBeCloseTo(bktUpdate(0.9, false, DEFAULTS), 10);
    expect(mastery(state, "M6.ZERO").pendingVerification).toBe(true);
    expect(mastery(state, "M6.ZERO").modelPKnown).toBeCloseTo(0.3, 10);
  });

  it("mastered=false caps pKnown at 0.3, clears masteredAt and marks the source", () => {
    const state = replay(
      pack,
      [
        attempt("a", "M6.ZERO", { ts: at(1), mode: "test" }),
        attempt("b", "M6.ZERO", { ts: at(2), mode: "test" }),
        override("o", 3, false),
      ],
      STUDENT,
    );
    expect(mastery(state, "M6.ZERO")).toMatchObject({
      pKnown: 0.3,
      source: "teacher_override",
      attempts: 2,
    });
    expect(mastery(state, "M6.ZERO").masteredAt).toBeUndefined();
    expect(mastery(state, "M6.ZERO").pendingVerification).toBeUndefined();
  });

  it("mastered=false never raises pKnown", () => {
    const state = replay(
      pack,
      [attempt("a", "M6.ZERO", { ts: at(1), correct: false }), override("o", 2, false)],
      STUDENT,
    );
    expect(mastery(state, "M6.ZERO").pKnown).toBeCloseTo(bktUpdate(0.3, false, DEFAULTS), 10);
  });

  it("mastered=false after a pending mastered override restores the model value and drops the verify recheck", () => {
    const state = replay(
      pack,
      [
        attempt("a", "M6.ZERO", { ts: at(1), correct: false }),
        override("o1", 2, true),
        override("o2", 3, false),
      ],
      STUDENT,
    );
    expect(mastery(state, "M6.ZERO").pKnown).toBeCloseTo(bktUpdate(0.3, false, DEFAULTS), 10);
    expect(mastery(state, "M6.ZERO").pendingVerification).toBeUndefined();
    expect(mastery(state, "M6.ZERO").modelPKnown).toBeUndefined();
    expect(state.rechecks).toEqual([]);
  });

  it("throws for an unknown concept id", () => {
    expect(() => replay(pack, [override("o", 1, true, "M0.NOPE")], STUDENT)).toThrow(
      "Unknown concept id: M0.NOPE",
    );
  });
});

describe("mark_taught", () => {
  it("schedules an after_taught recheck due at the event time", () => {
    const state = replay(
      pack,
      [{ ...base("m", 4), type: "mark_taught", teacherId: TEACHER, conceptId: "M7.ALPHA" }],
      STUDENT,
    );
    expect(state.rechecks).toEqual([
      { conceptId: "M7.ALPHA", dueAt: at(4), intervalDays: 0, kind: "after_taught" },
    ]);
  });

  it("does not stack duplicates when a concept is marked taught twice", () => {
    const taught = (id: string, minutes: number): StudentEvent => ({
      ...base(id, minutes),
      type: "mark_taught",
      teacherId: TEACHER,
      conceptId: "M7.ALPHA",
    });
    const state = replay(pack, [taught("m1", 1), taught("m2", 5)], STUDENT);
    expect(state.rechecks).toEqual([
      { conceptId: "M7.ALPHA", dueAt: at(5), intervalDays: 0, kind: "after_taught" },
    ]);
  });

  it("throws for an unknown concept id", () => {
    expect(() =>
      replay(
        pack,
        [{ ...base("m", 1), type: "mark_taught", teacherId: TEACHER, conceptId: "X" }],
        STUDENT,
      ),
    ).toThrow("Unknown concept id: X");
  });
});

describe("assign", () => {
  const assign = (
    id: string,
    minutes: number,
    conceptId: string,
    questionIds?: string[],
  ): StudentEvent => ({
    ...base(id, minutes),
    type: "assign",
    teacherId: TEACHER,
    conceptId,
    ...(questionIds ? { questionIds } : {}),
  });

  it("dedupes by conceptId and merges questionIds", () => {
    const state = replay(
      pack,
      [
        assign("a1", 1, "M7.ALPHA", ["q1", "q2"]),
        assign("a2", 2, "M7.BETA"),
        assign("a3", 3, "M7.ALPHA", ["q2", "q3"]),
        assign("a4", 4, "M7.ALPHA"),
      ],
      STUDENT,
    );
    expect(state.assigned).toEqual([
      { conceptId: "M7.ALPHA", questionIds: ["q1", "q2", "q3"] },
      { conceptId: "M7.BETA" },
    ]);
  });

  it("adds questionIds to an earlier assignment that had none", () => {
    const state = replay(
      pack,
      [assign("a1", 1, "M7.ALPHA"), assign("a2", 2, "M7.ALPHA", ["q1"])],
      STUDENT,
    );
    expect(state.assigned).toEqual([{ conceptId: "M7.ALPHA", questionIds: ["q1"] }]);
  });

  it("throws for an unknown concept id", () => {
    expect(() => replay(pack, [assign("a", 1, "X")], STUDENT)).toThrow("Unknown concept id: X");
  });
});

describe("extension_lock", () => {
  it("sets and clears extensionLocked", () => {
    const lock = (id: string, minutes: number, locked: boolean): StudentEvent => ({
      ...base(id, minutes),
      type: "extension_lock",
      teacherId: TEACHER,
      locked,
    });
    expect(replay(pack, [lock("l1", 1, true)], STUDENT).extensionLocked).toBe(true);
    expect(replay(pack, [lock("l1", 1, true), lock("l2", 2, false)], STUDENT).extensionLocked).toBe(
      false,
    );
  });
});

describe("group_edit", () => {
  it("changes only the event counters", () => {
    const before = replay(pack, [attempt("a", "M6.ZERO", { ts: at(1), sessionId: "s1" })], STUDENT);
    const after = applyEvent(pack, before, {
      ...base("g", 5),
      type: "group_edit",
      teacherId: TEACHER,
      chapterId: "CH.NOT.CHECKED",
      action: "move",
      fromGroupId: "a",
      toGroupId: "b",
    });
    expect(after).toEqual({ ...before, eventCount: 2, lastEventTs: at(5) });
    expect(after.lastSessionId).toBe("s1");
  });
});

describe("event bookkeeping", () => {
  it("updates eventCount, lastEventTs and lastSessionId; keeps the session id when an event has none", () => {
    const state = replay(
      pack,
      [
        attempt("a", "M6.ZERO", { ts: at(1), sessionId: "s1" }),
        attempt("b", "M6.ZERO", { ts: at(2), sessionId: "s2" }),
        { ...base("c", 3), type: "extension_lock", teacherId: TEACHER, locked: true },
      ],
      STUDENT,
    );
    expect(state.eventCount).toBe(3);
    expect(state.lastEventTs).toBe(at(3));
    expect(state.lastSessionId).toBe("s2");
  });

  it("applyEvent rejects an event for another student", () => {
    expect(() =>
      applyEvent(pack, initialState(STUDENT), attempt("a", "M6.ZERO", { studentId: "other" })),
    ).toThrow(/belongs to student other/);
  });
});
