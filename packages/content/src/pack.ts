/** What a chapter pack covers (ARCHITECTURE 6.3). Pure; the builder in build.ts does the I/O. */
import { ancestors, buildGraph } from "@setu/engine";
import type { Chapter, Concept, ConceptGraph, Question } from "@setu/engine";

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
