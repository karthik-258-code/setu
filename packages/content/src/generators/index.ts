import { addUnlikeFractions } from "./add-unlike-fractions";
import { combineLikeTerms } from "./combine-like-terms";
import { integerAddSub } from "./integer-add-sub";
import { integerMulDiv } from "./integer-mul-div";
import { linearBothSides } from "./linear-both-sides";
import { linearBrackets } from "./linear-brackets";
import { linearFractionCoeff } from "./linear-fraction-coeff";
import { transposeLinear } from "./transpose-linear";
import type { Generator } from "./types";

const ALL: readonly Generator[] = [
  addUnlikeFractions,
  integerAddSub,
  integerMulDiv,
  combineLikeTerms,
  transposeLinear,
  linearBothSides,
  linearBrackets,
  linearFractionCoeff,
];

/** Generators by the id a template names in its `generator` field. */
export const GENERATORS: Readonly<Record<string, Generator>> = Object.fromEntries(
  ALL.map((g) => [g.id, g]),
);
