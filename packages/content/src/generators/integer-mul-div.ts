import { paren } from "./format";
import { same } from "./types";
import type { Generator } from "./types";

/**
 * a × b (op 0) or (a·b) ÷ b (op 1) with at least one negative integer and |b| > 1, so the
 * quotient is always the integer a. The wrong sign of the result is I-SIGN-MUL.
 */
export const integerMulDiv: Generator<"a" | "b" | "op"> = {
  id: "integer_mul_div",
  params: ["a", "b", "op"],
  generate({ a, b, op }) {
    if (a === 0 || b === 0 || (a > 0 && b > 0) || Math.abs(b) === 1) return null;
    const multiply = op === 0;
    const symbol = multiply ? "×" : "÷";
    const left = multiply ? a : a * b;
    const result = multiply ? a * b : a;
    const expr = `${paren(left)} ${symbol} ${paren(b)}`;
    const size = `${Math.abs(left)} ${symbol} ${Math.abs(b)} = ${Math.abs(result)}`;
    const positive = left > 0 === b > 0;
    return {
      stem: { en: `Find ${expr}.`, te: `${expr} విలువ కనుగొను.` },
      solution: {
        en: `${positive ? "Same signs give a positive result" : "Different signs give a negative result"}: ${size}, so ${expr} = ${result}.`,
        te: `${positive ? "గుర్తులు ఒకటే అయితే ఫలితం ధనం" : "గుర్తులు వేరు అయితే ఫలితం రుణం"}: ${size}, కాబట్టి ${expr} = ${result}.`,
      },
      answer: same(`${result}`),
      distractors: [
        { text: same(`${-result}`), misconceptionCode: "I-SIGN-MUL" },
        { text: same(`${multiply ? a + b : left + b}`) },
        { text: same(`${2 * result}`) },
        { text: same(`${result + 1}`) },
      ],
    };
  },
};
