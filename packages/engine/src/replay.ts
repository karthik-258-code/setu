import { bktUpdate, paramsFor, priorFromPrerequisites } from "./bkt";
import { ladderMove, nextDifficulty, startingDifficulty } from "./ladder";
import { MASTERY_THRESHOLD, RECENT_ATTEMPTS_KEPT, TEST_QUESTIONS } from "./types";
import type {
  AssignEvent,
  AttemptEvent,
  ConceptId,
  ConceptProgress,
  ContentPack,
  Difficulty,
  MarkTaughtEvent,
  MasteryState,
  Mode,
  ReadinessCompletedEvent,
  Recheck,
  StudentEvent,
  StudentId,
  StudentState,
  TeacherOverrideEvent,
} from "./types";

/** pKnown a teacher override of "mastered" is set to (ARCHITECTURE 5.4). */
const OVERRIDE_MASTERED_PKNOWN = 0.9;
/** Upper bound for pKnown after a teacher override of "not mastered". */
const OVERRIDE_NOT_MASTERED_CEILING = 0.3;
/** Modes in which crossing the mastery threshold sets `masteredAt` (ARCHITECTURE 5.2). */
const MASTERY_MODES: readonly Mode[] = ["test", "recheck", "verify"];
/** Modes whose attempts move the difficulty ladder (ARCHITECTURE 5.4). */
const LADDER_MODES: readonly Mode[] = ["solve", "extension"];

/** The state of a student with no events. */
export function initialState(studentId: StudentId): StudentState {
  return {
    studentId,
    mastery: {},
    progress: {},
    readiness: {},
    rechecks: [],
    assigned: [],
    extensionLocked: false,
    recentAttempts: [],
    eventCount: 0,
  };
}

function requireConceptId(pack: ContentPack, id: ConceptId): void {
  if (!(id in pack.graph.concepts)) throw new Error(`Unknown concept id: ${id}`);
}

/** Progress for a concept the student has not touched yet, at its starting difficulty. */
function newProgress(
  pack: ContentPack,
  state: StudentState,
  conceptId: ConceptId,
): ConceptProgress {
  return {
    conceptId,
    difficulty: startingDifficulty(state, pack, pack.chapterId, conceptId),
    streakCorrect: 0,
    streakWrong: 0,
    solveAttempts: 0,
    testAttempts: 0,
    learnViewed: false,
    clearedByReadiness: false,
    seenQuestionIds: [],
  };
}

/** The model's current estimate: the stored pKnown, or the prerequisite-seeded prior if untouched. */
function currentPKnown(pack: ContentPack, state: StudentState, conceptId: ConceptId): number {
  const existing = state.mastery[conceptId];
  if (existing) return existing.pKnown;
  const concept = pack.graph.concepts[conceptId];
  if (!concept) throw new Error(`Unknown concept id: ${conceptId}`);
  return priorFromPrerequisites(pack.graph, conceptId, state.mastery, paramsFor(concept));
}

function emptyMastery(conceptId: ConceptId, pKnown: number): MasteryState {
  return { conceptId, pKnown, attempts: 0, correct: 0, source: "model" };
}

/** Replaces any recheck with the same concept and kind, so repeated events do not stack. */
function withRecheck(rechecks: readonly Recheck[], recheck: Recheck): Recheck[] {
  return [
    ...rechecks.filter((r) => !(r.conceptId === recheck.conceptId && r.kind === recheck.kind)),
    recheck,
  ];
}

