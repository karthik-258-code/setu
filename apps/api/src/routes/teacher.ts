import { buildGapGroups, buildGapMap, buildWeeklyView } from "@setu/engine";
import type {
  AttemptEvent,
  ClassroomStudent,
  ContentPack,
  GapGroup,
  GapMap,
  StudentEvent,
  WeeklyStudent,
  WeeklyView,
} from "@setu/engine";
import {
  chapterQuerySchema,
  classroomParamsSchema,
  evidenceParamsSchema,
  evidenceQuerySchema,
  launchRequestSchema,
  teacherEventRequestSchema,
} from "@setu/shared";
import type { ClassroomSummary, LaunchResponse, TeacherEventResponse } from "@setu/shared";
import type { FastifyPluginAsync } from "fastify";
import { claimsOf, teacherClassroom } from "../authz";
import { nowOf } from "../deps";
import type { ApiDeps } from "../deps";
import { ApiError, parseOr400 } from "../errors";
import { packFor, replayStudent } from "../replay";
import type { StoredClassroom, StoredStudent } from "../store";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function summary(c: StoredClassroom): ClassroomSummary {
  return { id: c.id, classLevel: c.classLevel, section: c.section, code: c.code, launchedChapters: c.launchedChapters };
}

const isAttempt = (e: StudentEvent): e is AttemptEvent => e.type === "attempt";

/**
 * GET /classrooms, POST /classrooms/:id/launch, GET gapmap, groups, evidence and weekly, and
 * POST /classrooms/:id/events (ARCHITECTURE 8.1). Every view is built by the engine from events.
 */
