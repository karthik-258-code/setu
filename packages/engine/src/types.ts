/**
 * @setu/engine public types.
 *
 * This file is the contract between content, web, api and the engine.
 * Changing it requires updating docs/ARCHITECTURE.md (sections 5 and 6) in the
 * same commit. The engine is pure: no I/O, no Date.now(), no Math.random().
 * Callers pass `now` (ISO string) and `rng` (seeded, see rng.ts).
 */

// ---------------------------------------------------------------------------
// Identifiers and enums
// ---------------------------------------------------------------------------

export type ConceptId = string; // M6.FRAC.ADD_SUB_UNLIKE
export type ChapterId = string; // CH.M8.LINEAR_EQ_ONE_VAR
export type QuestionId = string;
export type ResourceId = string;
export type StudentId = string;
export type TeacherId = string;
export type MisconceptionCode = string; // F-ADD-DENOM
export type RuleId = string; // R5_LEARN
export type IsoTimestamp = string;

export type Lang = "en" | "te" | "hi";
export type ClassLevel = 6 | 7 | 8 | 9 | 10;
export type Difficulty = 1 | 2 | 3;
export type Board = "NCERT" | "TS_SCERT";
export type ReviewStatus = "machine_draft" | "draft" | "reviewed";

/** Student-facing text. `en` is mandatory; the UI falls back to it. */
export interface LocalizedText {
  en: string;
  te?: string;
  hi?: string;
}

// ---------------------------------------------------------------------------
// Constants (thresholds from the Decode submission)
// ---------------------------------------------------------------------------

export interface BktParams {
  pL0: number; // initial knowledge
  pT: number; // learn (transit)
  pG: number; // guess
  pS: number; // slip
}

export const DEFAULT_BKT: BktParams = { pL0: 0.3, pT: 0.2, pG: 0.2, pS: 0.1 };

export const MASTERY_THRESHOLD = 0.9;
export const LEARN_SKIP_THRESHOLD = 0.7;
export const TEST_READY_THRESHOLD = 0.8;
export const TEST_QUESTIONS = 3;
export const SOLVE_ATTEMPTS_BEFORE_TEST = 4;
export const READINESS_MAX_ITEMS = 12;
export const READINESS_MAX_DEPTH = 3;
export const RECHECK_INTERVALS_DAYS: readonly number[] = [2, 7, 21];
export const MAX_GROUPS = 5;
export const RECENT_ATTEMPTS_KEPT = 50;

// ---------------------------------------------------------------------------
// Content: graph
// ---------------------------------------------------------------------------

export interface Concept {
  id: ConceptId;
  classLevel: ClassLevel;
  subject: "math";
  chapterId: ChapterId;
  title: LocalizedText;
  summary?: LocalizedText;
  /** Direct prerequisites. Edges point prerequisite -> this concept. */
  prerequisites: ConceptId[];
  boardTags: Board[];
  /** Optional per-concept BKT overrides (fitted later). */
  bkt?: Partial<BktParams>;
}

export interface Chapter {
  id: ChapterId;
  classLevel: ClassLevel;
  subject: "math";
  title: LocalizedText;
  /** Concepts belonging to this chapter, in teaching order. */
  conceptIds: ConceptId[];
  boardTags: Board[];
  /** full = demo-grade content; skeleton = graph + minimal content to prove scaling. */
  depth: "full" | "skeleton";
}

export interface ConceptGraph {
  concepts: Record<ConceptId, Concept>;
  chapters: Record<ChapterId, Chapter>;
  /** Kahn topological order, tie-break classLevel then id. Computed by buildGraph. */
  topoOrder: ConceptId[];
}

// ---------------------------------------------------------------------------
// Content: questions and resources
// ---------------------------------------------------------------------------

export interface Option {
  id: string; // "a" | "b" | "c" | "d"
  text: LocalizedText;
  isCorrect: boolean;
  /** Present on wrong options that diagnose a specific error. */
  misconceptionCode?: MisconceptionCode;
}

export type QuestionTag = "extension" | "word_problem" | "paper_friendly";

interface QuestionBase {
  id: QuestionId;
  conceptId: ConceptId;
  difficulty: Difficulty;
  stem: LocalizedText;
  hint?: LocalizedText;
  solution?: LocalizedText;
  /** Inline SVG, kept small. */
  diagramSvg?: string;
  boardTags: Board[];
  tags?: QuestionTag[];
  reviewStatus: ReviewStatus;
  /** Set when produced by a template generator. */
  templateId?: string;
}

export interface McqQuestion extends QuestionBase {
  type: "mcq";
  options: Option[];
}

export interface NumericQuestion extends QuestionBase {
  type: "numeric";
  answer: number;
  tolerance?: number;
  /** Known wrong answers that map to misconceptions. */
  wrongAnswers?: { value: number; misconceptionCode: MisconceptionCode }[];
}

export type Question = McqQuestion | NumericQuestion;

