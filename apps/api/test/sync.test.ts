import { replay } from "@setu/engine";
import type { StudentEvent } from "@setu/engine";
import {
  errorResponseSchema,
  studentLoginResponseSchema,
  syncResponseSchema,
  teacherLoginResponseSchema,
} from "@setu/shared";
import { describe, expect, it } from "vitest";
import { goldenPack, goldenVectors } from "../../../packages/engine/test/golden/load";
import { buildApp } from "../src/app";
import { hashSecret, verifyToken } from "../src/auth";
import { MemoryStore } from "../src/memory-store";

const SECRET = "test-secret";
const NOW = new Date("2026-11-01T00:00:00.000Z");
const pack = goldenPack();
const DEVICE_TYPES = new Set(["attempt", "learn_viewed", "readiness_completed"]);

async function setup(studentId = "s1") {
  const store = new MemoryStore({
    teachers: [
      {
        id: "t1",
        schoolId: "sch",
        name: "Lakshmi",
        email: "lakshmi@school.test",
        passwordHash: await hashSecret("pw-lakshmi"),
        role: "teacher",
      },
    ],
    classrooms: [
      {
        id: "c1",
        schoolId: "sch",
        classLevel: 8,
        section: "B",
        code: "GOLD8B",
        launchedChapters: [{ chapterId: pack.chapterId, trimmed: [], launchedAt: "2026-10-27T00:00:00.000Z" }],
      },
    ],
    students: [
      { id: studentId, classroomId: "c1", firstName: "Ravi", rollNo: "2", pinHash: await hashSecret("2222"), lang: "te" },
      { id: "other", classroomId: "c1", firstName: "Anjali", rollNo: "1", pinHash: await hashSecret("1111"), lang: "te" },
    ],
    assignments: { t1: ["c1"] },
  });
  const app = buildApp(
    {},
    {
      store,
      tokenSecret: SECRET,
      now: () => NOW,
      loadPack: async (chapterId) => {
        if (chapterId !== pack.chapterId) throw new Error(`no pack ${chapterId}`);
        return pack;
      },
    },
  );
  const login = await app.inject({
    method: "POST",
    url: "/auth/student/login",
    payload: { classroomCode: "gold8b", rollNo: "2", pin: "2222" },
  });
  const { accessToken } = studentLoginResponseSchema.parse(login.json());
  return { app, store, auth: { authorization: `Bearer ${accessToken}` } };
}

async function teacherTokens(app: Awaited<ReturnType<typeof setup>>["app"], password = "pw-lakshmi") {
  return app.inject({
    method: "POST",
    url: "/auth/teacher/login",
    payload: { email: "lakshmi@school.test", password },
  });
}

describe("auth", () => {
  it("logs a teacher in, refreshes, and refuses a wrong password or an access token as refresh", async () => {
    const { app } = await setup();
    const tokens = teacherLoginResponseSchema.parse((await teacherTokens(app)).json());
    expect(verifyToken(tokens.accessToken, SECRET, NOW.getTime() / 1000)).toMatchObject({ sub: "t1", role: "teacher" });
    const refreshed = await app.inject({ method: "POST", url: "/auth/refresh", payload: { refreshToken: tokens.refreshToken } });
    expect(refreshed.statusCode).toBe(200);
    const asRefresh = await app.inject({ method: "POST", url: "/auth/refresh", payload: { refreshToken: tokens.accessToken } });
    expect(asRefresh.statusCode).toBe(401);
    const bad = await teacherTokens(app, "nope-nope");
    expect(bad.statusCode).toBe(401);
    expect(errorResponseSchema.parse(bad.json()).error.code).toBe("INVALID_CREDENTIALS");
    await app.close();
  });

  it("refuses sync without a token or with a teacher token, and a wrong PIN", async () => {
    const { app } = await setup();
    const none = await app.inject({ method: "POST", url: "/sync", payload: { deviceId: "d", events: [] } });
    expect(none.statusCode).toBe(401);
    const t = teacherLoginResponseSchema.parse((await teacherTokens(app)).json());
    const asTeacher = await app.inject({
      method: "POST",
      url: "/sync",
      headers: { authorization: `Bearer ${t.accessToken}` },
      payload: { deviceId: "d", events: [] },
    });
    expect(asTeacher.statusCode).toBe(403);
    const wrongPin = await app.inject({
      method: "POST",
      url: "/auth/student/login",
      payload: { classroomCode: "GOLD8B", rollNo: "2", pin: "9999" },
    });
    expect(wrongPin.statusCode).toBe(401);
    await app.close();
  });
});

