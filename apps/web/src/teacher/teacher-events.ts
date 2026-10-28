import type { AttemptEvent, TeacherEvent } from "@setu/engine";
import { apiClient } from "../data/api";
import { newId } from "../data/ids";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A teacher action as a screen builds it; ids, time, student and teacher are filled in here. */
export type TeacherEventDraft = DistributiveOmit<
  Exclude<TeacherEvent, AttemptEvent>,
  "id" | "ts" | "sessionId" | "studentId" | "teacherId"
>;

/** Posts the same teacher action once for each student, through the current `ApiClient`. */
export async function postForStudents(
  classroomId: string,
  teacherId: string | null,
  studentIds: readonly string[],
  draft: TeacherEventDraft,
): Promise<void> {
  if (teacherId === null) throw new Error("No teacher is signed in");
  const ts = new Date().toISOString();
  for (const studentId of studentIds) {
    const event = { ...draft, id: newId(), ts, studentId, teacherId } as TeacherEvent;
    await apiClient().postTeacherEvent(classroomId, event);
  }
}
