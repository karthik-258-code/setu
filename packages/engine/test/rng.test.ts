import { describe, expect, it } from "vitest";
import { mulberry32, pick, shuffle } from "../src/index";

function take(rng: () => number, n: number): number[] {
  return Array.from({ length: n }, () => rng());
}

describe("mulberry32", () => {
  it("gives the same sequence for the same seed", () => {
    expect(take(mulberry32(42), 100)).toEqual(take(mulberry32(42), 100));
  });

  it("gives different sequences for different seeds", () => {
    expect(take(mulberry32(1), 10)).not.toEqual(take(mulberry32(2), 10));
  });

  it("matches the reference mulberry32 output for seed 0", () => {
    expect(take(mulberry32(0), 3)).toEqual([
      0.26642920868471265, 0.0003297457005828619, 0.2232720274478197,
    ]);
  });

  it("returns floats in [0, 1)", () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 10_000; i++) {
      const x = rng();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe("pick", () => {
  it("returns an element of the array, deterministically for a seed", () => {
    const arr = ["a", "b", "c", "d"] as const;
    const first = pick(mulberry32(7), arr);
    expect(arr).toContain(first);
    expect(pick(mulberry32(7), arr)).toBe(first);
  });

  it("can reach every element and the last index", () => {
    const rng = mulberry32(99);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(pick(rng, [0, 1, 2, 3, 4]));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it("returns the only element of a singleton", () => {
    expect(pick(mulberry32(1), ["x"])).toBe("x");
  });

  it("throws on an empty array", () => {
    expect(() => pick(mulberry32(1), [])).toThrow();
  });
});

describe("shuffle", () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it("returns a permutation of the input", () => {
    expect(shuffle(mulberry32(3), input).sort((a, b) => a - b)).toEqual(input);
  });

  it("does not mutate the input and returns a new array", () => {
    const copy = [...input];
    const out = shuffle(mulberry32(3), input);
    expect(input).toEqual(copy);
    expect(out).not.toBe(input);
  });

  it("is deterministic for a seed", () => {
    expect(shuffle(mulberry32(5), input)).toEqual(shuffle(mulberry32(5), input));
  });

  it("actually reorders for at least some seeds", () => {
    const moved = [1, 2, 3, 4, 5].some(
      (s) => shuffle(mulberry32(s), input).join() !== input.join(),
    );
    expect(moved).toBe(true);
  });

  it("handles empty and single-element arrays", () => {
    expect(shuffle(mulberry32(1), [])).toEqual([]);
    expect(shuffle(mulberry32(1), ["a"])).toEqual(["a"]);
  });

  it("works on frozen arrays", () => {
    expect(shuffle(mulberry32(1), Object.freeze([1, 2, 3]))).toHaveLength(3);
  });
});
