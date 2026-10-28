/** The `Store` contract over PostgreSQL with Prisma (ARCHITECTURE 8.3). */
import type { PrismaClient, Prisma } from "@prisma/client";
import type { StudentEvent, StudentState } from "@setu/engine";
import type { LaunchedChapter } from "@setu/shared";
import { byReplayOrder } from "./store";
import type { EventOrigin, Store, StoredClassroom, StoredStudent, StoredTeacher } from "./store";

type ClassroomRow = {
  id: string;
  schoolId: string;
  classLevel: number;
  section: string;
  code: string;
  launchedChapters: Prisma.JsonValue;
};

function toClassroom(row: ClassroomRow): StoredClassroom {
  return {
    id: row.id,
    schoolId: row.schoolId,
    classLevel: row.classLevel as StoredClassroom["classLevel"],
    section: row.section,
    code: row.code,
    launchedChapters: (Array.isArray(row.launchedChapters) ? row.launchedChapters : []) as unknown as LaunchedChapter[],
  };
}

function toTeacher(row: { id: string; schoolId: string; name: string; email: string; passwordHash: string; role: string }): StoredTeacher {
  return { ...row, role: row.role === "coordinator" ? "coordinator" : "teacher" };
}

function toStudent(row: { id: string; classroomId: string; firstName: string; rollNo: string; pinHash: string; lang: string }): StoredStudent {
  const lang = row.lang === "te" || row.lang === "hi" ? row.lang : "en";
  return { ...row, lang };
}

export class PrismaStore implements Store {
  private readonly db: PrismaClient;

  constructor(db: PrismaClient) {
    this.db = db;
  }

  async teacherByEmail(email: string) {
    const row = await this.db.teacher.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    return row ? toTeacher(row) : undefined;
  }

  async teacherById(id: string) {
    const row = await this.db.teacher.findUnique({ where: { id } });
    return row ? toTeacher(row) : undefined;
  }

  async classroomsForTeacher(teacherId: string) {
    const teacher = await this.teacherById(teacherId);
    if (!teacher) return [];
    const rows = await this.db.classroom.findMany({
      where:
        teacher.role === "coordinator"
          ? { schoolId: teacher.schoolId }
          : { teacherAssignments: { some: { teacherId } } },
      orderBy: [{ classLevel: "asc" }, { section: "asc" }],
    });
    return rows.map(toClassroom);
  }

  async classroomById(id: string) {
    const row = await this.db.classroom.findUnique({ where: { id } });
    return row ? toClassroom(row) : undefined;
  }

  async classroomByCode(code: string) {
    const row = await this.db.classroom.findUnique({ where: { code: code.toUpperCase() } });
    return row ? toClassroom(row) : undefined;
  }

  async setLaunchedChapters(classroomId: string, launched: LaunchedChapter[]) {
    await this.db.classroom.update({
      where: { id: classroomId },
      data: { launchedChapters: launched as unknown as Prisma.InputJsonValue },
    });
  }

  async studentById(id: string) {
    const row = await this.db.student.findUnique({ where: { id } });
    return row ? toStudent(row) : undefined;
  }

  async studentByRoll(classroomId: string, rollNo: string) {
    const row = await this.db.student.findUnique({ where: { classroomId_rollNo: { classroomId, rollNo } } });
    return row ? toStudent(row) : undefined;
  }

  async studentsInClassroom(classroomId: string) {
    const rows = await this.db.student.findMany({ where: { classroomId } });
    return rows
      .map(toStudent)
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true }));
  }

  async insertEvents(events: readonly StudentEvent[], origin: EventOrigin) {
    if (events.length === 0) return [];
    if (origin.deviceId !== undefined) await this.touchDevice(origin.deviceId);
    const existing = new Set(
      (await this.db.event.findMany({ where: { id: { in: events.map((e) => e.id) } }, select: { id: true } })).map(
        (r) => r.id,
      ),
    );
    const fresh = events.filter((e, i) => !existing.has(e.id) && events.findIndex((x) => x.id === e.id) === i);
    await this.db.event.createMany({
      data: fresh.map((e) => ({
        id: e.id,
        studentId: e.studentId,
        type: e.type,
        payload: e as unknown as Prisma.InputJsonValue,
        ts: new Date(e.ts),
        deviceId: origin.deviceId ?? null,
        teacherId: origin.teacherId ?? null,
      })),
      skipDuplicates: true,
    });
    return fresh.map((e) => e.id);
  }

  async eventsForStudent(studentId: string) {
    const rows = await this.db.event.findMany({ where: { studentId }, select: { payload: true } });
    return rows.map((r) => r.payload as unknown as StudentEvent).sort(byReplayOrder);
  }

  async saveMaterialised(studentId: string, state: StudentState) {
    await this.db.$transaction([
      this.db.masteryState.deleteMany({ where: { studentId } }),
      this.db.masteryState.createMany({
        data: Object.values(state.mastery).map((m) => ({
          studentId,
          conceptId: m.conceptId,
          pKnown: m.pKnown,
          attempts: m.attempts,
          masteredAt: m.masteredAt === undefined ? null : new Date(m.masteredAt),
          source: m.source,
        })),
      }),
      this.db.recheck.deleteMany({ where: { studentId } }),
      this.db.recheck.createMany({
        data: state.rechecks.map((r) => ({
          studentId,
          conceptId: r.conceptId,
          dueAt: new Date(r.dueAt),
          kind: r.kind,
        })),
      }),
    ]);
  }

  async recordSyncBatch(deviceId: string, eventCount: number) {
    await this.touchDevice(deviceId);
    await this.db.syncBatch.create({ data: { deviceId, eventCount } });
  }

  private async touchDevice(deviceId: string) {
    await this.db.device.upsert({
      where: { id: deviceId },
      create: { id: deviceId, label: deviceId, lastSeenAt: new Date() },
      update: { lastSeenAt: new Date() },
    });
  }
}
