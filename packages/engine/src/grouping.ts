import { ancestors, chapterExternalPrereqs, rootCauseGap } from "./graph";
import { effectiveMastery } from "./mastery";
import { MAX_GROUPS } from "./types";
import type {
  AttemptEvent,
  Chapter,
  ChapterId,
  ConceptId,
  ContentPack,
  GapGroup,
  GapMap,
  GapMapRow,
  MisconceptionCode,
  QuestionId,
  StudentId,
  StudentState,
  StudentSummary,
} from "./types";

/** One student of a classroom as the teacher views see it. */
export interface ClassroomStudent extends StudentSummary {
  state: StudentState;
}

/** Full attempt history per student; defaults to each state's `recentAttempts`. */
export type AttemptsByStudent = Readonly<Record<StudentId, readonly AttemptEvent[]>>;

/** A gap group at least this share of the class gets a whole-class warm-up (ARCHITECTURE 5.6). */
const WARM_UP_SHARE = 0.25;
const SUGGESTED_QUESTIONS = 3;

function requireChapter(pack: ContentPack, chapterId: ChapterId): Chapter {
  const chapter = pack.graph.chapters[chapterId];
  if (!chapter) throw new Error(`Unknown chapter id: ${chapterId}`);
  return chapter;
}

function byCountThenId(a: [string, number], b: [string, number]): number {
  return b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
}

/** Gap Map columns: external prerequisites and their ancestors in topo order, then the chapter. */
export function gapMapColumns(pack: ContentPack, chapterId: ChapterId): GapMap["columns"] {
  const chapter = requireChapter(pack, chapterId);
  const inChapter = new Set(chapter.conceptIds);
  const upstream = new Set<ConceptId>();
  for (const id of chapterExternalPrereqs(pack.graph, chapterId)) {
    upstream.add(id);
    for (const a of ancestors(pack.graph, id)) upstream.add(a);
  }
  return {
    prerequisites: pack.graph.topoOrder.filter((id) => upstream.has(id) && !inChapter.has(id)),
    chapter: [...chapter.conceptIds],
  };
}

/** A student's root-cause gap for the chapter, or null if ready or not yet checked. */
export function studentRootCause(
  pack: ContentPack,
  chapterId: ChapterId,
  state: StudentState,
): ConceptId | null {
  if (!state.readiness[chapterId]) return null;
  return rootCauseGap(pack.graph, effectiveMastery(pack, state, chapterId), chapterId);
}

/** Heatmap of students by concept (ARCHITECTURE 5.6). Cells are raw pKnown, null if untouched. */
export function buildGapMap(
  pack: ContentPack,
  chapterId: ChapterId,
  students: readonly ClassroomStudent[],
): GapMap {
  const columns = gapMapColumns(pack, chapterId);
  const all = [...columns.prerequisites, ...columns.chapter];
  const rows = students.map((s): GapMapRow => {
    const mastery: Record<ConceptId, number | null> = {};
    for (const id of all) mastery[id] = s.state.mastery[id]?.pKnown ?? null;
    const row: GapMapRow = {
      studentId: s.studentId,
      displayName: s.displayName,
      rollNo: s.rollNo,
      mastery,
      readinessDone: s.state.readiness[chapterId] !== undefined,
      rootCauseGap: studentRootCause(pack, chapterId, s.state),
    };
    if (s.state.lastEventTs !== undefined) row.lastEventTs = s.state.lastEventTs;
    return row;
  });
  return { chapterId, columns, rows };
}

function dominantMisconception(
  attempts: readonly AttemptEvent[],
  conceptId: ConceptId,
): MisconceptionCode | undefined {
  const counts = new Map<MisconceptionCode, number>();
  for (const a of attempts) {
    if (a.conceptId === conceptId && a.misconceptionCode !== undefined) {
      counts.set(a.misconceptionCode, (counts.get(a.misconceptionCode) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort(byCountThenId)[0]?.[0];
}

function mostMissed(attempts: readonly AttemptEvent[], conceptId: ConceptId): QuestionId[] {
  const counts = new Map<QuestionId, number>();
  for (const a of attempts) {
    if (a.conceptId === conceptId && !a.correct) {
      counts.set(a.questionId, (counts.get(a.questionId) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort(byCountThenId)
    .slice(0, SUGGESTED_QUESTIONS)
    .map(([id]) => id);
}

/**
 * Today's groups (ARCHITECTURE 5.6), in display order: ready, gap groups (largest first), other,
 * not attempted. Empty groups are left out and there are never more than MAX_GROUPS.
 */
export function buildGapGroups(
  pack: ContentPack,
  chapterId: ChapterId,
  students: readonly ClassroomStudent[],
  attemptsByStudent?: AttemptsByStudent,
): GapGroup[] {
  requireChapter(pack, chapterId);
  const attemptsOf = (s: ClassroomStudent): readonly AttemptEvent[] =>
    attemptsByStudent?.[s.studentId] ?? s.state.recentAttempts;

  const ready: StudentId[] = [];
  const notAttempted: StudentId[] = [];
  const byGap = new Map<ConceptId, ClassroomStudent[]>();
  for (const s of students) {
    if (!s.state.readiness[chapterId]) {
      notAttempted.push(s.studentId);
      continue;
    }
    const gap = studentRootCause(pack, chapterId, s.state);
    if (gap === null) ready.push(s.studentId);
    else byGap.set(gap, [...(byGap.get(gap) ?? []), s]);
  }

  const level = (id: ConceptId): number => pack.graph.concepts[id]?.classLevel ?? 99;
  const rank = (id: ConceptId): number => pack.graph.topoOrder.indexOf(id);
  const gaps = [...byGap.entries()].sort(
    (a, b) => b[1].length - a[1].length || level(a[0]) - level(b[0]) || rank(a[0]) - rank(b[0]),
  );
  const room = MAX_GROUPS - (ready.length > 0 ? 1 : 0) - (notAttempted.length > 0 ? 1 : 0);
  const fits = gaps.length <= room;
  const kept = fits ? gaps : gaps.slice(0, Math.max(0, room - 1));
  const merged = fits ? [] : gaps.slice(kept.length);

  const groups: GapGroup[] = [];
  if (ready.length > 0) {
    groups.push({
      id: "ready",
      kind: "ready",
      studentIds: ready,
      suggestedQuestionIds: [],
      suggestedAction: "extension",
    });
  }
  for (const [conceptId, members] of kept) {
    const attempts = members.flatMap((m) => [...attemptsOf(m)]);
    const group: GapGroup = {
      id: `gap:${conceptId}`,
      kind: "gap",
      conceptId,
      studentIds: members.map((m) => m.studentId),
      suggestedQuestionIds: mostMissed(attempts, conceptId),
      suggestedAction:
        members.length >= WARM_UP_SHARE * students.length ? "warm_up" : "small_group",
    };
    const code = dominantMisconception(attempts, conceptId);
    if (code !== undefined) group.dominantMisconception = code;
    groups.push(group);
  }
  if (merged.length > 0) {
    groups.push({
      id: "other",
      kind: "other",
      studentIds: merged.flatMap(([, members]) => members.map((m) => m.studentId)),
      suggestedQuestionIds: [],
      suggestedAction: "small_group",
    });
  }
  if (notAttempted.length > 0) {
    groups.push({
      id: "not_attempted",
      kind: "not_attempted",
      studentIds: notAttempted,
      suggestedQuestionIds: [],
      suggestedAction: "paper_check",
    });
  }
  return groups;
}
