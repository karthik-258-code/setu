import type { ApiClient } from "@setu/shared";
import { db } from "./db";
import { HttpApiClient } from "./http-api-client";
import { LocalDemoApiClient } from "./local-demo-api-client";
import { getPack } from "./packs";

/** Set `VITE_API_URL` (for example `http://localhost:3000`) to use the API; otherwise demo mode. */
const apiUrl = import.meta.env.VITE_API_URL as string | undefined;

let current: ApiClient =
  apiUrl !== undefined && apiUrl !== ""
    ? new HttpApiClient(apiUrl, db)
    : new LocalDemoApiClient(db, (chapterId) => getPack(db, chapterId));

/** The client every screen uses: `HttpApiClient` when `VITE_API_URL` is set, else demo mode. */
export function apiClient(): ApiClient {
  return current;
}

/** Swaps the client, for example to `HttpApiClient` after a real login (3.10). */
export function setApiClient(next: ApiClient): void {
  current = next;
}
