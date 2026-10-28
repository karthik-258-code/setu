import type { StudentEvent } from "@setu/engine";
import type { ApiClient, SyncResponse } from "@setu/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SetuDb } from "./db";
import { pendingEvents, syncOnce } from "./sync-queue";

let db: SetuDb;
let n = 0;

beforeEach(() => {
  n += 1;
  db = new SetuDb(`setu-sync-${n}`);
});

afterEach(async () => {
  await db.delete();
});

function event(id: string, studentId: string, minute: number): StudentEvent {
  return {
    type: "learn_viewed",
    id,
    studentId,
    ts: new Date(Date.UTC(2026, 9, 28, 9, minute)).toISOString(),
    conceptId: "M7.SEQ.TRANSPOSE",
    resourceId: "R1",
  };
}

function client(reply: (events: StudentEvent[]) => SyncResponse) {
  const batches: StudentEvent[][] = [];
  const api = {
    sync: async (events: StudentEvent[]) => {
      batches.push(events);
      return reply(events);
    },
  } as unknown as ApiClient;
  return { api, batches };
}

describe("sync queue", () => {
  it("sends only the student's unsynced events, marks accepted ones and keeps rejected ones out of later batches", async () => {
    await db.events.bulkAdd([
      { ...event("e2", "s1", 2), synced: 0 },
      { ...event("e1", "s1", 1), synced: 0 },
      { ...event("e3", "s1", 3), synced: 1 },
      { ...event("x1", "s2", 1), synced: 0 },
    ]);
    const { api, batches } = client((events) => ({
      accepted: events.filter((e) => e.id !== "e2").map((e) => e.id),
      rejected: events.filter((e) => e.id === "e2").map((e) => ({ id: e.id, reason: "bad" })),
      serverTime: "2026-10-28T10:00:00.000Z",
    }));
    const result = await syncOnce(db, api, "s1");
    expect(batches).toHaveLength(1);
    expect(batches[0]?.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(batches[0]?.[0]).not.toHaveProperty("synced");
    expect(result).toEqual({ sent: 2, accepted: 1, rejected: 1, pending: 0 });
    expect((await db.events.get("e1"))?.synced).toBe(1);
    expect((await db.events.get("e2"))?.synced).toBe(0);
    expect(await db.meta.get("sync:rejected")).toMatchObject({ value: { e2: "bad" } });
    expect((await pendingEvents(db, "s2")).map((e) => e.id)).toEqual(["x1"]);
    expect((await syncOnce(db, api, "s1")).sent).toBe(0);
  });

  it("leaves events queued when the upload fails", async () => {
    await db.events.add({ ...event("e1", "s1", 1), synced: 0 });
    const api = { sync: async () => Promise.reject(new Error("offline")) } as unknown as ApiClient;
    await expect(syncOnce(db, api, "s1")).rejects.toThrow("offline");
    expect((await pendingEvents(db, "s1")).map((e) => e.id)).toEqual(["e1"]);
  });
});
