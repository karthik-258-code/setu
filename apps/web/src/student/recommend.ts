/**
 * Glue between the home card and the engine policy: runs `nextRecommendation` with a seeded rng,
 * fills the pack's reason template in every language, and maps the mode to a student route.
 */
import { mulberry32, nextRecommendation } from "@setu/engine";
import type { ContentPack, Lang, LocalizedText, Recommendation, StudentState } from "@setu/engine";

/** FNV-1a hash of a string, used to seed the policy rng so one sitting sees stable choices. */
export function seedFrom(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function recommend(
  pack: ContentPack,
  state: StudentState,
  chapterId: string,
  now: Date,
  sessionId: string,
): Recommendation {
  return nextRecommendation({
    pack,
    state,
    chapterId,
    now: now.toISOString(),
    sessionId,
    rng: mulberry32(seedFrom(`${state.studentId}:${sessionId}`)),
  });
}

const TITLE_PARAMS: Record<string, "chapterId" | "conceptId"> = {
  chapter: "chapterId",
  concept: "conceptId",
};

function titleIn(text: LocalizedText, lang: Lang): string {
  const value = text[lang];
  return value !== undefined && value.trim() !== "" ? value : text.en;
}

function fill(
  template: string,
  lang: Lang,
  pack: ContentPack,
  params: Recommendation["reasonParams"],
): string {
  return template.replace(/\{(\w+)\}/g, (match: string, key: string) => {
    const idKey = TITLE_PARAMS[key];
    if (idKey !== undefined) {
      const id = params[idKey];
      if (typeof id !== "string") return match;
      const title =
        idKey === "chapterId" ? pack.graph.chapters[id]?.title : pack.graph.concepts[id]?.title;
      return title ? titleIn(title, lang) : id;
    }
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

/** The recommendation's reason in every language its template has, with ids turned into titles. */
export function renderReason(pack: ContentPack, rec: Recommendation): LocalizedText {
  const template = pack.reasonTemplates[rec.ruleId];
  if (!template) throw new Error(`The pack has no reason template for ${rec.ruleId}`);
  const out: LocalizedText = { en: fill(template.en, "en", pack, rec.reasonParams) };
  if (template.te !== undefined) out.te = fill(template.te, "te", pack, rec.reasonParams);
  if (template.hi !== undefined) out.hi = fill(template.hi, "hi", pack, rec.reasonParams);
  return out;
}

/** The student screen for a recommendation; `null` when there is nothing left to do. */
export function routeFor(rec: Recommendation): string | null {
  if (rec.mode === "done") return null;
  if (rec.mode === "readiness") return `/s/readiness/${encodeURIComponent(rec.chapterId)}`;
  if (rec.conceptId === undefined) throw new Error(`Recommendation ${rec.ruleId} has no concept`);
  const concept = encodeURIComponent(rec.conceptId);
  if (rec.mode === "learn") return `/s/learn/${concept}`;
  if (rec.mode === "solve") return `/s/solve/${concept}`;
  return `/s/test/${concept}`;
}
