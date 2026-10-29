import { linear, signed, signedTerm, term } from "./format";
import { same } from "./types";
import type { Generator } from "./types";

const VARIABLES = ["x", "y", "m", "n"];

/**
 * Simplify `px + r + qx` (variable chosen by `v`). Folding the number into the x term is
 * A-UNLIKE-COMBINE; reading qx as plain x (losing its coefficient) is A-COEFF-DROP.
 */
export const combineLikeTerms: Generator<"p" | "q" | "r" | "v"> = {
  id: "combine_like_terms",
  params: ["p", "q", "r", "v"],
  generate({ p, q, r, v }) {
    const name = VARIABLES[v];
    if (name === undefined || p === 0 || q === 0 || r === 0 || p + q === 0) return null;
    const expr = `${term(p, name)} ${signed(r)} ${signedTerm(q, name)}`;
    const answer = linear(p + q, r, name);
    return {
      stem: { en: `Simplify: ${expr}`, te: `సూక్ష్మీకరించు: ${expr}` },
      solution: {
        en: `${term(p, name)} and ${term(q, name)} are like terms: ${p} ${signed(q)} = ${p + q}, so together they make ${term(p + q, name)}. The number ${r} is an unlike term and stays as it is: ${answer}.`,
        te: `${term(p, name)}, ${term(q, name)} సజాతి పదాలు: ${p} ${signed(q)} = ${p + q}, కాబట్టి కలిపి ${term(p + q, name)}. సంఖ్య ${r} విజాతి పదం, అది అలాగే ఉంటుంది: ${answer}.`,
      },
      answer: same(answer),
      distractors: [
        { text: same(linear(p + q + r, 0, name)), misconceptionCode: "A-UNLIKE-COMBINE" },
        { text: same(linear(p + Math.sign(q), r, name)), misconceptionCode: "A-COEFF-DROP" },
        { text: same(linear(p - q, r, name)) },
        { text: same(linear(p + q, -r, name)) },
        { text: same(`${p + q + r}`) },
      ],
    };
  },
};
