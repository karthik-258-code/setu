/**
 * The demo classroom (BUILD_PLAN 6.1): Class 8 B with Anjali and Ravi as in the submission
 * (section 2.4) and 44 synthetic students. Every student with data takes the real Readiness
 * Check: `startReadiness`, `nextReadinessQuestion` and `recordReadinessAnswer` choose the
 * questions, and a simple learner model answers them. Deterministic for a given seed.
 */
import {
  ancestors,
  mulberry32,
  nextReadinessQuestion,
  readinessSummary,
  recordReadinessAnswer,
  replay,
  startReadiness,
} from "@setu/engine";
import type {
  AttemptEvent,
  ConceptId,
  ContentPack,
  Lang,
  MisconceptionCode,
  Question,
  StudentEvent,
} from "@setu/engine";

export const DEMO_CHAPTER_ID = "CH.M8.LINEAR_EQ_ONE_VAR";
export const DEMO_SEED = 20261027;
/** Monday, period 3 (09:30 IST), when the class takes the Readiness Check. */
export const DEMO_CHECK_START = "2026-10-26T04:00:00.000Z";

export interface DemoSeedStudent {
  studentId: string;
  firstName: string;
  rollNo: string;
  lang: Lang;
  /** Demo-only PIN, printed in the demo script; never a real student's PIN. */
  pin: string;
}

export interface DemoSeed {
  chapterId: string;
  students: DemoSeedStudent[];
  events: StudentEvent[];
}

/**
 * What a simulated learner does not know. A concept in `gaps`, or one that depends on it, is
 * answered wrongly with the gap's misconception where an option shows it. A `shaky` concept is
 * right the first time and wrong after that. `slip` is the chance of a careless error.
 */
export interface Learner {
  gaps: Record<ConceptId, MisconceptionCode>;
  shaky: Record<ConceptId, MisconceptionCode>;
  slip: number;
}

const SOLID: Learner = { gaps: {}, shaky: {}, slip: 0 };

/** Ravi: integers fine, adds denominators, unsure on like terms (submission 2.4). */
const RAVI: Learner = {
  gaps: { "M6.FRAC.ADD_SUB_UNLIKE": "F-ADD-DENOM" },
  shaky: { "M7.ALG.LIKE_TERMS": "A-UNLIKE-COMBINE" },
  slip: 0,
};

const FRACTION_GAP: Learner = { gaps: { "M6.FRAC.ADD_SUB_UNLIKE": "F-ADD-DENOM" }, shaky: {}, slip: 0.05 };
const SIGN_GAP: Learner = { gaps: { "M6.INT.ADD_SUB": "I-SIGN-ADD" }, shaky: {}, slip: 0.05 };
const READY: Learner = { gaps: {}, shaky: {}, slip: 0.05 };

const NAMES = [
  "Lakshmi", "Suresh", "Kavya", "Arjun", "Divya", "Kiran", "Swathi", "Mahesh", "Sravani",
  "Naveen", "Pooja", "Rahul", "Bhavana", "Sai", "Harika", "Vamsi", "Keerthi", "Ajay",
  "Sneha", "Pavan", "Meghana", "Teja", "Sindhu", "Ganesh", "Anusha", "Vinay", "Ramya",
  "Srikanth", "Navya", "Charan", "Deepika", "Manoj", "Lavanya", "Rakesh", "Priya", "Abhinav",
  "Haritha", "Gopi", "Mounika", "Nikhil", "Tejaswini", "Yashwanth", "Sahithi", "Venkat",
];

/** 13 more ready, 14 more with the fraction gap, 9 with integer sign errors, 8 absent: 46 with Anjali and Ravi. */
const SYNTHETIC: (Learner | null)[] = [
  ...Array<Learner>(13).fill(READY),
  ...Array<Learner>(14).fill(FRACTION_GAP),
  ...Array<Learner>(9).fill(SIGN_GAP),
  ...Array<null>(8).fill(null),
];

