/**
 * Content validation. `validateContent` is pure (no I/O) and runs a list of named rules,
 * each returning an array of errors. Run as a script (`pnpm content:validate`) it reads
 * `content/` from disk, prints every error with its file path and exits 1 if there are any.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RULE_IDS, ancestors, assertDag, buildGraph } from "@setu/engine";
import type { Chapter, Concept, LocalizedText, Question, Resource } from "@setu/engine";
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
import { generateTemplate } from "./generate";
import { GENERATORS } from "./generators/index";

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

/**
 * Rule: chapters and concepts agree. Every concept's `chapterId` names a chapter whose
 * `conceptIds` lists it, at the same class level; every listed concept exists. Skipped when
 * there are no chapters yet.
 */
export function chapterMembershipRule(concepts: Concept[], chapters: Chapter[]): ContentError[] {
  if (chapters.length === 0) return [];
  const errors: ContentError[] = [];
  const conceptById = new Map(concepts.map((c) => [c.id, c]));
  const chapterById = new Map(chapters.map((ch) => [ch.id, ch]));
  for (const chapter of chapters) {
    for (const id of chapter.conceptIds) {
      const concept = conceptById.get(id);
      if (!concept) {
        errors.push({ file: CHAPTERS_FILE, message: `${chapter.id}: unknown concept "${id}"` });
      } else if (concept.chapterId !== chapter.id) {
        errors.push({
          file: CHAPTERS_FILE,
          message: `${chapter.id}: lists ${id}, whose chapterId is "${concept.chapterId}"`,
        });
      }
    }
  }
  for (const concept of concepts) {
    const chapter = chapterById.get(concept.chapterId);
    if (!chapter) {
      errors.push({
        file: CONCEPTS_FILE,
        message: `${concept.id}: unknown chapter "${concept.chapterId}"`,
      });
    } else if (!chapter.conceptIds.includes(concept.id)) {
      errors.push({
        file: CONCEPTS_FILE,
        message: `${concept.id}: not listed in ${chapter.id}.conceptIds`,
      });
    } else if (chapter.classLevel !== concept.classLevel) {
      errors.push({
        file: CONCEPTS_FILE,
        message: `${concept.id}: class ${concept.classLevel} but ${chapter.id} is class ${chapter.classLevel}`,
      });
    }
  }
  return errors;
}

/**
 * Placeholders a reason template may use. The UI fills them from `Recommendation.reasonParams`:
 * `{chapter}` and `{concept}` become the titles of `chapterId` and `conceptId`,
 * `{misconception}` the label of `misconceptionCode`, `{difficulty}` and `{count}` the numbers.
 */
export const REASON_PLACEHOLDERS = ["chapter", "concept", "difficulty", "count", "misconception"];

function placeholdersIn(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? "").sort();
}

/**
 * Rule: every engine rule has a reason template in English and Telugu, using only known
 * placeholders, the same ones in both languages. Skipped when there are no chapters yet.
 */
export function reasonsRule(reasons: unknown, chapters: Chapter[]): ContentError[] {
  if (chapters.length === 0) return [];
  const parsed = reasonsFileSchema.safeParse(reasons);
  if (!parsed.success) return []; // already reported by schemaRule
  const allowed = new Set(REASON_PLACEHOLDERS);
  const errors: ContentError[] = [];
  const report = (message: string): void => {
    errors.push({ file: REASONS_FILE, message });
  };
  for (const id of RULE_IDS) {
    const template = parsed.data[id];
    if (!template) {
      report(`${id}: missing reason template`);
      continue;
    }
    const en = placeholdersIn(template.en);
    for (const p of en) if (!allowed.has(p)) report(`${id}: unknown placeholder {${p}}`);
    if (template.te === undefined) report(`${id}: missing Telugu (te)`);
    else if (placeholdersIn(template.te).join(",") !== en.join(",")) {
      report(`${id}: en and te use different placeholders`);
    }
  }
  return errors;
}

/**
 * Rule: misconceptions are keyed by their own code and carry Telugu for the label and the
 * teacher note. Skipped when there are no chapters yet.
 */
export function misconceptionsRule(misconceptions: unknown, chapters: Chapter[]): ContentError[] {
  if (chapters.length === 0) return [];
  const parsed = misconceptionsFileSchema.safeParse(misconceptions);
  if (!parsed.success) return [];
  const errors: ContentError[] = [];
  for (const [key, m] of Object.entries(parsed.data)) {
    if (m.code !== key) {
      errors.push({ file: MISCONCEPTIONS_FILE, message: `${key}: code is "${m.code}"` });
    }
    if (m.label.te === undefined) {
      errors.push({ file: MISCONCEPTIONS_FILE, message: `${key}: label has no Telugu (te)` });
    }
    if (m.teacherNote && m.teacherNote.te === undefined) {
      errors.push({ file: MISCONCEPTIONS_FILE, message: `${key}: teacherNote has no Telugu (te)` });
    }
  }
  return errors;
}

