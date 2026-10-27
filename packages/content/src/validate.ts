/**
 * Content validation. `validateContent` is pure (no I/O) and runs a list of named rules,
 * each returning an array of errors. Run as a script (`pnpm content:validate`) it reads
 * `content/` from disk, prints every error with its file path and exits 1 if there are any.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertDag, buildGraph } from "@setu/engine";
import type { Chapter, Concept } from "@setu/engine";
import type { z } from "zod";
import {
  chaptersFileSchema,
  conceptsFileSchema,
  misconceptionsFileSchema,
  questionsFileSchema,
  reasonsFileSchema,
  resourcesFileSchema,
  templatesFileSchema,
} from "./schema";
import { CONTENT_DIR, loadContent } from "./load";

/** Raw (unvalidated) content, as parsed from JSON. Per-concept maps are keyed by file path. */
export interface ContentInput {
  concepts: unknown;
  chapters: unknown;
  misconceptions: unknown;
  reasons: unknown;
  questions: Record<string, unknown>;
  templates: Record<string, unknown>;
  resources: Record<string, unknown>;
}

export interface ContentError {
  /** Path relative to `content/`, e.g. `graph/concepts.json`. */
  file: string;
  message: string;
}

export const CONCEPTS_FILE = "graph/concepts.json";
export const CHAPTERS_FILE = "graph/chapters.json";
export const MISCONCEPTIONS_FILE = "misconceptions.json";
export const REASONS_FILE = "reasons.json";

/** Content that passed schema validation; files that failed are left undefined. */
interface ParsedContent {
  concepts?: Concept[];
  chapters?: Chapter[];
}

type SchemaResult = { errors: ContentError[]; parsed: ParsedContent };

function check(file: string, schema: z.ZodTypeAny, data: unknown): ContentError[] {
  const result = schema.safeParse(data);
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    file,
    message: `${issue.path.length > 0 ? issue.path.join(".") : "(root)"}: ${issue.message}`,
  }));
}

/** Rule: every content file matches its zod schema. */
export function schemaRule(input: ContentInput): SchemaResult {
  const errors: ContentError[] = [];
  const parsed: ParsedContent = {};

  const conceptErrors = check(CONCEPTS_FILE, conceptsFileSchema, input.concepts);
  if (conceptErrors.length === 0) parsed.concepts = conceptsFileSchema.parse(input.concepts);
  errors.push(...conceptErrors);

  const chapterErrors = check(CHAPTERS_FILE, chaptersFileSchema, input.chapters);
  if (chapterErrors.length === 0) parsed.chapters = chaptersFileSchema.parse(input.chapters);
  errors.push(...chapterErrors);

  errors.push(...check(MISCONCEPTIONS_FILE, misconceptionsFileSchema, input.misconceptions));
  errors.push(...check(REASONS_FILE, reasonsFileSchema, input.reasons));
  for (const [file, data] of Object.entries(input.questions)) {
    errors.push(...check(file, questionsFileSchema, data));
  }
  for (const [file, data] of Object.entries(input.templates)) {
    errors.push(...check(file, templatesFileSchema, data));
  }
  for (const [file, data] of Object.entries(input.resources)) {
    errors.push(...check(file, resourcesFileSchema, data));
  }
  return { errors, parsed };
}

/** Rule: a prerequisite must point to a concept that exists. */
export function unknownPrerequisitesRule(concepts: Concept[]): ContentError[] {
  const known = new Set(concepts.map((c) => c.id));
  const errors: ContentError[] = [];
  for (const concept of concepts) {
    for (const prereq of concept.prerequisites) {
      if (!known.has(prereq)) {
        errors.push({
          file: CONCEPTS_FILE,
          message: `${concept.id}: unknown prerequisite "${prereq}"`,
        });
      }
    }
  }
  return errors;
}

/** Rule: the prerequisite graph has no cycle. */
export function acyclicGraphRule(concepts: Concept[], chapters: Chapter[]): ContentError[] {
  try {
    assertDag(buildGraph(concepts, chapters));
    return [];
  } catch (error) {
    return [{ file: CONCEPTS_FILE, message: (error as Error).message }];
  }
}

/** Validates all content. Graph rules run only when the concept file passed its schema. */
export function validateContent(input: ContentInput): ContentError[] {
  const { errors, parsed } = schemaRule(input);
  if (parsed.concepts) {
    errors.push(...unknownPrerequisitesRule(parsed.concepts));
    errors.push(...acyclicGraphRule(parsed.concepts, parsed.chapters ?? []));
  }
  return errors;
}

function main(): void {
  const { input, errors: loadErrors } = loadContent();
  const errors = [...loadErrors, ...validateContent(input)];
  if (errors.length > 0) {
    for (const error of errors) console.error(`${error.file}: ${error.message}`);
    console.error(`\n${errors.length} content error(s) in ${CONTENT_DIR}`);
    process.exit(1);
  }
  console.log("content valid");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
