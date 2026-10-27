/**
 * Zod schemas for every StudentEvent variant and for TeacherEvent, plus the
 * engine-state schemas they embed. These are what POST /sync and
 * POST /classrooms/:id/events validate against (ARCHITECTURE 8.2).
 * Each schema is drift-checked against packages/engine/src/types.ts via `mirror`.
 */
import { z } from "zod";
import type {
  AssignEvent,
  AttemptEvent,
  ExtensionLockEvent,
  GroupEditEvent,
  LearnViewedEvent,
  MarkTaughtEvent,
  ReadinessCompletedEvent,
  ReadinessSummary,
  StudentEvent,
  TeacherEvent,
  TeacherOverrideEvent,
} from "@setu/engine";
import { mirror } from "./mirror";

export const nonEmpty = z.string().min(1);
export const isoTimestampSchema = z.string().datetime({ offset: true });
export const difficultySchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export const modeSchema = z.enum([
  "readiness",
  "learn",
  "solve",
  "test",
  "recheck",
  "verify",
  "extension",
]);

const count = z.number().int().nonnegative();

export const readinessSummarySchema = mirror<ReadinessSummary>()(
  z
    .object({
      chapterId: nonEmpty,
      cleared: z.array(nonEmpty),
      failed: z.array(nonEmpty),
      uncertain: z.array(nonEmpty),
      pending: z.array(nonEmpty),
      itemsUsed: count,
      advancedEntry: z.boolean(),
      misconceptions: z.record(count),
      completedAt: isoTimestampSchema,
    })
    .strict(),
);

const eventBaseShape = {
  id: nonEmpty,
  studentId: nonEmpty,
  ts: isoTimestampSchema,
  sessionId: nonEmpty.optional(),
};

export const attemptEventSchema = mirror<AttemptEvent>()(
  z
    .object({
      ...eventBaseShape,
      type: z.literal("attempt"),
      questionId: nonEmpty,
      conceptId: nonEmpty,
      mode: modeSchema,
      difficulty: difficultySchema,
      correct: z.boolean(),
      selectedOptionId: nonEmpty.optional(),
      value: z.number().optional(),
      misconceptionCode: nonEmpty.optional(),
      hintsUsed: count,
      timeMs: count,
      source: z.enum(["device", "paper"]).optional(),
    })
    .strict(),
);

export const learnViewedEventSchema = mirror<LearnViewedEvent>()(
  z
    .object({
      ...eventBaseShape,
      type: z.literal("learn_viewed"),
      conceptId: nonEmpty,
      resourceId: nonEmpty,
    })
    .strict(),
);

export const readinessCompletedEventSchema = mirror<ReadinessCompletedEvent>()(
  z
    .object({
      ...eventBaseShape,
      type: z.literal("readiness_completed"),
      chapterId: nonEmpty,
      summary: readinessSummarySchema,
    })
    .strict(),
);

export const teacherOverrideEventSchema = mirror<TeacherOverrideEvent>()(
  z
    .object({
      ...eventBaseShape,
      type: z.literal("teacher_override"),
      teacherId: nonEmpty,
      conceptId: nonEmpty,
      mastered: z.boolean(),
      note: z.string().optional(),
    })
    .strict(),
);

export const markTaughtEventSchema = mirror<MarkTaughtEvent>()(
  z
    .object({
      ...eventBaseShape,
      type: z.literal("mark_taught"),
      teacherId: nonEmpty,
      conceptId: nonEmpty,
    })
    .strict(),
);

export const assignEventSchema = mirror<AssignEvent>()(
  z
    .object({
      ...eventBaseShape,
      type: z.literal("assign"),
      teacherId: nonEmpty,
      conceptId: nonEmpty,
      questionIds: z.array(nonEmpty).optional(),
    })
    .strict(),
);

export const extensionLockEventSchema = mirror<ExtensionLockEvent>()(
  z
    .object({
      ...eventBaseShape,
      type: z.literal("extension_lock"),
      teacherId: nonEmpty,
      locked: z.boolean(),
    })
    .strict(),
);

export const groupEditEventSchema = mirror<GroupEditEvent>()(
  z
    .object({
      ...eventBaseShape,
      type: z.literal("group_edit"),
      teacherId: nonEmpty,
      chapterId: nonEmpty,
      action: z.enum(["accept", "dismiss", "move", "merge", "split"]),
      fromGroupId: nonEmpty.optional(),
      toGroupId: nonEmpty.optional(),
    })
    .strict(),
);

export const studentEventSchema = mirror<StudentEvent>()(
  z.discriminatedUnion("type", [
    attemptEventSchema,
    learnViewedEventSchema,
    readinessCompletedEventSchema,
    teacherOverrideEventSchema,
    markTaughtEventSchema,
    assignEventSchema,
    extensionLockEventSchema,
    groupEditEventSchema,
  ]),
);

/** Teacher actions, plus `attempt` for paper entry (ARCHITECTURE 8.2). */
export const teacherEventSchema = mirror<TeacherEvent>()(
  z.discriminatedUnion("type", [
    teacherOverrideEventSchema,
    markTaughtEventSchema,
    assignEventSchema,
    extensionLockEventSchema,
    groupEditEventSchema,
    attemptEventSchema,
  ]),
);
