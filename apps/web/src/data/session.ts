import { newId } from "./ids";

let current: string | null = null;

/**
 * The id of the current sitting, stamped on every event so the policy can apply "one re-check per
 * session" (ARCHITECTURE 5.4). One sitting lasts from app start until `startNewSession`.
 */
export function currentSessionId(): string {
  if (current === null) current = newId();
  return current;
}

/** Starts a new sitting, for example when another student picks their profile on a shared device. */
export function startNewSession(): string {
  current = newId();
  return current;
}
