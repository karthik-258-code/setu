import { paren } from "./format";
import { same } from "./types";
import type { Generator } from "./types";

/** a + b (op 0) or a - b (op 1) with at least one negative integer. Sign slips are I-SIGN-ADD. */
export const integerAddSub: Generator<"a" | "b" | "op"> = {
  id: "integer_add_sub",
  params: ["a", "b", "op"],
  generate({ a, b, op }) {
    if (a === 0 || b === 0 || (a > 0 && b > 0)) return null;
    const add = op === 0;
    const expr = `${a} ${add ? "+" : "-"} ${paren(b)}`;
    const result = add ? a + b : a - b;
    if (result === 0) return null;
    const steps = Math.abs(b);
    const solution = add
      ? {
          en: `${expr} = ${result}. On the number line, start at ${a} and move ${steps} steps to the ${b > 0 ? "right" : "left"}.`,
          te: `${expr} = ${result}. సంఖ్యా రేఖపై ${a} వద్ద మొదలుపెట్టి ${steps} అడుగులు ${b > 0 ? "కుడివైపు" : "ఎడమవైపు"} కదులు.`,
        }
      : {
          en: `Subtracting ${paren(b)} is the same as adding ${paren(-b)}: ${expr} = ${a} + ${paren(-b)} = ${result}.`,
          te: `${paren(b)} ను తీసివేయడం ${paren(-b)} ను కలపడంతో సమానం: ${expr} = ${a} + ${paren(-b)} = ${result}.`,
        };
    const slips = add ? [-result, Math.sign(a) * (Math.abs(a) + Math.abs(b))] : [a + b, -result];
    return {
      stem: { en: `Find ${expr}.`, te: `${expr} విలువ కనుగొను.` },
      solution,
      answer: same(`${result}`),
      distractors: [
        ...slips.map((v) => ({ text: same(`${v}`), misconceptionCode: "I-SIGN-ADD" })),
        { text: same(`${result + 1}`) },
        { text: same(`${result - 1}`) },
      ],
    };
  },
};
