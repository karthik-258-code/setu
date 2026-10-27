import { MASTERY_THRESHOLD } from "./types";
import type { Chapter, Concept, ConceptGraph, ConceptId } from "./types";

/**
 * Builds the concept graph. `topoOrder` is computed once with Kahn's algorithm
 * (prerequisites first), tie-break `classLevel` then `id`. Prerequisites that point
 * to unknown concepts are ignored here; content validation reports them.
 * If the graph has a cycle, `topoOrder` omits the concepts on and downstream of it;
 * call `assertDag` to turn that into an error.
 */
export function buildGraph(
  concepts: readonly Concept[],
  chapters: readonly Chapter[],
): ConceptGraph {
  const conceptsById: Record<ConceptId, Concept> = {};
  for (const concept of concepts) conceptsById[concept.id] = concept;
  const chaptersById: ConceptGraph["chapters"] = {};
  for (const chapter of chapters) chaptersById[chapter.id] = chapter;

  const remaining = new Map<ConceptId, number>();
  const dependents = new Map<ConceptId, ConceptId[]>();
  for (const concept of Object.values(conceptsById)) {
    const known = new Set(concept.prerequisites.filter((p) => p in conceptsById));
    remaining.set(concept.id, known.size);
    for (const prereq of known) {
      const list = dependents.get(prereq) ?? [];
      list.push(concept.id);
      dependents.set(prereq, list);
    }
  }

  const compare = (a: ConceptId, b: ConceptId): number => {
    const ca = conceptsById[a];
    const cb = conceptsById[b];
    if (ca && cb && ca.classLevel !== cb.classLevel) return ca.classLevel - cb.classLevel;
    return a < b ? -1 : a > b ? 1 : 0;
  };

  const ready = [...remaining].filter(([, n]) => n === 0).map(([id]) => id);
  const topoOrder: ConceptId[] = [];
  while (ready.length > 0) {
    ready.sort(compare);
    const next = ready.shift() as ConceptId;
    topoOrder.push(next);
    for (const dependent of dependents.get(next) ?? []) {
      const left = (remaining.get(dependent) ?? 0) - 1;
      remaining.set(dependent, left);
      if (left === 0) ready.push(dependent);
    }
  }

  return { concepts: conceptsById, chapters: chaptersById, topoOrder };
}

/** Throws an Error naming one concrete cycle, e.g. `A -> B -> C -> A`, if the graph is not a DAG. */
export function assertDag(graph: ConceptGraph): void {
  const ids = Object.keys(graph.concepts);
  if (graph.topoOrder.length === ids.length) return;

  const ordered = new Set(graph.topoOrder);
  const stuck = ids.filter((id) => !ordered.has(id)).sort();
  // Walk "requires" edges among stuck concepts until one repeats; that closes a cycle.
  const visited: ConceptId[] = [];
  let current = stuck[0] as ConceptId;
  while (!visited.includes(current)) {
    visited.push(current);
    const concept = graph.concepts[current] as Concept;
    const next = concept.prerequisites.filter((p) => p in graph.concepts && !ordered.has(p)).sort();
    current = next[0] as ConceptId;
  }
  const cycle = [...visited.slice(visited.indexOf(current)), current];
  throw new Error(
    `Concept graph has a cycle: ${cycle.join(" -> ")} (each concept requires the next)`,
  );
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Anything with a `pKnown`; a `Record<ConceptId, MasteryState>` fits. A concept with no
 * entry is "untouched".
 */
export type MasteryView = Readonly<Record<ConceptId, { readonly pKnown: number }>>;

function requireConcept(graph: ConceptGraph, id: ConceptId): Concept {
  const concept = graph.concepts[id];
  if (!concept) throw new Error(`Unknown concept id: ${id}`);
  return concept;
}

function requireChapter(graph: ConceptGraph, chapterId: string): Chapter {
  const chapter = graph.chapters[chapterId];
  if (!chapter) throw new Error(`Unknown chapter id: ${chapterId}`);
  return chapter;
}

/** Position in `topoOrder`; concepts missing from it (cyclic graphs) sort last. */
function topoRanks(graph: ConceptGraph): Map<ConceptId, number> {
  const ranks = new Map<ConceptId, number>();
  graph.topoOrder.forEach((id, index) => ranks.set(id, index));
  return ranks;
}

function sortTopo(graph: ConceptGraph, ids: Iterable<ConceptId>): ConceptId[] {
  const ranks = topoRanks(graph);
  const rank = (id: ConceptId): number => ranks.get(id) ?? Number.MAX_SAFE_INTEGER;
  return [...new Set(ids)].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
}

/** Lowest `classLevel` first, then topo order. */
function sortByClassThenTopo(graph: ConceptGraph, ids: Iterable<ConceptId>): ConceptId[] {
  const ranks = topoRanks(graph);
  const rank = (id: ConceptId): number => ranks.get(id) ?? Number.MAX_SAFE_INTEGER;
  const level = (id: ConceptId): number => (graph.concepts[id] as Concept).classLevel;
  return [...new Set(ids)].sort(
    (a, b) => level(a) - level(b) || rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0),
  );
}

