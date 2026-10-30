import { teacherLoginResponseSchema } from "@setu/shared";
import { describe, expect, it } from "vitest";
import { goldenPack, goldenVectors } from "../../../packages/engine/test/golden/load";
import { buildApp } from "../src/app";
import { hashSecret } from "../src/auth";
import { MemoryStore } from "../src/memory-store";

const pack = goldenPack();
const launch = { chapterId: pack.chapterId, trimmed: [], launchedAt: "2026-10-27T00:00:00.000Z" };

async function setup() {
  const pw = await hashSecret("pw-staff-1");
  const store = new MemoryStore({
    teachers: [
      { id: "t1", schoolId: "sch", name: "Lakshmi", email: "t1@school.test", passwordHash: pw, role: "teacher" },
      { id: "k1", schoolId: "sch", name: "Coordinator", email: "k1@school.test", passwordHash: pw, role: "coordinator" },
    ],
    classrooms: [{ id: "c1", schoolId: "sch", classLevel: 8, section: "B", code: "C8B", launchedChapters: [launch] }],
    students: [{ id: "s1", classroomId: "c1", firstName: "Ravi", rollNo: "2", pinHash: pw, lang: "en" }],
    assignments: { t1: ["c1"] },
  });
  await store.insertEvents(goldenVectors[0]?.events.map((e) => ({ ...e, studentId: "s1" })) ?? [], {});
  const app = buildApp({}, { store, tokenSecret: "secret", now: () => new Date("2026-11-01T00:00:00.000Z"), loadPack: async () => pack });
  const auth = async (email: string) => {
    const res = await app.inject({ method: "POST", url: "/auth/teacher/login", payload: { email, password: "pw-staff-1" } });
    return { authorization: `Bearer ${teacherLoginResponseSchema.parse(res.json()).accessToken}` };
  };
  return { app, teacher: await auth("t1@school.test"), coordinator: await auth("k1@school.test") };
}

describe("coordinator access", () => {
  it("lists the school's classrooms and gets a summary with counts but no student names or ids", async () => {
    const { app, coordinator } = await setup();
    const list = await app.inject({ method: "GET", url: "/classrooms", headers: coordinator });
    expect((list.json() as { id: string }[]).map((c) => c.id)).toEqual(["c1"]);
    const res = await app.inject({ method: "GET", url: `/classrooms/c1/summary?chapterId=${pack.chapterId}`, headers: coordinator });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { students: number; concepts: unknown[]; groups: { students: number }[] };
    expect(body.students).toBe(1);
    expect(body.concepts.length).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toContain("Ravi");
    expect(JSON.stringify(body)).not.toContain("s1");
    await app.close();
  });

  it("is refused the Gap Map rows, evidence and teacher writes, which stay with the class teacher", async () => {
    const { app, teacher, coordinator } = await setup();
    for (const url of [
      `/classrooms/c1/gapmap?chapterId=${pack.chapterId}`,
      `/classrooms/c1/groups?chapterId=${pack.chapterId}`,
      `/classrooms/c1/students/s1/evidence?conceptId=A`,
    ]) {
      expect((await app.inject({ method: "GET", url, headers: coordinator })).statusCode).toBe(403);
    }
    const launchRes = await app.inject({ method: "POST", url: "/classrooms/c1/launch", headers: coordinator, payload: { chapterId: pack.chapterId, trimmed: [] } });
    expect(launchRes.statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: `/classrooms/c1/gapmap?chapterId=${pack.chapterId}`, headers: teacher })).statusCode).toBe(200);
    await app.close();
  });
});
