import { priorFromPrerequisites, paramsFor } from "./bkt";
import { ancestors, frontier } from "./graph";
import type { MasteryView } from "./graph";
import { startingDifficulty } from "./ladder";
import { selectQuestions } from "./selectQuestions";
import {
  LEARN_SKIP_THRESHOLD,
  MASTERY_THRESHOLD,
  SOLVE_ATTEMPTS_BEFORE_TEST,
  TEST_QUESTIONS,
  TEST_READY_THRESHOLD,
} from "./types";
import type {
  ConceptId,
  ConceptProgress,
  Difficulty,
  MisconceptionCode,
  PolicyContext,
  Question,
  QuestionId,
  Recheck,
  Recommendation,
  Resource,
} from "./types";

/** Difficulty of the questions in a verify-override re-check (ARCHITECTURE 5.4, R1). */
const VERIFY_DIFFICULTY: Difficulty = 2;
/** Questions in a re-check (R1, R2). */
const RECHECK_QUESTIONS = 3;
/** Difficulty and size of an extension set (R8). */
const EXTENSION_DIFFICULTY: Difficulty = 3;
const EXTENSION_QUESTIONS = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isDue(recheck: Recheck, now: string): boolean {
  return Date.parse(recheck.dueAt) <= Date.parse(now);
}

/** Due re-checks of the given kinds, earliest due first, then by concept id. */
function dueRechecks(ctx: PolicyContext, kinds: readonly Recheck["kind"][]): Recheck[] {
  return ctx.state.rechecks
    .filter((r) => kinds.includes(r.kind) && isDue(r, ctx.now))
    .sort(
      (a, b) =>
        Date.parse(a.dueAt) - Date.parse(b.dueAt) ||
        (a.conceptId < b.conceptId ? -1 : a.conceptId > b.conceptId ? 1 : 0),
    );
}

function seenIds(ctx: PolicyContext, conceptId: ConceptId): readonly QuestionId[] {
  return ctx.state.progress[conceptId]?.seenQuestionIds ?? [];
}

/** The real model estimate: stored pKnown, or the prerequisite-seeded prior if untouched. */
function pKnownOf(ctx: PolicyContext, conceptId: ConceptId): number {
  const stored = ctx.state.mastery[conceptId];
  if (stored) return stored.pKnown;
  const concept = ctx.pack.graph.concepts[conceptId];
  if (!concept) throw new Error(`Unknown concept id: ${conceptId}`);
  return priorFromPrerequisites(ctx.pack.graph, conceptId, ctx.state.mastery, paramsFor(concept));
}

function isMastered(ctx: PolicyContext, conceptId: ConceptId): boolean {
  return (ctx.state.mastery[conceptId]?.pKnown ?? 0) >= MASTERY_THRESHOLD;
}

/**
 * Mastery as the frontier sees it. A concept the readiness check cleared is treated as mastered,
 * and so are all its ancestors, because the check stops descending on one correct answer
 * (ARCHITECTURE 5.3). Without this, untouched Class 6 roots would always sit on the frontier.
 * Real evidence wins: a concept attempted after the check finished, or marked not mastered by
 * the teacher, keeps its own estimate.
 */
function frontierMastery(ctx: PolicyContext): MasteryView {
  const view: Record<ConceptId, { pKnown: number }> = {};
  for (const [id, m] of Object.entries(ctx.state.mastery)) view[id] = { pKnown: m.pKnown };

  const summary = ctx.state.readiness[ctx.chapterId];
  if (!summary) return view;
  const completedAt = Date.parse(summary.completedAt);
  const doubtful = new Set([...summary.failed, ...summary.uncertain]);
  const implied = new Set<ConceptId>();
  for (const id of summary.cleared) {
    implied.add(id);
    for (const a of ancestors(ctx.pack.graph, id)) implied.add(a);
  }
  for (const id of implied) {
    if (doubtful.has(id)) continue;
    const m = ctx.state.mastery[id];
    if (m) {
      if (m.source === "teacher_override" && m.pendingVerification !== true) continue;
      if (m.lastAttemptAt !== undefined && Date.parse(m.lastAttemptAt) > completedAt) continue;
    }
    view[id] = { pKnown: Math.max(m?.pKnown ?? 0, MASTERY_THRESHOLD) };
  }
  return view;
}

