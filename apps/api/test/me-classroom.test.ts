import { classroomSummarySchema, studentLoginResponseSchema } from "@setu/shared";
import { describe, expect, it } from "vitest";
import { goldenPack } from "../../../packages/engine/test/golden/load";
import { buildApp } from "../src/app";
import { hashSecret } from "../src/auth";
import { MemoryStore } from "../src/memory-store";

const pack = goldenPack();
const launch = { chapterId: pack.chapterId, trimmed: [], launchedAt: "2026-10-27T00:00:00.000Z" };

describe("GET /me/classroom", () => {
  it("returns the signed-in student's classroom with its launches, and needs a student token", async () => {
    const store = new MemoryStore({
      classrooms: [{ id: "c1", schoolId: "sch", classLevel: 8, section: "B", code: "C8B", launchedChapters: [launch] }],
      students: [{ id: "s1", classroomId: "c1", firstName: "Ravi", rollNo: "2", pinHash: await hashSecret("2222"), lang: "en" }],
    });
    const app = buildApp({}, { store, tokenSecret: "secret", now: () => new Date("2026-11-01T00:00:00.000Z"), loadPack: async () => pack });
    const login = await app.inject({ method: "POST", url: "/auth/student/login", payload: { classroomCode: "C8B", rollNo: "2", pin: "2222" } });
    const { accessToken } = studentLoginResponseSchema.parse(login.json());
    const res = await app.inject({ method: "GET", url: "/me/classroom", headers: { authorization: `Bearer ${accessToken}` } });
    expect(res.statusCode).toBe(200);
    expect(classroomSummarySchema.parse(res.json()).launchedChapters).toEqual([launch]);
    expect((await app.inject({ method: "GET", url: "/me/classroom" })).statusCode).toBe(401);
    await app.close();
  });
});