function applyAttempt(pack: ContentPack, state: StudentState, event: AttemptEvent): StudentState {
  const concept = pack.graph.concepts[event.conceptId];
  if (!concept) throw new Error(`Unknown concept id: ${event.conceptId}`);
  const params = paramsFor(concept);

  const before = state.mastery[event.conceptId];
  const prior =
    before?.pKnown ?? priorFromPrerequisites(pack.graph, event.conceptId, state.mastery, params);
  const pKnown = bktUpdate(prior, event.correct, params);

  const mastery: MasteryState = {
    ...(before ?? emptyMastery(event.conceptId, prior)),
    pKnown,
    attempts: (before?.attempts ?? 0) + 1,
    correct: (before?.correct ?? 0) + (event.correct ? 1 : 0),
    lastAttemptAt: event.ts,
  };
  if (event.correct) mastery.lastCorrectAt = event.ts;
  if (
    mastery.masteredAt === undefined &&
    MASTERY_MODES.includes(event.mode) &&
    pKnown >= MASTERY_THRESHOLD
  ) {
    mastery.masteredAt = event.ts;
  }

  const old = state.progress[event.conceptId] ?? newProgress(pack, state, event.conceptId);
  let progress: ConceptProgress = {
    ...old,
    streakCorrect: event.correct ? old.streakCorrect + 1 : 0,
    streakWrong: event.correct ? 0 : old.streakWrong + 1,
    solveAttempts: old.solveAttempts + (event.mode === "solve" ? 1 : 0),
    testAttempts: old.testAttempts + (event.mode === "test" ? 1 : 0),
    seenQuestionIds: old.seenQuestionIds.includes(event.questionId)
      ? old.seenQuestionIds
      : [...old.seenQuestionIds, event.questionId],
  };
  if (event.misconceptionCode !== undefined) progress.lastMisconception = event.misconceptionCode;

  if (LADDER_MODES.includes(event.mode)) {
    const move = ladderMove(progress, event);
    progress = { ...progress, difficulty: nextDifficulty(progress, event) };
    if (move === "down") {
      // A down-move shows a targeted worked example next (R5) and counts streaks afresh.
      progress = { ...progress, learnViewed: false, streakCorrect: 0, streakWrong: 0 };
    }
  } else if (event.mode === "test" && progress.testAttempts >= TEST_QUESTIONS) {
    // End of a test round: mastered starts a new round count; otherwise back to solve, one easier.
    progress =
      mastery.pKnown >= MASTERY_THRESHOLD
        ? { ...progress, testAttempts: 0 }
        : {
            ...progress,
            difficulty: Math.max(1, progress.difficulty - 1) as Difficulty,
            solveAttempts: 0,
            testAttempts: 0,
          };
  }

  return {
    ...state,
    mastery: { ...state.mastery, [event.conceptId]: mastery },
    progress: { ...state.progress, [event.conceptId]: progress },
    recentAttempts: [...state.recentAttempts, event].slice(-RECENT_ATTEMPTS_KEPT),
  };
}

function applyReadiness(
  pack: ContentPack,
  state: StudentState,
  event: ReadinessCompletedEvent,
): StudentState {
  const { summary } = event;
  if (!(event.chapterId in pack.graph.chapters)) {
    throw new Error(`Unknown chapter id: ${event.chapterId}`);
  }
  for (const id of [
    ...summary.cleared,
    ...summary.failed,
    ...summary.uncertain,
    ...summary.pending,
  ]) {
    requireConceptId(pack, id);
  }

  const progress = { ...state.progress };
  for (const id of summary.cleared) {
    progress[id] = {
      ...(progress[id] ?? newProgress(pack, state, id)),
      clearedByReadiness: true,
    };
  }
  const next: StudentState = {
    ...state,
    progress,
    readiness: { ...state.readiness, [event.chapterId]: summary },
  };
  // Readiness answers create progress before the summary exists. Now that the cleared flags and
  // `advancedEntry` are known, concepts that have not started solving get their starting difficulty.
  const chapter = pack.graph.chapters[event.chapterId];
  const ids = new Set([...summary.cleared, ...(chapter?.conceptIds ?? [])]);
  for (const id of ids) {
    const p = next.progress[id];
    if (p && p.solveAttempts === 0 && p.testAttempts === 0) {
      next.progress = {
        ...next.progress,
        [id]: { ...p, difficulty: startingDifficulty(next, pack, event.chapterId, id) },
      };
    }
  }
  return next;
}

