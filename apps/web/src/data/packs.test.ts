import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TINY_CHAPTER, tinyPack } from "../test/fixtures";
import { SetuDb } from "./db";
import { PACK_INDEX_URL, getPack, packUrl } from "./packs";
import type { Fetcher } from "./packs";

let db: SetuDb;
let n = 0;

beforeEach(() => {
  n += 1;
  db = new SetuDb(`setu-packs-${n}`);
});

afterEach(async () => {
  await db.delete();
});

function server(routes: Record<string, unknown>, calls: string[]): Fetcher {
  return async (url) => {
    calls.push(url);
    const found = url in routes;
    return {
      ok: found,
      status: found ? 200 : 404,
      json: async () => routes[url],
    } as Response;
  };
}

const offline: Fetcher = async () => {
  throw new TypeError("Failed to fetch");
};

function routesFor(packVersion: string): Record<string, unknown> {
  return {
    [PACK_INDEX_URL]: [{ chapterId: TINY_CHAPTER, packVersion, bytes: 1000 }],
    [packUrl(TINY_CHAPTER, packVersion)]: tinyPack(packVersion),
  };
}

describe("getPack", () => {
  it("downloads, validates and stores the version the index lists, then reuses it", async () => {
    const calls: string[] = [];
    const pack = await getPack(db, TINY_CHAPTER, server(routesFor("tiny-1"), calls));
    expect(pack.packVersion).toBe("tiny-1");
    expect((await db.packs.get(TINY_CHAPTER))?.packVersion).toBe("tiny-1");
    await getPack(db, TINY_CHAPTER, server(routesFor("tiny-1"), calls));
    expect(calls).toEqual([
      PACK_INDEX_URL,
      "/packs/CH.M8.LINEAR_EQ_ONE_VAR.json?v=tiny-1",
      PACK_INDEX_URL,
    ]);
  });

  it("downloads again when the index lists a new version", async () => {
    await getPack(db, TINY_CHAPTER, server(routesFor("tiny-1"), []));
    const pack = await getPack(db, TINY_CHAPTER, server(routesFor("tiny-2"), []));
    expect(pack.packVersion).toBe("tiny-2");
    expect((await db.packs.get(TINY_CHAPTER))?.packVersion).toBe("tiny-2");
  });

  it("uses the stored pack when offline", async () => {
    await getPack(db, TINY_CHAPTER, server(routesFor("tiny-1"), []));
    expect((await getPack(db, TINY_CHAPTER, offline)).packVersion).toBe("tiny-1");
  });

  it("throws when offline with nothing stored, or when the chapter has no pack", async () => {
    await expect(getPack(db, TINY_CHAPTER, offline)).rejects.toThrow("Failed to fetch");
    await expect(getPack(db, "CH.NOPE", server(routesFor("tiny-1"), []))).rejects.toThrow(
      "No pack for chapter CH.NOPE",
    );
  });

  it("rejects a downloaded pack that does not match the shared schema", async () => {
    const routes = routesFor("tiny-1");
    routes[packUrl(TINY_CHAPTER, "tiny-1")] = { packVersion: "tiny-1" };
    await expect(getPack(db, TINY_CHAPTER, server(routes, []))).rejects.toThrow();
    expect(await db.packs.get(TINY_CHAPTER)).toBeUndefined();
  });
});
