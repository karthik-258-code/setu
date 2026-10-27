/**
 * Zod schemas for StudentState, the teacher views and ContentPack, drift-checked
 * against packages/engine/src/types.ts. Content schemas are reused from @setu/content
 * so the pack is validated as deeply as the content files themselves.
 */
import { z } from "zod";
import type {
  ConceptGraph,
  ConceptProgress,
  ContentPack,
  GapGroup,
  GapMap,
  GapMapRow,
  MasteryState,
  Recheck,
  StudentState,
  WeeklyView,
} from "@setu/engine";
import {
  chapterSchema,
  conceptSchema,
  localizedTextSchema,
  misconceptionSchema,
  questionSchema,
  resourceSchema,
} from "@setu/content";
import {
  attemptEventSchema,
  difficultySchema,
  isoTimestampSchema,
  nonEmpty,
  readinessSummarySchema,
} from "./events";
import { mirror } from "./mirror";

const count = z.number().int().nonnegative();
const probability = z.number().min(0).max(1);

// ---------------------------------------------------------------------------
// StudentState (GET /me/state)
// ---------------------------------------------------------------------------

export const masteryStateSchema = mirror<MasteryState>()(
  z
    .object({
      conceptId: nonEmpty,
      pKnown: probability,
      attempts: count,
      correct: count,
      lastAttemptAt: isoTimestampSchema.optional(),
      lastCorrectAt: isoTimestampSchema.optional(),
      masteredAt: isoTimestampSchema.optional(),
      source: z.enum(["model", "teacher_override"]),
      pendingVerification: z.boolean().optional(),
    })
    .strict(),
);

export const conceptProgressSchema = mirror<ConceptProgress>()(
  z
    .object({
      conceptId: nonEmpty,
      difficulty: difficultySchema,
      streakCorrect: count,
      streakWrong: count,
      solveAttempts: count,
      testAttempts: count,
      learnViewed: z.boolean(),
      clearedByReadiness: z.boolean(),
      lastMisconception: nonEmpty.optional(),
      seenQuestionIds: z.array(nonEmpty),
    })
    .strict(),
);

export const recheckSchema = mirror<Recheck>()(
  z
    .object({
      conceptId: nonEmpty,
      dueAt: isoTimestampSchema,
      intervalDays: count,
      kind: z.enum(["spaced", "after_taught", "verify_override"]),
    })
    .strict(),
);

export const studentStateSchema = mirror<StudentState>()(
  z
    .object({
      studentId: nonEmpty,
      mastery: z.record(masteryStateSchema),
      progress: z.record(conceptProgressSchema),
      readiness: z.record(readinessSummarySchema),
      rechecks: z.array(recheckSchema),
      assigned: z.array(
        z.object({ conceptId: nonEmpty, questionIds: z.array(nonEmpty).optional() }).strict(),
      ),
      extensionLocked: z.boolean(),
      recentAttempts: z.array(attemptEventSchema),
      eventCount: count,
      lastEventTs: isoTimestampSchema.optional(),
      lastSessionId: nonEmpty.optional(),
    })
    .strict(),
);

// ---------------------------------------------------------------------------
// Teacher views
// ---------------------------------------------------------------------------

export const gapMapRowSchema = mirror<GapMapRow>()(
  z
    .object({
      studentId: nonEmpty,
      displayName: z.string(),
      rollNo: z.string(),
      mastery: z.record(probability.nullable()),
      readinessDone: z.boolean(),
      rootCauseGap: nonEmpty.nullable(),
      lastEventTs: isoTimestampSchema.optional(),
    })
    .strict(),
);

export const gapMapSchema = mirror<GapMap>()(
  z
    .object({
      chapterId: nonEmpty,
      columns: z.object({ prerequisites: z.array(nonEmpty), chapter: z.array(nonEmpty) }).strict(),
      rows: z.array(gapMapRowSchema),
    })
    .strict(),
);

export const gapGroupSchema = mirror<GapGroup>()(
  z
    .object({
      id: nonEmpty,
      kind: z.enum(["ready", "gap", "not_attempted", "other"]),
      conceptId: nonEmpty.optional(),
      dominantMisconception: nonEmpty.optional(),
      studentIds: z.array(nonEmpty),
      suggestedQuestionIds: z.array(nonEmpty),
      suggestedAction: z.enum(["warm_up", "small_group", "paper_check", "extension"]),
    })
    .strict(),
);

export const weeklyViewSchema = mirror<WeeklyView>()(
  z
    .object({
      chapterId: nonEmpty,
      from: isoTimestampSchema,
      to: isoTimestampSchema,
      moved: z.array(
        z.object({ studentId: nonEmpty, fromGroupId: nonEmpty, toGroupId: nonEmpty }).strict(),
      ),
      blockingConcepts: z.array(z.object({ conceptId: nonEmpty, studentCount: count }).strict()),
      recheckResults: z.array(
        z
          .object({
            conceptId: nonEmpty,
            taughtAt: isoTimestampSchema,
            passed: count,
            failed: count,
          })
          .strict(),
      ),
    })
    .strict(),
);

// ---------------------------------------------------------------------------
// ContentPack (GET /packs/:chapterId)
// ---------------------------------------------------------------------------

export const conceptGraphSchema = mirror<ConceptGraph>()(
  z
    .object({
      concepts: z.record(conceptSchema),
      chapters: z.record(chapterSchema),
      topoOrder: z.array(nonEmpty),
    })
    .strict(),
);

export const contentPackSchema = mirror<ContentPack>()(
  z
    .object({
      packVersion: nonEmpty,
      builtAt: isoTimestampSchema,
      chapterId: nonEmpty,
      graph: conceptGraphSchema,
      questions: z.array(questionSchema),
      resources: z.array(resourceSchema),
      misconceptions: z.record(misconceptionSchema),
      reasonTemplates: z.record(localizedTextSchema),
    })
    .strict(),
);