function applyOverride(
  pack: ContentPack,
  state: StudentState,
  event: TeacherOverrideEvent,
): StudentState {
  const id = event.conceptId;
  const before = state.mastery[id];
  const estimate = currentPKnown(pack, state, id);
  const base = before ?? emptyMastery(id, estimate);

  if (event.mastered) {
    // A second override keeps the first model estimate; the 0.9 in between is not a model value.
    const modelPKnown = base.pendingVerification ? (base.modelPKnown ?? estimate) : estimate;
    const mastery: MasteryState = {
      ...base,
      pKnown: OVERRIDE_MASTERED_PKNOWN,
      source: "teacher_override",
      pendingVerification: true,
      modelPKnown,
    };
    return {
      ...state,
      mastery: { ...state.mastery, [id]: mastery },
      rechecks: withRecheck(state.rechecks, {
        conceptId: id,
        dueAt: event.ts,
        intervalDays: 0,
        kind: "verify_override",
      }),
    };
  }

  // Not mastered: the artificial 0.9 of a pending override is ignored in favour of the model value.
  const reference = base.pendingVerification ? (base.modelPKnown ?? estimate) : estimate;
  const mastery: MasteryState = {
    ...base,
    pKnown: Math.min(reference, OVERRIDE_NOT_MASTERED_CEILING),
    source: "teacher_override",
  };
  delete mastery.masteredAt;
  delete mastery.pendingVerification;
  delete mastery.modelPKnown;
  return {
    ...state,
    mastery: { ...state.mastery, [id]: mastery },
    rechecks: state.rechecks.filter((r) => !(r.conceptId === id && r.kind === "verify_override")),
  };
}

function applyMarkTaught(state: StudentState, event: MarkTaughtEvent): StudentState {
  return {
    ...state,
    rechecks: withRecheck(state.rechecks, {
      conceptId: event.conceptId,
      dueAt: event.ts,
      intervalDays: 0,
      kind: "after_taught",
    }),
  };
}

function applyAssign(state: StudentState, event: AssignEvent): StudentState {
  const existing = state.assigned.find((a) => a.conceptId === event.conceptId);
  if (!existing) {
    const entry: StudentState["assigned"][number] = { conceptId: event.conceptId };
    if (event.questionIds) entry.questionIds = [...new Set(event.questionIds)];
    return { ...state, assigned: [...state.assigned, entry] };
  }
  if (!event.questionIds) return state;
  const merged = [...new Set([...(existing.questionIds ?? []), ...event.questionIds])];
  return {
    ...state,
    assigned: state.assigned.map((a) =>
      a.conceptId === event.conceptId ? { ...a, questionIds: merged } : a,
    ),
  };
}

function applyBody(pack: ContentPack, state: StudentState, event: StudentEvent): StudentState {
  switch (event.type) {
    case "attempt":
      return applyAttempt(pack, state, event);
    case "learn_viewed": {
      requireConceptId(pack, event.conceptId);
      const old = state.progress[event.conceptId] ?? newProgress(pack, state, event.conceptId);
      return {
        ...state,
        progress: { ...state.progress, [event.conceptId]: { ...old, learnViewed: true } },
      };
    }
    case "readiness_completed":
      return applyReadiness(pack, state, event);
    case "teacher_override":
      requireConceptId(pack, event.conceptId);
      return applyOverride(pack, state, event);
    case "mark_taught":
      requireConceptId(pack, event.conceptId);
      return applyMarkTaught(state, event);
    case "assign":
      requireConceptId(pack, event.conceptId);
      return applyAssign(state, event);
    case "extension_lock":
      return { ...state, extensionLocked: event.locked };
    case "group_edit":
      return state;
  }
}

/**
 * Applies one event and returns a new state; the inputs are never mutated. Throws on an
 * unknown concept or chapter id, or on an event that belongs to another student.
 */
export function applyEvent(
  pack: ContentPack,
  state: StudentState,
  event: StudentEvent,
): StudentState {
  if (event.studentId !== state.studentId) {
    throw new Error(
      `Event ${event.id} belongs to student ${event.studentId}, not ${state.studentId}`,
    );
  }
  const next = applyBody(pack, state, event);
  const stamped: StudentState = {
    ...next,
    eventCount: state.eventCount + 1,
    lastEventTs: event.ts,
  };
  if (event.sessionId !== undefined) stamped.lastSessionId = event.sessionId;
  return stamped;
}

function compareEvents(a: StudentEvent, b: StudentEvent): number {
  const ta = Date.parse(a.ts);
  const tb = Date.parse(b.ts);
  if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
  if (!(Number.isFinite(ta) && Number.isFinite(tb)) && a.ts !== b.ts) return a.ts < b.ts ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Folds a student's events into a `StudentState`. Events of other students are ignored;
 * the rest are sorted by `ts` (as instants), then `id`, so the input order does not matter.
 */
export function replay(
  pack: ContentPack,
  events: readonly StudentEvent[],
  studentId: StudentId,
): StudentState {
  return events
    .filter((e) => e.studentId === studentId)
    .sort(compareEvents)
    .reduce((state, event) => applyEvent(pack, state, event), initialState(studentId));
}
