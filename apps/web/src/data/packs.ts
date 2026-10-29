import type { ContentPack } from "@setu/engine";
import { packResponseSchema } from "@setu/shared";
import type { SetuDb } from "./db";

/** One line of `/packs/index.json`, written by `pnpm content:pack` (DECISIONS 2.7). */
export interface PackIndexEntry {
  chapterId: string;
  packVersion: string;
  bytes: number;
}

export type Fetcher = (url: string) => Promise<Response>;

export const PACK_INDEX_URL = "/packs/index.json";

/** Versioned pack URL; the service worker caches each version as its own entry (DECISIONS 0.5). */
export function packUrl(chapterId: string, packVersion: string): string {
  return `/packs/${encodeURIComponent(chapterId)}.json?v=${encodeURIComponent(packVersion)}`;
}

async function fetchJson(fetcher: Fetcher, url: string): Promise<unknown> {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`GET ${url} failed with status ${response.status}`);
  return response.json();
}

/**
 * The pack for `chapterId`. Online, it reads the index and downloads the pack only when the stored
 * copy is missing or has another `packVersion`; a downloaded pack is validated against the shared
 * schema and stored. When the network fails, the stored copy is used, so a student is never
 * blocked offline once the pack has been downloaded. Throws only when there is no stored copy and
 * the network cannot provide a valid pack.
 */
export async function getPack(
  db: SetuDb,
  chapterId: string,
  fetcher: Fetcher = (url) => fetch(url),
): Promise<ContentPack> {
  const stored = await db.packs.get(chapterId);
  let entry: PackIndexEntry | undefined;
  try {
    const index = (await fetchJson(fetcher, PACK_INDEX_URL)) as PackIndexEntry[];
    entry = index.find((e) => e.chapterId === chapterId);
  } catch (error) {
    if (stored) return stored.pack;
    throw error;
  }
  if (!entry) {
    if (stored) return stored.pack;
    throw new Error(`No pack for chapter ${chapterId}`);
  }
  if (stored && stored.packVersion === entry.packVersion) return stored.pack;
  try {
    const pack = packResponseSchema.parse(
      await fetchJson(fetcher, packUrl(chapterId, entry.packVersion)),
    ) as ContentPack;
    await db.packs.put({ chapterId, packVersion: pack.packVersion, pack });
    return pack;
  } catch (error) {
    if (stored) return stored.pack;
    throw error;
  }
}
