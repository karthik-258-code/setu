/**
 * `ApiClient` that runs entirely in the browser (ARCHITECTURE 7.4): the demo classroom lives in
 * Dexie and every teacher view is computed with the same engine functions the API uses. The
 * Prove-round demo needs nothing else.
 */
import { buildGapGroups, buildGapMap, buildWeeklyView } from "@setu/engine";
import type {
  AttemptEvent,
  AttemptsByStudent,
  ClassroomStudent,
  ContentPack,
  GapGroup,
  GapMap,
  StudentEvent,
  StudentState,
  TeacherEvent,
  WeeklyStudent,
  WeeklyView,
} from "@setu/engine";
import { studentEventSchema, teacherEventSchema } from "@setu/shared";
import type {
  ApiClient,
  ClassroomSummary,
  LaunchRequest,
  LaunchResponse,
  StudentLoginRequest,
  StudentLoginResponse,
  SyncResponse,
  TeacherLoginRequest,
  TeacherLoginResponse,
} from "@setu/shared";
import type { SetuDb } from "./db";
import { DEMO_CLASSROOM, DEMO_ROSTER_KEY, DEMO_STUDENTS, DEMO_TEACHER } from "./demo-seed";
import type { DemoStudent } from "./demo-seed";
import { loadState, studentEvents } from "./event-store";

const LAUNCHES_KEY = "demo:launches";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** A demo request that the demo classroom cannot satisfy, with an API-style error code. */
export class DemoApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "DemoApiError";
    this.code = code;
  }
}

function isAttempt(e: StudentEvent): e is AttemptEvent {
  return e.type === "attempt";
}

export class LocalDemoApiClient implements ApiClient {
  private readonly db: SetuDb;
  private readonly loadPack: (chapterId: string) => Promise<ContentPack>;
  private readonly now: () => Date;
  private studentId: string | null = null;

  constructor(
    db: SetuDb,
    loadPack: (chapterId: string) => Promise<ContentPack>,
    now: () => Date = () => new Date(),
  ) {
    this.db = db;
    this.loadPack = loadPack;
    this.now = now;
  }

  async login(request: TeacherLoginRequest): Promise<TeacherLoginResponse> {
    if (request.email !== DEMO_TEACHER.email || request.password !== DEMO_TEACHER.password) {
      throw new DemoApiError("INVALID_CREDENTIALS", "Unknown demo teacher or wrong password");
    }
    return { accessToken: `demo:${DEMO_TEACHER.teacherId}`, refreshToken: "demo:refresh" };
  }

  async studentLogin(request: StudentLoginRequest): Promise<StudentLoginResponse> {
    const student = (await this.roster()).find((s) => s.rollNo === request.rollNo);
    if (request.classroomCode !== DEMO_CLASSROOM.code || !student || student.pin !== request.pin) {
      throw new DemoApiError("INVALID_CREDENTIALS", "Unknown classroom, roll number or PIN");
    }
    this.studentId = student.studentId;
    return {
      accessToken: `demo:${student.studentId}`,
      student: {
        studentId: student.studentId,
        firstName: student.firstName,
        rollNo: student.rollNo,
        classroomId: DEMO_CLASSROOM.id,
        lang: student.lang,
      },
    };
  }

  async getMyState(): Promise<StudentState> {
    if (this.studentId === null) throw new DemoApiError("UNAUTHORIZED", "No student is logged in");
    const launched = (await this.getClassrooms())[0]?.launchedChapters ?? [];
    const chapterId = launched[launched.length - 1]?.chapterId;
    if (chapterId === undefined) throw new DemoApiError("NOT_FOUND", "No chapter is launched");
    return loadState(this.db, await this.loadPack(chapterId), this.studentId);
  }

  async getPack(chapterId: string): Promise<ContentPack> {
    return this.loadPack(chapterId);
  }

  /** The demo "server" is this device: valid events of demo students are accepted and marked synced. */
  async sync(events: StudentEvent[]): Promise<SyncResponse> {
    const known = new Set((await this.roster()).map((s) => s.studentId));
    const accepted: StudentEvent[] = [];
    const rejected: SyncResponse["rejected"] = [];
    for (const raw of events) {
      if (!studentEventSchema.safeParse(raw).success) {
        rejected.push({ id: String(raw.id), reason: "invalid event" });
      } else if (!known.has(raw.studentId)) {
        rejected.push({ id: raw.id, reason: `unknown student ${raw.studentId}` });
      } else {
        accepted.push(raw);
      }
    }
    await this.db.events.bulkPut(accepted.map((e) => ({ ...e, synced: 1 as const })));
    return {
      accepted: accepted.map((e) => e.id),
      rejected,
      serverTime: this.now().toISOString(),
    };
  }

