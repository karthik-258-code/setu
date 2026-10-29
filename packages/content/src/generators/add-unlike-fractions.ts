import { chain, fraction, gcd, lcm } from "./format";
import { same } from "./types";
import type { Generator } from "./types";

/** a/b + c/d with b != d, both proper and in lowest terms. (a+c)/(b+d) is F-ADD-DENOM. */
export const addUnlikeFractions: Generator<"a" | "b" | "c" | "d"> = {
  id: "add_unlike_fractions",
  params: ["a", "b", "c", "d"],
  generate({ a, b, c, d }) {
    if (a < 1 || c < 1 || a >= b || c >= d || b === d) return null;
    if (gcd(a, b) !== 1 || gcd(c, d) !== 1) return null;
    const l = lcm(b, d);
    const a2 = a * (l / b);
    const c2 = c * (l / d);
    const expr = `${a}/${b} + ${c}/${d}`;
    const first = chain(`${a}/${b}`, `${a2}/${l}`);
    const second = chain(`${c}/${d}`, `${c2}/${l}`);
    const total = chain(`${a2 + c2}/${l}`, fraction(a2 + c2, l));
    return {
      stem: { en: `Find ${expr}.`, te: `${expr} విలువ కనుగొను.` },
      solution: {
        en: `The LCM of ${b} and ${d} is ${l}, so ${first} and ${second}. Then ${expr} = ${total}.`,
        te: `${b}, ${d} ల క.సా.గు. ${l}, కాబట్టి ${first}, ${second}. అప్పుడు ${expr} = ${total}.`,
      },
      answer: same(fraction(a2 + c2, l)),
      distractors: [
        { text: same(fraction(a + c, b + d)), misconceptionCode: "F-ADD-DENOM" },
        { text: same(fraction(a + c, l)) },
        { text: same(fraction(a * c, b * d)) },
        { text: same(fraction(a2 + c2, b * d)) },
      ],
    };
  },
};
