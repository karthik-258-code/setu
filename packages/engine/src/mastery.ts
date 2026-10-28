import { ancestors } from "./graph";
import type { MasteryView } from "./graph";
import { MASTERY_THRESHOLD } from "./types";
import type { ChapterId, ConceptId, ContentPack, StudentState } from "./types";

/**
 * Mastery as the pathway policy and the teacher views see it. A concept the chapter's readiness
 * check cleared is treated as mastered, and so are all its ancestors, because the check stops
 * descending on one correct answer (ARCHITECTURE 5.3). Real evidence wins: a concept that is
 * failed or uncertain, attempted after the check finished, or marked not mastered by the teacher
 * keeps its own estimate. Without readiness for `chapterId` this is the replayed mastery as is.
 */
export function effectiveMastery(
  pack: ContentPack,
  state: StudentState,
  chapterId: ChapterId,
): MasteryView {
  const view: Record<ConceptId, { pKnown: number }> = {};
  for (const [id, m] of Object.entries(state.mastery)) view[id] = { pKnown: m.pKnown };

  const summary = state.readiness[chapterId];
  if (!summary) return view;
  const completedAt = Date.parse(summary.completedAt);
  const doubtful = new Set([...summary.failed, ...summary.uncertain]);
  const implied = new Set<ConceptId>();
  for (const id of summary.cleared) {
    implied.add(id);
    for (const a of ancestors(pack.graph, id)) implied.add(a);
  }
  for (const id of implied) {
    if (doubtful.has(id)) continue;
    const m = state.mastery[id];
    if (m) {
      if (m.source === "teacher_override" && m.pendingVerification !== true) continue;
      if (m.lastAttemptAt !== undefined && Date.parse(m.lastAttemptAt) > completedAt) continue;
    }
    view[id] = { pKnown: Math.max(m?.pKnown ?? 0, MASTERY_THRESHOLD) };
  }
  return view;
}