/**
 * Up to `n` questions of a concept at `difficulty`. Questions the teacher assigned and the
 * student has not seen come first; the rest are filled by `selectQuestions`.
 */
function pickQuestions(
  ctx: PolicyContext,
  conceptId: ConceptId,
  difficulty: Difficulty,
  n: number,
  preferred: readonly QuestionId[] = [],
): Question[] {
  const seen = seenIds(ctx, conceptId);
  const wanted = new Set(preferred.filter((id) => !seen.includes(id)));
  let chosen: Question[] = [];
  if (wanted.size > 0) {
    const restricted = {
      ...ctx.pack,
      questions: ctx.pack.questions.filter((q) => wanted.has(q.id) && q.conceptId === conceptId),
    };
    chosen = selectQuestions(restricted, conceptId, difficulty, seen, n, ctx.rng);
  }
  if (chosen.length >= n) return chosen;
  const have = new Set(chosen.map((q) => q.id));
  const rest = selectQuestions(
    ctx.pack,
    conceptId,
    difficulty,
    [...seen, ...have],
    n + have.size,
    ctx.rng,
  )
    .filter((q) => !have.has(q.id))
    .slice(0, n - chosen.length);
  return [...chosen, ...rest];
}

function recommendation(
  ctx: PolicyContext,
  ruleId: string,
  mode: Recommendation["mode"],
  reasonParams: Recommendation["reasonParams"],
  rest: Partial<Recommendation> = {},
): Recommendation {
  return {
    studentId: ctx.state.studentId,
    chapterId: ctx.chapterId,
    mode,
    ...rest,
    ruleId,
    reasonParams: { chapterId: ctx.chapterId, ...reasonParams },
  };
}

function ids(questions: readonly Question[]): QuestionId[] {
  return questions.map((q) => q.id);
}

// ---------------------------------------------------------------------------
// R1, R2: re-checks
// ---------------------------------------------------------------------------