export const teacherRoutes: FastifyPluginAsync<{ deps: ApiDeps }> = async (app, { deps }) => {
  async function classroomStudents(classroom: StoredClassroom, pack: ContentPack) {
    const students = await deps.store.studentsInClassroom(classroom.id);
    return Promise.all(
      students.map(async (s) => ({ student: s, events: await deps.store.eventsForStudent(s.id) })),
    ).then((rows) =>
      rows.map(({ student, events }) => ({ student, events, state: replayOf(pack, student, events) })),
    );
  }

  function replayOf(pack: ContentPack, student: StoredStudent, events: StudentEvent[]) {
    return { pack, student, events };
  }

  async function chapterView(request: Parameters<typeof teacherClassroom>[1], chapterId: string, classroomId: string) {
    const { classroom, teacherId } = await teacherClassroom(deps, request, classroomId);
    const pack = await packFor(deps, chapterId);
    const students = await deps.store.studentsInClassroom(classroom.id);
    const rows = await Promise.all(
      students.map(async (s) => ({
        student: s,
        events: await deps.store.eventsForStudent(s.id),
        state: await replayStudent(deps, pack, s.id),
      })),
    );
    return { classroom, teacherId, pack, rows };
  }
  void classroomStudents;

  app.get("/classrooms", async (request): Promise<ClassroomSummary[]> => {
    const { sub } = claimsOf(deps, request, "teacher");
    return (await deps.store.classroomsForTeacher(sub)).map(summary);
  });

  app.post("/classrooms/:id/launch", async (request): Promise<LaunchResponse> => {
    const { id } = parseOr400(classroomParamsSchema, request.params);
    const body = parseOr400(launchRequestSchema, request.body);
    const { classroom } = await teacherClassroom(deps, request, id);
    const pack = await packFor(deps, body.chapterId);
    if (!pack.graph.chapters[body.chapterId]) {
      throw new ApiError(404, "NOT_FOUND", `Unknown chapter ${body.chapterId}`);
    }
    const launch: LaunchResponse = {
      chapterId: body.chapterId,
      trimmed: [...new Set(body.trimmed)],
      launchedAt: nowOf(deps).toISOString(),
    };
    await deps.store.setLaunchedChapters(classroom.id, [
      ...classroom.launchedChapters.filter((l) => l.chapterId !== body.chapterId),
      launch,
    ]);
    return launch;
  });

  app.get("/classrooms/:id/gapmap", async (request): Promise<GapMap> => {
    const { id } = parseOr400(classroomParamsSchema, request.params);
    const { chapterId } = parseOr400(chapterQuerySchema, request.query);
    const { pack, rows } = await chapterView(request, chapterId, id);
    const students: ClassroomStudent[] = rows.map((r) => ({
      studentId: r.student.id,
      displayName: r.student.firstName,
      rollNo: r.student.rollNo,
      state: r.state,
    }));
    return buildGapMap(pack, chapterId, students);
  });

  app.get("/classrooms/:id/groups", async (request): Promise<GapGroup[]> => {
    const { id } = parseOr400(classroomParamsSchema, request.params);
    const { chapterId } = parseOr400(chapterQuerySchema, request.query);
    const { pack, rows } = await chapterView(request, chapterId, id);
    const students: ClassroomStudent[] = rows.map((r) => ({
      studentId: r.student.id,
      displayName: r.student.firstName,
      rollNo: r.student.rollNo,
      state: r.state,
    }));
    const attempts = Object.fromEntries(rows.map((r) => [r.student.id, r.events.filter(isAttempt)]));
    return buildGapGroups(pack, chapterId, students, attempts);
  });

  app.get("/classrooms/:id/students/:sid/evidence", async (request): Promise<AttemptEvent[]> => {
    const { id, sid } = parseOr400(evidenceParamsSchema, request.params);
    const { conceptId } = parseOr400(evidenceQuerySchema, request.query);
    const { classroom } = await teacherClassroom(deps, request, id);
    const student = await deps.store.studentById(sid);
    if (!student || student.classroomId !== classroom.id) {
      throw new ApiError(404, "NOT_FOUND", `Student ${sid} is not in this classroom`);
    }
    return (await deps.store.eventsForStudent(sid)).filter(isAttempt).filter((a) => a.conceptId === conceptId);
  });

  app.get("/classrooms/:id/weekly", async (request): Promise<WeeklyView> => {
    const { id } = parseOr400(classroomParamsSchema, request.params);
    const { chapterId } = parseOr400(chapterQuerySchema, request.query);
    const { pack, rows } = await chapterView(request, chapterId, id);
    const to = nowOf(deps);
    const students: WeeklyStudent[] = rows.map((r) => ({
      studentId: r.student.id,
      displayName: r.student.firstName,
      rollNo: r.student.rollNo,
      events: r.events,
    }));
    return buildWeeklyView(pack, chapterId, students, new Date(to.getTime() - WEEK_MS).toISOString(), to.toISOString());
  });

  app.post("/classrooms/:id/events", async (request): Promise<TeacherEventResponse> => {
    const { id } = parseOr400(classroomParamsSchema, request.params);
    const event = parseOr400(teacherEventRequestSchema, request.body) as StudentEvent;
    const { classroom, teacherId } = await teacherClassroom(deps, request, id);
    const student = await deps.store.studentById(event.studentId);
    if (!student || student.classroomId !== classroom.id) {
      throw new ApiError(403, "FORBIDDEN", "The student is not in this classroom");
    }
    if ("teacherId" in event && event.teacherId !== teacherId) {
      throw new ApiError(403, "FORBIDDEN", "teacherId must be the signed-in teacher");
    }
    if (event.type === "attempt" && event.source !== "paper") {
      throw new ApiError(400, "BAD_REQUEST", "Teachers can only enter paper attempts");
    }
    await deps.store.insertEvents([event], { teacherId });
    const latest = classroom.launchedChapters[classroom.launchedChapters.length - 1];
    if (latest) {
      const pack = await packFor(deps, latest.chapterId);
      await deps.store.saveMaterialised(student.id, await replayStudent(deps, pack, student.id));
    }
    return { id: event.id, serverTime: nowOf(deps).toISOString() };
  });
};
