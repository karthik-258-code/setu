import type { ApiClient } from "@setu/shared";
import { db } from "./db";
import { LocalDemoApiClient } from "./local-demo-api-client";
import { getPack } from "./packs";

let current: ApiClient = new LocalDemoApiClient(db, (chapterId) => getPack(db, chapterId));

/** The client every screen uses: demo mode until `HttpApiClient` arrives with task 3.10. */
export function apiClient(): ApiClient {
  return current;
}

/** Swaps the client, for example to `HttpApiClient` after a real login (3.10). */
export function setApiClient(next: ApiClient): void {
  current = next;
}
