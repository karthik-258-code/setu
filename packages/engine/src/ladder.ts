import { priorFromPrerequisites, paramsFor } from "./bkt";
import { LEARN_SKIP_THRESHOLD } from "./types";
import type {
  AttemptEvent,
  ChapterId,
  ConceptId,
  ConceptProgress,
  ContentPack,
  Difficulty,
  StudentState,
} from "./types";

/** Consecutive correct (or wrong) answers needed to move the ladder (ARCHITECTURE 5.4). */
const STREAK_TO_MOVE = 2;

export type LadderMove = "up" | "down" | "hold";

/**
 * Decides the ladder move after an attempt. `progress` must already include `lastAttempt`
 * in its streaks. A misconception or a wrong streak means down, even at difficulty 1, so the
 * caller can still send the student back to a targeted worked example. Up needs a correct
 * streak and no hints on the last attempt (progress does not keep the earlier attempts' hints).
 */
export function ladderMove(progress: ConceptProgress, lastAttempt: AttemptEvent): LadderMove {
  if (lastAttempt.misconceptionCode !== undefined || progress.streakWrong >= STREAK_TO_MOVE) {
    return "down";
  }
  if (
    lastAttempt.correct &&
    lastAttempt.hintsUsed === 0 &&
    progress.streakCorrect >= STREAK_TO_MOVE
  ) {
    return "up";
  }
  return "hold";
}

/** The difficulty after `lastAttempt`: one up (max 3), one down (min 1), or unchanged. */
export function nextDifficulty(progress: ConceptProgress, lastAttempt: AttemptEvent): Difficulty {
  const move = ladderMove(progress, lastAttempt);
  if (move === "up") return Math.min(3, progress.difficulty + 1) as Difficulty;
  if (move === "down") return Math.max(1, progress.difficulty - 1) as Difficulty;
  return progress.difficulty;
}

/**
 * Difficulty of the first question on a concept: 2 if readiness cleared it, the model already
 * knows it (`pKnown >= LEARN_SKIP_THRESHOLD`, using the prerequisite-seeded prior if untouched)
 * or the chapter's readiness summary has `advancedEntry`; otherwise 1.
 */
export function startingDifficulty(
  state: StudentState,
  pack: ContentPack,
  chapterId: ChapterId,
  conceptId: ConceptId,
): Difficulty {
  const concept = pack.graph.concepts[conceptId];
  if (!concept) throw new Error(`Unknown concept id: ${conceptId}`);
  const pKnown =
    state.mastery[conceptId]?.pKnown ??
    priorFromPrerequisites(pack.graph, conceptId, state.mastery, paramsFor(concept));
  const skip =
    state.progress[conceptId]?.clearedByReadiness === true ||
    pKnown >= LEARN_SKIP_THRESHOLD ||
    state.readiness[chapterId]?.advancedEntry === true;
  return skip ? 2 : 1;
}
