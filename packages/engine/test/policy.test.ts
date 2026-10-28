import { describe, expect, it } from "vitest";
import {
  buildGraph,
  initialState,
  mulberry32,
  nextReadinessQuestion,
  nextRecommendation,
  readinessSummary,
  recordReadinessAnswer,
  replay,
  startReadiness,
} from "../src/index";
import type {
  AttemptEvent,
  ContentPack,
  Question,
  Recommendation,
  Resource,
  StudentEvent,
} from "../src/index";
import { chapter, concept } from "./fixtures/graph";
import {
  FIXTURE_STUDENT_ID as STUDENT,
  FIXTURE_TEACHER_ID as TEACHER,
  at,
  attempt,
  fixturePack,
} from "./fixtures/pack";
import { SPINE_CHAPTER_ID, questionsFor, spinePack } from "./fixtures/readiness";

const NOW = "2026-10-27T12:00:00.000Z";
const UNLIKE = "M6.FRAC.ADD_SUB_UNLIKE";
const UNLIKE_EXAMPLE = `${UNLIKE}.R.worked_example.01.F-ADD-DENOM`;
const FRACTIONS_EXAMPLE = "M8.LEQ.FRACTIONS.R.worked_example.01.F-ADD-DENOM";
const APPLY_EXPLANATION = "M7.SEQ.APPLY.R.explanation.01";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function resource(
  id: string,
  conceptId: string,
  type: Resource["type"],
  targetsMisconception?: string,
): Resource {
  return {
    id,
    conceptId,
    type,
    body: { en: id },
    reviewStatus: "draft",
    ...(targetsMisconception !== undefined ? { targetsMisconception } : {}),
  };
}

/** The Class 6 to 8 spine plus the resources the R5 branches need. */
function policyPack(): ContentPack {
  return {
    ...spinePack(),
    resources: [
      resource(`${UNLIKE}.R.explanation.01`, UNLIKE, "explanation"),
      resource(UNLIKE_EXAMPLE, UNLIKE, "worked_example", "F-ADD-DENOM"),
      resource(FRACTIONS_EXAMPLE, "M8.LEQ.FRACTIONS", "worked_example", "F-ADD-DENOM"),
      resource(APPLY_EXPLANATION, "M7.SEQ.APPLY", "explanation"),
    ],
  };
}

function wrongCode(question: Question): string | undefined {
  if (question.type !== "mcq") return undefined;
  return question.options.find((o) => !o.isCorrect)?.misconceptionCode;
}

/** Plays a real Readiness Check on the spine chapter and returns its events, completion last. */
function readinessEvents(pack: ContentPack, isCorrect: (q: Question) => boolean): StudentEvent[] {
  const rng = mulberry32(7);
  let session = startReadiness(pack, initialState(STUDENT), SPINE_CHAPTER_ID, []);
  const events: StudentEvent[] = [];
  for (let n = 1; n <= 100; n++) {
    const next = nextReadinessQuestion(pack, session, rng);
    session = next.session;
    const question = next.question;
    if (!question) {
      events.push({
        id: "readiness-done",
        type: "readiness_completed",
        studentId: STUDENT,
        ts: at(30),
        chapterId: SPINE_CHAPTER_ID,
        summary: readinessSummary(session, at(30)),
      });
      return events;
    }
    const correct = isCorrect(question);
    const code = correct ? undefined : wrongCode(question);
    const event = attempt(`r${n}`, question.conceptId, {
      questionId: question.id,
      mode: "readiness",
      difficulty: question.difficulty,
      correct,
      ts: at(n),
      ...(code !== undefined ? { misconceptionCode: code } : {}),
    });
    events.push(event);
    session = recordReadinessAnswer(pack, session, event);
  }
  throw new Error("readiness check did not finish within 100 questions");
}

const pack = policyPack();
/** Anjali: every readiness answer correct (advanced entry). */
const anjali = readinessEvents(pack, () => true);
/** Ravi: wrong only on adding unlike fractions, with F-ADD-DENOM. */
const ravi = readinessEvents(pack, (q) => q.conceptId !== UNLIKE);

