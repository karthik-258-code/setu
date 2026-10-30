import { describe, expect, it } from "vitest";
import {
  READINESS_MAX_DEPTH,
  READINESS_MAX_ITEMS,
  initialState,
  mulberry32,
  nextReadinessQuestion,
  readinessSummary,
  recordReadinessAnswer,
  replay,
  startReadiness,
} from "../src/index";
import type {
  AttemptEvent,
  ContentPack,
  Question,
  ReadinessSession,
  StudentEvent,
} from "../src/index";
import {
  FIXTURE_CHAPTER_ID,
  FIXTURE_STUDENT_ID as STUDENT,
  at,
  attempt,
  fixturePack,
} from "./fixtures/pack";
import {
  CHAIN_CHAPTER_ID,
  SPINE_CHAPTER_ID,
  chainPack,
  questionsFor,
  spinePack,
} from "./fixtures/readiness";

const NOW = "2026-10-27T12:00:00.000Z";

type Answer = { correct: boolean };
type Answerer = (question: Question, session: ReadinessSession) => Answer;

const allCorrect: Answerer = () => ({ correct: true });
const allWrong: Answerer = () => ({ correct: false });

/** Wrong option's misconception code, if the question has one. */
function wrongCode(question: Question): string | undefined {
  if (question.type !== "mcq") return undefined;
  return question.options.find((o) => !o.isCorrect)?.misconceptionCode;
}

function attemptFor(question: Question, correct: boolean, n: number): AttemptEvent {
  const code = correct ? undefined : wrongCode(question);
  return attempt(`a${n}`, question.conceptId, {
    questionId: question.id,
    mode: "readiness",
    difficulty: question.difficulty,
    correct,
    ...(code !== undefined ? { misconceptionCode: code } : {}),
    ts: at(n),
  });
}

interface Run {
  session: ReadinessSession;
  asked: Question[];
  attempts: AttemptEvent[];
}

/** Plays a check to the end, answering with `answerer`. Fails the test if it never ends. */
function play(
  pack: ContentPack,
  session: ReadinessSession,
  answerer: Answerer,
  rng: () => number = mulberry32(1),
): Run {
  const asked: Question[] = [];
  const attempts: AttemptEvent[] = [];
  let current = session;
  for (let guard = 0; guard < 100; guard++) {
    const next = nextReadinessQuestion(pack, current, rng);
    current = next.session;
    if (!next.question) return { session: current, asked, attempts };
    const { correct } = answerer(next.question, current);
    const event = attemptFor(next.question, correct, asked.length + 1);
    asked.push(next.question);
    attempts.push(event);
    current = recordReadinessAnswer(pack, current, event);
  }
  throw new Error("readiness check did not finish within 100 questions");
}

/** Answers by concept: listed concepts get the given sequence (last value repeats), others correct. */
function byConcept(plan: Record<string, boolean[]>): Answerer {
  const counts: Record<string, number> = {};
  return (question) => {
    const seq = plan[question.conceptId];
    if (!seq) return { correct: true };
    const n = counts[question.conceptId] ?? 0;
    counts[question.conceptId] = n + 1;
    return { correct: seq[Math.min(n, seq.length - 1)] as boolean };
  };
}

