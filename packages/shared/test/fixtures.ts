import type { StudentEvent, StudentState } from "@setu/engine";

const base = {
  id: "3b241101-e2bb-4255-8caf-4136c566a962",
  studentId: "stu-anjali",
  ts: "2026-10-27T09:30:00.000Z",
  sessionId: "sess-1",
};

/** One valid event per StudentEvent variant, typed so a new variant forces a new fixture. */
export const eventFixtures: { [T in StudentEvent["type"]]: Extract<StudentEvent, { type: T }> } = {
  attempt: {
    ...base,
    type: "attempt",
    questionId: "M6.FRAC.ADD_SUB_UNLIKE.Q01",
    conceptId: "M6.FRAC.ADD_SUB_UNLIKE",
    mode: "readiness",
    difficulty: 2,
    correct: false,
    selectedOptionId: "b",
    value: 0.5,
    misconceptionCode: "F-ADD-DENOM",
    hintsUsed: 0,
    timeMs: 14200,
    source: "paper",
  },
  learn_viewed: {
    ...base,
    type: "learn_viewed",
    conceptId: "M6.FRAC.ADD_SUB_UNLIKE",
    resourceId: "M6.FRAC.ADD_SUB_UNLIKE.R.explanation.01",
  },
  readiness_completed: {
    ...base,
    type: "readiness_completed",
    chapterId: "CH.M8.LINEAR_EQ_ONE_VAR",
    summary: {
      chapterId: "CH.M8.LINEAR_EQ_ONE_VAR",
      cleared: ["M7.SEQ.BALANCE"],
      failed: ["M6.FRAC.ADD_SUB_UNLIKE"],
      uncertain: [],
      pending: ["M7.INT.MUL_DIV"],
      itemsUsed: 9,
      advancedEntry: false,
      misconceptions: { "F-ADD-DENOM": 2 },
      completedAt: "2026-10-27T09:40:00.000Z",
    },
  },
  teacher_override: {
    ...base,
    type: "teacher_override",
    teacherId: "t-1",
    conceptId: "M6.FRAC.ADD_SUB_UNLIKE",
    mastered: true,
    note: "Saw her do this on the board",
  },
  mark_taught: {
    ...base,
    type: "mark_taught",
    teacherId: "t-1",
    conceptId: "M6.FRAC.ADD_SUB_UNLIKE",
  },
  assign: {
    ...base,
    type: "assign",
    teacherId: "t-1",
    conceptId: "M6.FRAC.ADD_SUB_UNLIKE",
    questionIds: ["M6.FRAC.ADD_SUB_UNLIKE.Q02"],
  },
  extension_lock: { ...base, type: "extension_lock", teacherId: "t-1", locked: true },
  group_edit: {
    ...base,
    type: "group_edit",
    teacherId: "t-1",
    chapterId: "CH.M8.LINEAR_EQ_ONE_VAR",
    action: "move",
    fromGroupId: "gap:M6.FRAC.ADD_SUB_UNLIKE",
    toGroupId: "ready",
  },
};

export const stateFixture: StudentState = {
  studentId: "stu-anjali",
  mastery: {
    "M6.FRAC.ADD_SUB_UNLIKE": {
      conceptId: "M6.FRAC.ADD_SUB_UNLIKE",
      pKnown: 0.42,
      attempts: 3,
      correct: 1,
      lastAttemptAt: "2026-10-27T09:30:00.000Z",
      source: "model",
    },
  },
  progress: {
    "M6.FRAC.ADD_SUB_UNLIKE": {
      conceptId: "M6.FRAC.ADD_SUB_UNLIKE",
      difficulty: 1,
      streakCorrect: 0,
      streakWrong: 1,
      solveAttempts: 0,
      testAttempts: 0,
      learnViewed: false,
      clearedByReadiness: false,
      lastMisconception: "F-ADD-DENOM",
      seenQuestionIds: ["M6.FRAC.ADD_SUB_UNLIKE.Q01"],
    },
  },
  readiness: {},
  rechecks: [
    {
      conceptId: "M6.FRAC.ADD_SUB_UNLIKE",
      dueAt: "2026-10-29T09:30:00.000Z",
      intervalDays: 2,
      kind: "spaced",
    },
  ],
  assigned: [{ conceptId: "M6.FRAC.ADD_SUB_UNLIKE" }],
  extensionLocked: false,
  recentAttempts: [eventFixtures.attempt],
  eventCount: 1,
  lastEventTs: "2026-10-27T09:30:00.000Z",
};
