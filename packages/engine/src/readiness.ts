import { chapterExternalPrereqs, descendants, directPrereqs } from "./graph";
import { pick } from "./rng";
import { READINESS_MAX_DEPTH, READINESS_MAX_ITEMS } from "./types";
import type {
  AttemptEvent,
  ConceptId,
  ContentPack,
  Difficulty,
  Question,
  QuestionId,
  ReadinessQueueItem,
  ReadinessSession,
  ReadinessStatus,
  ReadinessSummary,
  StudentState,
} from "./types";

/** Difficulty asked first (ARCHITECTURE 5.3); the nearest available one is the fallback. */
const TARGET_DIFFICULTY: Difficulty = 2;
/** Chapter questions asked when every prerequisite is cleared. */
const CHAPTER_QUESTIONS = 2;

type ReadinessResult = ReadinessSession["results"][ConceptId];

/** What `nextReadinessQuestion` returns: the updated session and the question to show, or null when done. */
export interface NextReadinessQuestion {
  session: ReadinessSession;
  question: Question | null;
}

// ---------------------------------------------------------------------------
// Ordering and question choice
// ---------------------------------------------------------------------------

/**
 * Orders concepts by impact (how many of the chapter's concepts transitively depend on
 * them, descending), then topo order.
 */
function orderByImpact(
  pack: ContentPack,
  chapterId: string,
  ids: Iterable<ConceptId>,
): ConceptId[] {
  const chapter = pack.graph.chapters[chapterId];
  const inChapter = new Set(chapter?.conceptIds ?? []);
  const rank = new Map<ConceptId, number>();
  pack.graph.topoOrder.forEach((id, index) => rank.set(id, index));
  const rankOf = (id: ConceptId): number => rank.get(id) ?? Number.MAX_SAFE_INTEGER;

  const unique = [...new Set(ids)];
  const impact = new Map<ConceptId, number>();
  for (const id of unique) {
    impact.set(id, descendants(pack.graph, id).filter((d) => inChapter.has(d)).length);
  }
  return unique.sort(
    (a, b) =>
      (impact.get(b) ?? 0) - (impact.get(a) ?? 0) ||
      rankOf(a) - rankOf(b) ||
      (a < b ? -1 : a > b ? 1 : 0),
  );
}

/** Questions of a concept that have not been asked in this session. */
function availableQuestions(
  pack: ContentPack,
  asked: readonly QuestionId[],
  conceptId: ConceptId,
): Question[] {
  const used = new Set(asked);
  return pack.questions.filter((q) => q.conceptId === conceptId && !used.has(q.id));
}

/**
 * A difficulty-2 question if one is left, else the nearest difficulty (the easier one on a
 * tie). `rng` is used only to pick among questions of that difficulty.
 */
function chooseQuestion(
  pack: ContentPack,
  asked: readonly QuestionId[],
  conceptId: ConceptId,
  rng: () => number,
): Question | null {
  const candidates = availableQuestions(pack, asked, conceptId);
  if (candidates.length === 0) return null;
  const distance = (q: Question): number => Math.abs(q.difficulty - TARGET_DIFFICULTY);
  const best = candidates.reduce((a, q) =>
    distance(q) < distance(a) || (distance(q) === distance(a) && q.difficulty < a.difficulty)
      ? q
      : a,
  );
  const tier = candidates
    .filter((q) => q.difficulty === best.difficulty)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return pick(rng, tier);
}

// ---------------------------------------------------------------------------
// Phase machine
// ---------------------------------------------------------------------------

/**
 * Pushes the direct prerequisites of `from` that were not asked or cleared yet to the front of
 * the queue, ordered by impact, if depth allows. Trimmed prerequisites and concepts that
 * already have a result (asked, or a target) are skipped. A target is always asked before the
 * concepts that depend on it, because impact and topo order both put prerequisites first.
 */
function descend(
  pack: ContentPack,
  session: ReadinessSession,
  from: ReadinessQueueItem,
): ReadinessSession {
  const depth = from.depth + 1;
  if (depth > READINESS_MAX_DEPTH) return session;

  const results = { ...session.results };
  const front: ReadinessQueueItem[] = [];
  const candidates = directPrereqs(pack.graph, from.conceptId).filter(
    (id) => !session.trimmed.includes(id),
  );
  for (const id of orderByImpact(pack, session.chapterId, candidates)) {
    if (id in results) continue;
    results[id] = { depth, asked: 0, correct: 0, status: "pending" };
    if (availableQuestions(pack, session.askedQuestionIds, id).length > 0) {
      front.push({ conceptId: id, depth });
    }
  }
  return { ...session, results, queue: [...front, ...session.queue] };
}