export interface QuestionTemplate {
  id: string;
  conceptId: ConceptId;
  difficulty: Difficulty;
  /** Name of a generator in @setu/content/src/generators. */
  generator: string;
  /** Parameter ranges [min, max] inclusive or explicit choices. */
  paramSpace: Record<string, [number, number] | number[]>;
  /** How many deterministic variants to emit into the pack. */
  count: number;
  boardTags: Board[];
  tags?: QuestionTag[];
  reviewStatus: ReviewStatus;
}

export type ResourceType = "explanation" | "worked_example" | "hint";

export interface Resource {
  id: ResourceId;
  conceptId: ConceptId;
  type: ResourceType;
  body: LocalizedText; // markdown subset: paragraphs, bold, inline code, simple lists
  diagramSvg?: string;
  /** Worked examples built to counter a specific misconception. */
  targetsMisconception?: MisconceptionCode;
  reviewStatus: ReviewStatus;
}

export interface Misconception {
  code: MisconceptionCode;
  label: LocalizedText;
  teacherNote?: LocalizedText;
}

export interface ContentPack {
  packVersion: string; // semver or git short sha
  builtAt: IsoTimestamp;
  chapterId: ChapterId;
  /** The full graph (small). Questions and resources cover chapter + ancestors only. */
  graph: ConceptGraph;
  questions: Question[];
  resources: Resource[];
  misconceptions: Record<MisconceptionCode, Misconception>;
  /** ruleId -> template with {placeholders} filled from Recommendation.reasonParams. */
  reasonTemplates: Record<RuleId, LocalizedText>;
}

// ---------------------------------------------------------------------------
// Events (the only thing that is stored and synced)
// ---------------------------------------------------------------------------

export type Mode = "readiness" | "learn" | "solve" | "test" | "recheck" | "verify" | "extension";

interface EventBase {
  /** Client-generated UUID v4; server upserts by this id. */
  id: string;
  studentId: StudentId;
  ts: IsoTimestamp;
  /** Groups events into one sitting; used for "one re-check per session". */
  sessionId?: string;
}

export interface AttemptEvent extends EventBase {
  type: "attempt";
  questionId: QuestionId;
  conceptId: ConceptId;
  mode: Mode;
  difficulty: Difficulty;
  correct: boolean;
  selectedOptionId?: string;
  value?: number;
  misconceptionCode?: MisconceptionCode;
  hintsUsed: number;
  timeMs: number;
  /** paper = entered by the teacher from a printed check. */
  source?: "device" | "paper";
}

export interface LearnViewedEvent extends EventBase {
  type: "learn_viewed";
  conceptId: ConceptId;
  resourceId: ResourceId;
}

export interface ReadinessCompletedEvent extends EventBase {
  type: "readiness_completed";
  chapterId: ChapterId;
  summary: ReadinessSummary;
}

export interface TeacherOverrideEvent extends EventBase {
  type: "teacher_override";
  teacherId: TeacherId;
  conceptId: ConceptId;
  /** true = mark mastered (observed in class); false = mark not mastered. */
  mastered: boolean;
  note?: string;
}

export interface MarkTaughtEvent extends EventBase {
  type: "mark_taught";
  teacherId: TeacherId;
  conceptId: ConceptId;
}

export interface AssignEvent extends EventBase {
  type: "assign";
  teacherId: TeacherId;
  conceptId: ConceptId;
  questionIds?: QuestionId[];
}

export interface ExtensionLockEvent extends EventBase {
  type: "extension_lock";
  teacherId: TeacherId;
  locked: boolean;
}

/** Audit-only; does not change StudentState. Used by the weekly view. */
export interface GroupEditEvent extends EventBase {
  type: "group_edit";
  teacherId: TeacherId;
  chapterId: ChapterId;
  action: "accept" | "dismiss" | "move" | "merge" | "split";
  fromGroupId?: string;
  toGroupId?: string;
}

export type StudentEvent =
  | AttemptEvent
  | LearnViewedEvent
  | ReadinessCompletedEvent
  | TeacherOverrideEvent
  | MarkTaughtEvent
  | AssignEvent
  | ExtensionLockEvent
  | GroupEditEvent;

export type TeacherEvent =
  | TeacherOverrideEvent
  | MarkTaughtEvent
  | AssignEvent
  | ExtensionLockEvent
  | GroupEditEvent
  | AttemptEvent; // paper entry

// ---------------------------------------------------------------------------
// Student state (derived by replay; never synced directly)
// ---------------------------------------------------------------------------

export interface MasteryState {
  conceptId: ConceptId;
  pKnown: number;
  attempts: number;
  correct: number;
  lastAttemptAt?: IsoTimestamp;
  lastCorrectAt?: IsoTimestamp;
  /** Set when threshold crossed in test/recheck/verify mode. */
  masteredAt?: IsoTimestamp;
  source: "model" | "teacher_override";
  pendingVerification?: boolean;
  /**
   * The model's pKnown just before an unverified `teacher_override` (mastered = true).
   * Present only while `pendingVerification` is true; failed verification restores it.
   */
  modelPKnown?: number;
}

