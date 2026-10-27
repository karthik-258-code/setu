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