function recommend(
  p: ContentPack,
  events: readonly StudentEvent[],
  opts: { sessionId?: string; now?: string; chapterId?: string } = {},
): Recommendation {
  const state = replay(p, [...events], STUDENT);
  return nextRecommendation({
    pack: p,
    state,
    chapterId: opts.chapterId ?? p.chapterId,
    now: opts.now ?? NOW,
    sessionId: opts.sessionId ?? "s1",
    rng: mulberry32(3),
  });
}

function override(id: string, conceptId: string, minutes: number): StudentEvent {
  return {
    id,
    type: "teacher_override",
    studentId: STUDENT,
    ts: at(minutes),
    teacherId: TEACHER,
    conceptId,
    mastered: true,
  };
}

function markTaught(id: string, conceptId: string, ts: string): StudentEvent {
  return { id, type: "mark_taught", studentId: STUDENT, ts, teacherId: TEACHER, conceptId };
}

function assign(id: string, conceptId: string, questionIds?: string[]): StudentEvent {
  return {
    id,
    type: "assign",
    studentId: STUDENT,
    ts: at(40),
    teacherId: TEACHER,
    conceptId,
    ...(questionIds !== undefined ? { questionIds } : {}),
  };
}

// One-concept chapter whose estimate never moves (pG = pS = 0.5, pT = 0), so R6 and R8 can be
// reached without hand-tuning answer sequences.
const MINI = "CH.M8.MINI";
const MINI_CONCEPT = "M8.A";

function miniPack(pL0: number, withExtension = true): ContentPack {
  const a = { ...concept(MINI_CONCEPT, 8, []), bkt: { pL0, pT: 0, pG: 0.5, pS: 0.5 } };
  const extension: Question = {
    id: `${MINI_CONCEPT}.X1`,
    conceptId: MINI_CONCEPT,
    type: "mcq",
    difficulty: 3,
    stem: { en: "extension" },
    options: [
      { id: "a", text: { en: "right" }, isCorrect: true },
      { id: "b", text: { en: "wrong" }, isCorrect: false },
    ],
    boardTags: ["NCERT"],
    tags: ["extension"],
    reviewStatus: "draft",
  };
  return {
    ...fixturePack(),
    chapterId: MINI,
    graph: buildGraph([a], [chapter(MINI, 8, [MINI_CONCEPT])]),
    questions: [...questionsFor([MINI_CONCEPT]), ...(withExtension ? [extension] : [])],
    resources: [],
  };
}

const miniReadiness: StudentEvent = {
  id: "mini-rc",
  type: "readiness_completed",
  studentId: STUDENT,
  ts: at(0),
  chapterId: MINI,
  summary: {
    chapterId: MINI,
    cleared: [],
    failed: [],
    uncertain: [],
    pending: [],
    itemsUsed: 0,
    advancedEntry: false,
    misconceptions: {},
    completedAt: at(0),
  },
};

