import type { StudentEvent, StudentState } from "@setu/engine";
import type { LaunchedChapter } from "@setu/shared";
import { byReplayOrder } from "./store";
import type {
  EventOrigin,
  Store,
  StoredClassroom,
  StoredStudent,
  StoredTeacher,
} from "./store";

export interface MemorySeed {
  teachers?: StoredTeacher[];
  classrooms?: StoredClassroom[];
  students?: StoredStudent[];
  /** teacherId -> classroomIds */
  assignments?: Record<string, string[]>;
}

/** The `Store` contract in memory: for tests and for running the API without Postgres. */
export class MemoryStore implements Store {
  readonly teachers = new Map<string, StoredTeacher>();
  readonly classrooms = new Map<string, StoredClassroom>();
  readonly students = new Map<string, StoredStudent>();
  readonly assignments = new Map<string, Set<string>>();
  readonly events = new Map<string, { event: StudentEvent; origin: EventOrigin }>();
  readonly materialised = new Map<string, StudentState>();
  readonly syncBatches: { deviceId: string; eventCount: number }[] = [];

  constructor(seed: MemorySeed = {}) {
    for (const t of seed.teachers ?? []) this.teachers.set(t.id, t);
    for (const c of seed.classrooms ?? []) this.classrooms.set(c.id, c);
    for (const s of seed.students ?? []) this.students.set(s.id, s);
    for (const [teacherId, ids] of Object.entries(seed.assignments ?? {})) {
      this.assignments.set(teacherId, new Set(ids));
    }
  }

  async teacherByEmail(email: string) {
    return [...this.teachers.values()].find((t) => t.email.toLowerCase() === email.toLowerCase());
  }

  async teacherById(id: string) {
    return this.teachers.get(id);
  }

  async classroomsForTeacher(teacherId: string) {
    const teacher = this.teachers.get(teacherId);
    if (!teacher) return [];
    const assigned = this.assignments.get(teacherId) ?? new Set<string>();
    return [...this.classrooms.values()]
      .filter((c) =>
        teacher.role === "coordinator" ? c.schoolId === teacher.schoolId : assigned.has(c.id),
      )
      .sort((a, b) => a.classLevel - b.classLevel || a.section.localeCompare(b.section));
  }

  async classroomById(id: string) {
    return this.classrooms.get(id);
  }

  async classroomByCode(code: string) {
    return [...this.classrooms.values()].find((c) => c.code.toUpperCase() === code.toUpperCase());
  }

  async setLaunchedChapters(classroomId: string, launched: LaunchedChapter[]) {
    const classroom = this.classrooms.get(classroomId);
    if (classroom) this.classrooms.set(classroomId, { ...classroom, launchedChapters: launched });
  }

  async studentById(id: string) {
    return this.students.get(id);
  }

  async studentByRoll(classroomId: string, rollNo: string) {
    return [...this.students.values()].find((s) => s.classroomId === classroomId && s.rollNo === rollNo);
  }

  async studentsInClassroom(classroomId: string) {
    return [...this.students.values()]
      .filter((s) => s.classroomId === classroomId)
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true }));
  }

  async insertEvents(events: readonly StudentEvent[], origin: EventOrigin) {
    const inserted: string[] = [];
    for (const event of events) {
      if (this.events.has(event.id)) continue;
      this.events.set(event.id, { event, origin });
      inserted.push(event.id);
    }
    return inserted;
  }

  async eventsForStudent(studentId: string) {
    return [...this.events.values()]
      .map((e) => e.event)
      .filter((e) => e.studentId === studentId)
      .sort(byReplayOrder);
  }

  async saveMaterialised(studentId: string, state: StudentState) {
    this.materialised.set(studentId, state);
  }

  async recordSyncBatch(deviceId: string, eventCount: number) {
    this.syncBatches.push({ deviceId, eventCount });
  }
}
