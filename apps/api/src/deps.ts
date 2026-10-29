import type { ContentPack } from "@setu/engine";
import type { Store } from "./store";

/** What the routes are built from; `server.ts` supplies the production values. */
export interface ApiDeps {
  store: Store;
  /** HMAC secret for access and refresh tokens. */
  tokenSecret: string;
  /** Reads a built pack (task 4.3); throws for an unknown chapter. */
  loadPack: (chapterId: string) => Promise<ContentPack>;
  now?: () => Date;
}

export function nowOf(deps: ApiDeps): Date {
  return deps.now?.() ?? new Date();
}

export function nowSeconds(deps: ApiDeps): number {
  return Math.floor(nowOf(deps).getTime() / 1000);
}
