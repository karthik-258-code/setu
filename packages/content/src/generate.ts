/**
 * Template expansion (ARCHITECTURE 6.4). `generateTemplate` is pure and deterministic: variant
 * `seed` of a template always draws its parameters and option order from the same seeded rng,
 * so a template yields the same questions on every machine and every run.
 */
import { mulberry32, pick, shuffle } from "@setu/engine";
import type { McqQuestion, Option, QuestionTemplate } from "@setu/engine";
import { GENERATORS } from "./generators/index";
import type { Distractor, Draft } from "./generators/types";

/** Seeds tried per requested variant before expansion gives up and throws. */
export const MAX_SEEDS_PER_VARIANT = 50;
const OPTION_IDS = ["a", "b", "c", "d"];

/** 32-bit FNV-1a hash of a string, as a signed integer. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}

/** The rng for variant `seed` of the template `templateId`. */
export function variantRng(templateId: string, seed: number): () => number {
  return mulberry32((hashString(templateId) + Math.imul(seed, 0x9e3779b1)) | 0);
}

/**
 * Draws one value per parameter. A two-element space is an inclusive integer range [min, max];
 * any other length is a list of choices.
 */
export function sampleParams(
  rng: () => number,
  template: QuestionTemplate,
  names: readonly string[],
): Record<string, number> {
  const params: Record<string, number> = {};
  for (const name of names) {
    const space: readonly number[] | undefined = template.paramSpace[name];
    if (space === undefined || space.length === 0) {
      throw new Error(`${template.id}: paramSpace has no values for "${name}"`);
    }
    if (space.length === 2) {
      const min = space[0] as number;
      const max = space[1] as number;
      params[name] = min + Math.floor(rng() * (max - min + 1));
    } else {
      params[name] = pick(rng, space);
    }
  }
  return params;
}

/**
 * Four options: the answer plus the first three distinct distractors, at least one of them
 * misconception-coded, in an order shuffled by the variant's rng. Null if the draft cannot
 * supply that.
 */
function buildOptions(rng: () => number, draft: Draft): Option[] | null {
  const wanted = OPTION_IDS.length - 1;
  const seen = new Set<string>([draft.answer.en]);
  const wrong: Distractor[] = [];
  for (const d of draft.distractors) {
    if (wrong.length === wanted) break;
    if (seen.has(d.text.en)) continue;
    seen.add(d.text.en);
    wrong.push(d);
  }
  if (wrong.length < wanted || !wrong.some((d) => d.misconceptionCode !== undefined)) return null;
  const choices: Omit<Option, "id">[] = [
    { text: draft.answer, isCorrect: true },
    ...wrong.map((d) =>
      d.misconceptionCode === undefined
        ? { text: d.text, isCorrect: false }
        : { text: d.text, isCorrect: false, misconceptionCode: d.misconceptionCode },
    ),
  ];
  return shuffle(rng, choices).map((c, i) => ({ id: OPTION_IDS[i] ?? String(i), ...c }));
}

/**
 * Expands a template into `count` distinct MCQs with ids `{templateId}.{seed}`. Seeds whose
 * parameters the generator rejects, or whose stem repeats an earlier one, are skipped. Throws on
 * an unknown generator or when `count` distinct questions are not found within
 * `count * MAX_SEEDS_PER_VARIANT` seeds.
 */
export function generateTemplate(template: QuestionTemplate): McqQuestion[] {
  const generator = GENERATORS[template.generator];
  if (!generator) throw new Error(`${template.id}: unknown generator "${template.generator}"`);
  const out: McqQuestion[] = [];
  const stems = new Set<string>();
  const maxSeed = template.count * MAX_SEEDS_PER_VARIANT;
  for (let seed = 1; out.length < template.count; seed++) {
    if (seed > maxSeed) {
      throw new Error(
        `${template.id}: only ${out.length} of ${template.count} distinct questions after ${maxSeed} seeds`,
      );
    }
    const rng = variantRng(template.id, seed);
    const draft = generator.generate(sampleParams(rng, template, generator.params));
    if (!draft || stems.has(draft.stem.en)) continue;
    const options = buildOptions(rng, draft);
    if (!options) continue;
    stems.add(draft.stem.en);
    out.push({
      id: `${template.id}.${seed}`,
      conceptId: template.conceptId,
      difficulty: template.difficulty,
      stem: draft.stem,
      solution: draft.solution,
      boardTags: [...template.boardTags],
      ...(template.tags ? { tags: [...template.tags] } : {}),
      reviewStatus: template.reviewStatus,
      templateId: template.id,
      type: "mcq",
      options,
    });
  }
  return out;
}
