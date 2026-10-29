import { fraction, signed } from "./format";
import { same } from "./types";
import type { Generator } from "./types";

/**
 * Solve k(x + p) = m for an integer x. Multiplying only the first term is E-DIST-PARTIAL; a sign
 * slip on kp is E-TRANSPOSE-SIGN; subtracting k instead of dividing is E-TRANSPOSE-DIVIDE.
 */
export const linearBrackets: Generator<"k" | "p" | "x"> = {
  id: "linear_brackets",
  params: ["k", "p", "x"],
  generate({ k, p, x }) {
    if (k < 2 || p === 0) return null;
    const m = k * (x + p);
    const kp = k * p;
    const t = m - kp;
    const eq = `${k}(x ${signed(p)}) = ${m}`;
    const opened = `${k}x ${signed(kp)} = ${m}`;
    const moved = `${k}x = ${m} ${signed(-kp)} = ${t}`;
    return {
      stem: { en: `Solve ${eq}.`, te: `${eq} ను సాధించు.` },
      solution: {
        en: `Open the bracket: ${opened}. Then ${moved}, so x = ${x}.`,
        te: `కుండలీకరణం తెరువు: ${opened}. అప్పుడు ${moved}, కాబట్టి x = ${x}.`,
      },
      answer: same(`x = ${x}`),
      distractors: [
        { text: same(`x = ${fraction(m - p, k)}`), misconceptionCode: "E-DIST-PARTIAL" },
        { text: same(`x = ${fraction(m + kp, k)}`), misconceptionCode: "E-TRANSPOSE-SIGN" },
        { text: same(`x = ${t - k}`), misconceptionCode: "E-TRANSPOSE-DIVIDE" },
        { text: same(`x = ${fraction(m, k)}`) },
        { text: same(`x = ${-x}`) },
      ],
    };
  },
};