/**
 * What the chapter phase says about each chapter concept it asked: -1 (backed) when every
 * chapter question was right, +1 (pointing down) when every one was wrong. A mixed result is
 * not attributed, because the session keeps only the count of correct chapter answers.
 */
function chapterEvidence(pack: ContentPack, session: ReadinessSession): Map<ConceptId, number> {
  const inChapter = new Set(pack.graph.chapters[session.chapterId]?.conceptIds ?? []);
  const asked = new Set(session.askedQuestionIds);
  const served = pack.questions.filter((q) => asked.has(q.id) && inChapter.has(q.conceptId));
  const evidence = new Map<ConceptId, number>();
  if (served.length === 0) return evidence;
  const value =
    session.chapterCorrect === served.length ? -1 : session.chapterCorrect === 0 ? 1 : 0;
  if (value === 0) return evidence;
  for (const q of served) evidence.set(q.conceptId, value);
  return evidence;
}

/**
 * Failed or uncertain descendants of `conceptId` in the check, minus cleared ones; asked
 * chapter concepts count through `chapterEvidence`.
 */
function suspicion(
  pack: ContentPack,
  session: ReadinessSession,
  chapter: ReadonlyMap<ConceptId, number>,
  conceptId: ConceptId,
): number {
  let score = 0;
  for (const id of descendants(pack.graph, conceptId)) {
    const status = session.results[id]?.status;
    if (status === "failed" || status === "uncertain") score += 1;
    else if (status === "cleared") score -= 1;
    else score += chapter.get(id) ?? 0;
  }
  return score;
}

/**
 * Cleared concepts answered exactly once, in the order the failures point to them: highest
 * `suspicion` first, then closest to the chapter (lowest depth), then impact. A concept answered
 * right under a failed dependant is the likeliest lucky guess; one whose dependants were
 * answered right is already backed by them.
 */
