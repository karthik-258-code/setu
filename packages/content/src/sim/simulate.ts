/**
 * Simulation harness (BUILD_PLAN 6.2). Synthetic learners with planted prerequisite gaps take
 * the engine's Readiness Check, and learners with three learning rates practise a chapter
 * concept under the engine's ladder or at a fixed difficulty. Every decision is the engine's;
 * only the learners' answers are simulated. Deterministic for a given seed.
 */
import {
  ancestors,
  applyEvent,
  buildGapMap,
  chapterExternalPrereqs,
  mulberry32,
  nextReadinessQuestion,
  nextRecommendation,
  readinessSummary,
  recordReadinessAnswer,
  replay,
  startReadiness,
} from "@setu/engine";
import type {
  AttemptEvent,
  ClassroomStudent,
  ConceptId,
  ContentPack,
  Difficulty,
  Question,
  StudentState,
} from "@setu/engine";

/** Chance of a correct answer by difficulty, for a learner who knows or does not know the concept. */
export const P_KNOWN: Record<Difficulty, number> = { 1: 0.95, 2: 0.9, 3: 0.8 };
export const P_UNKNOWN: Record<Difficulty, number> = { 1: 0.35, 2: 0.2, 3: 0.1 };
/** Chance per attempt that a learner who does not know the concept learns it. */
export const LEARNING_RATES = [
  { name: "slow", rate: 0.07 },
  { name: "medium", rate: 0.15 },
  { name: "fast", rate: 0.3 },
] as const;
export const PRACTICE_CAP = 80;
const BAND_WINDOW = 5;
const START = Date.parse("2026-11-02T04:00:00.000Z");

export type GapKind = "single" | "double";
export type Strategy = "ladder" | "fixed";

export interface ReadinessOutcome {
  kind: GapKind;
  planted: ConceptId[];
  found: ConceptId[];
  truePositives: number;
  rootCause: ConceptId | null;
  itemsUsed: number;
}

export interface PracticeOutcome {
  strategy: Strategy;
  rate: string;
  items: number;
  mastered: boolean;
  windows: number;
  inBand: number;
}

function answerFields(
  q: Question,
  correct: boolean,
): Pick<AttemptEvent, "correct" | "selectedOptionId" | "value" | "misconceptionCode"> {
  if (q.type === "mcq") {
    const option = correct
      ? q.options.find((o) => o.isCorrect)
      : (q.options.find((o) => !o.isCorrect && o.misconceptionCode !== undefined) ??
        q.options.find((o) => !o.isCorrect));
    if (!option) throw new Error(`Question ${q.id} has no suitable option`);
    return {
      correct: option.isCorrect,
      selectedOptionId: option.id,
      ...(option.misconceptionCode !== undefined ? { misconceptionCode: option.misconceptionCode } : {}),
    };
  }
  if (correct) return { correct: true, value: q.answer };
  const wrong = q.wrongAnswers?.[0];
  return wrong
    ? { correct: false, value: wrong.value, misconceptionCode: wrong.misconceptionCode }
    : { correct: false, value: q.answer + 1 };
}

/** Prerequisites outside the chapter that have questions: where gaps are planted. */
export function gapCandidates(pack: ContentPack, chapterId: string): ConceptId[] {
  const chapter = pack.graph.chapters[chapterId];
  if (!chapter) throw new Error(`Unknown chapter id: ${chapterId}`);
  const inChapter = new Set(chapter.conceptIds);
  const scope = new Set<ConceptId>();
  for (const id of chapter.conceptIds) for (const a of ancestors(pack.graph, id)) scope.add(a);
  return pack.graph.topoOrder.filter(
    (id) => scope.has(id) && !inChapter.has(id) && pack.questions.some((q) => q.conceptId === id),
  );
}

