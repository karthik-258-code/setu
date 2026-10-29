import { buildGapGroups, studentRootCause } from "./grouping";
import type { AttemptsByStudent, ClassroomStudent } from "./grouping";
import { RECHECK_QUESTIONS } from "./recheck";
import { replay } from "./replay";
import { MASTERY_THRESHOLD } from "./types";
import type {
  AttemptEvent,
  ChapterId,
  ConceptId,
  ContentPack,
  IsoTimestamp,
  MarkTaughtEvent,
  StudentEvent,
  StudentId,
  StudentSummary,
  WeeklyView,
} from "./types";

/** One student and their full event log, as the weekly view needs it. */
export interface WeeklyStudent extends StudentSummary {
  events: readonly StudentEvent[];
}

function parseTs(ts: IsoTimestamp): number {
  const t = Date.parse(ts);
  if (!Number.isFinite(t)) throw new RangeError(`Invalid timestamp: ${ts}`);
  return t;
}

function upTo(events: readonly StudentEvent[], t: number): StudentEvent[] {
  return events.filter((e) => Date.parse(e.ts) <= t);
}

function isAttempt(e: StudentEvent): e is AttemptEvent {
  return e.type === "attempt";
}

function byTsThenId(a: StudentEvent, b: StudentEvent): number {
  return Date.parse(a.ts) - Date.parse(b.ts) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** The classroom as it stood at instant `t`: replayed states and attempts up to `t`. */
function classroomAt(
  pack: ContentPack,
  students: readonly WeeklyStudent[],
  t: number,
): { students: ClassroomStudent[]; attempts: AttemptsByStudent } {
  const attempts: Record<StudentId, AttemptEvent[]> = {};
  const list = students.map((s): ClassroomStudent => {
    const events = upTo(s.events, t);
    attempts[s.studentId] = events.filter(isAttempt);
    return {
      studentId: s.studentId,
      displayName: s.displayName,
      rollNo: s.rollNo,
      state: replay(pack, events, s.studentId),
    };
  });
  return { students: list, attempts };
}

function groupIdByStudent(
  pack: ContentPack,
  chapterId: ChapterId,
  classroom: { students: ClassroomStudent[]; attempts: AttemptsByStudent },
): Map<StudentId, string> {
  const ids = new Map<StudentId, string>();
  for (const group of buildGapGroups(pack, chapterId, classroom.students, classroom.attempts)) {
    for (const id of group.studentIds) ids.set(id, group.id);
  }
  return ids;
}

/**
 * The teacher's weekly view for `chapterId` over [from, to] (BUILD_PLAN 5.7), built only from
 * replayed events so it agrees with the Gap Map and groups:
 * - `moved`: students whose group (`buildGapGroups`) at `to` differs from their group at `from`;
 * - `blockingConcepts`: root-cause gaps at `to` with the number of students blocked, most first;
 * - `recheckResults`: per concept marked taught in the window, the earliest `taughtAt` and how many
 *   of the taught students passed or failed the after-taught re-check, judged by `pKnown` once
 *   their `RECHECK_QUESTIONS`th re-check attempt after their mark-taught event is replayed.
 *   Students who have not finished that round yet are not counted.
 * Throws if a timestamp is invalid or `from` is after `to`.
 */
export function buildWeeklyView(
  pack: ContentPack,
  chapterId: ChapterId,
  students: readonly WeeklyStudent[],
  from: IsoTimestamp,
  to: IsoTimestamp,
): WeeklyView {
  const tFrom = parseTs(from);
  const tTo = parseTs(to);
  if (tFrom > tTo) throw new RangeError(`Weekly view: from ${from} is after to ${to}`);
  const rank = (id: ConceptId): number => pack.graph.topoOrder.indexOf(id);

  const after = classroomAt(pack, students, tTo);
  const groupsBefore = groupIdByStudent(pack, chapterId, classroomAt(pack, students, tFrom));
  const groupsAfter = groupIdByStudent(pack, chapterId, after);
  const moved: WeeklyView["moved"] = [];
  for (const s of students) {
    const fromGroupId = groupsBefore.get(s.studentId);
    const toGroupId = groupsAfter.get(s.studentId);
    if (fromGroupId !== undefined && toGroupId !== undefined && fromGroupId !== toGroupId) {
      moved.push({ studentId: s.studentId, fromGroupId, toGroupId });
    }
  }

  const blocked = new Map<ConceptId, number>();
  for (const s of after.students) {
    const gap = studentRootCause(pack, chapterId, s.state);
    if (gap !== null) blocked.set(gap, (blocked.get(gap) ?? 0) + 1);
  }
  const blockingConcepts = [...blocked.entries()]
    .sort((a, b) => b[1] - a[1] || rank(a[0]) - rank(b[0]))
    .map(([conceptId, studentCount]) => ({ conceptId, studentCount }));

  const results = new Map<ConceptId, { taughtAt: IsoTimestamp; passed: number; failed: number }>();
  for (const s of students) {
    const taught = new Map<ConceptId, MarkTaughtEvent>();
    for (const e of s.events) {
      if (e.type !== "mark_taught") continue;
      const t = Date.parse(e.ts);
      if (t < tFrom || t > tTo) continue;
      const earlier = taught.get(e.conceptId);
      if (!earlier || t < Date.parse(earlier.ts)) taught.set(e.conceptId, e);
    }
    for (const [conceptId, mark] of taught) {
      const entry = results.get(conceptId) ?? { taughtAt: mark.ts, passed: 0, failed: 0 };
      if (Date.parse(mark.ts) < Date.parse(entry.taughtAt)) entry.taughtAt = mark.ts;
      const round = s.events
        .filter(isAttempt)
        .filter(
          (a) =>
            a.conceptId === conceptId &&
            a.mode === "recheck" &&
            Date.parse(a.ts) >= Date.parse(mark.ts) &&
            Date.parse(a.ts) <= tTo,
        )
        .sort(byTsThenId);
      const last = round[RECHECK_QUESTIONS - 1];
      if (last) {
        const state = replay(pack, upTo(s.events, Date.parse(last.ts)), s.studentId);
        if ((state.mastery[conceptId]?.pKnown ?? 0) >= MASTERY_THRESHOLD) entry.passed += 1;
        else entry.failed += 1;
      }
      results.set(conceptId, entry);
    }
  }
  const recheckResults = [...results.entries()]
    .sort((a, b) => Date.parse(a[1].taughtAt) - Date.parse(b[1].taughtAt) || rank(a[0]) - rank(b[0]))
    .map(([conceptId, r]) => ({
      conceptId,
      taughtAt: r.taughtAt,
      passed: r.passed,
      failed: r.failed,
    }));

  return { chapterId, from, to, moved, blockingConcepts, recheckResults };
}
