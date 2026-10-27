import { directPrereqs } from "./graph";
import type { MasteryView } from "./graph";
import { DEFAULT_BKT, MASTERY_THRESHOLD } from "./types";
import type { BktParams, Concept, ConceptGraph, ConceptId } from "./types";

const PRIOR_FLOOR = 0.05;
const PRIOR_CEILING = 0.95;

function requireProbability(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be a finite number in [0, 1], got ${value}`);
  }
}

function requireParams(params: BktParams): void {
  requireProbability("pL0", params.pL0);
  requireProbability("pT", params.pT);
  requireProbability("pG", params.pG);
  requireProbability("pS", params.pS);
}

/** `DEFAULT_BKT` with the concept's `bkt` overrides applied. Does not mutate either. */
export function paramsFor(concept: Concept): BktParams {
  const params: BktParams = { ...DEFAULT_BKT };
  for (const key of ["pL0", "pT", "pG", "pS"] as const) {
    const override = concept.bkt?.[key];
    if (override !== undefined) params[key] = override;
  }
  return params;
}

/**
 * One BKT step (ARCHITECTURE 5.2): Bayes posterior given the answer, then the learning
 * transition. Throws RangeError if `pKnown` or any parameter is not a finite number in [0, 1].
 * An observation the model calls impossible (zero evidence, for example `pL = 0` with
 * `pG = 0` and a correct answer) leaves `pKnown` as the prior before the learning step.
 */
export function bktUpdate(pKnown: number, correct: boolean, params: BktParams): number {
  requireProbability("pKnown", pKnown);
  requireParams(params);
  const { pT, pG, pS } = params;

  const numerator = correct ? pKnown * (1 - pS) : pKnown * pS;
  const evidence = correct ? numerator + (1 - pKnown) * pG : numerator + (1 - pKnown) * (1 - pG);
  const posterior = evidence === 0 ? pKnown : numerator / evidence;
  return posterior + (1 - posterior) * pT;
}

/**
 * Prior for a concept when first touched: `clamp(pL0 * (0.4 + 0.6 * minPrereq), 0.05, 0.95)`,
 * `minPrereq` being the lowest `pKnown` over direct prerequisites (`pL0` for any without a
 * mastery entry). A concept with no prerequisites returns `pL0` unchanged and unclamped.
 * Throws if `conceptId` is unknown or inputs are outside [0, 1].
 */
export function priorFromPrerequisites(
  graph: ConceptGraph,
  conceptId: ConceptId,
  mastery: MasteryView,
  params: BktParams,
): number {
  requireParams(params);
  const prereqs = directPrereqs(graph, conceptId);
  if (prereqs.length === 0) return params.pL0;

  let minPrereq = 1;
  for (const id of prereqs) {
    const pKnown = mastery[id]?.pKnown ?? params.pL0;
    requireProbability(`mastery[${id}].pKnown`, pKnown);
    if (pKnown < minPrereq) minPrereq = pKnown;
  }
  const prior = params.pL0 * (0.4 + 0.6 * minPrereq);
  return Math.min(PRIOR_CEILING, Math.max(PRIOR_FLOOR, prior));
}

/** True when `pKnown >= MASTERY_THRESHOLD`. */
export function isMastered(pKnown: number): boolean {
  return pKnown >= MASTERY_THRESHOLD;
}
