/** Chapter packs (ARCHITECTURE 6.3). Pure; the builder in build.ts does the file I/O. */
import { createHash } from "node:crypto";
import { ancestors, buildGraph } from "@setu/engine";
import type {
  Chapter,
  Concept,
  ConceptGraph,
  ContentPack,
  LocalizedText,
  Misconception,
  Question,
  Resource,
  RuleId,
} from "@setu/engine";
import {
  chaptersFileSchema,
  conceptsFileSchema,
  misconceptionsFileSchema,
  questionsFileSchema,
  reasonsFileSchema,
  resourcesFileSchema,
} from "./schema";
import { templatesRule } from "./validate";
import type { ContentInput } from "./validate";

/** A pack larger than this fails the build (BUILD_PLAN 2.7). */
export const MAX_PACK_BYTES = 5 * 1024 * 1024;

/** Everything packs are cut from: parsed content plus the questions the templates generate. */
export interface PackSources {
  concepts: Concept[];
  chapters: Chapter[];
  questions: readonly Question[];
  resources: readonly Resource[];
  misconceptions: Record<string, Misconception>;
  reasons: Record<string, LocalizedText>;
}

/** Parses validated content and expands its templates. Throws if the content is invalid. */
export function packSources(input: ContentInput): PackSources {
  const concepts = conceptsFileSchema.parse(input.concepts);
  const chapters = chaptersFileSchema.parse(input.chapters);
  const handAuthored = Object.values(input.questions).flatMap((data) =>
    questionsFileSchema.parse(data),
  );
  const generated = Object.values(templatesRule(concepts, input.templates).generated).flat();
  return {
    concepts,
    chapters,
    questions: [...handAuthored, ...generated],
    resources: Object.values(input.resources).flatMap((data) => resourcesFileSchema.parse(data)),
    misconceptions: misconceptionsFileSchema.parse(input.misconceptions),
    reasons: reasonsFileSchema.parse(input.reasons),
  };
}

function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * The pack for `chapterId`: the whole graph, the questions and resources of the chapter's concepts
 * and their ancestors (sorted by id), all misconceptions and reason templates. `packVersion` is the
 * first 12 hex digits of a SHA-256 over everything except `builtAt` and the version itself, so it
 * changes exactly when the content does. Throws on an unknown chapter id.
 */
export function buildPack(sources: PackSources, chapterId: string, builtAt: string): ContentPack {
  const graph = buildGraph(sources.concepts, sources.chapters);
  const scope = chapterScope(graph, chapterId);
  const body = {
    chapterId,
    graph,
    questions: sources.questions.filter((q) => scope.has(q.conceptId)).sort(byId),
    resources: sources.resources.filter((r) => scope.has(r.conceptId)).sort(byId),
    misconceptions: sources.misconceptions,
    // Every rule id has a template: reasonsRule checks it before a pack is built.
    reasonTemplates: sources.reasons as Record<RuleId, LocalizedText>,
  };
  const packVersion = createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 12);
  return { packVersion, builtAt, ...body };
}

/** The concepts a pack for `chapterId` carries content for: its concepts and all their ancestors. */
export function chapterScope(graph: ConceptGraph, chapterId: string): Set<string> {
  const chapter = graph.chapters[chapterId];
  if (!chapter) throw new Error(`Unknown chapter id: ${chapterId}`);
  const scope = new Set<string>();
  for (const id of chapter.conceptIds) {
    scope.add(id);
    for (const a of ancestors(graph, id)) scope.add(a);
  }
  return scope;
}

export interface QuestionCount {
  chapterId: string;
  handAuthored: number;
  generated: number;
  total: number;
}

/** Questions each chapter's pack would carry, split into hand-authored and template-generated. */
export function questionCounts(
  concepts: Concept[],
  chapters: Chapter[],
  questions: readonly Question[],
): QuestionCount[] {
  const graph = buildGraph(concepts, chapters);
  return chapters.map((chapter) => {
    const scope = chapterScope(graph, chapter.id);
    const inScope = questions.filter((q) => scope.has(q.conceptId));
    const generated = inScope.filter((q) => q.templateId !== undefined).length;
    return {
      chapterId: chapter.id,
      handAuthored: inScope.length - generated,
      generated,
      total: inScope.length,
    };
  });
}
