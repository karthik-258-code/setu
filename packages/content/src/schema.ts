/**
 * Zod schemas mirroring packages/engine/src/types.ts (the contract).
 * Each schema is passed through `mirror<EngineType>()`, so a schema whose output
 * is not assignable to the engine type fails `pnpm typecheck`. Objects are strict:
 * unknown keys in content files are errors, which catches typos such as `misconceptionCde`.
 */
import { z } from "zod";
import type {
  Chapter,
  Concept,
  LocalizedText,
  McqQuestion,
  Misconception,
  NumericQuestion,
  Option,
  Question,
  QuestionTemplate,
  Resource,
} from "@setu/engine";

/** Compile-time check that a schema's output type is assignable to the engine type `T`. */
function mirror<T>() {
  return <S extends z.ZodType<T, z.ZodTypeDef, unknown>>(schema: S): S => schema;
}

const nonEmpty = z.string().min(1);

export const localizedTextSchema = mirror<LocalizedText>()(
  z
    .object({
      en: nonEmpty,
      te: z.string().optional(),
      hi: z.string().optional(),
    })
    .strict(),
);

const classLevelSchema = z.union([
  z.literal(6),
  z.literal(7),
  z.literal(8),
  z.literal(9),
  z.literal(10),
]);
const difficultySchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const boardSchema = z.enum(["NCERT", "TS_SCERT"]);
const reviewStatusSchema = z.enum(["machine_draft", "draft", "reviewed"]);
const questionTagSchema = z.enum(["extension", "word_problem", "paper_friendly"]);

const probability = z.number().min(0).max(1);

export const conceptSchema = mirror<Concept>()(
  z
    .object({
      id: nonEmpty,
      classLevel: classLevelSchema,
      subject: z.literal("math"),
      chapterId: nonEmpty,
      title: localizedTextSchema,
      summary: localizedTextSchema.optional(),
      prerequisites: z.array(nonEmpty),
      boardTags: z.array(boardSchema),
      bkt: z
        .object({
          pL0: probability.optional(),
          pT: probability.optional(),
          pG: probability.optional(),
          pS: probability.optional(),
        })
        .strict()
        .optional(),
    })
    .strict(),
);

export const chapterSchema = mirror<Chapter>()(
  z
    .object({
      id: nonEmpty,
      classLevel: classLevelSchema,
      subject: z.literal("math"),
      title: localizedTextSchema,
      conceptIds: z.array(nonEmpty),
      boardTags: z.array(boardSchema),
      depth: z.enum(["full", "skeleton"]),
    })
    .strict(),
);

export const optionSchema = mirror<Option>()(
  z
    .object({
      id: nonEmpty,
      text: localizedTextSchema,
      isCorrect: z.boolean(),
      misconceptionCode: nonEmpty.optional(),
    })
    .strict(),
);

const questionBaseShape = {
  id: nonEmpty,
  conceptId: nonEmpty,
  difficulty: difficultySchema,
  stem: localizedTextSchema,
  hint: localizedTextSchema.optional(),
  solution: localizedTextSchema.optional(),
  diagramSvg: z.string().optional(),
  boardTags: z.array(boardSchema),
  tags: z.array(questionTagSchema).optional(),
  reviewStatus: reviewStatusSchema,
  templateId: nonEmpty.optional(),
};

export const mcqQuestionSchema = mirror<McqQuestion>()(
  z
    .object({
      ...questionBaseShape,
      type: z.literal("mcq"),
      options: z.array(optionSchema),
    })
    .strict(),
);

export const numericQuestionSchema = mirror<NumericQuestion>()(
  z
    .object({
      ...questionBaseShape,
      type: z.literal("numeric"),
      answer: z.number(),
      tolerance: z.number().nonnegative().optional(),
      wrongAnswers: z
        .array(z.object({ value: z.number(), misconceptionCode: nonEmpty }).strict())
        .optional(),
    })
    .strict(),
);

export const questionSchema = mirror<Question>()(
  z.discriminatedUnion("type", [mcqQuestionSchema, numericQuestionSchema]),
);

export const questionTemplateSchema = mirror<QuestionTemplate>()(
  z
    .object({
      id: nonEmpty,
      conceptId: nonEmpty,
      difficulty: difficultySchema,
      generator: nonEmpty,
      paramSpace: z.record(z.union([z.tuple([z.number(), z.number()]), z.array(z.number())])),
      count: z.number().int().positive(),
      boardTags: z.array(boardSchema),
      tags: z.array(questionTagSchema).optional(),
      reviewStatus: reviewStatusSchema,
    })
    .strict(),
);

export const resourceSchema = mirror<Resource>()(
  z
    .object({
      id: nonEmpty,
      conceptId: nonEmpty,
      type: z.enum(["explanation", "worked_example", "hint"]),
      body: localizedTextSchema,
      diagramSvg: z.string().optional(),
      targetsMisconception: nonEmpty.optional(),
      reviewStatus: reviewStatusSchema,
    })
    .strict(),
);

export const misconceptionSchema = mirror<Misconception>()(
  z
    .object({
      code: nonEmpty,
      label: localizedTextSchema,
      teacherNote: localizedTextSchema.optional(),
    })
    .strict(),
);

// File-level schemas (one per kind of file in content/).
export const conceptsFileSchema = z.array(conceptSchema);
export const chaptersFileSchema = z.array(chapterSchema);
export const misconceptionsFileSchema = z.record(misconceptionSchema);
export const reasonsFileSchema = z.record(localizedTextSchema);
export const questionsFileSchema = z.array(questionSchema);
export const templatesFileSchema = z.array(questionTemplateSchema);
export const resourcesFileSchema = z.array(resourceSchema);