/** Known direct prerequisites of a concept. Unknown ids are ignored, as in `buildGraph`. */
function knownPrereqs(graph: ConceptGraph, concept: Concept): ConceptId[] {
  return concept.prerequisites.filter((p) => p in graph.concepts);
}

function isMastered(mastery: MasteryView, id: ConceptId, threshold: number): boolean {
  const entry = mastery[id];
  return entry !== undefined && entry.pKnown >= threshold;
}

/** Direct prerequisites of `id`, deduplicated, in topo order. Throws on an unknown id. */
export function directPrereqs(graph: ConceptGraph, id: ConceptId): ConceptId[] {
  return sortTopo(graph, knownPrereqs(graph, requireConcept(graph, id)));
}

function collectAncestors(graph: ConceptGraph, start: Iterable<ConceptId>): Set<ConceptId> {
  const seen = new Set<ConceptId>();
  const stack = [...start];
  while (stack.length > 0) {
    const id = stack.pop() as ConceptId;
    for (const prereq of knownPrereqs(graph, requireConcept(graph, id))) {
      if (!seen.has(prereq)) {
        seen.add(prereq);
        stack.push(prereq);
      }
    }
  }
  return seen;
}

/** All transitive prerequisites of `id` in topo order, excluding `id`. Throws on an unknown id. */
export function ancestors(graph: ConceptGraph, id: ConceptId): ConceptId[] {
  requireConcept(graph, id);
  const found = collectAncestors(graph, [id]);
  found.delete(id);
  return sortTopo(graph, found);
}

/** All concepts that transitively require `id`, in topo order, excluding `id`. */
export function descendants(graph: ConceptGraph, id: ConceptId): ConceptId[] {
  requireConcept(graph, id);
  const dependents = new Map<ConceptId, ConceptId[]>();
  for (const concept of Object.values(graph.concepts)) {
    for (const prereq of knownPrereqs(graph, concept)) {
      const list = dependents.get(prereq) ?? [];
      list.push(concept.id);
      dependents.set(prereq, list);
    }
  }
  const seen = new Set<ConceptId>();
  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop() as ConceptId;
    for (const next of dependents.get(current) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  seen.delete(id);
  return sortTopo(graph, seen);
}

/**
 * Direct prerequisites of the chapter's concepts (`chapter.conceptIds`) that are not
 * themselves in the chapter, deduplicated, in topo order.
 */
export function chapterExternalPrereqs(graph: ConceptGraph, chapterId: string): ConceptId[] {
  const chapter = requireChapter(graph, chapterId);
  const inChapter = new Set(chapter.conceptIds);
  const external = new Set<ConceptId>();
  for (const conceptId of chapter.conceptIds) {
    for (const prereq of knownPrereqs(graph, requireConcept(graph, conceptId))) {
      if (!inChapter.has(prereq)) external.add(prereq);
    }
  }
  return sortTopo(graph, external);
}

/**
 * Concepts in `scope` that are not mastered and whose direct prerequisites are all
 * mastered. Mastered means `pKnown >= threshold`; a concept with no mastery entry is
 * untouched and counts as not mastered. Ordered by lowest `classLevel`, then topo order.
 */
export function frontier(
  graph: ConceptGraph,
  mastery: MasteryView,
  scope: Iterable<ConceptId>,
  threshold: number,
): ConceptId[] {
  const result: ConceptId[] = [];
  for (const id of new Set(scope)) {
    const concept = requireConcept(graph, id);
    if (isMastered(mastery, id, threshold)) continue;
    if (knownPrereqs(graph, concept).every((p) => isMastered(mastery, p, threshold))) {
      result.push(id);
    }
  }
  return sortByClassThenTopo(graph, result);
}

/**
 * The most upstream blocker for a chapter (ARCHITECTURE 5.6). The candidate set is the
 * chapter's ancestor set (ancestors of its concepts, minus the chapter's own concepts)
 * restricted to touched concepts with `pKnown < MASTERY_THRESHOLD`. A candidate counts as
 * a blocker when each of its direct prerequisites is mastered or untouched. Ties go to the
 * lowest `classLevel`, then topo order. Returns null when there is no blocker.
 */
export function rootCauseGap(
  graph: ConceptGraph,
  mastery: MasteryView,
  chapterId: string,
): ConceptId | null {
  const chapter = requireChapter(graph, chapterId);
  const inChapter = new Set(chapter.conceptIds);
  const ancestorSet = collectAncestors(graph, chapter.conceptIds);

  const blockers: ConceptId[] = [];
  for (const id of ancestorSet) {
    if (inChapter.has(id)) continue;
    const entry = mastery[id];
    if (entry === undefined || entry.pKnown >= MASTERY_THRESHOLD) continue;
    const upstreamClear = knownPrereqs(graph, requireConcept(graph, id)).every((p) => {
      const prereq = mastery[p];
      return prereq === undefined || prereq.pKnown >= MASTERY_THRESHOLD;
    });
    if (upstreamClear) blockers.push(id);
  }
  return sortByClassThenTopo(graph, blockers)[0] ?? null;
}
