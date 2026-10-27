/**
 * Request and response schemas, one pair per endpoint in ARCHITECTURE 8.1.
 * Path parameters and query strings get their own schemas so Fastify validates every input.
 */
import { z } from "zod";
import type { Lang } from "@setu/engine";
import { mirror } from "./mirror";
import {
  attemptEventSchema,
  isoTimestampSchema,
  nonEmpty,
  studentEventSchema,
  teacherEventSchema,
} from "./events";
import {
  contentPackSchema,
  gapGroupSchema,
  gapMapSchema,
  studentStateSchema,
  weeklyViewSchema,
} from "./state";

/** Sync batch cap (ARCHITECTURE 8.2). */
export const MAX_SYNC_EVENTS = 200;

export const langSchema = mirror<Lang>()(z.enum(["en", "te", "hi"]));

// --- Params and queries -----------------------------------------------------

export const chapterParamsSchema = z.object({ chapterId: nonEmpty }).strict();
export const classroomParamsSchema = z.object({ id: nonEmpty }).strict();
export const chapterQuerySchema = z.object({ chapterId: nonEmpty }).strict();
export const evidenceParamsSchema = z.object({ id: nonEmpty, sid: nonEmpty }).strict();
export const evidenceQuerySchema = z.object({ conceptId: nonEmpty }).strict();

// --- POST /auth/teacher/login -----------------------------------------------

export const teacherLoginRequestSchema = z
  .object({ email: z.string().email(), password: nonEmpty })
  .strict();
export const teacherLoginResponseSchema = z
  .object({ accessToken: nonEmpty, refreshToken: nonEmpty })
  .strict();

// --- POST /auth/student/login -----------------------------------------------

export const studentLoginRequestSchema = z
  .object({
    classroomCode: nonEmpty,
    rollNo: nonEmpty,
    pin: z.string().regex(/^\d{4}$/, "PIN must be 4 digits"),
  })
  .strict();

/** Student PII is limited to firstName, rollNo, classroomId, lang (pinHash never leaves the server). */
export const studentProfileSchema = z
  .object({
    studentId: nonEmpty,
    firstName: nonEmpty,
    rollNo: nonEmpty,
    classroomId: nonEmpty,
    lang: langSchema,
  })
  .strict();
export const studentLoginResponseSchema = z
  .object({ accessToken: nonEmpty, student: studentProfileSchema })
  .strict();

// --- POST /auth/refresh -----------------------------------------------------

export const refreshRequestSchema = z.object({ refreshToken: nonEmpty }).strict();
export const refreshResponseSchema = z
  .object({ accessToken: nonEmpty, refreshToken: nonEmpty })
  .strict();

// --- GET /packs/:chapterId, GET /me/state -----------------------------------

export const packResponseSchema = contentPackSchema;
export const meStateResponseSchema = studentStateSchema;

// --- POST /sync -------------------------------------------------------------

export const syncRequestSchema = z
  .object({
    deviceId: nonEmpty,
    events: z.array(studentEventSchema).max(MAX_SYNC_EVENTS),
  })
  .strict();
export const syncResponseSchema = z
  .object({
    accepted: z.array(nonEmpty),
    rejected: z.array(z.object({ id: z.string(), reason: nonEmpty }).strict()),
    serverTime: isoTimestampSchema,
  })
  .strict();

// --- GET /classrooms, POST /classrooms/:id/launch ---------------------------

export const launchedChapterSchema = z
  .object({
    chapterId: nonEmpty,
    /** Prerequisite concepts the teacher removed from the Readiness Check. */
    trimmed: z.array(nonEmpty),
    launchedAt: isoTimestampSchema,
  })
  .strict();
export const classroomSummarySchema = z
  .object({
    id: nonEmpty,
    classLevel: z.union([z.literal(6), z.literal(7), z.literal(8), z.literal(9), z.literal(10)]),
    section: z.string(),
    code: nonEmpty,
    launchedChapters: z.array(launchedChapterSchema),
  })
  .strict();
export const classroomsResponseSchema = z.array(classroomSummarySchema);

export const launchRequestSchema = z
  .object({ chapterId: nonEmpty, trimmed: z.array(nonEmpty) })
  .strict();
export const launchResponseSchema = launchedChapterSchema;

// --- GET /classrooms/:id/{gapmap,groups,students/:sid/evidence,weekly} ------

export const gapMapResponseSchema = gapMapSchema;
export const groupsResponseSchema = z.array(gapGroupSchema);
export const evidenceResponseSchema = z.array(attemptEventSchema);
export const weeklyResponseSchema = weeklyViewSchema;

// --- POST /classrooms/:id/events --------------------------------------------

export const teacherEventRequestSchema = teacherEventSchema;
export const teacherEventResponseSchema = z
  .object({ id: nonEmpty, serverTime: isoTimestampSchema })
  .strict();

// --- GET /health ------------------------------------------------------------

export const healthResponseSchema = z
  .object({ status: z.literal("ok"), version: nonEmpty })
  .strict();

// --- Inferred types ---------------------------------------------------------

export type TeacherLoginRequest = z.infer<typeof teacherLoginRequestSchema>;
export type TeacherLoginResponse = z.infer<typeof teacherLoginResponseSchema>;
export type StudentLoginRequest = z.infer<typeof studentLoginRequestSchema>;
export type StudentLoginResponse = z.infer<typeof studentLoginResponseSchema>;
export type StudentProfile = z.infer<typeof studentProfileSchema>;
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
export type SyncRequest = z.infer<typeof syncRequestSchema>;
export type SyncResponse = z.infer<typeof syncResponseSchema>;
export type LaunchedChapter = z.infer<typeof launchedChapterSchema>;
export type ClassroomSummary = z.infer<typeof classroomSummarySchema>;
export type LaunchRequest = z.infer<typeof launchRequestSchema>;
export type LaunchResponse = z.infer<typeof launchResponseSchema>;
export type TeacherEventResponse = z.infer<typeof teacherEventResponseSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
