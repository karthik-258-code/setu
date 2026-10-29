import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { replay } from "@setu/engine";
import { tinyPack } from "../test/fixtures";
import { SetuDb } from "./db";
import { appendEvent, loadState, studentEvents } from "./event-store";
import type { EventContext, NewEvent } from "./event-store";

const pack = tinyPack();
let db: SetuDb;
let n = 0;

beforeEach(() => {
  n += 1;
  db = new SetuDb(`setu-event-store-${n}`);
});

afterEach(async () => {
  await db.delete();
});

function ctx(time: string, sessionId = "sitting-1"): EventContext {
  return { now: () => new Date(`2026-10-28T${time}:00.000Z`), sessionId };
}

function solve(correct: boolean): NewEvent {
  return {
    type: "attempt",
    studentId: "s1",
    questionId: "M8.LEQ.ONE_SIDE.Q01",
    conceptId: "M8.LEQ.ONE_SIDE",
    mode: "solve",
    difficulty: 1,
    correct,
    hintsUsed: 0,
    timeMs: 4000,
  };
}

describe("event store", () => {
  it("stamps a new event with a UUID, the time and the sitting, stores it unsynced and caches the state", async () => {
    const { event, state } = await appendEvent(db, pack, solve(true), ctx("10:00"));
    expect(event.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(event.ts).toBe("2026-10-28T10:00:00.000Z");
    expect(event.sessionId).toBe("sitting-1");
    expect((await db.events.get(event.id))?.synced).toBe(0);
    expect(state.eventCount).toBe(1);
    expect(state).toEqual(replay(pack, [event], "s1"));
    expect(await db.states.get("s1")).toEqual(state);
  });

  it("gives the same state as a full replay when an event arrives out of order", async () => {
    const later = await appendEvent(db, pack, solve(true), ctx("10:05"));
    const earlier = await appendEvent(db, pack, solve(false), ctx("10:01"));
    expect(earlier.state).toEqual(replay(pack, [later.event, earlier.event], "s1"));
    expect(earlier.state.lastEventTs).toBe(later.event.ts);
  });

  it("returns the cached state while it covers every stored event of the same pack", async () => {
    const { state } = await appendEvent(db, pack, solve(true), ctx("10:00"));
    await db.states.put({ ...state, extensionLocked: true });
    expect((await loadState(db, pack, "s1")).extensionLocked).toBe(true);
  });

  it("replays when the cache misses an event or was built from another pack", async () => {
    await appendEvent(db, pack, solve(true), ctx("10:00"));
    await db.events.add({
      id: "teacher-lock",
      type: "extension_lock",
      studentId: "s1",
      ts: "2026-10-28T10:02:00.000Z",
      teacherId: "t1",
      locked: true,
      synced: 1,
    });
    const replayed = await loadState(db, pack, "s1");
    expect(replayed.eventCount).toBe(2);
    expect(replayed.extensionLocked).toBe(true);
    await db.states.put({ ...replayed, extensionLocked: false });
    expect((await loadState(db, tinyPack("tiny-2"), "s1")).extensionLocked).toBe(true);
  });

  it("returns stored events without the synced flag", async () => {
    await appendEvent(db, pack, solve(true), ctx("10:00"));
    const events = await studentEvents(db, "s1");
    expect(events).toHaveLength(1);
    expect("synced" in (events[0] ?? {})).toBe(false);
  });
});