/** One learner's Readiness Check; a concept is unknown when it or any prerequisite is planted. */
export function simulateReadinessStudent(
  pack: ContentPack,
  chapterId: string,
  studentId: string,
  planted: readonly ConceptId[],
  rng: () => number,
): { found: ConceptId[]; truePositives: number; itemsUsed: number; state: StudentState } {
  const unknown = (id: ConceptId) =>
    planted.includes(id) || ancestors(pack.graph, id).some((a) => planted.includes(a));
  const sessionId = `${studentId}-check`;
  let ms = START;
  let n = 0;
  let state = replay(pack, [], studentId);
  let step = nextReadinessQuestion(pack, startReadiness(pack, state, chapterId, []), rng);
  while (step.question) {
    const q = step.question;
    const current = step.session.current;
    if (!current) throw new Error("The readiness check served a question without a current item");
    ms += 30_000;
    const p = unknown(q.conceptId) ? P_UNKNOWN[q.difficulty] : P_KNOWN[q.difficulty];
    const attempt: AttemptEvent = {
      type: "attempt",
      id: `${studentId}-${n++}`,
      studentId,
      ts: new Date(ms).toISOString(),
      sessionId,
      questionId: q.id,
      conceptId: current.conceptId,
      mode: "readiness",
      difficulty: q.difficulty,
      ...answerFields(q, rng() < p),
      hintsUsed: 0,
      timeMs: 30_000,
      source: "device",
    };
    state = applyEvent(pack, state, attempt);
    step = nextReadinessQuestion(pack, recordReadinessAnswer(pack, step.session, attempt), rng);
  }
  ms += 1_000;
  const summary = readinessSummary(step.session, new Date(ms).toISOString());
  state = applyEvent(pack, state, {
    type: "readiness_completed",
    id: `${studentId}-done`,
    studentId,
    ts: new Date(ms).toISOString(),
    sessionId,
    chapterId,
    summary,
  });
  const found = [...summary.failed, ...summary.uncertain];
  return { found, truePositives: found.filter(unknown).length, itemsUsed: summary.itemsUsed, state };
}

/** Half the cohort has one planted gap, half two; the Gap Map gives each student's root cause. */
export function simulateReadinessCohort(
  pack: ContentPack,
  chapterId: string,
  students: number,
  rng: () => number,
): ReadinessOutcome[] {
  const candidates = gapCandidates(pack, chapterId);
  if (candidates.length < 2) throw new Error(`${chapterId} needs at least two gap candidates`);
  const pickOne = (exclude: readonly ConceptId[]): ConceptId => {
    const pool = candidates.filter((c) => !exclude.includes(c));
    const chosen = pool[Math.floor(rng() * pool.length)];
    if (chosen === undefined) throw new Error("No gap candidate left");
    return chosen;
  };
  const outcomes: Omit<ReadinessOutcome, "rootCause">[] = [];
  const classroom: ClassroomStudent[] = [];
  for (let i = 0; i < students; i++) {
    const kind: GapKind = i % 2 === 0 ? "single" : "double";
    const first = pickOne([]);
    const planted = kind === "single" ? [first] : [first, pickOne([first])];
    const studentId = `sim-${String(i).padStart(4, "0")}`;
    const result = simulateReadinessStudent(pack, chapterId, studentId, planted, rng);
    outcomes.push({ kind, planted, found: result.found, truePositives: result.truePositives, itemsUsed: result.itemsUsed });
    classroom.push({ studentId, displayName: studentId, rollNo: String(i + 1), state: result.state });
  }
  const roots = new Map(
    buildGapMap(pack, chapterId, classroom).rows.map((r) => [r.studentId, r.rootCauseGap]),
  );
  return outcomes.map((o, i) => ({
    ...o,
    rootCause: roots.get(classroom[i]?.studentId ?? "") ?? null,
  }));
}

/**
 * A learner who knows the prerequisites practises the first chapter concept the policy picks,
 * until the engine records mastery or `PRACTICE_CAP` items. `fixed` swaps each question for a
 * difficulty-2 one of the same concept; the policy still decides when to test.
 */