function confirmItems(pack: ContentPack, session: ReadinessSession): ReadinessQueueItem[] {
  const byDepth = new Map<number, ConceptId[]>();
  for (const [id, result] of Object.entries(session.results)) {
    if (result.asked !== 1 || result.correct !== 1) continue;
    if (availableQuestions(pack, session.askedQuestionIds, id).length === 0) continue;
    byDepth.set(result.depth, [...(byDepth.get(result.depth) ?? []), id]);
  }
  const items: ReadinessQueueItem[] = [];
  for (const depth of [...byDepth.keys()].sort((a, b) => a - b)) {
    for (const id of orderByImpact(pack, session.chapterId, byDepth.get(depth) ?? [])) {
      items.push({ conceptId: id, depth });
    }
  }
  // Stable sort: equal scores keep the depth-then-impact order built above.
  const chapter = chapterEvidence(pack, session);
  return items
    .map((item) => ({ item, score: suspicion(pack, session, chapter, item.conceptId) }))
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

/** The first two chapter concepts in topo order, when both have a question left. */
function chapterItems(pack: ContentPack, session: ReadinessSession): ReadinessQueueItem[] {
  const chapter = pack.graph.chapters[session.chapterId];
  if (!chapter) return [];
  const rank = new Map<ConceptId, number>();
  pack.graph.topoOrder.forEach((id, index) => rank.set(id, index));
  const rankOf = (id: ConceptId): number => rank.get(id) ?? Number.MAX_SAFE_INTEGER;
  return [...chapter.conceptIds]
    .sort((a, b) => rankOf(a) - rankOf(b))
    .slice(0, CHAPTER_QUESTIONS)
    .filter((id) => availableQuestions(pack, session.askedQuestionIds, id).length > 0)
    .map((conceptId) => ({ conceptId, depth: 0 }));
}

function finish(session: ReadinessSession): ReadinessSession {
  return { ...session, phase: "done", queue: [] };
}

/** True once a question of a chapter concept has been served (the chapter phase never repeats). */
function chapterAsked(pack: ContentPack, session: ReadinessSession): boolean {
  const inChapter = new Set(pack.graph.chapters[session.chapterId]?.conceptIds ?? []);
  const asked = new Set(session.askedQuestionIds);
  return pack.questions.some((q) => asked.has(q.id) && inChapter.has(q.conceptId));
}

/**
 * Brings `phase` and `queue` up to date after the session changed (no question may be
 * pending). direct/descend/confirm are derived from the head of the queue; when the queue
 * runs dry the next phase is set up: chapter, then confirm, then done.
 */
function settle(pack: ContentPack, session: ReadinessSession): ReadinessSession {
  if (session.phase === "done") return session;
  if (session.budgetLeft <= 0) return finish(session);
  if (session.phase === "chapter" && session.queue.length > 0) return session;

  const head = session.queue[0];
  if (head) {
    const asked = (session.results[head.conceptId]?.asked ?? 0) > 0;
    const phase = asked ? "confirm" : head.depth === 0 ? "direct" : "descend";
    return { ...session, phase };
  }

  // A target the check could not ask (no question left) is not cleared either.
  const targetsOk = Object.values(session.results).every(
    (r) => r.depth !== 0 || r.status === "cleared",
  );
  if (targetsOk && session.budgetLeft >= CHAPTER_QUESTIONS && !chapterAsked(pack, session)) {
    const items = chapterItems(pack, session);
    if (items.length === CHAPTER_QUESTIONS) return { ...session, phase: "chapter", queue: items };
  }

  const confirm = confirmItems(pack, session);
  if (confirm.length > 0) return { ...session, phase: "confirm", queue: confirm };
  return finish(session);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Starts a Chapter Readiness Check (ARCHITECTURE 5.3). Targets are the chapter's external
 * prerequisites minus the teacher-`trimmed` ones, ordered by impact then topo order, and
 * queued at depth 0. Only `state.studentId` is read. Throws on an unknown chapter id.
 */
export function startReadiness(
  pack: ContentPack,
  state: StudentState,
  chapterId: string,
  trimmed: readonly ConceptId[],
): ReadinessSession {
  const trimmedIds = [...new Set(trimmed)];
  const external = chapterExternalPrereqs(pack.graph, chapterId).filter(
    (id) => !trimmedIds.includes(id),
  );
  const results: ReadinessSession["results"] = {};
  const queue: ReadinessQueueItem[] = [];
  for (const id of orderByImpact(pack, chapterId, external)) {
    results[id] = { depth: 0, asked: 0, correct: 0, status: "pending" };
    if (availableQuestions(pack, [], id).length > 0) queue.push({ conceptId: id, depth: 0 });
  }
  return settle(pack, {
    studentId: state.studentId,
    chapterId,
    phase: "direct",
    budgetLeft: READINESS_MAX_ITEMS,
    queue,
    askedQuestionIds: [],
    results,
    trimmed: trimmedIds,
    misconceptions: {},
    chapterCorrect: 0,
  });
}

/**
 * The next question, or `question: null` when the check is done. Serving a question spends
 * one item of budget, records its id (a question is never asked twice) and sets
 * `session.current`. Calling it again before the answer is recorded returns the same question.
 * `rng` only chooses among questions of the same difficulty.
 */
export function nextReadinessQuestion(
  pack: ContentPack,
  session: ReadinessSession,
  rng: () => number,
): NextReadinessQuestion {
  if (session.current) {
    const { questionId } = session.current;
    const shown = pack.questions.find((q) => q.id === questionId);
    if (!shown) throw new Error(`Unknown question id: ${questionId}`);
    return { session, question: shown };
  }

  let current = settle(pack, session);
  while (current.phase !== "done") {
    const head = current.queue[0] as ReadinessQueueItem;
    const rest = current.queue.slice(1);
    const question = chooseQuestion(pack, current.askedQuestionIds, head.conceptId, rng);
    if (!question) {
      current = settle(pack, { ...current, queue: rest });
      continue;
    }

    const isChapterQuestion = current.phase === "chapter";
    let results = current.results;
    if (!isChapterQuestion) {
      const result = results[head.conceptId];
      if (!result) throw new Error(`Concept ${head.conceptId} was queued without a result entry`);
      results = { ...results, [head.conceptId]: { ...result, asked: result.asked + 1 } };
    }
    return {
      session: {
        ...current,
        queue: rest,
        results,
        budgetLeft: current.budgetLeft - 1,
        askedQuestionIds: [...current.askedQuestionIds, question.id],
        current: {
          conceptId: head.conceptId,
          questionId: question.id,
          depth: head.depth,
          isChapterQuestion,
        },
      },
      question,
    };
  }
  return { session: current, question: null };
}

function statusAfterAnswer(result: ReadinessResult): ReadinessStatus {
  if (result.asked === 1) return result.correct === 1 ? "cleared" : "failed";
  return result.correct === result.asked ? "cleared" : "uncertain";
}

/**
 * Records the answer to `session.current` and moves the phase on. A wrong first answer marks
 * the concept `failed`; a first correct answer marks it `cleared` straight away; a wrong
 * second answer (in the confirm phase) downgrades `cleared` to `uncertain`. `failed` and `uncertain` concepts queue their direct prerequisites at the front
 * (depth + 1, up to `READINESS_MAX_DEPTH`). Throws if no question is pending or the attempt is
 * for a different question or student. The caller also writes the attempt event.
 */
export function recordReadinessAnswer(
  pack: ContentPack,
  session: ReadinessSession,
  attempt: AttemptEvent,
): ReadinessSession {
  const current = session.current;
  if (!current) throw new Error("No readiness question is pending");
  if (attempt.questionId !== current.questionId || attempt.conceptId !== current.conceptId) {
    throw new Error(
      `Attempt ${attempt.id} answers ${attempt.questionId}, but ${current.questionId} is pending`,
    );
  }
  if (attempt.studentId !== session.studentId) {
    throw new Error(
      `Attempt ${attempt.id} belongs to student ${attempt.studentId}, not ${session.studentId}`,
    );
  }

  let next: ReadinessSession = { ...session };
  delete next.current;

  const code = attempt.misconceptionCode;
  if (!attempt.correct && code !== undefined) {
    next.misconceptions = { ...next.misconceptions, [code]: (next.misconceptions[code] ?? 0) + 1 };
  }

  if (current.isChapterQuestion) {
    if (attempt.correct) next.chapterCorrect += 1;
    return settle(pack, next);
  }

  const before = next.results[current.conceptId];
  if (!before) throw new Error(`Concept ${current.conceptId} has no readiness result`);
  const updated: ReadinessResult = {
    ...before,
    correct: before.correct + (attempt.correct ? 1 : 0),
  };
  updated.status = statusAfterAnswer(updated);
  next.results = { ...next.results, [current.conceptId]: updated };
  if (updated.status === "failed" || updated.status === "uncertain") {
    next = descend(pack, next, { conceptId: current.conceptId, depth: updated.depth });
  }
  return settle(pack, next);
}

/**
 * The `ReadinessSummary` for the caller to store in a `readiness_completed` event. Concepts
 * the check reached but never resolved, or never reached, are `pending`; teacher-trimmed
 * prerequisites are not listed. `now` is stored as `completedAt`.
 */
export function readinessSummary(session: ReadinessSession, now: string): ReadinessSummary {
  const withStatus = (status: ReadinessStatus): ConceptId[] =>
    Object.entries(session.results)
      .filter(([, result]) => result.status === status)
      .map(([id]) => id);
  return {
    chapterId: session.chapterId,
    cleared: withStatus("cleared"),
    failed: withStatus("failed"),
    uncertain: withStatus("uncertain"),
    pending: withStatus("pending"),
    itemsUsed: READINESS_MAX_ITEMS - session.budgetLeft,
    advancedEntry: session.chapterCorrect >= CHAPTER_QUESTIONS,
    misconceptions: { ...session.misconceptions },
    completedAt: now,
  };
}

const byPaperRank = (a: Question, b: Question): number => {
  const rank = (q: Question) => (q.tags?.includes("paper_friendly") ? 0 : 1);
  return rank(a) - rank(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
};

/**
 * The printable Readiness Check (BUILD_PLAN 5.5): up to `count` questions at the target
 * difficulty, dealt round-robin over the chapter's external prerequisites (topo order) minus
 * `trimmed`, paper-friendly questions first, then by id. Deterministic; no rng.
 */
export function paperCheckQuestions(
  pack: ContentPack,
  chapterId: string,
  trimmed: readonly ConceptId[],
  count: number = READINESS_MAX_ITEMS,
): Question[] {
  const lists = chapterExternalPrereqs(pack.graph, chapterId)
    .filter((id) => !trimmed.includes(id))
    .map((id) =>
      pack.questions
        .filter((q) => q.conceptId === id && q.difficulty === TARGET_DIFFICULTY)
        .sort(byPaperRank),
    );
  const out: Question[] = [];
  for (let round = 0; out.length < count; round++) {
    let added = false;
    for (const list of lists) {
      const question = list[round];
      if (question && out.length < count) {
        out.push(question);
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}
