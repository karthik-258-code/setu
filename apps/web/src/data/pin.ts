import type { SetuDb } from "./db";

const SALT_KEY = "deviceSalt";

/** A student PIN is exactly four digits (shared `studentLoginRequestSchema`). */
export const PIN_PATTERN = /^\d{4}$/;

function hex(bytes: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** This device's random salt (16 bytes, hex), created on first use and kept in `meta`. */
export async function deviceSalt(db: SetuDb): Promise<string> {
  const existing = (await db.meta.get(SALT_KEY))?.value;
  if (typeof existing === "string") return existing;
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  await db.meta.put({ key: SALT_KEY, value: salt });
  return salt;
}

/** SHA-256 of `salt:pin` with WebCrypto, as hex (ARCHITECTURE 7.3). The PIN itself is never stored. */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${pin}`));
  return hex(digest);
}
