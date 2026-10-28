/**
 * Everything the routes need from storage (ARCHITECTURE 8.3). `PrismaStore` is the production
 * implementation; `MemoryStore` keeps the same contract in memory for tests and local runs.
 * Events are the source of truth; mastery and re-check rows are materialised from replay.
 */
import type { StudentEvent, StudentState } from "@setu/engine";
import type { LaunchedChapter } from "@setu/shared";

export interface StoredTeacher {
  id: string;
  schoolId: string;
  name: string;
  email: string;
  passwordHash: string;
  /** "teacher" sees assigned classrooms; "coordinator" sees every classroom of the school. */
  role: "teacher" | "coordinator";
}

export interface StoredClassroom {
  id: string;
  schoolId: string;
  classLevel: 6 | 7 | 8 | 9 | 10;
  section: string;
  code: string;
  launchedChapters: LaunchedChapter[];
}

export interface StoredStudent {
  id: string;
  classroomId: string;
  firstName: string;
  rollNo: string;
  pinHash: string;
  lang: "en" | "te" | "hi";
}

export interface EventOrigin {
  deviceId?: string;
  teacherId?: string;
}

export interface Store {
  teacherByEmail(email: string): Promise<StoredTeacher | undefined>;
  teacherById(id: string): Promise<StoredTeacher | undefined>;
  /** Classrooms a teacher may see: assigned ones, or the whole school for a coordinator. */
  classroomsForTeacher(teacherId: string): Promise<StoredClassroom[]>;
  classroomById(id: string): Promise<StoredClassroom | undefined>;
  classroomByCode(code: string): Promise<StoredClassroom | undefined>;
  setLaunchedChapters(classroomId: string, launched: LaunchedChapter[]): Promise<void>;
  studentById(id: string): Promise<StoredStudent | undefined>;
  studentByRoll(classroomId: string, rollNo: string): Promise<StoredStudent | undefined>;
  studentsInClassroom(classroomId: string): Promise<StoredStudent[]>;
  /** Inserts events whose id is new and returns those ids; existing ids are left untouched. */
  insertEvents(events: readonly StudentEvent[], origin: EventOrigin): Promise<string[]>;
  /** A student's events in replay order (`ts`, then `id`). */
  eventsForStudent(studentId: string): Promise<StudentEvent[]>;
  /** Replaces the student's materialised mastery and re-check rows with `state`'s. */
  saveMaterialised(studentId: string, state: StudentState): Promise<void>;
  recordSyncBatch(deviceId: string, eventCount: number): Promise<void>;
}

/** Replay order used by the engine: by `ts`, then by `id`. */
export function byReplayOrder(a: StudentEvent, b: StudentEvent): number {
  if (a.ts !== b.ts) return a.ts < b.ts ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