/**
 * Rule: resources are well placed and complete.
 * Per file (always): each resource's `conceptId` matches its file name `resources/<conceptId>.json`
 * and names a known concept, ids are unique, `targetsMisconception` names a known code, and no
 * `machine_draft` item ships. Coverage (once chapters exist): every concept of a `full` chapter
 * and every ancestor of those concepts has an explanation with English and Telugu, a worked
 * example and a hint (ARCHITECTURE 6.3).
 */
export function resourcesRule(
  concepts: Concept[],
  chapters: Chapter[],
  resources: Record<string, unknown>,
  misconceptions: unknown,
): ContentError[] {
  const errors: ContentError[] = [];
  const known = new Set(concepts.map((c) => c.id));
  const parsedCodes = misconceptionsFileSchema.safeParse(misconceptions);
  const codes = new Set(parsedCodes.success ? Object.keys(parsedCodes.data) : []);
  const byConcept = new Map<string, Resource[]>();
  const seen = new Set<string>();

  for (const [file, data] of Object.entries(resources)) {
    const parsed = resourcesFileSchema.safeParse(data);
    if (!parsed.success) continue; // reported by schemaRule
    const expected = file.replace(/^resources\//, "").replace(/\.json$/, "");
    for (const r of parsed.data) {
      const report = (message: string): void => {
        errors.push({ file, message: `${r.id}: ${message}` });
      };
      if (r.conceptId !== expected) report(`conceptId "${r.conceptId}" does not match the file name`);
      if (!known.has(r.conceptId)) report(`unknown concept "${r.conceptId}"`);
      if (seen.has(r.id)) report("duplicate resource id");
      seen.add(r.id);
      if (r.targetsMisconception !== undefined && !codes.has(r.targetsMisconception)) {
        report(`unknown misconception "${r.targetsMisconception}"`);
      }
      if (r.reviewStatus === "machine_draft") report("machine_draft items must be reviewed before build");
      byConcept.set(r.conceptId, [...(byConcept.get(r.conceptId) ?? []), r]);
    }
  }

  if (chapters.length === 0) return errors;
  let graph;
  try {
    graph = buildGraph(concepts, chapters);
    assertDag(graph);
  } catch {
    return errors; // reported by the graph rules
  }
  const g = graph;
  for (const chapter of chapters) {
    if (chapter.depth !== "full") continue;
    const scope = new Set<string>();
    for (const id of chapter.conceptIds) {
      if (!known.has(id)) continue;
      scope.add(id);
      for (const a of ancestors(g, id)) scope.add(a);
    }
    for (const id of g.topoOrder.filter((c) => scope.has(c))) {
      const list = byConcept.get(id) ?? [];
      const file = `resources/${id}.json`;
      const missing = (what: string): void => {
        errors.push({ file, message: `${id}: needs ${what} (in scope of full chapter ${chapter.id})` });
      };
      const explanation = list.find((r) => r.type === "explanation");
      if (!explanation) missing("an explanation");
      else if (explanation.body.te === undefined) missing("a Telugu (te) explanation");
      if (!list.some((r) => r.type === "worked_example")) missing("a worked example");
      if (!list.some((r) => r.type === "hint")) missing("a hint");
    }
  }
  return errors;
}

/** Hand-authored questions each concept of a `full` chapter, and each ancestor, needs (ARCHITECTURE 6.3). */
export const MIN_QUESTIONS_FULL = 6;
/** Of those, the minimum at each of the three difficulties (BUILD_PLAN 2.4). */
export const MIN_PER_DIFFICULTY_FULL = 2;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when the text is absent or carries a non-blank Telugu string. */
function teluguPresent(text: LocalizedText | undefined): boolean {
  return text === undefined || (text.te ?? "").trim().length > 0;
}

/**
 * Rule: questions are well placed, well formed and cover full chapters.
 * Per file (always): each question's `conceptId` matches its file name `questions/<conceptId>.json`
 * and names a known concept, its id is `<conceptId>.Qnn` and unique, no `machine_draft` item ships,
 * an MCQ has at least two options with unique ids and exactly one correct option (which carries no
 * misconception code), every misconception code on an option or a numeric wrong answer is known,
 * and a numeric wrong answer differs from the answer. Coverage (once chapters exist): every concept
 * of a `full` chapter and every ancestor has at least 6 questions, at least 2 per difficulty, and
 * Telugu on every stem, solution, hint and option.
 */
export function questionsRule(
  concepts: Concept[],
  chapters: Chapter[],
  questions: Record<string, unknown>,
  misconceptions: unknown,
): ContentError[] {
  const errors: ContentError[] = [];
  const known = new Set(concepts.map((c) => c.id));
  const parsedCodes = misconceptionsFileSchema.safeParse(misconceptions);
  const codes = new Set(parsedCodes.success ? Object.keys(parsedCodes.data) : []);
  const byConcept = new Map<string, Question[]>();
  const seen = new Set<string>();

  for (const [file, data] of Object.entries(questions)) {
    const parsed = questionsFileSchema.safeParse(data);
    if (!parsed.success) continue; // reported by schemaRule
    const expected = file.replace(/^(questions|templates)\//, "").replace(/\.json$/, "");
    for (const q of parsed.data) {
      const report = (message: string): void => {
        errors.push({ file, message: `${q.id}: ${message}` });
      };
      const checkCode = (code: string | undefined, where: string): void => {
        if (code !== undefined && !codes.has(code)) report(`${where}: unknown misconception "${code}"`);
      };
      if (q.conceptId !== expected) report(`conceptId "${q.conceptId}" does not match the file name`);
      if (!known.has(q.conceptId)) report(`unknown concept "${q.conceptId}"`);
      const shape =
        q.templateId === undefined
          ? { pattern: `^${escapeRegExp(q.conceptId)}\\.Q\\d{2,}$`, label: `${q.conceptId}.Qnn` }
          : { pattern: `^${escapeRegExp(q.templateId)}\\.\\d+$`, label: `${q.templateId}.<seed>` };
      if (!new RegExp(shape.pattern).test(q.id)) report(`id must be ${shape.label}`);
      if (seen.has(q.id)) report("duplicate question id");
      seen.add(q.id);
      if (q.reviewStatus === "machine_draft") report("machine_draft items must be reviewed before build");
      if (q.type === "mcq") {
        if (q.options.length < 2) report("needs at least 2 options");
        const optionIds = new Set<string>();
        for (const o of q.options) {
          if (optionIds.has(o.id)) report(`duplicate option id "${o.id}"`);
          optionIds.add(o.id);
          checkCode(o.misconceptionCode, `option ${o.id}`);
          if (o.isCorrect && o.misconceptionCode !== undefined) {
            report(`correct option ${o.id} carries a misconception code`);
          }
        }
        const correct = q.options.filter((o) => o.isCorrect).length;
        if (correct !== 1) report(`needs exactly one correct option (has ${correct})`);
      } else {
        for (const w of q.wrongAnswers ?? []) {
          checkCode(w.misconceptionCode, `wrong answer ${w.value}`);
          if (Math.abs(w.value - q.answer) <= (q.tolerance ?? 0)) {
            report(`wrong answer ${w.value} matches the answer`);
          }
        }
      }
      byConcept.set(q.conceptId, [...(byConcept.get(q.conceptId) ?? []), q]);
    }
  }

  if (chapters.length === 0) return errors;
  let graph;
  try {
    graph = buildGraph(concepts, chapters);
    assertDag(graph);
  } catch {
    return errors; // reported by the graph rules
  }
  const g = graph;
  for (const chapter of chapters) {
    if (chapter.depth !== "full") continue;
    const scope = new Set<string>();
    for (const id of chapter.conceptIds) {
      if (!known.has(id)) continue;
      scope.add(id);
      for (const a of ancestors(g, id)) scope.add(a);
    }
    const where = `(in scope of full chapter ${chapter.id})`;
    for (const id of g.topoOrder.filter((c) => scope.has(c))) {
      const list = byConcept.get(id) ?? [];
      const file = `questions/${id}.json`;
      const report = (message: string): void => {
        errors.push({ file, message: `${message} ${where}` });
      };
      if (list.length < MIN_QUESTIONS_FULL) {
        report(`${id}: needs at least ${MIN_QUESTIONS_FULL} questions, has ${list.length}`);
      }
      for (const d of [1, 2, 3] as const) {
        const n = list.filter((q) => q.difficulty === d).length;
        if (n < MIN_PER_DIFFICULTY_FULL) {
          report(`${id}: needs at least ${MIN_PER_DIFFICULTY_FULL} questions at difficulty ${d}, has ${n}`);
        }
      }
      for (const q of list) {
        if (!teluguPresent(q.stem)) report(`${q.id}: stem has no Telugu (te)`);
        if (!teluguPresent(q.solution)) report(`${q.id}: solution has no Telugu (te)`);
        if (!teluguPresent(q.hint)) report(`${q.id}: hint has no Telugu (te)`);
        if (q.type === "mcq") {
          for (const o of q.options) {
            if (!teluguPresent(o.text)) report(`${q.id}: option ${o.id} has no Telugu (te)`);
          }
        }
      }
    }
  }
  return errors;
}

/**
 * Rule: templates are well placed and expand (ARCHITECTURE 6.4). Each template's `conceptId`
 * matches its file name `templates/<conceptId>.json` and names a known concept, its id is
 * `<conceptId>.Tnn` and unique, its generator exists, and its `paramSpace` defines exactly the
 * generator's parameters with integer values (a two-element array is an inclusive range, so it
 * must not be descending). Valid templates are expanded; expansion failures are errors. Returns the
 * generated questions keyed by template file so `questionsRule` checks them like hand-authored ones.
 */
export function templatesRule(
  concepts: Concept[],
  templates: Record<string, unknown>,
): { errors: ContentError[]; generated: Record<string, Question[]> } {
  const errors: ContentError[] = [];
  const generated: Record<string, Question[]> = {};
  const known = new Set(concepts.map((c) => c.id));
  const seen = new Set<string>();
  for (const [file, data] of Object.entries(templates)) {
    const parsed = templatesFileSchema.safeParse(data);
    if (!parsed.success) continue; // reported by schemaRule
    const expected = file.replace(/^templates\//, "").replace(/\.json$/, "");
    const out: Question[] = [];
    for (const t of parsed.data) {
      const before = errors.length;
      const report = (message: string): void => {
        errors.push({ file, message: `${t.id}: ${message}` });
      };
      if (t.conceptId !== expected) report(`conceptId "${t.conceptId}" does not match the file name`);
      if (!known.has(t.conceptId)) report(`unknown concept "${t.conceptId}"`);
      if (!new RegExp(`^${escapeRegExp(t.conceptId)}\\.T\\d{2,}$`).test(t.id)) {
        report(`id must be ${t.conceptId}.Tnn`);
      }
      if (seen.has(t.id)) report("duplicate template id");
      seen.add(t.id);
      const generator = GENERATORS[t.generator];
      if (!generator) {
        report(`unknown generator "${t.generator}"`);
        continue;
      }
      const wanted = new Set<string>(generator.params);
      for (const name of generator.params) {
        if (!(name in t.paramSpace)) report(`paramSpace needs "${name}"`);
      }
      for (const [name, space] of Object.entries(t.paramSpace)) {
        const values: readonly number[] = space;
        if (!wanted.has(name)) report(`paramSpace has unknown parameter "${name}"`);
        if (values.length === 0) report(`paramSpace "${name}" is empty`);
        else if (!values.every((v) => Number.isInteger(v))) {
          report(`paramSpace "${name}" must hold integers`);
        } else if (values.length === 2 && (values[0] as number) > (values[1] as number)) {
          report(`paramSpace "${name}" range [${values[0]}, ${values[1]}] is empty`);
        }
      }
      if (errors.length > before) continue;
      try {
        out.push(...generateTemplate(t));
      } catch (error) {
        errors.push({ file, message: (error as Error).message });
      }
    }
    generated[file] = out;
  }
  return { errors, generated };
}

/** Validates all content. Graph rules run only when the concept file passed its schema. */
export function validateContent(input: ContentInput): ContentError[] {
  const { errors, parsed } = schemaRule(input);
  if (parsed.concepts) {
    errors.push(...unknownPrerequisitesRule(parsed.concepts));
    errors.push(...acyclicGraphRule(parsed.concepts, parsed.chapters ?? []));
    errors.push(...chapterMembershipRule(parsed.concepts, parsed.chapters ?? []));
  }
  errors.push(...reasonsRule(input.reasons, parsed.chapters ?? []));
  errors.push(...misconceptionsRule(input.misconceptions, parsed.chapters ?? []));
  errors.push(
    ...resourcesRule(
      parsed.concepts ?? [],
      parsed.chapters ?? [],
      input.resources,
      input.misconceptions,
    ),
  );
  const templateCheck = templatesRule(parsed.concepts ?? [], input.templates);
  errors.push(...templateCheck.errors);
  errors.push(
    ...questionsRule(
      parsed.concepts ?? [],
      parsed.chapters ?? [],
      { ...input.questions, ...templateCheck.generated },
      input.misconceptions,
    ),
  );
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
