import { shuffle } from "./rng";
import type {
  ConceptId,
  ContentPack,
  Difficulty,
  Question,
  QuestionId,
  QuestionTag,
} from "./types";

export interface SelectQuestionsOptions {
  /** Only questions carrying this tag are considered. */
  tag?: QuestionTag;
}

/**
 * Picks up to `n` distinct questions of a concept (ARCHITECTURE 5.4).
 *
 * Order of preference: questions at exactly `difficulty` first, then at distance 1, then 2.
 * Within a difficulty, questions not in `exclude` come before seen ones. Unseen questions are
 * shuffled with `rng`; seen ones are ordered least recently seen first (earliest position in
 * `exclude`), which needs no randomness. The result is shorter than `n` only if the concept
 * has fewer matching questions. The same inputs and seed give the same result.
 */
export function selectQuestions(
  pack: ContentPack,
  conceptId: ConceptId,
  difficulty: Difficulty,
  exclude: readonly QuestionId[],
  n: number,
  rng: () => number,
  opts: SelectQuestionsOptions = {},
): Question[] {
  if (!(conceptId in pack.graph.concepts)) throw new Error(`Unknown concept id: ${conceptId}`);
  if (n <= 0) return [];

  const lastSeen = new Map<QuestionId, number>();
  exclude.forEach((id, index) => {
    if (!lastSeen.has(id)) lastSeen.set(id, index);
  });

  const byId = new Map<QuestionId, Question>();
  for (const q of pack.questions) {
    if (q.conceptId !== conceptId || byId.has(q.id)) continue;
    if (opts.tag !== undefined && !(q.tags ?? []).includes(opts.tag)) continue;
    byId.set(q.id, q);
  }
  // Sorted by id so the shuffle below does not depend on the order questions sit in the pack.
  const candidates = [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const result: Question[] = [];
  const distances = [...new Set(candidates.map((q) => Math.abs(q.difficulty - difficulty)))].sort(
    (a, b) => a - b,
  );
  for (const distance of distances) {
    const tier = candidates.filter((q) => Math.abs(q.difficulty - difficulty) === distance);
    const unseen = shuffle(
      rng,
      tier.filter((q) => !lastSeen.has(q.id)),
    );
    const seen = tier
      .filter((q) => lastSeen.has(q.id))
      .sort((a, b) => (lastSeen.get(a.id) as number) - (lastSeen.get(b.id) as number));
    result.push(...unseen, ...seen);
    if (result.length >= n) break;
  }
  return result.slice(0, n);
}
