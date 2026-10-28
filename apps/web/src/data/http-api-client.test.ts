import type { StudentEvent } from "@setu/engine";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SetuDb } from "./db";
import { ApiRequestError, HttpApiClient } from "./http-api-client";

let db: SetuDb;
let n = 0;
const calls: { url: string; init: RequestInit }[] = [];
let responses: Response[] = [];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const fake = async (url: string, init: RequestInit) => {
  calls.push({ url, init });
  const next = responses.shift();
  if (!next) throw new Error(`unexpected request ${url}`);
  return next;
};
const header = (i: number, name: string) => (calls[i]?.init.headers as Record<string, string>)[name];

beforeEach(() => {
  n += 1;
  db = new SetuDb(`setu-http-${n}`);
  calls.length = 0;
  responses = [];
});

afterEach(async () => {
  await db.delete();
});

const student = { studentId: "s1", firstName: "Ravi", rollNo: "2", classroomId: "c1", lang: "te" };

describe("HttpApiClient", () => {
  it("stores the student's token at login and syncs that student's events with it", async () => {
    const client = new HttpApiClient("http://api.test/", db, fake);
    responses.push(json({ accessToken: "tok-s1", student }));
    await client.studentLogin({ classroomCode: "C8B", rollNo: "2", pin: "2222" });
    const event = { id: "e1", studentId: "s1" } as unknown as StudentEvent;
    responses.push(json({ accepted: ["e1"], rejected: [], serverTime: "2026-10-28T10:00:00.000Z" }));
    expect(await client.sync([event])).toMatchObject({ accepted: ["e1"] });
    expect(calls[1]?.url).toBe("http://api.test/sync");
    expect(header(1, "authorization")).toBe("Bearer tok-s1");
    const body = JSON.parse(String(calls[1]?.init.body)) as { deviceId: string; events: unknown[] };
    expect(body.deviceId).toMatch(/[0-9a-f-]{36}/);
    expect(body.events).toHaveLength(1);
  });

  it("refreshes an expired teacher token once and repeats the request", async () => {
    const client = new HttpApiClient("http://api.test", db, fake);
    responses.push(json({ accessToken: "a1", refreshToken: "r1" }));
    await client.login({ email: "t@school.test", password: "pw-teacher" });
    responses.push(json({ error: { code: "UNAUTHORIZED", message: "expired" } }, 401));
    responses.push(json({ accessToken: "a2", refreshToken: "r2" }));
    responses.push(json([]));
    expect(await client.getClassrooms()).toEqual([]);
    expect(header(1, "authorization")).toBe("Bearer a1");
    expect(calls[2]?.url).toBe("http://api.test/auth/refresh");
    expect(header(3, "authorization")).toBe("Bearer a2");
  });

  it("turns API errors into ApiRequestError with the server's code", async () => {
    const client = new HttpApiClient("http://api.test", db, fake);
    responses.push(json({ error: { code: "INVALID_CREDENTIALS", message: "Wrong credentials" } }, 401));
    const failure = client.studentLogin({ classroomCode: "C8B", rollNo: "2", pin: "9999" });
    await expect(failure).rejects.toBeInstanceOf(ApiRequestError);
    await expect(client.sync([{ id: "e", studentId: "nobody" } as unknown as StudentEvent])).rejects.toMatchObject({ status: 401 });
  });
});
