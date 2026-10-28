import type { ApiClient } from "@setu/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { tinyPack } from "../test/fixtures";
import { SetuDb } from "./db";
import { DEFAULT_LAUNCH, refreshLaunch, storedLaunch } from "./launch";
import { LocalDemoApiClient } from "./local-demo-api-client";
import { deviceSalt, hashPin } from "./pin";
import {
  activeProfile,
  checkPin,
  listProfiles,
  saveProfile,
  setActiveProfile,
  setProfileLang,
} from "./profiles";

let db: SetuDb;
let n = 0;

beforeEach(() => {
  n += 1;
  db = new SetuDb(`setu-profiles-${n}`);
});

afterEach(async () => {
  await db.delete();
});

const ravi = {
  studentId: "demo-ravi",
  firstName: "Ravi",
  rollNo: "2",
  classroomId: "demo-8b",
  lang: "te" as const,
};
const anjali = { ...ravi, studentId: "demo-anjali", firstName: "Anjali", rollNo: "1" };

describe("PIN hashing", () => {
  it("keeps one random salt per device", async () => {
    const salt = await deviceSalt(db);
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(await deviceSalt(db)).toBe(salt);
  });

  it("hashes the same PIN the same way with one salt and differently with another", async () => {
    const a = await hashPin("1234", "salt-a");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashPin("1234", "salt-a")).toBe(a);
    expect(await hashPin("1234", "salt-b")).not.toBe(a);
    expect(await hashPin("1235", "salt-a")).not.toBe(a);
  });
});

describe("profiles", () => {
  it("stores only the allowed fields and a PIN hash, never the PIN", async () => {
    const profile = await saveProfile(db, ravi, "2222");
    expect(Object.keys(profile).sort()).toEqual(
      ["classroomId", "firstName", "lang", "pinHash", "rollNo", "studentId"].sort(),
    );
    expect(profile.pinHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(await db.profiles.toArray())).not.toContain("2222");
  });

  it("accepts the right PIN only", async () => {
    await saveProfile(db, ravi, "2222");
    expect(await checkPin(db, "demo-ravi", "2222")).toBe(true);
    expect(await checkPin(db, "demo-ravi", "2223")).toBe(false);
    expect(await checkPin(db, "nobody", "2222")).toBe(false);
  });

  it("lists profiles by name, tracks the active one and remembers each student's language", async () => {
    await saveProfile(db, ravi, "2222");
    await saveProfile(db, anjali, "1111");
    expect((await listProfiles(db)).map((p) => p.firstName)).toEqual(["Anjali", "Ravi"]);
    expect(await activeProfile(db)).toBeUndefined();
    await setActiveProfile(db, "demo-ravi");
    expect((await activeProfile(db))?.firstName).toBe("Ravi");
    await setProfileLang(db, "demo-ravi", "en");
    expect((await db.profiles.get("demo-ravi"))?.lang).toBe("en");
    expect((await db.profiles.get("demo-anjali"))?.lang).toBe("te");
    await setActiveProfile(db, null);
    expect(await activeProfile(db)).toBeUndefined();
  });
});

describe("launched chapter", () => {
  it("stores the classroom's latest launch and keeps it when the client fails", async () => {
    expect(await storedLaunch(db, "demo-8b")).toEqual(DEFAULT_LAUNCH);
    const pack = tinyPack();
    const client = new LocalDemoApiClient(
      db,
      async () => pack,
      () => new Date("2026-10-28T10:00:00.000Z"),
    );
    const launch = await client.launchChapter("demo-8b", {
      chapterId: pack.chapterId,
      trimmed: ["M7.SEQ.TRANSPOSE"],
    });
    expect(await refreshLaunch(db, client, "demo-8b")).toEqual(launch);
    const offline = {
      getClassrooms: () => Promise.reject(new Error("offline")),
    } as unknown as ApiClient;
    expect(await refreshLaunch(db, offline, "demo-8b")).toEqual(launch);
  });
});
