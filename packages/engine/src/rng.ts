/**
 * Seeded randomness for the engine. Callers pass the returned `rng` into any
 * function that needs randomness; the engine never touches Math.random().
 */

/** Standard mulberry32. Returns a generator of floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniformly picks one element. Throws on an empty array. */
export function pick<T>(rng: () => number, arr: readonly T[]): T {
  if (arr.length === 0) {
    throw new RangeError("pick: cannot pick from an empty array");
  }
  return arr[Math.floor(rng() * arr.length)] as T;
}

/** Fisher-Yates shuffle on a copy. Never mutates `arr`. */
export function shuffle<T>(rng: () => number, arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}