describe("packs", () => {
  it("serves a pack with an ETag, 304 when unchanged, 404 for an unknown chapter", async () => {
    const { app } = await setup();
    const first = await app.inject({ method: "GET", url: `/packs/${pack.chapterId}` });
    expect(first.statusCode).toBe(200);
    const etag = String(first.headers.etag);
    expect(etag).toBe(`"${pack.packVersion}"`);
    const again = await app.inject({ method: "GET", url: `/packs/${pack.chapterId}`, headers: { "if-none-match": etag } });
    expect(again.statusCode).toBe(304);
    expect((await app.inject({ method: "GET", url: "/packs/CH.NOPE" })).statusCode).toBe(404);
    await app.close();
  });
});

describe("sync", () => {
  it.each(goldenVectors)("golden vector $name replayed through the API gives the engine's state", async (vector) => {
    const { app, store, auth } = await setup(vector.studentId);
    // Teacher events reach the server through teacher routes; store them as those routes would.
    await store.insertEvents(vector.events.filter((e) => !DEVICE_TYPES.has(e.type)), { teacherId: "t1" });
    const deviceEvents = vector.events.filter((e) => DEVICE_TYPES.has(e.type));
    const half = Math.ceil(deviceEvents.length / 2);
    const batches: StudentEvent[][] = [[...deviceEvents.slice(half)].reverse(), deviceEvents.slice(0, half), deviceEvents];
    for (const events of batches) {
      const res = await app.inject({ method: "POST", url: "/sync", headers: auth, payload: { deviceId: "phone-1", events } });
      expect(res.statusCode).toBe(200);
      const body = syncResponseSchema.parse(res.json());
      expect(body.accepted).toHaveLength(events.length);
      expect(body.rejected).toEqual([]);
    }
    expect(store.events.size).toBe(vector.events.length);
    const expected = replay(pack, vector.events, vector.studentId);
    expect(expected.eventCount).toBe(vector.expected.eventCount);
    const state = await app.inject({ method: "GET", url: "/me/state", headers: auth });
    expect(state.statusCode).toBe(200);
    expect(state.json()).toEqual(JSON.parse(JSON.stringify(expected)));
    expect(store.materialised.get(vector.studentId)).toEqual(expected);
    await app.close();
  });

  it("rejects invalid events, other students' events and teacher events, keeping the rest", async () => {
    const { app, auth } = await setup("s1");
    const good = goldenVectors[0]?.events.find((e) => e.type === "attempt");
    if (!good) throw new Error("golden vector without an attempt");
    const mine = { ...good, studentId: "s1" };
    const events = [
      mine,
      { ...good, id: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b", studentId: "other" },
      { id: "x", type: "attempt" },
      {
        type: "extension_lock",
        id: "7f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
        studentId: "s1",
        ts: good.ts,
        teacherId: "t1",
        locked: true,
      },
    ];
    const res = await app.inject({ method: "POST", url: "/sync", headers: auth, payload: { deviceId: "phone-1", events } });
    const body = syncResponseSchema.parse(res.json());
    expect(body.accepted).toEqual([mine.id]);
    expect(body.rejected.map((r) => r.reason)).toEqual([
      "event belongs to another student",
      expect.stringMatching(/^invalid event/),
      "extension_lock events come from a teacher, not a device",
    ]);
    await app.close();
  });
});
