/**
 * Secrets and tokens with `node:crypto` only. Passwords and PINs are hashed with scrypt (salted,
 * self-describing `scrypt$N$r$p$salt$hash`); tokens are HS256 JWTs (ARCHITECTURE 8.4).
 */
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;

function scrypt(secret: string, salt: Buffer, length: number, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(secret, salt, length, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(secret, salt, KEY_LENGTH, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

/** True when `secret` matches `stored`; false for any malformed hash. Constant-time compare. */
export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash ?? "", "base64url");
  if (expected.length === 0) return false;
  const actual = await scrypt(secret, Buffer.from(salt ?? "", "base64url"), expected.length, Number(n), Number(r), Number(p));
  return timingSafeEqual(actual, expected);
}

export type Role = "teacher" | "student";
export type TokenKind = "access" | "refresh";

export interface TokenClaims {
  sub: string;
  role: Role;
  kind: TokenKind;
  /** Expiry, seconds since the epoch. */
  exp: number;
}

/** Teachers refresh every hour; students sign in on a shared phone and may be offline for weeks. */
export const TOKEN_TTL_SECONDS: Record<Role, Record<TokenKind, number>> = {
  teacher: { access: 60 * 60, refresh: 30 * 24 * 60 * 60 },
  student: { access: 60 * 24 * 60 * 60, refresh: 60 * 24 * 60 * 60 },
};

const b64 = (text: string) => Buffer.from(text).toString("base64url");
const HEADER = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));

function mac(data: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

export function signToken(claims: TokenClaims, secret: string): string {
  const body = b64(JSON.stringify(claims));
  return `${HEADER}.${body}.${mac(`${HEADER}.${body}`, secret).toString("base64url")}`;
}

export function issueToken(role: Role, kind: TokenKind, sub: string, secret: string, nowSeconds: number): string {
  return signToken({ sub, role, kind, exp: nowSeconds + TOKEN_TTL_SECONDS[role][kind] }, secret);
}

/** The claims of a valid, unexpired token signed with `secret`, otherwise null. */
export function verifyToken(token: string, secret: string, nowSeconds: number): TokenClaims | null {
  const [head, body, signature] = token.split(".");
  if (!head || !body || !signature || head !== HEADER) return null;
  const given = Buffer.from(signature, "base64url");
  const expected = mac(`${head}.${body}`, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const c = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<TokenClaims>;
    if (typeof c.sub !== "string" || c.sub === "") return null;
    if (c.role !== "teacher" && c.role !== "student") return null;
    if (c.kind !== "access" && c.kind !== "refresh") return null;
    if (typeof c.exp !== "number" || c.exp <= nowSeconds) return null;
    return { sub: c.sub, role: c.role, kind: c.kind, exp: c.exp };
  } catch {
    return null;
  }
}