function recheckRecommendation(
  ctx: PolicyContext,
  ruleId: string,
  mode: "verify" | "recheck",
  candidates: readonly Recheck[],
  difficultyFor: (conceptId: ConceptId) => Difficulty,
): Recommendation | null {
  for (const recheck of candidates) {
    const difficulty = difficultyFor(recheck.conceptId);
    const questions = pickQuestions(ctx, recheck.conceptId, difficulty, RECHECK_QUESTIONS);
    if (questions.length === 0) continue; // nothing to ask: fall through
    return recommendation(
      ctx,
      ruleId,
      mode,
      { conceptId: recheck.conceptId, difficulty, count: questions.length },
      {
        conceptId: recheck.conceptId,
        difficulty,
        questionIds: ids(questions),
        recheckKind: recheck.kind,
      },
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// R5: learn resource
// ---------------------------------------------------------------------------

/** Most recent misconception code in `recentAttempts` on one of `conceptIds`. */
function recentMisconception(
  ctx: PolicyContext,
  conceptIds: ReadonlySet<ConceptId>,
): MisconceptionCode | undefined {
  const attempts = ctx.state.recentAttempts;
  for (let i = attempts.length - 1; i >= 0; i--) {
    const a = attempts[i];
    if (a && a.misconceptionCode !== undefined && conceptIds.has(a.conceptId)) {
      return a.misconceptionCode;
    }
  }
  return undefined;
}

function workedExampleFor(
  ctx: PolicyContext,
  conceptId: ConceptId,
  code: MisconceptionCode,
): Resource | undefined {
  const matches = ctx.pack.resources.filter(
    (r) => r.type === "worked_example" && r.targetsMisconception === code,
  );
  return matches.find((r) => r.conceptId === conceptId) ?? matches[0];
}

/** The Learn resource for a concept and the misconception it targets, if any. */
function learnResource(
  ctx: PolicyContext,
  conceptId: ConceptId,
  progress: ConceptProgress | undefined,
): { resource: Resource; misconceptionCode?: MisconceptionCode } | undefined {
  const own = progress?.lastMisconception;
  if (own !== undefined) {
    const resource = workedExampleFor(ctx, conceptId, own);
    if (resource) return { resource, misconceptionCode: own };
  }
  const upstream = recentMisconception(ctx, new Set(ancestors(ctx.pack.graph, conceptId)));
  if (upstream !== undefined) {
    const resource = workedExampleFor(ctx, conceptId, upstream);
    if (resource) return { resource, misconceptionCode: upstream };
  }
  const explanation = ctx.pack.resources.find(
    (r) => r.type === "explanation" && r.conceptId === conceptId,
  );
  return explanation ? { resource: explanation } : undefined;
}

// ---------------------------------------------------------------------------
// R5 to R7 for a chosen concept
// ---------------------------------------------------------------------------

function forConcept(
  ctx: PolicyContext,
  conceptId: ConceptId,
  preferred: readonly QuestionId[] | undefined,
  assigned: boolean,
): Recommendation | null {
  const progress = ctx.state.progress[conceptId];
  const pKnown = pKnownOf(ctx, conceptId);
  const base: Recommendation["reasonParams"] = {
    conceptId,
    ...(assigned ? { assigned: 1 } : {}),
  };

  // R5_LEARN. A chapter concept of an `advancedEntry` student counts as cleared by readiness
  // until the student starts solving it (a later down-move resets `learnViewed` on purpose).
  const advancedSkip =
    ctx.state.readiness[ctx.chapterId]?.advancedEntry === true &&
    (ctx.pack.graph.chapters[ctx.chapterId]?.conceptIds.includes(conceptId) ?? false) &&
    (progress?.solveAttempts ?? 0) === 0 &&
    (progress?.testAttempts ?? 0) === 0;
  if (
    !(progress?.learnViewed ?? false) &&
    pKnown < LEARN_SKIP_THRESHOLD &&
    !(progress?.clearedByReadiness ?? false) &&
    !advancedSkip
  ) {
    const found = learnResource(ctx, conceptId, progress);
    if (found) {
      return recommendation(
        ctx,
        "R5_LEARN",
        "learn",
        {
          ...base,
          ...(found.misconceptionCode !== undefined
            ? { misconceptionCode: found.misconceptionCode }
            : {}),
        },
        { conceptId, resourceId: found.resource.id },
      );
    }
  }

  const difficulty: Difficulty =
    progress?.difficulty ?? startingDifficulty(ctx.state, ctx.pack, ctx.chapterId, conceptId);

  // R6_TEST
  if (
    progress !== undefined &&
    progress.solveAttempts >= SOLVE_ATTEMPTS_BEFORE_TEST &&
    pKnown >= TEST_READY_THRESHOLD &&
    !isMastered(ctx, conceptId)
  ) {
    const questions = pickQuestions(ctx, conceptId, difficulty, TEST_QUESTIONS, preferred);
    if (questions.length > 0) {
      return recommendation(
        ctx,
        "R6_TEST",
        "test",
        { ...base, difficulty, solveAttempts: progress.solveAttempts, count: questions.length },
        { conceptId, difficulty, questionIds: ids(questions) },
      );
    }
  }

  // R7_SOLVE
  const questions = pickQuestions(ctx, conceptId, difficulty, 1, preferred);
  if (questions.length > 0) {
    return recommendation(
      ctx,
      "R7_SOLVE",
      "solve",
      { ...base, difficulty },
      { conceptId, difficulty, questionIds: ids(questions) },
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// R8: extension
// ---------------------------------------------------------------------------

function extension(
  ctx: PolicyContext,
  chapterConceptIds: readonly ConceptId[],
): Recommendation | null {
  if (ctx.state.extensionLocked) return null;
  if (!chapterConceptIds.every((id) => isMastered(ctx, id))) return null;

  const unseen: Question[] = [];
  const seenQuestions: Question[] = [];
  for (const id of chapterConceptIds) {
    const seen = new Set(seenIds(ctx, id));
    const found = selectQuestions(
      ctx.pack,
      id,
      EXTENSION_DIFFICULTY,
      seenIds(ctx, id),
      EXTENSION_QUESTIONS,
      ctx.rng,
      { tag: "extension" },
    ).filter((q) => q.difficulty === EXTENSION_DIFFICULTY);
    for (const q of found) (seen.has(q.id) ? seenQuestions : unseen).push(q);
  }
  const questions = [...unseen, ...seenQuestions].slice(0, EXTENSION_QUESTIONS);
  const first = questions[0];
  if (!first) return null;
  return recommendation(
    ctx,
    "R8_EXTENSION",
    "extension",
    { conceptId: first.conceptId, difficulty: EXTENSION_DIFFICULTY, count: questions.length },
    {
      conceptId: first.conceptId,
      difficulty: EXTENSION_DIFFICULTY,
      questionIds: ids(questions),
    },
  );
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * The next thing a student should do (ARCHITECTURE 5.4). Rules are tried in order and the first
 * that fires wins; a rule that cannot produce questions or a resource falls through to the next.
 * R3 and R4 only choose the concept for R5 to R7, so the returned `ruleId` is the R5, R6 or R7
 * rule that fired. `reasonParams` hold ids and numbers only; the UI turns them into text.
 */
export function nextRecommendation(ctx: PolicyContext): Recommendation {
  const chapter = ctx.pack.graph.chapters[ctx.chapterId];
  if (!chapter) throw new Error(`Unknown chapter id: ${ctx.chapterId}`);
  const { state } = ctx;

  // R0_READINESS
  if (!state.readiness[ctx.chapterId]) return recommendation(ctx, "R0_READINESS", "readiness", {});

  // R1_VERIFY_OVERRIDE
  const verify = recheckRecommendation(
    ctx,
    "R1_VERIFY_OVERRIDE",
    "verify",
    dueRechecks(ctx, ["verify_override"]),
    () => VERIFY_DIFFICULTY,
  );
  if (verify) return verify;

  // R2_RECHECK_DUE (at most one per session)
  const recheckedThisSession = state.recentAttempts.some(
    (a) => a.mode === "recheck" && a.sessionId === ctx.sessionId,
  );
  if (!recheckedThisSession) {
    const recheck = recheckRecommendation(
      ctx,
      "R2_RECHECK_DUE",
      "recheck",
      dueRechecks(ctx, ["spaced", "after_taught"]),
      (id) =>
        state.progress[id]?.difficulty ?? startingDifficulty(state, ctx.pack, ctx.chapterId, id),
    );
    if (recheck) return recheck;
  }

  // R3_ASSIGNED: the first assigned concept that is not mastered.
  const assigned = state.assigned.find((a) => !isMastered(ctx, a.conceptId));
  if (assigned) {
    const result = forConcept(ctx, assigned.conceptId, assigned.questionIds, true);
    if (result) return result;
  }

  // R4_FRONTIER
  const scope = new Set<ConceptId>();
  for (const id of chapter.conceptIds) {
    scope.add(id);
    for (const a of ancestors(ctx.pack.graph, id)) scope.add(a);
  }
  const open = frontier(ctx.pack.graph, frontierMastery(ctx), scope, MASTERY_THRESHOLD);
  const first = open[0];
  if (first !== undefined) {
    const result = forConcept(ctx, first, undefined, false);
    if (result) return result;
  }

  // R8_EXTENSION
  if (open.length === 0) {
    const result = extension(ctx, chapter.conceptIds);
    if (result) return result;
  }

  // R9_DONE
  return recommendation(ctx, "R9_DONE", "done", {});
}
