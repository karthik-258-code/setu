import { fraction, signed, term } from "./format";
import { same } from "./types";
import type { Generator } from "./types";

/**
 * Solve ax + b = cx + d for an integer x (d is derived from x). Moving terms across without
 * changing their sign is E-TRANSPOSE-SIGN; subtracting the coefficient is E-TRANSPOSE-DIVIDE.
 */
export const linearBothSides: Generator<"a" | "b" | "c" | "x"> = {
  id: "linear_both_sides",
  params: ["a", "b", "c", "x"],
  generate({ a, b, c, x }) {
    if (a < 1 || c < 1 || a === c || b === 0) return null;
    const d = (a - c) * x + b;
    if (d === 0) return null;
    const coef = a - c;
    const k = d - b;
    const eq = `${term(a, "x")} ${signed(b)} = ${term(c, "x")} ${signed(d)}`;
    const collect = `${term(a, "x")} - ${term(c, "x")} = ${d} ${signed(-b)}`;
    return {
      stem: { en: `Solve ${eq}.`, te: `${eq} ను సాధించు.` },
      solution: {
        en: `Collect the x terms on one side and the numbers on the other: ${collect}, so ${term(coef, "x")} = ${k} and x = ${x}.`,
        te: `x పదాలను ఒక వైపు, సంఖ్యలను మరో వైపు చేర్చు: ${collect}, కాబట్టి ${term(coef, "x")} = ${k}, x = ${x}.`,
      },
      answer: same(`x = ${x}`),
      distractors: [
        { text: same(`x = ${fraction(d + b, a + c)}`), misconceptionCode: "E-TRANSPOSE-SIGN" },
        { text: same(`x = ${fraction(k, a + c)}`), misconceptionCode: "E-TRANSPOSE-SIGN" },
        { text: same(`x = ${k - coef}`), misconceptionCode: "E-TRANSPOSE-DIVIDE" },
        { text: same(`x = ${-x}`) },
        { text: same(`x = ${x + 1}`) },
      ],
    };
  },
};