function start(pack: ContentPack, chapterId: string, trimmed: string[] = []): ReadinessSession {
  return startReadiness(pack, initialState(STUDENT), chapterId, trimmed);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const spine = spinePack();
const fixture = fixturePack();
const chain = chainPack();

describe("startReadiness", () => {
  it("queues the chapter's external prerequisites at depth 0 ordered by impact, then topo order", () => {
    const session = start(spine, SPINE_CHAPTER_ID);
    const ids = session.queue.map((item) => item.conceptId);
    expect(ids).toHaveLength(7);
    expect(session.queue.every((item) => item.depth === 0)).toBe(true);
    // Impact: TRANSPOSE, FRAC.DIV, FRAC.MUL reach all 7 chapter concepts; LIKE_TERMS 6; the rest 2.
    expect(new Set(ids.slice(0, 3))).toEqual(
      new Set(["M7.SEQ.TRANSPOSE", "M7.FRAC.DIV", "M7.FRAC.MUL"]),
    );
    expect(ids[3]).toBe("M7.ALG.LIKE_TERMS");
    expect(new Set(ids.slice(4))).toEqual(
      new Set(["M7.INT.PROPERTIES", "M6.FRAC.ADD_SUB_UNLIKE", "M7.SEQ.SETUP"]),
    );
    // Ties keep topo order.
    const rank = (id: string): number => spine.graph.topoOrder.indexOf(id);
    for (const group of [ids.slice(0, 3), ids.slice(4)]) {
      expect(group).toEqual([...group].sort((a, b) => rank(a) - rank(b)));
    }
  });

  it("starts in the direct phase with the full budget and nothing asked", () => {
    const session = start(spine, SPINE_CHAPTER_ID);
    expect(session).toMatchObject({
      studentId: STUDENT,
      chapterId: SPINE_CHAPTER_ID,
      phase: "direct",
      budgetLeft: READINESS_MAX_ITEMS,
      askedQuestionIds: [],
      misconceptions: {},
      chapterCorrect: 0,
      trimmed: [],
    });
    expect(session.current).toBeUndefined();
  });

  it("throws on an unknown chapter", () => {
    expect(() => start(spine, "CH.NOPE")).toThrow("Unknown chapter id: CH.NOPE");
  });

  it("skips teacher-trimmed prerequisites", () => {
    const trimmed = ["M7.SEQ.SETUP", "M7.INT.PROPERTIES"];
    const session = start(spine, SPINE_CHAPTER_ID, trimmed);
    expect(session.queue.map((i) => i.conceptId)).not.toEqual(expect.arrayContaining(trimmed));
    expect(session.queue).toHaveLength(5);

    const run = play(spine, session, allCorrect);
    const asked = run.asked.map((q) => q.conceptId);
    for (const id of trimmed) expect(asked).not.toContain(id);
    const summary = readinessSummary(run.session, NOW);
    const listed = [
      ...summary.cleared,
      ...summary.failed,
      ...summary.uncertain,
      ...summary.pending,
    ];
    for (const id of trimmed) expect(listed).not.toContain(id);
  });

  it("does not descend into a trimmed concept", () => {
    // M7.FRAC.DIV (target) <- M7.FRAC.MUL (target, trimmed) <- M6.FRAC.EQUIV
    const run = play(
      spine,
      start(spine, SPINE_CHAPTER_ID, ["M7.FRAC.MUL"]),
      byConcept({ "M7.FRAC.DIV": [false] }),
    );
    const asked = run.asked.map((q) => q.conceptId);
    expect(asked).not.toContain("M7.FRAC.MUL");
    expect(asked).not.toContain("M6.FRAC.EQUIV");
  });
});

describe("nextReadinessQuestion", () => {
  it("prefers difficulty 2 and sets session.current", () => {
    const { session, question } = nextReadinessQuestion(
      spine,
      start(spine, SPINE_CHAPTER_ID),
      mulberry32(3),
    );
    expect(question?.difficulty).toBe(2);
    expect(session.current).toEqual({
      conceptId: question?.conceptId,
      questionId: question?.id,
      depth: 0,
      isChapterQuestion: false,
    });
    expect(session.budgetLeft).toBe(READINESS_MAX_ITEMS - 1);
    expect(session.askedQuestionIds).toEqual([question?.id]);
  });

  it("returns the same question until the answer is recorded", () => {
    const first = nextReadinessQuestion(spine, start(spine, SPINE_CHAPTER_ID), mulberry32(3));
    const again = nextReadinessQuestion(spine, first.session, mulberry32(99));
    expect(again.question).toBe(first.question);
    expect(again.session).toBe(first.session);
  });

  it("uses the passed rng only to choose among difficulty-2 questions", () => {
    const picks = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const { question } = nextReadinessQuestion(
        spine,
        start(spine, SPINE_CHAPTER_ID),
        mulberry32(seed),
      );
      picks.add(question?.id ?? "none");
      // Same seed, same question.
      const repeat = nextReadinessQuestion(spine, start(spine, SPINE_CHAPTER_ID), mulberry32(seed));
      expect(repeat.question?.id).toBe(question?.id);
    }
    expect(picks.size).toBeGreaterThan(1);
  });

  it("falls back to the nearest difficulty when a concept has no difficulty-2 item", () => {
    // The only target of the chain pack is M7.C4; give it questions of the listed difficulties only.
    const firstDifficulty = (difficulties: number[]): number | undefined => {
      const pack: ContentPack = {
        ...chain,
        questions: [
          ...chain.questions.filter((q) => q.conceptId !== "M7.C4"),
          ...questionsFor(["M7.C4"]).filter((q) => difficulties.includes(q.difficulty)),
        ],
      };
      return nextReadinessQuestion(pack, start(pack, CHAIN_CHAPTER_ID), mulberry32(1)).question
        ?.difficulty;
    };
    expect(firstDifficulty([1, 2, 3])).toBe(2);
    expect(firstDifficulty([1, 3])).toBe(1); // a tie goes to the easier question
    expect(firstDifficulty([3])).toBe(3);
    expect(firstDifficulty([1])).toBe(1);
  });

  it("skips a concept with no questions and leaves it pending", () => {
    const pack: ContentPack = {
      ...spine,
      questions: spine.questions.filter((q) => q.conceptId !== "M7.FRAC.DIV"),
    };
    const run = play(pack, start(pack, SPINE_CHAPTER_ID), allCorrect);
    expect(run.asked.map((q) => q.conceptId)).not.toContain("M7.FRAC.DIV");
    const summary = readinessSummary(run.session, NOW);
    expect(summary.pending).toContain("M7.FRAC.DIV");
    expect(summary.cleared).not.toContain("M7.FRAC.DIV");
    // Not every target is cleared, so no chapter questions are asked.
    expect(summary.advancedEntry).toBe(false);
    expect(run.asked.some((q) => q.conceptId.startsWith("M8"))).toBe(false);
  });

  it("returns null when the budget is used up and keeps returning null", () => {
    const run = play(spine, start(spine, SPINE_CHAPTER_ID), allCorrect);
    expect(run.session.phase).toBe("done");
    expect(run.session.budgetLeft).toBe(0);
    const again = nextReadinessQuestion(spine, run.session, mulberry32(1));
    expect(again.question).toBeNull();
    expect(again.session.phase).toBe("done");
  });

  it("returns null straight away when the concept has nothing to ask", () => {
    const empty: ContentPack = { ...chain, questions: [] };
    const { question, session } = nextReadinessQuestion(
      empty,
      start(empty, CHAIN_CHAPTER_ID),
      mulberry32(1),
    );
    expect(question).toBeNull();
    expect(session.phase).toBe("done");
    expect(readinessSummary(session, NOW).pending).toEqual(["M7.C4"]);
  });

  it("does not mutate the session it is given", () => {
    const session = deepFreeze(start(spine, SPINE_CHAPTER_ID));
    const { session: next } = nextReadinessQuestion(spine, session, mulberry32(1));
    expect(next).not.toBe(session);
    expect(session.current).toBeUndefined();
    expect(session.budgetLeft).toBe(READINESS_MAX_ITEMS);
  });
});

