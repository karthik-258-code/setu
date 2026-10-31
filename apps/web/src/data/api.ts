import type { ApiClient } from "@setu/shared";
import type { ContentPack } from "@setu/engine";
import { db } from "./db";
import { HttpApiClient } from "./http-api-client";
import { LocalDemoApiClient } from "./local-demo-api-client";
import { getPack } from "./packs";

/** Set `VITE_API_URL` (for example `http://localhost:3000`) to use the API; otherwise demo mode. */
const apiUrl = import.meta.env.VITE_API_URL as string | undefined;

function configuredApiClient(): ApiClient {
  return apiUrl !== undefined && apiUrl !== ""
    ? new HttpApiClient(apiUrl, db)
    : new LocalDemoApiClient(db, (chapterId) => getPack(db, chapterId));
}

let current = configuredApiClient();
let demoModeActive = false;

/** The client every screen uses: `HttpApiClient` when `VITE_API_URL` is set, else demo mode. */
export function apiClient(): ApiClient {
  return current;
}

/** Uses the browser-only seeded demo even when the deployed app is API-backed. */
export function enterDemoMode(
  demoDb = db,
  loadPack?: (chapterId: string) => Promise<ContentPack>,
): void {
  const resolvePack = loadPack ?? ((chapterId: string) => getPack(demoDb, chapterId));
  current = new LocalDemoApiClient(demoDb, resolvePack);
  demoModeActive = true;
}

/** Returns to the configured API after leaving the seeded demo. */
export function exitDemoMode(): void {
  if (!demoModeActive) return;
  current = configuredApiClient();
  demoModeActive = false;
}

/** Swaps the client, for example to `HttpApiClient` after a real login (3.10). */
export function setApiClient(next: ApiClient): void {
  current = next;
  demoModeActive = false;
}
