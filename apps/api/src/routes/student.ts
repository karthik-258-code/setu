import type { StudentEvent, StudentState } from "@setu/engine";
import { MAX_SYNC_EVENTS, chapterParamsSchema, studentEventSchema } from "@setu/shared";
import type { ClassroomSummary, SyncResponse } from "@setu/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { signedInStudent } from "../authz";
import { nowOf } from "../deps";
import type { ApiDeps } from "../deps";
import { ApiError, parseOr400 } from "../errors";
import { latestChapterId, packFor, replayStudent } from "../replay";

/** The envelope is checked as a whole; each event on its own, so one bad event is rejected, not the batch. */
const syncEnvelopeSchema = z
  .object({
    deviceId: z.string().min(1),
    events: z.array(z.unknown()).max(MAX_SYNC_EVENTS),
  })
  .strict();

/** Event types a student device may send; teacher actions arrive through teacher routes. */
const DEVICE_EVENT_TYPES = new Set<StudentEvent["type"]>(["attempt", "learn_viewed", "readiness_completed"]);

function idOf(raw: unknown): string {
  return typeof raw === "object" && raw !== null && "id" in raw ? String((raw as { id: unknown }).id) : "";
}

/** GET /packs/:chapterId, GET /me/state, POST /sync (ARCHITECTURE 8.1, 8.2). */
export const studentRoutes: FastifyPluginAsync<{ deps: ApiDeps }> = async (app, { deps }) => {
  app.get("/packs/:chapterId", async (request, reply) => {
    const { chapterId } = parseOr400(chapterParamsSchema, request.params);
    const pack = await packFor(deps, chapterId);
    const etag = `"${pack.packVersion}"`;
    reply.header("ETag", etag).header("Cache-Control", "public, max-age=0, must-revalidate");
    if (request.headers["if-none-match"] === etag) return reply.code(304).send();
    return pack;
  });

  // The signed-in student's own classroom, so a device can pick up the latest launched chapter.
  app.get("/me/classroom", async (request): Promise<ClassroomSummary> => {
    const student = await signedInStudent(deps, request);
    const c = await deps.store.classroomById(student.classroomId);
    if (!c) throw new ApiError(404, "NOT_FOUND", "Classroom not found");
    return { id: c.id, classLevel: c.classLevel, section: c.section, code: c.code, launchedChapters: c.launchedChapters };
  });

  app.get("/me/state", async (request): Promise<StudentState> => {
    const student = await signedInStudent(deps, request);
    const classroom = await deps.store.classroomById(student.classroomId);
    if (!classroom) throw new ApiError(404, "NOT_FOUND", "Classroom not found");
    return replayStudent(deps, await packFor(deps, latestChapterId(classroom)), student.id);
  });

  app.post("/sync", async (request): Promise<SyncResponse> => {
    const student = await signedInStudent(deps, request);
    const body = parseOr400(syncEnvelopeSchema, request.body);
    const valid: StudentEvent[] = [];
    const rejected: SyncResponse["rejected"] = [];
    for (const raw of body.events) {
      const parsed = studentEventSchema.safeParse(raw);
      if (!parsed.success) {
        rejected.push({ id: idOf(raw), reason: `invalid event: ${parsed.error.issues[0]?.message ?? "schema"}` });
        continue;
      }
      const event = parsed.data as StudentEvent;
      if (event.studentId !== student.id) {
        rejected.push({ id: event.id, reason: "event belongs to another student" });
      } else if (!DEVICE_EVENT_TYPES.has(event.type)) {
        rejected.push({ id: event.id, reason: `${event.type} events come from a teacher, not a device` });
      } else {
        valid.push(event);
      }
    }
    // Idempotent: an id already stored is accepted again without a second insert.
    await deps.store.insertEvents(valid, { deviceId: body.deviceId });
    await deps.store.recordSyncBatch(body.deviceId, valid.length);
    const classroom = await deps.store.classroomById(student.classroomId);
    const launched = classroom?.launchedChapters[classroom.launchedChapters.length - 1];
    if (launched && valid.length > 0) {
      const pack = await packFor(deps, launched.chapterId);
      await deps.store.saveMaterialised(student.id, await replayStudent(deps, pack, student.id));
    }
    return { accepted: valid.map((e) => e.id), rejected, serverTime: nowOf(deps).toISOString() };
  });
};