function solves(n: number): AttemptEvent[] {
  const suffixes = ["Q01", "Q02", "Q03", "Q04"];
  return Array.from({ length: n }, (_, i) =>
    attempt(`s${i}`, MINI_CONCEPT, {
      questionId: `${MINI_CONCEPT}.${suffixes[i % suffixes.length] ?? "Q01"}`,
      ts: at(i + 1),
    }),
  );
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

describe("nextRecommendation rules", () => {
  it("R0: asks for the readiness check before anything else", () => {
    const rec = recommend(pack, []);
    expect(rec.ruleId).toBe("R0_READINESS");
    expect(rec.mode).toBe("readiness");
    expect(rec.chapterId).toBe(SPINE_CHAPTER_ID);
  });

  it("throws on an unknown chapter", () => {
    expect(() => recommend(pack, anjali, { chapterId: "CH.NOPE" })).toThrow(/Unknown chapter id/);
  });

  it("R1: a due override verification comes first, three questions at difficulty 2", () => {
    const rec = recommend(pack, [...anjali, override("o1", "M6.INT.CONCEPT", 40)]);
    expect(rec.ruleId).toBe("R1_VERIFY_OVERRIDE");
    expect(rec.mode).toBe("verify");
    expect(rec.recheckKind).toBe("verify_override");
    expect(rec.conceptId).toBe("M6.INT.CONCEPT");
    expect(rec.difficulty).toBe(2);
    expect(rec.questionIds).toHaveLength(3);
  });

  it("R1 beats a due R2 re-check", () => {
    const rec = recommend(pack, [
      ...anjali,
      override("o1", "M6.INT.CONCEPT", 40),
      markTaught("t1", "M7.FRAC.MUL", at(41)),
    ]);
    expect(rec.ruleId).toBe("R1_VERIFY_OVERRIDE");
  });

  it("R2: a due after-taught re-check gives three questions on that concept", () => {
    const rec = recommend(pack, [...anjali, markTaught("t1", "M7.FRAC.MUL", at(41))]);
    expect(rec.ruleId).toBe("R2_RECHECK_DUE");
    expect(rec.mode).toBe("recheck");
    expect(rec.recheckKind).toBe("after_taught");
    expect(rec.conceptId).toBe("M7.FRAC.MUL");
    expect(rec.questionIds).toHaveLength(3);
  });

  it("R2 ignores a re-check that is not due yet", () => {
    const rec = recommend(pack, [
      ...anjali,
      markTaught("t1", "M7.FRAC.MUL", "2026-10-28T00:00:00.000Z"),
    ]);
    expect(rec.ruleId).toBe("R7_SOLVE");
    expect(rec.conceptId).toBe("M8.LEQ.ONE_SIDE");
  });

  it("R2 runs at most once per session", () => {
    const events = [
      ...anjali,
      markTaught("t1", "M7.FRAC.MUL", at(41)),
      attempt("rc1", "M7.FRAC.MUL", {
        questionId: "M7.FRAC.MUL.Q02",
        mode: "recheck",
        difficulty: 2,
        sessionId: "s1",
        ts: at(42),
      }),
    ];
    expect(recommend(pack, events, { sessionId: "s1" }).ruleId).not.toBe("R2_RECHECK_DUE");
    expect(recommend(pack, events, { sessionId: "s2" }).ruleId).toBe("R2_RECHECK_DUE");
  });

  it("R2 beats an assigned concept", () => {
    const rec = recommend(pack, [
      ...anjali,
      markTaught("t1", "M7.FRAC.MUL", at(41)),
      assign("as1", "M7.ALG.ADD_SUB_EXPR"),
    ]);
    expect(rec.ruleId).toBe("R2_RECHECK_DUE");
  });

  it("R3: an assigned concept beats the frontier and prefers the assigned questions", () => {
    const rec = recommend(pack, [
      ...anjali,
      assign("as1", "M7.ALG.ADD_SUB_EXPR", ["M7.ALG.ADD_SUB_EXPR.Q04"]),
    ]);
    expect(rec.ruleId).toBe("R7_SOLVE");
    expect(rec.conceptId).toBe("M7.ALG.ADD_SUB_EXPR");
    expect(rec.reasonParams.assigned).toBe(1);
    expect(rec.questionIds).toEqual(["M7.ALG.ADD_SUB_EXPR.Q04"]);
  });

  it("R5: uses a worked example for a misconception seen on an ancestor", () => {
    const rec = recommend(pack, [...ravi, assign("as1", "M8.LEQ.FRACTIONS")]);
    expect(rec.ruleId).toBe("R5_LEARN");
    expect(rec.conceptId).toBe("M8.LEQ.FRACTIONS");
    expect(rec.resourceId).toBe(FRACTIONS_EXAMPLE);
    expect(rec.reasonParams.misconceptionCode).toBe("F-ADD-DENOM");
  });

  it("R5: falls back to the explanation when no misconception applies", () => {
    const rec = recommend(pack, [...ravi, assign("as1", "M7.SEQ.APPLY")]);
    expect(rec.ruleId).toBe("R5_LEARN");
    expect(rec.resourceId).toBe(APPLY_EXPLANATION);
    expect(rec.reasonParams.misconceptionCode).toBeUndefined();
  });

  it("R7 before the solve-attempt threshold, R6 once it is reached", () => {
    const mini = miniPack(0.85);
    expect(recommend(mini, [miniReadiness, ...solves(3)]).ruleId).toBe("R7_SOLVE");
    const rec = recommend(mini, [miniReadiness, ...solves(4)]);
    expect(rec.ruleId).toBe("R6_TEST");
    expect(rec.mode).toBe("test");
    expect(rec.conceptId).toBe(MINI_CONCEPT);
    expect(rec.questionIds).toHaveLength(3);
  });

  it("R8: extension work once every chapter concept is mastered", () => {
    const rec = recommend(miniPack(0.95), [miniReadiness, ...solves(1)]);
    expect(rec.ruleId).toBe("R8_EXTENSION");
    expect(rec.mode).toBe("extension");
    expect(rec.difficulty).toBe(3);
    expect(rec.questionIds).toEqual([`${MINI_CONCEPT}.X1`]);
  });

  it("R9 when extension is locked by the teacher", () => {
    const lock: StudentEvent = {
      id: "lock",
      type: "extension_lock",
      studentId: STUDENT,
      ts: at(5),
      teacherId: TEACHER,
      locked: true,
    };
    const rec = recommend(miniPack(0.95), [miniReadiness, ...solves(1), lock]);
    expect(rec.ruleId).toBe("R9_DONE");
    expect(rec.mode).toBe("done");
  });

  it("R9 when there are no extension questions", () => {
    const rec = recommend(miniPack(0.95, false), [miniReadiness, ...solves(1)]);
    expect(rec.ruleId).toBe("R9_DONE");
  });

  it("reasonParams hold ids and numbers only", () => {
    for (const rec of [
      recommend(pack, anjali),
      recommend(pack, ravi),
      recommend(pack, [...anjali, markTaught("t1", "M7.FRAC.MUL", at(41))]),
    ]) {
      for (const value of Object.values(rec.reasonParams)) {
        expect(["string", "number"]).toContain(typeof value);
      }
      expect(rec.reasonParams.chapterId).toBe(SPINE_CHAPTER_ID);
    }
  });
});

// ---------------------------------------------------------------------------
// Scenarios from the Decode submission, section 2.4
// ---------------------------------------------------------------------------

describe("Anjali and Ravi pathways", () => {
  it("Anjali: advanced entry, straight to Solve on the first chapter concept at difficulty 2", () => {
    const state = replay(pack, [...anjali], STUDENT);
    expect(state.readiness[SPINE_CHAPTER_ID]?.advancedEntry).toBe(true);
    const rec = recommend(pack, anjali);
    expect(rec.ruleId).toBe("R7_SOLVE");
    expect(rec.mode).toBe("solve");
    expect(rec.conceptId).toBe("M8.LEQ.ONE_SIDE");
    expect(rec.difficulty).toBe(2);
  });

  it("Ravi: Learn on adding unlike fractions with the F-ADD-DENOM worked example, then Solve at 1", () => {
    const summary = replay(pack, [...ravi], STUDENT).readiness[SPINE_CHAPTER_ID];
    expect(summary?.failed).toContain(UNLIKE);
    expect(summary?.cleared).toContain("M6.FRAC.EQUIV");

    const learn = recommend(pack, ravi);
    expect(learn.ruleId).toBe("R5_LEARN");
    expect(learn.mode).toBe("learn");
    expect(learn.conceptId).toBe(UNLIKE);
    expect(learn.resourceId).toBe(UNLIKE_EXAMPLE);
    expect(learn.reasonParams.misconceptionCode).toBe("F-ADD-DENOM");

    const viewed: StudentEvent = {
      id: "lv1",
      type: "learn_viewed",
      studentId: STUDENT,
      ts: at(31),
      conceptId: UNLIKE,
      resourceId: UNLIKE_EXAMPLE,
    };
    const solve = recommend(pack, [...ravi, viewed]);
    expect(solve.ruleId).toBe("R7_SOLVE");
    expect(solve.conceptId).toBe(UNLIKE);
    expect(solve.difficulty).toBe(1);
  });
});
