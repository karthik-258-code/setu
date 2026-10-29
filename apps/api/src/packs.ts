/**
 * Reads the packs that `pnpm content:pack` writes to apps/api/packs/ (task 4.3), validated with
 * the shared schema and cached per file version.
 */
import { readFile } from "node:fs/promises";
import type { ContentPack } from "@setu/engine";
import { packResponseSchema } from "@setu/shared";

const CHAPTER_ID = /^[A-Za-z0-9._-]+$/;

export function packLoader(dir: URL): (chapterId: string) => Promise<ContentPack> {
  const cache = new Map<string, ContentPack>();
  return async (chapterId) => {
    if (!CHAPTER_ID.test(chapterId)) throw new Error(`Bad chapter id ${chapterId}`);
    const cached = cache.get(chapterId);
    if (cached) return cached;
    const raw: unknown = JSON.parse(await readFile(new URL(`${chapterId}.json`, dir), "utf8"));
    const pack = packResponseSchema.parse(raw) as ContentPack;
    cache.set(chapterId, pack);
    return pack;
  };
}