export function simulatePractice(
  pack: ContentPack,
  chapterId: string,
  strategy: Strategy,
  rateName: string,
  rate: number,
  rng: () => number,
): PracticeOutcome {
  const studentId = "sim-practice";
  const sessionId = "sim-practice";
  let ms = START;
  let n = 0;
  const meta = () => {
    ms += 60_000;
    return { id: `p-${n++}`, studentId, ts: new Date(ms).toISOString(), sessionId };
  };
  let state = replay(pack, [], studentId);
  state = applyEvent(pack, state, {
    type: "readiness_completed",
    ...meta(),
    chapterId,
    summary: {
      chapterId,
      cleared: chapterExternalPrereqs(pack.graph, chapterId),
      failed: [],
      uncertain: [],
      pending: [],
      itemsUsed: 0,
      advancedEntry: false,
      misconceptions: {},
      completedAt: new Date(ms).toISOString(),
    },
  });

  let target: ConceptId | undefined;
  let known = false;
  const outcomes: boolean[] = [];
  let windows = 0;
  let inBand = 0;
  for (let step = 0; step < PRACTICE_CAP * 2 && outcomes.length < PRACTICE_CAP; step++) {
    const rec = nextRecommendation({ pack, state, chapterId, now: new Date(ms).toISOString(), sessionId, rng });
    if (rec.mode === "done" || rec.mode === "readiness" || rec.conceptId === undefined) break;
    target ??= rec.conceptId;
    if (rec.conceptId !== target || state.mastery[target]?.masteredAt !== undefined) break;
    if (rec.mode === "learn") {
      state = applyEvent(pack, state, {
        type: "learn_viewed",
        ...meta(),
        conceptId: target,
        resourceId: rec.resourceId ?? "",
      });
      if (!known && rng() < rate) known = true;
      continue;
    }
    const fixedPool = pack.questions.filter((q) => q.conceptId === target && q.difficulty === 2);
    for (const id of rec.questionIds ?? []) {
      if (outcomes.length >= PRACTICE_CAP) break;
      const chosen = pack.questions.find((q) => q.id === id);
      const q =
        strategy === "fixed" && fixedPool.length > 0
          ? fixedPool[outcomes.length % fixedPool.length]
          : chosen;
      if (!q) continue;
      const correct = rng() < (known ? P_KNOWN[q.difficulty] : P_UNKNOWN[q.difficulty]);
      state = applyEvent(pack, state, {
        type: "attempt",
        ...meta(),
        questionId: q.id,
        conceptId: q.conceptId,
        mode: rec.mode,
        difficulty: q.difficulty,
        ...answerFields(q, correct),
        hintsUsed: 0,
        timeMs: 30_000,
        source: "device",
      });
      outcomes.push(correct);
      if (outcomes.length >= BAND_WINDOW) {
        const recent = outcomes.slice(-BAND_WINDOW).filter(Boolean).length / BAND_WINDOW;
        windows += 1;
        if (recent >= 0.6 && recent <= 0.8) inBand += 1;
      }
      if (!known && rng() < rate) known = true;
    }
  }
  const mastered = target !== undefined && state.mastery[target]?.masteredAt !== undefined;
  return { strategy, rate: rateName, items: outcomes.length, mastered, windows, inBand };
}

export interface ReadinessStats {
  kind: GapKind;
  students: number;
  recall: number;
  precision: number | null;
  rootCauseHit: number;
  medianItems: number;
  maxItems: number;
}

export interface PracticeStats {
  strategy: Strategy;
  rate: string;
  students: number;
  masteredShare: number;
  medianItemsToMastery: number | null;
  inBandShare: number;
}

export interface SimReport {
  chapterId: string;
  seed: number;
  students: number;
  readiness: ReadinessStats[];
  practice: PracticeStats[];
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const hi = sorted[mid] ?? 0;
  return sorted.length % 2 === 1 ? hi : ((sorted[mid - 1] ?? hi) + hi) / 2;
}

function readinessStats(outcomes: readonly ReadinessOutcome[], kind: GapKind): ReadinessStats {
  const mine = outcomes.filter((o) => o.kind === kind);
  const planted = mine.reduce((s, o) => s + o.planted.length, 0);
  const hits = mine.reduce((s, o) => s + o.planted.filter((p) => o.found.includes(p)).length, 0);
  const found = mine.reduce((s, o) => s + o.found.length, 0);
  const tp = mine.reduce((s, o) => s + o.truePositives, 0);
  const root = mine.filter((o) => o.rootCause !== null && o.planted.includes(o.rootCause)).length;
  const items = mine.map((o) => o.itemsUsed);
  return {
    kind,
    students: mine.length,
    recall: planted === 0 ? 0 : hits / planted,
    precision: found === 0 ? null : tp / found,
    rootCauseHit: mine.length === 0 ? 0 : root / mine.length,
    medianItems: median(items) ?? 0,
    maxItems: items.length === 0 ? 0 : Math.max(...items),
  };
}

function practiceStats(outcomes: readonly PracticeOutcome[], strategy: Strategy, rate: string): PracticeStats {
  const mine = outcomes.filter((o) => o.strategy === strategy && o.rate === rate);
  const mastered = mine.filter((o) => o.mastered);
  const windows = mine.reduce((s, o) => s + o.windows, 0);
  return {
    strategy,
    rate,
    students: mine.length,
    masteredShare: mine.length === 0 ? 0 : mastered.length / mine.length,
    medianItemsToMastery: median(mastered.map((o) => o.items)),
    inBandShare: windows === 0 ? 0 : mine.reduce((s, o) => s + o.inBand, 0) / windows,
  };
}