describe("recordReadinessAnswer", () => {
  it("throws when no question is pending", () => {
    const session = start(spine, SPINE_CHAPTER_ID);
    const stray = attempt("x", "M7.FRAC.DIV", { mode: "readiness" });
    expect(() => recordReadinessAnswer(spine, session, stray)).toThrow("No readiness question");
  });

  it("throws when the attempt is for another question or student", () => {
    const { session, question } = nextReadinessQuestion(
      spine,
      start(spine, SPINE_CHAPTER_ID),
      mulberry32(1),
    );
    const good = attemptFor(question as Question, true, 1);
    expect(() =>
      recordReadinessAnswer(spine, session, { ...good, questionId: "M7.FRAC.DIV.Q99" }),
    ).toThrow("is pending");
    expect(() => recordReadinessAnswer(spine, session, { ...good, studentId: "someone" })).toThrow(
      "belongs to student",
    );
  });

  it("does not mutate the session and clears current", () => {
    const { session, question } = nextReadinessQuestion(
      spine,
      start(spine, SPINE_CHAPTER_ID),
      mulberry32(1),
    );
    deepFreeze(session);
    const next = recordReadinessAnswer(spine, session, attemptFor(question as Question, false, 1));
    expect(next.current).toBeUndefined();
    expect(session.current).toBeDefined();
    expect(next.results[(question as Question).conceptId]).toMatchObject({
      asked: 1,
      correct: 0,
      status: "failed",
    });
  });

  it("marks a concept failed on a wrong answer and cleared after one right answer", () => {
    const first = nextReadinessQuestion(spine, start(spine, SPINE_CHAPTER_ID), mulberry32(1));
    const id = (first.question as Question).conceptId;
    const right = recordReadinessAnswer(
      spine,
      first.session,
      attemptFor(first.question as Question, true, 1),
    );
    expect(right.results[id]).toMatchObject({ asked: 1, correct: 1, status: "cleared" });
  });
});

