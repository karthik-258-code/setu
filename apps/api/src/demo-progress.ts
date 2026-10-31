import type { StudentEvent } from "@setu/engine";

export interface DemoRosterIdentity {
  studentId: string;
  rollNo: string;
}

export interface DatabaseRosterIdentity {
  id: string;
  rollNo: string;
}

/** Replaces browser-demo ids with the matching database student ids by classroom roll. */
export function remapDemoEventsToRoster(
  events: readonly StudentEvent[],
  demoStudents: readonly DemoRosterIdentity[],
  databaseStudents: readonly DatabaseRosterIdentity[],
  excludedRollNos: readonly string[] = [],
): StudentEvent[] {
  const rollByDemoId = new Map<string, string>();
  for (const student of demoStudents) {
    if (rollByDemoId.has(student.studentId)) throw new Error(`Duplicate demo student id ${student.studentId}`);
    rollByDemoId.set(student.studentId, student.rollNo);
  }

  const databaseIdByRoll = new Map<string, string>();
  for (const student of databaseStudents) {
    if (databaseIdByRoll.has(student.rollNo)) throw new Error(`Duplicate database roll ${student.rollNo}`);
    databaseIdByRoll.set(student.rollNo, student.id);
  }

  for (const student of demoStudents) {
    if (!databaseIdByRoll.has(student.rollNo)) {
      throw new Error(`No database student found for demo roll ${student.rollNo}`);
    }
  }

  const excludedRolls = new Set(excludedRollNos);
  return events.flatMap((event) => {
    const rollNo = rollByDemoId.get(event.studentId);
    if (rollNo === undefined) throw new Error(`No demo roster entry found for event student ${event.studentId}`);
    if (excludedRolls.has(rollNo)) return [];
    const studentId = databaseIdByRoll.get(rollNo);
    if (studentId === undefined) throw new Error(`No database student found for demo roll ${rollNo}`);
    return [{ ...event, studentId }];
  });
}

/** Adds missing generated events only for students who do not already have real activity. */
export function planDemoProgress(
  events: readonly StudentEvent[],
  existingEvents: readonly Pick<StudentEvent, "id" | "studentId">[],
  options: { allowExistingActivity?: boolean } = {},
): { pending: StudentEvent[]; skippedStudents: number } {
  const generatedById = new Map(events.map((event) => [event.id, event]));
  if (generatedById.size !== events.length) throw new Error("Generated activity contains duplicate event ids");

  const allowExistingActivity = options.allowExistingActivity ?? false;
  const existingIds = new Set<string>();
  const studentsWithExistingActivity = new Set<string>();
  for (const existing of existingEvents) {
    const generated = generatedById.get(existing.id);
    if (generated && generated.studentId !== existing.studentId) {
      throw new Error(`Generated event ${existing.id} already belongs to another student`);
    }
    if (generated) {
      existingIds.add(existing.id);
    } else if (!allowExistingActivity) {
      studentsWithExistingActivity.add(existing.studentId);
    }
  }

  const generatedStudents = new Set(events.map((event) => event.studentId));
  return {
    pending: events.filter(
      (event) => !studentsWithExistingActivity.has(event.studentId) && !existingIds.has(event.id),
    ),
    skippedStudents: allowExistingActivity
      ? 0
      : [...studentsWithExistingActivity].filter((studentId) => generatedStudents.has(studentId)).length,
  };
}
