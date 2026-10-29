/**
 * Loads the seeded demo classroom that `pnpm content:pack` writes to `/demo/seed.json` (6.1):
 * the roster goes to `meta`, the events to the event store as synced. Loaded once per seed
 * version, so practice done in the demo is kept until a new seed is built.
 */
import type { StudentEvent } from "@setu/engine";
import { studentEventSchema } from "@setu/shared";
import type { SetuDb } from "./db";
import { DEMO_ROSTER_KEY } from "./demo-seed";
import type { DemoStudent } from "./demo-seed";

export const DEMO_SEED_URL = "/demo/seed.json";
const SEEDED_KEY = "demo:seeded";

export type FetchJson = (url: string) => Promise<unknown>;

const fetchJson: FetchJson = async (url) => {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseStudent(value: unknown, i: number): DemoStudent {
  if (
    isRecord(value) &&
    typeof value.studentId === "string" &&
    typeof value.firstName === "string" &&
    typeof value.rollNo === "string" &&
    (value.lang === "en" || value.lang === "te" || value.lang === "hi") &&
    typeof value.pin === "string" &&
    /^\d{4}$/.test(value.pin)
  ) {
    return {
      studentId: value.studentId,
      firstName: value.firstName,
      rollNo: value.rollNo,
      lang: value.lang,
      pin: value.pin,
    };
  }
  throw new Error(`demo seed: student ${i} is malformed`);
}

/** Validates the seed and stores it unless this version is already loaded. */
export async function loadDemoClassroom(
  db: SetuDb,
  load: FetchJson = fetchJson,
): Promise<{ students: number; events: number }> {
  const raw = await load(DEMO_SEED_URL);
  if (!isRecord(raw) || !Array.isArray(raw.students) || !Array.isArray(raw.events)) {
    throw new Error("demo seed: expected students and events");
  }
  const students = raw.students.map(parseStudent);
  const events: StudentEvent[] = raw.events.map((e: unknown, i) => {
    const parsed = studentEventSchema.safeParse(e);
    if (!parsed.success) throw new Error(`demo seed: event ${i} is invalid`);
    return parsed.data as StudentEvent;
  });
  const known = new Set(students.map((s) => s.studentId));
  const stranger = events.find((e) => !known.has(e.studentId));
  if (stranger) throw new Error(`demo seed: event for unknown student ${stranger.studentId}`);

  const version = `${String(raw.packVersion ?? "")}:${students.length}:${events.length}`;
  if ((await db.meta.get(SEEDED_KEY))?.value !== version) {
    await db.transaction("rw", db.events, db.states, db.meta, async () => {
      for (const s of students) {
        await db.events
          .where("[studentId+ts]")
          .between([s.studentId, ""], [s.studentId, "\uffff"])
          .delete();
      }
      await db.states.bulkDelete(students.map((s) => s.studentId));
      await db.events.bulkPut(events.map((e) => ({ ...e, synced: 1 as const })));
      await db.meta.put({ key: DEMO_ROSTER_KEY, value: students });
      await db.meta.put({ key: SEEDED_KEY, value: version });
    });
  }
  return { students: students.length, events: events.length };
}