  async getClassrooms(): Promise<ClassroomSummary[]> {
    const stored = await this.storedLaunches();
    const launchedChapters = [
      ...DEMO_CLASSROOM.launchedChapters.filter(
        (l) => !stored.some((s) => s.chapterId === l.chapterId),
      ),
      ...stored,
    ];
    return [{ ...DEMO_CLASSROOM, launchedChapters }];
  }

  async launchChapter(classroomId: string, request: LaunchRequest): Promise<LaunchResponse> {
    this.requireClassroom(classroomId);
    const pack = await this.loadPack(request.chapterId);
    if (!pack.graph.chapters[request.chapterId]) {
      throw new DemoApiError("NOT_FOUND", `Unknown chapter ${request.chapterId}`);
    }
    const launch: LaunchResponse = {
      chapterId: request.chapterId,
      trimmed: [...request.trimmed],
      launchedAt: this.now().toISOString(),
    };
    const stored = await this.storedLaunches();
    await this.db.meta.put({
      key: LAUNCHES_KEY,
      value: [...stored.filter((s) => s.chapterId !== request.chapterId), launch],
    });
    return launch;
  }

  async getGapMap(classroomId: string, chapterId: string): Promise<GapMap> {
    this.requireClassroom(classroomId);
    const pack = await this.loadPack(chapterId);
    return buildGapMap(pack, chapterId, await this.classroomStudents(pack));
  }

  async getGroups(classroomId: string, chapterId: string): Promise<GapGroup[]> {
    this.requireClassroom(classroomId);
    const pack = await this.loadPack(chapterId);
    const attempts: Record<string, AttemptEvent[]> = {};
    for (const s of await this.roster()) {
      attempts[s.studentId] = (await studentEvents(this.db, s.studentId)).filter(isAttempt);
    }
    const byStudent: AttemptsByStudent = attempts;
    return buildGapGroups(pack, chapterId, await this.classroomStudents(pack), byStudent);
  }

  async getEvidence(
    classroomId: string,
    studentId: string,
    conceptId: string,
  ): Promise<AttemptEvent[]> {
    this.requireClassroom(classroomId);
    await this.requireStudent(studentId);
    return (await studentEvents(this.db, studentId))
      .filter(isAttempt)
      .filter((a) => a.conceptId === conceptId)
      .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  }

  async postTeacherEvent(classroomId: string, event: TeacherEvent): Promise<void> {
    this.requireClassroom(classroomId);
    if (!teacherEventSchema.safeParse(event).success) {
      throw new DemoApiError("BAD_REQUEST", "Invalid teacher event");
    }
    await this.requireStudent(event.studentId);
    await this.db.events.put({ ...event, synced: 1 });
  }

  async getWeekly(classroomId: string, chapterId: string): Promise<WeeklyView> {
    this.requireClassroom(classroomId);
    const pack = await this.loadPack(chapterId);
    const to = this.now();
    const from = new Date(to.getTime() - WEEK_MS);
    const students: WeeklyStudent[] = [];
    for (const s of await this.roster()) {
      students.push({
        studentId: s.studentId,
        displayName: s.firstName,
        rollNo: s.rollNo,
        events: await studentEvents(this.db, s.studentId),
      });
    }
    return buildWeeklyView(pack, chapterId, students, from.toISOString(), to.toISOString());
  }

  /** The seeded roster once `/demo` has stored it (6.1), otherwise the two-student stub. */
  private async roster(): Promise<readonly DemoStudent[]> {
    const stored = (await this.db.meta.get(DEMO_ROSTER_KEY))?.value as DemoStudent[] | undefined;
    return stored ?? DEMO_STUDENTS;
  }

  private async storedLaunches(): Promise<LaunchResponse[]> {
    return ((await this.db.meta.get(LAUNCHES_KEY))?.value ?? []) as LaunchResponse[];
  }

  private requireClassroom(classroomId: string): void {
    if (classroomId !== DEMO_CLASSROOM.id) {
      throw new DemoApiError("NOT_FOUND", `Unknown classroom ${classroomId}`);
    }
  }

  private async requireStudent(studentId: string): Promise<void> {
    if (!(await this.roster()).some((s) => s.studentId === studentId)) {
      throw new DemoApiError("NOT_FOUND", `Student ${studentId} is not in the demo classroom`);
    }
  }

  private async classroomStudents(pack: ContentPack): Promise<ClassroomStudent[]> {
    const students: ClassroomStudent[] = [];
    for (const s of await this.roster()) {
      students.push({
        studentId: s.studentId,
        displayName: s.firstName,
        rollNo: s.rollNo,
        state: await loadState(this.db, pack, s.studentId),
      });
    }
    return students;
  }
}