describe("descending", () => {
  it("descends from a failed Class 7 prerequisite into Class 6", () => {
    const start0 = start(spine, SPINE_CHAPTER_ID);
    const run = play(spine, start0, byConcept({ "M7.FRAC.MUL": [false] }));
    const asked = run.asked.map((q) => q.conceptId);
    expect(asked).toContain("M6.FRAC.EQUIV");
    const failedIndex = asked.indexOf("M7.FRAC.MUL");
    // The Class 6 prerequisite comes straight after the failure, ahead of the remaining targets.
    expect(asked[failedIndex + 1]).toBe("M6.FRAC.EQUIV");
    expect(run.session.results["M6.FRAC.EQUIV"]?.depth).toBe(1);
    expect(readinessSummary(run.session, NOW).failed).toEqual(["M7.FRAC.MUL"]);
  });

  it("pushes several prerequisites to the front ordered by impact", () => {
    // M7.SEQ.SETUP <- M6.ALG.EQUATION_INTRO, M7.ALG.TERMS. Impact on the chapter: EQUATION_INTRO 7
    // (through BALANCE and TRANSPOSE to every concept), TERMS 6 (it does not reach ONE_SIDE).
    const run = play(spine, start(spine, SPINE_CHAPTER_ID), byConcept({ "M7.SEQ.SETUP": [false] }));
    const asked = run.asked.map((q) => q.conceptId);
    const i = asked.indexOf("M7.SEQ.SETUP");
    expect(asked.slice(i + 1, i + 3)).toEqual(["M6.ALG.EQUATION_INTRO", "M7.ALG.TERMS"]);
  });

  it("recurses on wrong answers and stops at depth 3", () => {
    // PROPERTIES(7) -> MUL_DIV(7) -> INT.ADD_SUB(6) -> INT.CONCEPT(6): depths 0, 1, 2, 3.
    const run = play(spine, start(spine, SPINE_CHAPTER_ID), allWrong);
    const depths = Object.values(run.session.results).map((r) => r.depth);
    expect(Math.max(...depths)).toBeLessThanOrEqual(READINESS_MAX_DEPTH);
    expect(run.session.results["M6.INT.CONCEPT"]?.depth).toBe(3);
  });

  it("does not descend past depth 3", () => {
    const run = play(chain, start(chain, CHAIN_CHAPTER_ID), allWrong);
    expect(run.asked.map((q) => q.conceptId)).toEqual(["M7.C4", "M7.C3", "M7.C2", "M6.C1"]);
    expect(run.session.results["M6.C0"]).toBeUndefined();
    expect(run.session.results["M6.C1"]?.depth).toBe(READINESS_MAX_DEPTH);
    const summary = readinessSummary(run.session, NOW);
    expect(summary.failed).toEqual(["M7.C4", "M7.C3", "M7.C2", "M6.C1"]);
    expect(summary.itemsUsed).toBe(4);
  });

  it("does not ask a prerequisite that was already asked or cleared", () => {
    // M7.FRAC.MUL and M7.FRAC.DIV are targets; failing DIV must not re-ask MUL once it is asked.
    const run = play(spine, start(spine, SPINE_CHAPTER_ID), byConcept({ "M7.FRAC.DIV": [false] }));
    const counts = new Map<string, number>();
    for (const q of run.asked) counts.set(q.conceptId, (counts.get(q.conceptId) ?? 0) + 1);
    expect(counts.get("M7.FRAC.MUL")).toBeLessThanOrEqual(2);
    expect(run.session.results["M7.FRAC.MUL"]?.depth).toBe(0);
  });

  it("queues the prerequisites of a failed concept ahead of the remaining targets", () => {
    const first = nextReadinessQuestion(spine, start(spine, SPINE_CHAPTER_ID), mulberry32(1));
    const failed = (first.question as Question).conceptId;
    const question = first.question as Question;
    const after = recordReadinessAnswer(spine, first.session, attemptFor(question, false, 1));
    expect(after.phase).toBe("descend");
    expect(after.queue.map((i) => i.conceptId)).not.toContain(failed);
    expect(after.queue[0]?.depth).toBe(1);
    const firstDepth0 = after.queue.findIndex((i) => i.depth === 0);
    expect(after.queue.slice(0, firstDepth0).every((i) => i.depth === 1)).toBe(true);
    expect(after.queue.slice(firstDepth0).every((i) => i.depth === 0)).toBe(true);
  });
});

