import { fraction, lcm, term } from "./format";
import { same } from "./types";
import type { Generator } from "./types";

/**
 * Solve x/a + x/b = c with x = n·LCM(a, b), so x and c are integers. Multiplying the fraction
 * terms by the LCM but not c is E-LCM-PARTIAL; adding the fractions as (x + x)/(a + b) is
 * F-ADD-DENOM.
 */
export const linearFractionCoeff: Generator<"a" | "b" | "n"> = {
  id: "linear_fraction_coeff",
  params: ["a", "b", "n"],
  generate({ a, b, n }) {
    if (a < 2 || b < 2 || a === b || n === 0) return null;
    const l = lcm(a, b);
    const x = n * l;
    const c = x / a + x / b;
    const s = l / a + l / b;
    const eq = `x/${a} + x/${b} = ${c}`;
    const cleared = `${term(l / a, "x")} + ${term(l / b, "x")} = ${l * c}`;
    return {
      stem: { en: `Solve ${eq}.`, te: `${eq} ను సాధించు.` },
      solution: {
        en: `Multiply every term by ${l}, the LCM of ${a} and ${b}, including the ${c}: ${cleared}, so ${s}x = ${l * c} and x = ${x}.`,
        te: `${c} తో సహా ప్రతి పదాన్నీ ${a}, ${b} ల క.సా.గు. ${l} తో గుణించు: ${cleared}, కాబట్టి ${s}x = ${l * c}, x = ${x}.`,
      },
      answer: same(`x = ${x}`),
      distractors: [
        { text: same(`x = ${fraction(c, s)}`), misconceptionCode: "E-LCM-PARTIAL" },
        { text: same(`x = ${fraction(c * (a + b), 2)}`), misconceptionCode: "F-ADD-DENOM" },
        { text: same(`x = ${c * l}`) },
        { text: same(`x = ${-x}`) },
        { text: same(`x = ${x + l}`) },
      ],
    };
  },
};
