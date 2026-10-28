/** Number and expression formatting shared by the generators. Every function is pure. */

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

export function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

/** `n/d` in lowest terms with the sign in front, or a plain integer when `d` divides `n`. */
export function fraction(n: number, d: number): string {
  if (d === 0) throw new RangeError("fraction: zero denominator");
  if (n === 0) return "0";
  const g = gcd(n, d);
  let num = n / g;
  let den = d / g;
  if (den < 0) {
    num = -num;
    den = -den;
  }
  return den === 1 ? `${num}` : `${num}/${den}`;
}

/** `+ 5` or `- 5`, for writing a number after another term. */
export function signed(n: number): string {
  return n < 0 ? `- ${-n}` : `+ ${n}`;
}

/** A negative number in brackets, as written after an operator: `(-3)`. */
export function paren(n: number): string {
  return n < 0 ? `(${n})` : `${n}`;
}

/** `3x`, `x`, `-x` or `-3x`. */
export function term(coef: number, name: string): string {
  if (coef === 1) return name;
  if (coef === -1) return `-${name}`;
  return `${coef}${name}`;
}

/** `+ 3x` or `- 3x`, for writing a term after another term. */
export function signedTerm(coef: number, name: string): string {
  return coef < 0 ? `- ${term(-coef, name)}` : `+ ${term(coef, name)}`;
}

/** `coef·name + constant` in simplest written form: `5x + 3`, `x - 2`, `-x`, `7`. */
export function linear(coef: number, constant: number, name: string): string {
  if (coef === 0) return `${constant}`;
  if (constant === 0) return term(coef, name);
  return `${term(coef, name)} ${signed(constant)}`;
}

/** `left = right`, or just `left` when the two are written the same. */
export function chain(left: string, right: string): string {
  return left === right ? left : `${left} = ${right}`;
}
