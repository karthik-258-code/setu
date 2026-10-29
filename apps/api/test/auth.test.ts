import { describe, expect, it } from "vitest";
import { hashSecret, issueToken, signToken, verifySecret, verifyToken } from "../src/auth";

const SECRET = "test-secret";

describe("secrets", () => {
  it("hashes with a fresh salt and verifies only the right secret", async () => {
    const a = await hashSecret("setu-demo");
    const b = await hashSecret("setu-demo");
    expect(a).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(a).not.toBe(b);
    expect(await verifySecret("setu-demo", a)).toBe(true);
    expect(await verifySecret("wrong", a)).toBe(false);
    expect(await verifySecret("setu-demo", "not-a-hash")).toBe(false);
  });
});

describe("tokens", () => {
  it("round-trips claims and rejects tampering, another secret and expiry", () => {
    const token = issueToken("teacher", "access", "t1", SECRET, 1000);
    expect(verifyToken(token, SECRET, 1001)).toMatchObject({ sub: "t1", role: "teacher", kind: "access" });
    expect(verifyToken(token, "other", 1001)).toBeNull();
    expect(verifyToken(token, SECRET, 1000 + 60 * 60)).toBeNull();
    const [h, , s] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "t2", role: "teacher", kind: "access", exp: 9e9 })).toString("base64url");
    expect(verifyToken(`${h}.${forged}.${s}`, SECRET, 1001)).toBeNull();
    expect(verifyToken(signToken({ sub: "", role: "student", kind: "access", exp: 9e9 }, SECRET), SECRET, 1)).toBeNull();
  });
});