export interface ConceptProgress {
  conceptId: ConceptId;
  difficulty: Difficulty;
  streakCorrect: number;
  streakWrong: number;
  solveAttempts: number;
  testAttempts: number;
  learnViewed: boolean;
  clearedByReadiness: boolean;
  lastMisconception?: MisconceptionCode;
  seenQuestionIds: QuestionId[];
}

export type RecheckKind = "spaced" | "after_taught" | "verify_override";

export interface Recheck {
  conceptId: ConceptId;
  dueAt: IsoTimestamp;
  intervalDays: number;
  kind: RecheckKind;
}

export type ReadinessStatus = "pending" | "cleared" | "failed" | "uncertain";

export interface ReadinessSummary {
  chapterId: ChapterId;
  cleared: ConceptId[];
  failed: ConceptId[];
  uncertain: ConceptId[];
  pending: ConceptId[];
  itemsUsed: number;
  advancedEntry: boolean;
  misconceptions: Record<MisconceptionCode, number>;
  completedAt: IsoTimestamp;
}

export interface StudentState {
  studentId: StudentId;
  mastery: Record<ConceptId, MasteryState>;
  progress: Record<ConceptId, ConceptProgress>;
  readiness: Record<ChapterId, ReadinessSummary>;
  rechecks: Recheck[];
  assigned: { conceptId: ConceptId; questionIds?: QuestionId[] }[];
  extensionLocked: boolean;
  /** Most recent attempts, newest last, capped at RECENT_ATTEMPTS_KEPT. */
  recentAttempts: AttemptEvent[];
  eventCount: number;
  lastEventTs?: IsoTimestamp;
  lastSessionId?: string;
}

// ---------------------------------------------------------------------------
// Readiness Check session (in-memory while the check runs)
// ---------------------------------------------------------------------------

export type ReadinessPhase = "direct" | "descend" | "confirm" | "chapter" | "done";

export interface ReadinessQueueItem {
  conceptId: ConceptId;
  depth: number; // 0 = direct prerequisite of the chapter
}

export interface ReadinessSession {
  studentId: StudentId;
  chapterId: ChapterId;
  phase: ReadinessPhase;
  budgetLeft: number;
  queue: ReadinessQueueItem[];
  askedQuestionIds: QuestionId[];
  results: Record<
    ConceptId,
    { depth: number; asked: number; correct: number; status: ReadinessStatus }
  >;
  /** Prerequisites the teacher removed before launch. */
  trimmed: ConceptId[];
  misconceptions: Record<MisconceptionCode, number>;
  chapterCorrect: number;
  /** The question currently shown, if any. */
  current?: {
    conceptId: ConceptId;
    questionId: QuestionId;
    depth: number;
    isChapterQuestion: boolean;
  };
}

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

export type RecommendationMode = Mode | "done";

export interface Recommendation {
  studentId: StudentId;
  chapterId: ChapterId;
  mode: RecommendationMode;
  conceptId?: ConceptId;
  difficulty?: Difficulty;
  resourceId?: ResourceId;
  questionIds?: QuestionId[];
  recheckKind?: RecheckKind;
  ruleId: RuleId;
  /** Filled into the pack's reasonTemplates[ruleId]. Values are concept titles, numbers, etc. */
  reasonParams: Record<string, string | number>;
}

export interface PolicyContext {
  pack: ContentPack;
  state: StudentState;
  chapterId: ChapterId;
  now: IsoTimestamp;
  sessionId: string;
  rng: () => number;
}

// ---------------------------------------------------------------------------
// Teacher views
// ---------------------------------------------------------------------------

export interface StudentSummary {
  studentId: StudentId;
  displayName: string;
  rollNo: string;
}

export interface GapMapRow extends StudentSummary {
  /** pKnown per concept column; null when never touched. */
  mastery: Record<ConceptId, number | null>;
  readinessDone: boolean;
  rootCauseGap: ConceptId | null;
  lastEventTs?: IsoTimestamp;
}

export interface GapMap {
  chapterId: ChapterId;
  columns: { prerequisites: ConceptId[]; chapter: ConceptId[] };
  rows: GapMapRow[];
}

export type GroupKind = "ready" | "gap" | "not_attempted" | "other";
export type SuggestedAction = "warm_up" | "small_group" | "paper_check" | "extension";

export interface GapGroup {
  id: string; // stable: kind + conceptId
  kind: GroupKind;
  conceptId?: ConceptId;
  dominantMisconception?: MisconceptionCode;
  studentIds: StudentId[];
  suggestedQuestionIds: QuestionId[];
  suggestedAction: SuggestedAction;
}

export interface WeeklyView {
  chapterId: ChapterId;
  from: IsoTimestamp;
  to: IsoTimestamp;
  moved: { studentId: StudentId; fromGroupId: string; toGroupId: string }[];
  blockingConcepts: { conceptId: ConceptId; studentCount: number }[];
  recheckResults: {
    conceptId: ConceptId;
    taughtAt: IsoTimestamp;
    passed: number;
    failed: number;
  }[];
}
