import { describe, expect, it } from "vitest";
import { initialState, ladderMove, nextDifficulty, startingDifficulty } from "../src/index";
import type { AttemptEvent, ConceptProgress, ReadinessSummary, StudentState } from "../src/index";
import { FIXTURE_CHAPTER_ID, at, attempt, fixturePack } from "./fixtures/pack";

const pack = fixturePack();
const CONCEPT = "M7.ALPHA";

function progress(overrides: Partial<ConceptProgress> = {}): ConceptProgress {
  return {
    conceptId: CONCEPT,
    difficulty: 2,
    streakCorrect: 0,
    streakWrong: 0,
    solveAttempts: 0,
    testAttempts: 0,
    learnViewed: false,
    clearedByReadiness: false,
    seenQuestionIds: [],
    ...overrides,
  };
}

function last(overrides: Partial<AttemptEvent> = {}): AttemptEvent {
  return attempt("a1", CONCEPT, overrides);
}

describe("nextDifficulty", () => {
  it("goes up one after two consecutive correct answers without hints", () => {
    expect(nextDifficulty(progress({ streakCorrect: 2 }), last())).toBe(3);
    expect(nextDifficulty(progress({ difficulty: 1, streakCorrect: 2 }), last())).toBe(2);
  });

  it("stays after a single correct answer", () => {
    expect(nextDifficulty(progress({ streakCorrect: 1 }), last())).toBe(2);
  });

  it("does not go up when the last correct answer used a hint", () => {
    expect(nextDifficulty(progress({ streakCorrect: 2 }), last({ hintsUsed: 1 }))).toBe(2);
  });

  it("never goes above 3", () => {
    expect(nextDifficulty(progress({ difficulty: 3, streakCorrect: 4 }), last())).toBe(3);
  });

  it("goes down one after two consecutive wrong answers", () => {
    const wrong = last({ correct: false });
    expect(nextDifficulty(progress({ streakWrong: 2 }), wrong)).toBe(1);
    expect(nextDifficulty(progress({ streakWrong: 1 }), wrong)).toBe(2);
  });

  it("goes down after any attempt with a misconception code", () => {
    const wrong = last({ correct: false, misconceptionCode: "F-ADD-DENOM" });
    expect(nextDifficulty(progress({ streakWrong: 1 }), wrong)).toBe(1);
    expect(nextDifficulty(progress({ difficulty: 3, streakWrong: 1 }), wrong)).toBe(2);
  });

  it("never goes below 1", () => {
    const wrong = last({ correct: false, misconceptionCode: "F-ADD-DENOM" });
    expect(nextDifficulty(progress({ difficulty: 1, streakWrong: 3 }), wrong)).toBe(1);
  });

  it("prefers down over up when a misconception arrives on a long correct streak", () => {
    const attemptWithCode = last({ misconceptionCode: "F-ADD-DENOM" });
    expect(nextDifficulty(progress({ streakCorrect: 2 }), attemptWithCode)).toBe(1);
  });
});

describe("ladderMove", () => {
  it("reports a down move even when difficulty is already 1", () => {
    const wrong = last({ correct: false, misconceptionCode: "F-ADD-DENOM" });
    expect(ladderMove(progress({ difficulty: 1 }), wrong)).toBe("down");
  });

  it("reports up and hold", () => {
    expect(ladderMove(progress({ streakCorrect: 2 }), last())).toBe("up");
    expect(ladderMove(progress({ streakCorrect: 1 }), last())).toBe("hold");
  });
});

describe("startingDifficulty", () => {
  function summary(advancedEntry: boolean): ReadinessSummary {
    return {
      chapterId: FIXTURE_CHAPTER_ID,
      cleared: [],
      failed: [],
      uncertain: [],
      pending: [],
      itemsUsed: 5,
      advancedEntry,
      misconceptions: {},
      completedAt: at(0),
    };
  }

  function stateWith(overrides: Partial<StudentState>): StudentState {
    return { ...initialState("stu-1"), ...overrides };
  }

  it("is 1 for an untouched concept with no signals", () => {
    expect(startingDifficulty(initialState("stu-1"), pack, FIXTURE_CHAPTER_ID, CONCEPT)).toBe(1);
  });

  it("is 2 when readiness cleared the concept", () => {
    const state = stateWith({ progress: { [CONCEPT]: progress({ clearedByReadiness: true }) } });
    expect(startingDifficulty(state, pack, FIXTURE_CHAPTER_ID, CONCEPT)).toBe(2);
  });

  it("is 2 when pKnown is at the learn-skip threshold, 1 just below", () => {
    const mastery = (pKnown: number) => ({
      [CONCEPT]: { conceptId: CONCEPT, pKnown, attempts: 1, correct: 1, source: "model" as const },
    });
    expect(
      startingDifficulty(stateWith({ mastery: mastery(0.7) }), pack, FIXTURE_CHAPTER_ID, CONCEPT),
    ).toBe(2);
    expect(
      startingDifficulty(stateWith({ mastery: mastery(0.69) }), pack, FIXTURE_CHAPTER_ID, CONCEPT),
    ).toBe(1);
  });

  it("is 2 when the chapter's readiness summary has advancedEntry", () => {
    const yes = stateWith({ readiness: { [FIXTURE_CHAPTER_ID]: summary(true) } });
    const no = stateWith({ readiness: { [FIXTURE_CHAPTER_ID]: summary(false) } });
    expect(startingDifficulty(yes, pack, FIXTURE_CHAPTER_ID, CONCEPT)).toBe(2);
    expect(startingDifficulty(no, pack, FIXTURE_CHAPTER_ID, CONCEPT)).toBe(1);
  });

  it("ignores advancedEntry of another chapter", () => {
    const state = stateWith({
      readiness: { "CH.OTHER": { ...summary(true), chapterId: "CH.OTHER" } },
    });
    expect(startingDifficulty(state, pack, FIXTURE_CHAPTER_ID, CONCEPT)).toBe(1);
  });

  it("throws for an unknown concept id", () => {
    expect(() =>
      startingDifficulty(initialState("stu-1"), pack, FIXTURE_CHAPTER_ID, "NOPE"),
    ).toThrow("Unknown concept id: NOPE");
  });
});
