/** A random UUID v4 for event and session ids (WebCrypto; also available in Node 20 for tests). */
export function newId(): string {
  return crypto.randomUUID();
}