describe("confirming and clearing", () => {
  it("asks a second question for concepts answered right once, closest to the chapter first", () => {
    // M7.FRAC.MUL fails -> EQUIV (depth 1) right. After all targets, confirmations start at depth 0.
    const run = play(
      spine,
      start(spine, SPINE_CHAPTER_ID, ["M7.SEQ.TRANSPOSE", "M7.SEQ.SETUP", "M7.INT.PROPERTIES"]),
      byConcept({ "M7.FRAC.MUL": [false] }),
    );
    const order = run.asked.map((q) => q.conceptId);
    const secondTimes = order.filter((id, i) => order.indexOf(id) !== i);
    const depthOf = (id: string): number => run.session.results[id]?.depth ?? -1;
    const depths = secondTimes.map(depthOf);
    expect(depths).toEqual([...depths].sort((a, b) => a - b));
    expect(depths[0]).toBe(0);
  });

  it("confirms the cleared prerequisites of a failed concept before the targets", () => {
    // Ravi: adding unlike fractions fails and its three prerequisites are answered right once.
    // Equivalent fractions is backed by the right answers on multiplying and dividing fractions,
    // so like fractions and LCM take the two confirmations left.
    const run = play(
      spine,
      start(spine, SPINE_CHAPTER_ID),
      byConcept({ "M6.FRAC.ADD_SUB_UNLIKE": [false] }),
    );
    const order = run.asked.map((q) => q.conceptId);
    const secondTimes = order.filter((id, i) => order.indexOf(id) !== i);
    expect(new Set(secondTimes)).toEqual(new Set(["M6.FRAC.ADD_SUB_LIKE", "M6.NUM.LCM_HCF"]));
  });

  it("keeps a concept cleared after a correct second answer and never asks the same question twice", () => {
    const run = play(fixture, start(fixture, FIXTURE_CHAPTER_ID), allCorrect);
    const summary = readinessSummary(run.session, NOW);
    expect(summary.cleared.sort()).toEqual(["M6.TWO", "M7.DELTA", "M7.GAMMA"]);
    for (const id of summary.cleared) {
      expect(run.session.results[id]).toMatchObject({ asked: 2, correct: 2, status: "cleared" });
    }
    const ids = run.asked.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("clears a concept on its first correct answer, before any confirmation", () => {
    const first = nextReadinessQuestion(fixture, start(fixture, FIXTURE_CHAPTER_ID), mulberry32(1));
    const question = first.question as Question;
    const after = recordReadinessAnswer(fixture, first.session, attemptFor(question, true, 1));
    expect(after.results[question.conceptId]).toMatchObject({
      asked: 1,
      correct: 1,
      status: "cleared",
    });
    expect(after.queue.map((i) => i.conceptId)).not.toContain(question.conceptId);
  });

  it("turns cleared into uncertain when the second answer in confirm is wrong", () => {
    const pack = fixture;
    let session = start(pack, FIXTURE_CHAPTER_ID);
    const rng = mulberry32(1);
    const attempts: AttemptEvent[] = [];
    let secondAnswerSeen = false;
    for (let n = 1; n <= READINESS_MAX_ITEMS; n++) {
      const next = nextReadinessQuestion(pack, session, rng);
      if (!next.question) break;
      session = next.session;
      const conceptId = next.question.conceptId;
      const isSecond = session.phase === "confirm" && session.results[conceptId]?.asked === 2;
      const correct = !(isSecond && !secondAnswerSeen);
      const before = session.results[conceptId]?.status;
      if (isSecond && !secondAnswerSeen) {
        secondAnswerSeen = true;
        expect(before).toBe("cleared");
      }
      const event = attemptFor(next.question, correct, n);
      attempts.push(event);
      session = recordReadinessAnswer(pack, session, event);
      if (isSecond && !correct) {
        expect(session.results[conceptId]).toMatchObject({
          asked: 2,
          correct: 1,
          status: "uncertain",
        });
      }
    }
    expect(secondAnswerSeen).toBe(true);
    const summary = readinessSummary(session, NOW);
    expect(summary.uncertain).toHaveLength(1);
    expect(summary.cleared).not.toContain(summary.uncertain[0]);
    expect(summary.failed).toEqual([]);
  });

  it("marks a concept uncertain on right-then-wrong and descends when depth allows", () => {
    const run = play(
      fixture,
      start(fixture, FIXTURE_CHAPTER_ID),
      byConcept({ "M7.GAMMA": [true, false] }),
    );
    const summary = readinessSummary(run.session, NOW);
    expect(summary.uncertain).toEqual(["M7.GAMMA"]);
    expect(summary.failed).toEqual([]);
    expect(run.session.results["M7.GAMMA"]).toMatchObject({
      asked: 2,
      correct: 1,
      status: "uncertain",
    });
    // The chapter questions came before the confirmation, so the downgrade does not undo them.
    // GAMMA's prerequisites are now asked at depth 1, after the second GAMMA question.
    const order = run.asked.map((q) => q.conceptId);
    const secondGamma = order.lastIndexOf("M7.GAMMA");
    expect(new Set(order.slice(secondGamma + 1, secondGamma + 3))).toEqual(
      new Set(["M7.ALPHA", "M7.BETA"]),
    );
    expect(run.session.results["M7.ALPHA"]?.depth).toBe(1);
    expect(summary.advancedEntry).toBe(true);
  });

  it("does not descend from an uncertain concept at the depth limit", () => {
    // C4 right-wrong at depth 0 descends; make the chain fail until C1 (depth 3), then C1 is
    // wrong on its only question, so nothing deeper is queued.
    const run = play(chain, start(chain, CHAIN_CHAPTER_ID), byConcept({ "M7.C4": [false] }));
    expect(run.asked.map((q) => q.conceptId)).not.toContain("M6.C0");
    const uncertainAtLimit = play(
      chain,
      start(chain, CHAIN_CHAPTER_ID),
      byConcept({ "M7.C4": [false], "M7.C3": [false], "M7.C2": [false], "M6.C1": [true, false] }),
    );
    expect(uncertainAtLimit.session.results["M6.C1"]).toMatchObject({
      depth: 3,
      status: "uncertain",
    });
    expect(uncertainAtLimit.session.results["M6.C0"]).toBeUndefined();
  });

  it("keeps a concept cleared when it has no second question to confirm with", () => {
    const pack: ContentPack = {
      ...fixture,
      questions: fixture.questions.filter((q) => q.conceptId !== "M6.TWO" || q.difficulty === 2),
    };
    const run = play(pack, start(pack, FIXTURE_CHAPTER_ID), allCorrect);
    expect(run.session.results["M6.TWO"]).toMatchObject({
      asked: 1,
      correct: 1,
      status: "cleared",
    });
    expect(readinessSummary(run.session, NOW).advancedEntry).toBe(true);
  });
});

describe("chapter phase and advancedEntry", () => {
  it("asks two difficulty-2 chapter questions when every target is cleared, then sets advancedEntry", () => {
    const run = play(fixture, start(fixture, FIXTURE_CHAPTER_ID), allCorrect);
    const chapterQuestions = run.asked.slice(3, 5);
    // First two chapter concepts in topo order: HEX before IOTA (IOTA depends on HEX).
    expect(chapterQuestions.map((q) => q.conceptId)).toEqual(["M8.HEX", "M8.IOTA"]);
    expect(chapterQuestions.every((q) => q.difficulty === 2)).toBe(true);
    expect(run.session.phase).toBe("done");
    const summary = readinessSummary(run.session, NOW);
    expect(summary.advancedEntry).toBe(true);
    expect(summary.itemsUsed).toBe(8);
    expect(summary.failed).toEqual([]);
    expect(summary.pending).toEqual([]);
    // Chapter concepts are not listed: only prerequisites are.
    expect(summary.cleared).not.toContain("M8.HEX");
  });

  it("fits the chapter questions into exactly 12 items with five targets", () => {
    const trimmed = ["M7.INT.PROPERTIES", "M7.SEQ.SETUP"];
    const run = play(spine, start(spine, SPINE_CHAPTER_ID, trimmed), allCorrect);
    const summary = readinessSummary(run.session, NOW);
    expect(summary.itemsUsed).toBe(12);
    expect(summary.cleared).toHaveLength(5);
    expect(summary.advancedEntry).toBe(true);
    expect(run.asked.slice(5, 7).map((q) => q.conceptId)).toEqual([
      "M8.LEQ.ONE_SIDE",
      "M8.LEQ.BOTH_SIDES",
    ]);
  });

  it("reaches advancedEntry with exactly 12 items for an untrimmed all-correct Class 6-8 run", () => {
    const session = start(spine, SPINE_CHAPTER_ID);
    const targets = session.queue.map((item) => item.conceptId);
    const run = play(spine, session, allCorrect);
    const summary = readinessSummary(run.session, NOW);
    expect(summary.itemsUsed).toBe(12);
    expect(summary.advancedEntry).toBe(true);
    expect(summary.cleared).toHaveLength(7);
    expect(summary.pending).toEqual([]);
    expect(summary.uncertain).toEqual([]);

    // 7 direct, then 2 chapter, then 3 confirm. The two right chapter answers back
    // transposing, both fraction targets and like terms, so the confirmations go to the three
    // targets the chapter questions do not depend on.
    const concepts = run.asked.map((q) => q.conceptId);
    const direct = concepts.slice(0, 7);
    expect(direct).toEqual(targets);
    expect(concepts.slice(7, 9)).toEqual(["M8.LEQ.ONE_SIDE", "M8.LEQ.BOTH_SIDES"]);
    const confirm = concepts.slice(9);
    expect(confirm).toEqual(["M6.FRAC.ADD_SUB_UNLIKE", "M7.INT.PROPERTIES", "M7.SEQ.SETUP"]);
    expect(run.session.phase).toBe("done");
  });

  it("confirms the prerequisites of the chapter questions first when both are wrong", () => {
    const run = play(
      spine,
      start(spine, SPINE_CHAPTER_ID),
      byConcept({ "M8.LEQ.ONE_SIDE": [false], "M8.LEQ.BOTH_SIDES": [false] }),
    );
    const concepts = run.asked.map((q) => q.conceptId);
    expect(concepts.slice(7, 9)).toEqual(["M8.LEQ.ONE_SIDE", "M8.LEQ.BOTH_SIDES"]);
    // Both chapter concepts sit on transposing and dividing fractions; multiplying fractions is
    // also below them but is backed by the right dividing-fractions answer.
    expect(concepts.slice(9)).toEqual(["M7.FRAC.DIV", "M7.SEQ.TRANSPOSE", "M7.FRAC.MUL"]);
    expect(readinessSummary(run.session, NOW).advancedEntry).toBe(false);
  });

  it("does not set advancedEntry when a chapter question is wrong", () => {
    const run = play(
      fixture,
      start(fixture, FIXTURE_CHAPTER_ID),
      byConcept({ "M8.IOTA": [false] }),
    );
    const summary = readinessSummary(run.session, NOW);
    expect(summary.advancedEntry).toBe(false);
    expect(summary.itemsUsed).toBe(8);
    expect(run.session.chapterCorrect).toBe(1);
  });

  it("skips the chapter phase if any target is failed", () => {
    for (const id of ["M7.GAMMA", "M7.DELTA"]) {
      const run = play(fixture, start(fixture, FIXTURE_CHAPTER_ID), byConcept({ [id]: [false] }));
      expect(run.asked.some((q) => q.conceptId.startsWith("M8"))).toBe(false);
      expect(readinessSummary(run.session, NOW).advancedEntry).toBe(false);
    }
  });

  it("asks the chapter questions before the confirm phase", () => {
    const run = play(fixture, start(fixture, FIXTURE_CHAPTER_ID), allCorrect);
    const concepts = run.asked.map((q) => q.conceptId);
    expect(concepts.slice(3, 5)).toEqual(["M8.HEX", "M8.IOTA"]);
    expect(concepts.slice(5)).toHaveLength(3);
    expect(concepts.slice(5).every((id) => !id.startsWith("M8"))).toBe(true);
  });

  it("goes straight to the chapter questions when the teacher trimmed every prerequisite", () => {
    const run = play(
      fixture,
      start(fixture, FIXTURE_CHAPTER_ID, ["M7.GAMMA", "M7.DELTA", "M6.TWO"]),
      allCorrect,
    );
    expect(run.asked.map((q) => q.conceptId)).toEqual(["M8.HEX", "M8.IOTA"]);
    expect(readinessSummary(run.session, NOW).advancedEntry).toBe(true);
  });

  it("does not run the chapter phase when under two items are left", () => {
    const session = { ...start(fixture, FIXTURE_CHAPTER_ID), budgetLeft: 4 };
    const run = play(fixture, session, allCorrect);
    // Three first questions leave one item: no chapter questions, one confirmation.
    expect(run.asked.some((q) => q.conceptId.startsWith("M8"))).toBe(false);
    expect(run.asked).toHaveLength(4);
    expect(run.session.budgetLeft).toBe(0);
    expect(readinessSummary(run.session, NOW).advancedEntry).toBe(false);
  });
});

describe("misconceptions", () => {
  it("counts misconception codes of wrong answers only", () => {
    const run = play(
      spine,
      start(spine, SPINE_CHAPTER_ID),
      byConcept({
        "M6.FRAC.ADD_SUB_UNLIKE": [false],
        "M7.ALG.LIKE_TERMS": [false],
        "M7.FRAC.MUL": [false],
      }),
    );
    const summary = readinessSummary(run.session, NOW);
    expect(summary.misconceptions["F-ADD-DENOM"]).toBe(1);
    expect(summary.misconceptions["A-UNLIKE-COMBINE"]).toBe(1);
    // M7.FRAC.MUL has no misconception code, so its wrong answer adds nothing.
    expect(Object.keys(summary.misconceptions).sort()).toEqual(["A-UNLIKE-COMBINE", "F-ADD-DENOM"]);
  });

  it("counts the code of a wrong second answer", () => {
    const trimmed = ["M7.SEQ.TRANSPOSE", "M7.FRAC.DIV", "M7.FRAC.MUL"];
    const run = play(
      spine,
      start(spine, SPINE_CHAPTER_ID, trimmed),
      byConcept({ "M7.ALG.LIKE_TERMS": [true, false] }),
    );
    const summary = readinessSummary(run.session, NOW);
    expect(summary.uncertain).toContain("M7.ALG.LIKE_TERMS");
    expect(summary.misconceptions).toEqual({ "A-UNLIKE-COMBINE": 1 });
  });

  it("accumulates the same code across concepts", () => {
    const sharedCode = Object.fromEntries(
      ["M7.FRAC.MUL", "M7.FRAC.DIV", "M6.FRAC.ADD_SUB_UNLIKE"].map((id) => [id, "F-ADD-DENOM"]),
    );
    const pack: ContentPack = {
      ...spine,
      questions: [
        ...spine.questions.filter((q) => !(q.conceptId in sharedCode)),
        ...questionsFor(Object.keys(sharedCode), sharedCode),
      ],
    };
    const run = play(
      pack,
      start(pack, SPINE_CHAPTER_ID),
      byConcept({ "M7.FRAC.DIV": [false], "M6.FRAC.ADD_SUB_UNLIKE": [false] }),
    );
    expect(readinessSummary(run.session, NOW).misconceptions).toEqual({ "F-ADD-DENOM": 2 });
  });
});

describe("budget and question uniqueness (random answer patterns)", () => {
  it("never exceeds 12 items, repeats a question or passes depth 3", () => {
    const packs: [ContentPack, string, string[]][] = [
      [spine, SPINE_CHAPTER_ID, []],
      [spine, SPINE_CHAPTER_ID, ["M7.SEQ.SETUP"]],
      [spine, SPINE_CHAPTER_ID, ["M7.INT.PROPERTIES", "M7.SEQ.SETUP", "M7.FRAC.MUL"]],
      [fixture, FIXTURE_CHAPTER_ID, []],
      [chain, CHAIN_CHAPTER_ID, []],
    ];
    let longest = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const [pack, chapterId, trimmed] = packs[seed % packs.length] as (typeof packs)[number];
      const pCorrect = (seed % 10) / 9; // 0 .. 1, covering all-wrong and all-correct
      const answers = mulberry32(seed * 7919);
      const run = play(
        pack,
        start(pack, chapterId, trimmed),
        () => ({ correct: answers() < pCorrect }),
        mulberry32(seed),
      );
      const ids = run.asked.map((q) => q.id);
      longest = Math.max(longest, ids.length);
      expect(ids.length).toBeLessThanOrEqual(READINESS_MAX_ITEMS);
      expect(new Set(ids).size).toBe(ids.length);
      expect(run.session.askedQuestionIds).toEqual(ids);
      expect(run.session.budgetLeft).toBe(READINESS_MAX_ITEMS - ids.length);
      expect(run.session.phase).toBe("done");
      for (const result of Object.values(run.session.results)) {
        expect(result.depth).toBeLessThanOrEqual(READINESS_MAX_DEPTH);
        expect(result.asked).toBeLessThanOrEqual(2);
      }
      const summary = readinessSummary(run.session, NOW);
      expect(summary.itemsUsed).toBe(ids.length);
      const listed = [
        ...summary.cleared,
        ...summary.failed,
        ...summary.uncertain,
        ...summary.pending,
      ];
      expect(new Set(listed).size).toBe(listed.length);
    }
    expect(longest).toBe(READINESS_MAX_ITEMS);
  });

  it("is deterministic for a given seed", () => {
    const answers = (seed: number): Answerer => {
      const rng = mulberry32(seed);
      return () => ({ correct: rng() < 0.6 });
    };
    const a = play(spine, start(spine, SPINE_CHAPTER_ID), answers(5), mulberry32(11));
    const b = play(spine, start(spine, SPINE_CHAPTER_ID), answers(5), mulberry32(11));
    expect(a.asked.map((q) => q.id)).toEqual(b.asked.map((q) => q.id));
    expect(a.session).toEqual(b.session);
  });
});

describe("readinessSummary", () => {
  it("reports statuses, items used, completedAt and pending concepts never reached", () => {
    const run = play(chain, start(chain, CHAIN_CHAPTER_ID), allCorrect);
    const summary = readinessSummary(run.session, NOW);
    expect(summary).toEqual({
      chapterId: CHAIN_CHAPTER_ID,
      cleared: ["M7.C4"],
      failed: [],
      uncertain: [],
      pending: [],
      itemsUsed: 2,
      advancedEntry: false,
      misconceptions: {},
      completedAt: NOW,
    });
  });

  it("lists targets the check never reached as pending", () => {
    const session = start(spine, SPINE_CHAPTER_ID);
    const summary = readinessSummary(session, NOW);
    expect(summary.pending).toHaveLength(7);
    expect(summary.itemsUsed).toBe(0);
    expect(summary.cleared).toEqual([]);
  });

  it("round-trips through a readiness_completed event and replay", () => {
    const run = play(fixture, start(fixture, FIXTURE_CHAPTER_ID), allCorrect);
    const summary = readinessSummary(run.session, NOW);
    const completed: StudentEvent = {
      id: "done",
      type: "readiness_completed",
      studentId: STUDENT,
      ts: at(60),
      chapterId: FIXTURE_CHAPTER_ID,
      summary,
    };
    const state = replay(fixture, [...run.attempts, completed], STUDENT);
    expect(state.readiness[FIXTURE_CHAPTER_ID]).toEqual(summary);
    expect(state.eventCount).toBe(run.attempts.length + 1);
    expect(state.mastery["M7.GAMMA"]?.attempts).toBe(2);
    expect(state.progress["M7.GAMMA"]?.clearedByReadiness).toBe(true);
  });
});

describe("Ravi (Decode submission 2.4)", () => {
  // Ravi picks 2/5 on 1/2 + 1/3 (F-ADD-DENOM), passes equivalent fractions, and gets the other
  // prerequisites right. No prerequisite is trimmed.
  const ravi = byConcept({ "M6.FRAC.ADD_SUB_UNLIKE": [false] });

  it("fails adding unlike fractions with F-ADD-DENOM and clears equivalent fractions", () => {
    const run = play(spine, start(spine, SPINE_CHAPTER_ID), ravi);
    const summary = readinessSummary(run.session, NOW);
    expect(summary.failed).toEqual(["M6.FRAC.ADD_SUB_UNLIKE"]);
    expect(summary.cleared).toContain("M6.FRAC.EQUIV");
    expect(summary.pending).toEqual([]);
    expect(summary.misconceptions).toEqual({ "F-ADD-DENOM": 1 });
    expect(summary.advancedEntry).toBe(false);
    expect(summary.itemsUsed).toBe(12);
    expect(run.session.results["M6.FRAC.EQUIV"]?.depth).toBe(1);
    // A failure skips the chapter phase.
    expect(run.asked.some((q) => q.conceptId.startsWith("M8"))).toBe(false);
  });

  it("feeds replay so the written attempts lower adding unlike fractions and raise equivalent fractions", () => {
    const run = play(spine, start(spine, SPINE_CHAPTER_ID), ravi);
    const state = replay(spine, run.attempts, STUDENT);
    expect(state.mastery["M6.FRAC.ADD_SUB_UNLIKE"]?.pKnown).toBeLessThan(0.3);
    expect(state.mastery["M6.FRAC.EQUIV"]?.pKnown).toBeGreaterThan(
      state.mastery["M6.FRAC.ADD_SUB_UNLIKE"]?.pKnown ?? 1,
    );
    expect(state.progress["M6.FRAC.ADD_SUB_UNLIKE"]?.lastMisconception).toBe("F-ADD-DENOM");
  });
});
