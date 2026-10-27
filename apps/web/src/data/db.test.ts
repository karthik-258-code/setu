import { describe, expect, it } from "vitest";
import { SetuDb } from "./db";

describe("Dexie db", () => {
  it("opens as `setu` v1 with the ARCHITECTURE 7.3 tables and indexes", async () => {
    const db = new SetuDb();
    await db.open();
    expect(db.name).toBe("setu");
    expect(db.verno).toBe(1);
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      "events",
      "meta",
      "packs",
      "profiles",
      "states",
    ]);
    expect(db.events.schema.primKey.name).toBe("id");
    const indexes = db.events.schema.indexes.map((i) => i.name).sort();
    expect(indexes).toEqual(["[studentId+ts]", "synced"]);
    db.close();
  });

  it("round-trips an event through the [studentId+ts] index", async () => {
    const db = new SetuDb("setu-test");
    await db.events.bulkAdd([
      {
        id: "e2",
        type: "learn_viewed",
        studentId: "s1",
        ts: "2026-10-27T10:00:00.000Z",
        conceptId: "M8.LEQ.ONE_SIDE",
        resourceId: "r1",
        synced: 0,
      },
      {
        id: "e1",
        type: "learn_viewed",
        studentId: "s1",
        ts: "2026-10-27T09:00:00.000Z",
        conceptId: "M8.LEQ.ONE_SIDE",
        resourceId: "r1",
        synced: 1,
      },
    ]);
    const rows = await db.events
      .where("[studentId+ts]")
      .between(["s1", ""], ["s1", "\uffff"])
      .toArray();
    expect(rows.map((r) => r.id)).toEqual(["e1", "e2"]);
    expect(await db.events.where("synced").equals(0).count()).toBe(1);
    await db.delete();
  });
});