/** A deterministic RFC 4122 version 4 UUID from `rng`. */
export function uuidFrom(rng: () => number): string {
  const hex: string[] = [];
  for (let i = 0; i < 32; i++) hex.push(Math.floor(rng() * 16).toString(16));
  hex[12] = "4";
  hex[16] = (8 + Math.floor(rng() * 4)).toString(16);
  const h = hex.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** The misconception a learner shows on `conceptId`, "right" when they know it. */
function expected(
  pack: ContentPack,
  learner: Learner,
  conceptId: ConceptId,
  askedBefore: number,
): MisconceptionCode | "right" {
  const own = learner.gaps[conceptId];
  if (own !== undefined) return own;
  for (const a of ancestors(pack.graph, conceptId)) {
    const code = learner.gaps[a];
    if (code !== undefined) return code;
  }
  const shaky = learner.shaky[conceptId];
  if (shaky !== undefined && askedBefore > 0) return shaky;
  return "right";
}

type Answer = Pick<AttemptEvent, "correct" | "selectedOptionId" | "value" | "misconceptionCode">;

function respond(question: Question, outcome: MisconceptionCode | "right"): Answer {
  if (question.type === "mcq") {
    const wrong = question.options.filter((o) => !o.isCorrect);
    const option =
      outcome === "right"
        ? question.options.find((o) => o.isCorrect)
        : (wrong.find((o) => o.misconceptionCode === outcome) ??
          wrong.find((o) => o.misconceptionCode !== undefined) ??
          wrong[0]);
    if (!option) throw new Error(`Question ${question.id} has no option to choose`);
    return {
      correct: option.isCorrect,
      selectedOptionId: option.id,
      ...(option.misconceptionCode !== undefined ? { misconceptionCode: option.misconceptionCode } : {}),
    };
  }
  if (outcome === "right") return { correct: true, value: question.answer };
  const known =
    question.wrongAnswers?.find((w) => w.misconceptionCode === outcome) ?? question.wrongAnswers?.[0];
  return known
    ? { correct: false, value: known.value, misconceptionCode: known.misconceptionCode }
    : { correct: false, value: question.answer + 1 };
}

/** One student's Readiness Check as events: an attempt per question, then `readiness_completed`. */
export function simulateReadiness(
  pack: ContentPack,
  chapterId: string,
  studentId: string,
  learner: Learner,
  startMs: number,
  rng: () => number,
): StudentEvent[] {
  const sessionId = uuidFrom(rng);
  const events: StudentEvent[] = [];
  const asked: Record<ConceptId, number> = {};
  let ms = startMs;
  let step = nextReadinessQuestion(
    pack,
    startReadiness(pack, replay(pack, [], studentId), chapterId, []),
    rng,
  );
  while (step.question) {
    const question = step.question;
    const current = step.session.current;
    if (!current) throw new Error("The readiness check served a question without a current item");
    const before = asked[question.conceptId] ?? 0;
    asked[question.conceptId] = before + 1;
    let outcome = expected(pack, learner, question.conceptId, before);
    if (outcome === "right" && rng() < learner.slip) outcome = "careless";
    const time = 20_000 + Math.floor(rng() * 40_000);
    const attempt: AttemptEvent = {
      type: "attempt",
      id: uuidFrom(rng),
      studentId,
      ts: new Date(ms).toISOString(),
      sessionId,
      questionId: question.id,
      conceptId: current.conceptId,
      mode: "readiness",
      difficulty: question.difficulty,
      ...respond(question, outcome),
      hintsUsed: 0,
      timeMs: time,
      source: "device",
    };
    events.push(attempt);
    ms += time + 5_000;
    step = nextReadinessQuestion(pack, recordReadinessAnswer(pack, step.session, attempt), rng);
  }
  const completedAt = new Date(ms).toISOString();
  events.push({
    type: "readiness_completed",
    id: uuidFrom(rng),
    studentId,
    ts: completedAt,
    sessionId,
    chapterId,
    summary: readinessSummary(step.session, completedAt),
  });
  return events;
}

/** The whole demo classroom: roster and event log. Same inputs, same output. */
export function buildDemoSeed(
  pack: ContentPack,
  chapterId: string = DEMO_CHAPTER_ID,
  seed: number = DEMO_SEED,
  checkStart: string = DEMO_CHECK_START,
): DemoSeed {
  const rng = mulberry32(seed);
  const students: DemoSeedStudent[] = [
    { studentId: "demo-anjali", firstName: "Anjali", rollNo: "1", lang: "te", pin: "1111" },
    { studentId: "demo-ravi", firstName: "Ravi", rollNo: "2", lang: "te", pin: "2222" },
  ];
  const learners: (Learner | null)[] = [SOLID, RAVI];
  SYNTHETIC.forEach((learner, i) => {
    const roll = i + 3;
    students.push({
      studentId: `demo-s${String(roll).padStart(2, "0")}`,
      firstName: NAMES[i] ?? `Student ${roll}`,
      rollNo: String(roll),
      lang: i % 3 === 0 ? "en" : "te",
      pin: String(3000 + roll),
    });
    learners.push(learner);
  });

  const start = Date.parse(checkStart);
  const events: StudentEvent[] = [];
  students.forEach((student, i) => {
    const learner = learners[i];
    if (!learner) return; // absent on Monday: no events
    const offset = (i % 4) * 60_000; // four lab rows start a minute apart
    events.push(...simulateReadiness(pack, chapterId, student.studentId, learner, start + offset, rng));
  });
  return { chapterId, students, events };
}
