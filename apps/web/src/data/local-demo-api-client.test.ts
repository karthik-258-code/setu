import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TINY_CHAPTER, tinyPack } from "../test/fixtures";
import { SetuDb } from "./db";
import { appendEvent } from "./event-store";
import type { NewEvent } from "./event-store";
import { DemoApiError, LocalDemoApiClient } from "./local-demo-api-client";

const pack = tinyPack();
const NOW = "2026-10-28T10:00:00.000Z";
let db: SetuDb;
let client: LocalDemoApiClient;
let n = 0;

beforeEach(() => {
  n += 1;
  db = new SetuDb(`setu-demo-${n}`);
  client = new LocalDemoApiClient(db, async () => pack, () => new Date(NOW));
});

afterEach(async () => {
  await db.delete();
});

const ravi = { classroomCode: "DEMO8B", rollNo: "2", pin: "2222" };
const ctx = { now: () => new Date("2026-10-28T09:30:00.000Z"), sessionId: "sitting-1" };

function raviSolves(correct: boolean): NewEvent {
  return {
    type: "attempt",
    studentId: "demo-ravi",
    questionId: "M8.LEQ.ONE_SIDE.Q01",
    conceptId: "M8.LEQ.ONE_SIDE",
    mode: "solve",
    difficulty: 1,
    correct,
    hintsUsed: 0,
    timeMs: 4000,
  };
}

describe("LocalDemoApiClient", () => {
  it("logs in a demo student by classroom code, roll number and PIN, and rejects a wrong PIN", async () => {
    const response = await client.studentLogin(ravi);
    expect(response.student).toEqual({
      studentId: "demo-ravi",
      firstName: "Ravi",
      rollNo: "2",
      classroomId: "demo-8b",
      lang: "te",
    });
    await expect(client.studentLogin({ ...ravi, pin: "0000" })).rejects.toThrow(DemoApiError);
    await expect(
      client.login({ email: "teacher@demo.setu.app", password: "nope" }),
    ).rejects.toThrow(DemoApiError);
  });

  it("needs a student login for getMyState, then returns the replayed state", async () => {
    await expect(client.getMyState()).rejects.toThrow(DemoApiError);
    await client.studentLogin(ravi);
    await appendEvent(db, pack, raviSolves(true), ctx);
    expect((await client.getMyState()).eventCount).toBe(1);
  });

  it("accepts valid events of demo students on sync, marks them synced and rejects the rest", async () => {
    const { event } = await appendEvent(db, pack, raviSolves(true), ctx);
    const response = await client.sync([
      event,
      { ...event, id: "stranger-1", studentId: "stranger" },
    ]);
    expect(response.accepted).toEqual([event.id]);
    expect(response.rejected).toEqual([{ id: "stranger-1", reason: "unknown student stranger" }]);
    expect(response.serverTime).toBe(NOW);
    expect((await db.events.get(event.id))?.synced).toBe(1);
  });

  it("launches a chapter for the demo classroom and lists it", async () => {
    const launch = await client.launchChapter("demo-8b", {
      chapterId: TINY_CHAPTER,
      trimmed: ["M7.SEQ.TRANSPOSE"],
    });
    expect(launch).toEqual({
      chapterId: TINY_CHAPTER,
      trimmed: ["M7.SEQ.TRANSPOSE"],
      launchedAt: NOW,
    });
    expect((await client.getClassrooms())[0]?.launchedChapters).toEqual([launch]);
    await expect(
      client.launchChapter("nope", { chapterId: TINY_CHAPTER, trimmed: [] }),
    ).rejects.toThrow(DemoApiError);
  });

  it("records a teacher event and serves a student's attempts on a concept as evidence", async () => {
    await client.postTeacherEvent("demo-8b", {
      id: "taught-1",
      type: "mark_taught",
      studentId: "demo-ravi",
      ts: "2026-10-28T09:00:00.000Z",
      teacherId: "demo-teacher",
      conceptId: "M8.LEQ.ONE_SIDE",
    });
    expect((await db.events.get("taught-1"))?.synced).toBe(1);
    await appendEvent(db, pack, raviSolves(false), ctx);
    const evidence = await client.getEvidence("demo-8b", "demo-ravi", "M8.LEQ.ONE_SIDE");
    expect(evidence.map((e) => [e.type, e.correct])).toEqual([["attempt", false]]);
    await expect(
      client.getEvidence("demo-8b", "stranger", "M8.LEQ.ONE_SIDE"),
    ).rejects.toThrow(DemoApiError);
  });

  it("builds the Gap Map, groups and weekly view of the demo classroom with the engine", async () => {
    const map = await client.getGapMap("demo-8b", TINY_CHAPTER);
    expect(map.rows.map((r) => r.displayName)).toEqual(["Anjali", "Ravi"]);
    expect(map.rows.every((r) => !r.readinessDone)).toBe(true);
    const groups = await client.getGroups("demo-8b", TINY_CHAPTER);
    expect(groups.map((g) => g.id)).toEqual(["not_attempted"]);
    const weekly = await client.getWeekly("demo-8b", TINY_CHAPTER);
    expect(weekly.from).toBe("2026-10-21T10:00:00.000Z");
    expect(weekly.to).toBe(NOW);
    expect(weekly.moved).toEqual([]);
  });
});