/** The whole study: `students` readiness learners, and each one practising under both strategies. */
export function runSimulation(
  pack: ContentPack,
  chapterId: string,
  students: number,
  seed: number,
): SimReport {
  const readiness = simulateReadinessCohort(pack, chapterId, students, mulberry32(seed));
  const practiceRng = mulberry32(seed + 1);
  const practice: PracticeOutcome[] = [];
  for (let i = 0; i < students; i++) {
    const { name, rate } = LEARNING_RATES[i % LEARNING_RATES.length] ?? LEARNING_RATES[0];
    practice.push(simulatePractice(pack, chapterId, "ladder", name, rate, practiceRng));
    practice.push(simulatePractice(pack, chapterId, "fixed", name, rate, practiceRng));
  }
  return {
    chapterId,
    seed,
    students,
    readiness: [readinessStats(readiness, "single"), readinessStats(readiness, "double")],
    practice: LEARNING_RATES.flatMap(({ name }) => [
      practiceStats(practice, "ladder", name),
      practiceStats(practice, "fixed", name),
    ]),
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const num = (x: number | null) => (x === null ? "\u2013" : String(Math.round(x * 10) / 10));

/** `docs/EVALUATION.md`, generated: tables, the single-gap recall target, and the assumptions. */
export function renderEvaluation(report: SimReport): string {
  const single = report.readiness.find((r) => r.kind === "single");
  const target = single !== undefined && single.recall >= 0.85;
  const lines = [
    "# Evaluation: simulated learners",
    "",
    `Generated by \`pnpm sim\` (seed ${report.seed}, ${report.students} synthetic students, chapter \`${report.chapterId}\`). Do not edit by hand; rerun the command. The engine makes every decision; only the learners' answers are simulated, so these numbers test the engine's logic, not real classrooms.`,
    "",
    "## Readiness Check: finding planted gaps within 12 items",
    "",
    "| Planted gaps | Students | Recall | Precision | Gap Map root cause is a planted gap | Median items | Max items |",
    "|---|---|---|---|---|---|---|",
    ...report.readiness.map(
      (r) =>
        `| ${r.kind} | ${r.students} | ${pct(r.recall)} | ${r.precision === null ? "\u2013" : pct(r.precision)} | ${pct(r.rootCauseHit)} | ${num(r.medianItems)} | ${r.maxItems} |`,
    ),
    "",
    `Target: recall at least 85% for single gaps. **${target ? "Met" : "Not met"}** (${single ? pct(single.recall) : "\u2013"}).`,
    "",
    "- *Recall*: planted gap concepts that the check reports as failed or uncertain.",
    "- *Precision*: reported concepts that the learner really does not know (the planted gap or a concept that depends on it).",
    "- *Root cause*: the Gap Map's `rootCauseGap` for the student is one of the planted gaps.",
    "",
    "## Practice: ladder versus fixed difficulty",
    "",
    `Each learner knows the prerequisites and practises the first chapter concept the policy chooses, until the engine records mastery or ${PRACTICE_CAP} items. *Fixed* replaces every question with a difficulty-2 question of the same concept; the policy still decides when to test.`,
    "",
    "| Learning rate | Strategy | Learners | Mastered | Median items to mastery | Attempts in the 60-80% accuracy band |",
    "|---|---|---|---|---|---|",
    ...report.practice.map(
      (p) =>
        `| ${p.rate} | ${p.strategy} | ${p.students} | ${pct(p.masteredShare)} | ${num(p.medianItemsToMastery)} | ${pct(p.inBandShare)} |`,
    ),
    "",
    `The band share counts, for every attempt from the ${BAND_WINDOW}th on, whether accuracy over the last ${BAND_WINDOW} attempts was between 60% and 80%.`,
    "",
    "## Assumptions",
    "",
    `- Chance of a correct answer by difficulty 1, 2, 3: ${[1, 2, 3].map((d) => pct(P_KNOWN[d as Difficulty])).join(", ")} when the concept is known; ${[1, 2, 3].map((d) => pct(P_UNKNOWN[d as Difficulty])).join(", ")} when not.`,
    `- A concept is unknown when it, or any of its prerequisites, is a planted gap. Gaps are planted uniformly among the chapter's prerequisite concepts that have questions.`,
    `- Learning rates (chance per attempt of learning the concept): ${LEARNING_RATES.map((r) => `${r.name} ${r.rate}`).join(", ")}; viewing a Learn resource is also one chance.`,
    "- Wrong answers pick an option with a misconception code when there is one.",
    "- Limits: learners are rule-based, not fitted to real data; one chapter; no forgetting between sessions; re-checks are not simulated.",
    "",
  ];
  return lines.join("\n");
}
