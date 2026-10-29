import { fraction, signed, term } from "./format";
import { same } from "./types";
import type { Generator } from "./types";

/**
 * Solve ax + b = c for an integer x. Keeping the sign of b when it crosses is E-TRANSPOSE-SIGN;
 * subtracting the coefficient instead of dividing by it is E-TRANSPOSE-DIVIDE.
 */
export const transposeLinear: Generator<"a" | "x" | "b"> = {
  id: "transpose_linear",
  params: ["a", "x", "b"],
  generate({ a, x, b }) {
    if (a < 2 || b === 0) return null;
    const c = a * x + b;
    const k = c - b;
    const eq = `${term(a, "x")} ${signed(b)} = ${c}`;
    const steps = `${term(a, "x")} = ${c} ${signed(-b)} = ${k}`;
    return {
      stem: { en: `Solve ${eq}.`, te: `${eq} ను సాధించు.` },
      solution: {
        en: `${steps}, so x = ${k} ÷ ${a} = ${x}.`,
        te: `${steps}, కాబట్టి x = ${k} ÷ ${a} = ${x}.`,
      },
      answer: same(`x = ${x}`),
      distractors: [
        { text: same(`x = ${fraction(c + b, a)}`), misconceptionCode: "E-TRANSPOSE-SIGN" },
        { text: same(`x = ${k - a}`), misconceptionCode: "E-TRANSPOSE-DIVIDE" },
        { text: same(`x = ${k}`) },
        { text: same(`x = ${-x}`) },
        { text: same(`x = ${x + 1}`) },
      ],
    };
  },
};
