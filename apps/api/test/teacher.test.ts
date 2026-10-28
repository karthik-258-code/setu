import { buildGapMap, replay } from "@setu/engine";
import { classroomsResponseSchema, errorResponseSchema, gapMapResponseSchema, teacherLoginResponseSchema } from "@setu/shared";
import { describe, expect, it } from "vitest";
import { goldenPack, goldenVectors } from "../../../packages/engine/test/golden/load";
import { buildApp } from "../src/app";
import { hashSecret } from "../src/auth";
import { MemoryStore } from "../src/memory-store";

const pack = goldenPack();
const NOW = new Date("2026-11-01T00:00:00.000Z");
function firstVector() {
  const v = goldenVectors[0];
  if (!v) throw new Error("no golden vector");
  return v;
}
const vector = firstVector();
const launch = { chapterId: pack.chapterId, trimmed: [], launchedAt: "2026-10-27T00:00:00.000Z" };

async function setup() {
  const pw = await hashSecret("pw-teacher");
  const store = new MemoryStore({
    teachers: [
      { id: "t1", schoolId: "sch", name: "Lakshmi", email: "t1@school.test", passwordHash: pw, role: "teacher" },
      { id: "t2", schoolId: "sch", name: "Rao", email: "t2@school.test", passwordHash: pw, role: "teacher" },
    ],
    classrooms: [
      { id: "c1", schoolId: "sch", classLevel: 8, section: "B", code: "C8B", launchedChapters: [launch] },
      { id: "c2", schoolId: "sch", classLevel: 9, section: "A", code: "C9A", launchedChapters: [] },
    ],
    students: [
      { id: vector.studentId, classroomId: "c1", firstName: "Ravi", rollNo: "2", pinHash: pw, lang: "te" },
      { id: "s9", classroomId: "c2", firstName: "Kiran", rollNo: "1", pinHash: pw, lang: "en" },
    ],
    assignments: { t1: ["c1"], t2: ["c2"] },
  });
  await store.insertEvents(vector.events, {});
  const app = buildApp({}, { store, tokenSecret: "secret", now: () => NOW, loadPack: async () => pack });
  const login = async (email: string) => {
    const res = await app.inject({ method: "POST", url: "/auth/teacher/login", payload: { email, password: "pw-teacher" } });
    return { authorization: `Bearer ${teacherLoginResponseSchema.parse(res.json()).accessToken}` };
  };
  return { app, store, t1: await login("t1@school.test"), t2: await login("t2@school.test") };
}

describe("teacher reads", () => {
  it("lists only assigned classrooms and builds the Gap Map with the engine", async () => {
    const { app, t1 } = await setup();
    const list = classroomsResponseSchema.parse((await app.inject({ method: "GET", url: "/classrooms", headers: t1 })).json());
    expect(list.map((c) => c.id)).toEqual(["c1"]);
    const res = await app.inject({ method: "GET", url: `/classrooms/c1/gapmap?chapterId=${pack.chapterId}`, headers: t1 });
    expect(res.statusCode).toBe(200);
    const expected = buildGapMap(pack, pack.chapterId, [
      { studentId: vector.studentId, displayName: "Ravi", rollNo: "2", state: replay(pack, vector.events, vector.studentId) },
    ]);
    expect(gapMapResponseSchema.parse(res.json())).toEqual(JSON.parse(JSON.stringify(expected)));
    for (const url of [
      `/classrooms/c1/groups?chapterId=${pack.chapterId}`,
      `/classrooms/c1/weekly?chapterId=${pack.chapterId}`,
      `/classrooms/c1/students/${vector.studentId}/evidence?conceptId=${Object.keys(pack.graph.concepts)[0] ?? ""}`,
    ]) {
      expect((await app.inject({ method: "GET", url, headers: t1 })).statusCode).toBe(200);
    }
    await app.close();
  });

  it("denies another teacher's classroom, unknown classrooms and missing queries", async () => {
    const { app, t2 } = await setup();
    const denied = await app.inject({ method: "GET", url: `/classrooms/c1/gapmap?chapterId=${pack.chapterId}`, headers: t2 });
    expect(denied.statusCode).toBe(403);
    expect(errorResponseSchema.parse(denied.json()).error.code).toBe("FORBIDDEN");
    expect((await app.inject({ method: "GET", url: `/classrooms/zz/gapmap?chapterId=${pack.chapterId}`, headers: t2 })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/classrooms/c2/gapmap", headers: t2 })).statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: "/classrooms" })).statusCode).toBe(401);
    await app.close();
  });
});

describe("teacher writes", () => {
  it("launches a chapter with trimmed prerequisites", async () => {
    const { app, store, t2 } = await setup();
    const res = await app.inject({
      method: "POST",
      url: "/classrooms/c2/launch",
      headers: t2,
      payload: { chapterId: pack.chapterId, trimmed: ["A", "A"] },
    });
    expect(res.statusCode).toBe(200);
    expect((await store.classroomById("c2"))?.launchedChapters).toEqual([
      { chapterId: pack.chapterId, trimmed: ["A"], launchedAt: NOW.toISOString() },
    ]);
    await app.close();
  });

  it("stores a teacher event for a student of the classroom and refuses the wrong student or teacher", async () => {
    const { app, store, t1 } = await setup();
    const base = { type: "mark_taught", ts: "2026-10-31T09:00:00.000Z", conceptId: Object.keys(pack.graph.concepts)[0] };
    const ok = await app.inject({
      method: "POST",
      url: "/classrooms/c1/events",
      headers: t1,
      payload: { ...base, id: "1f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b", studentId: vector.studentId, teacherId: "t1" },
    });
    expect(ok.statusCode).toBe(200);
    expect(store.events.get("1f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b")?.origin).toEqual({ teacherId: "t1" });
    expect(store.materialised.has(vector.studentId)).toBe(true);
    const otherStudent = await app.inject({
      method: "POST",
      url: "/classrooms/c1/events",
      headers: t1,
      payload: { ...base, id: "2f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b", studentId: "s9", teacherId: "t1" },
    });
    expect(otherStudent.statusCode).toBe(403);
    const otherTeacher = await app.inject({
      method: "POST",
      url: "/classrooms/c1/events",
      headers: t1,
      payload: { ...base, id: "3f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b", studentId: vector.studentId, teacherId: "t2" },
    });
    expect(otherTeacher.statusCode).toBe(403);
    await app.close();
  });
});
