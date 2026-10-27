import { describe, expect, it } from "vitest";
import { studentEventSchema, teacherEventSchema } from "../src/index";
import { eventFixtures } from "./fixtures";

const studentTypes = Object.keys(eventFixtures) as (keyof typeof eventFixtures)[];
const teacherTypes = [
  "teacher_override",
  "mark_taught",
  "assign",
  "extension_lock",
  "group_edit",
  "attempt",
] as const;

describe("studentEventSchema", () => {
  it.each(studentTypes)("round-trips a %s event unchanged", (type) => {
    const fixture = eventFixtures[type];
    const parsed = studentEventSchema.parse(JSON.parse(JSON.stringify(fixture)));
    expect(parsed).toEqual(fixture);
  });

  it("rejects an unknown event type", () => {
    const result = studentEventSchema.safeParse({ ...eventFixtures.attempt, type: "teleport" });
    expect(result.success).toBe(false);
  });

  it("rejects an event with an unknown field", () => {
    const result = studentEventSchema.safeParse({ ...eventFixtures.attempt, pinHash: "x" });
    expect(result.success).toBe(false);
  });

  it("rejects an attempt without a boolean correct flag", () => {
    const result = studentEventSchema.safeParse({ ...eventFixtures.attempt, correct: "yes" });
    expect(result.success).toBe(false);
  });

  it("rejects an event with a malformed timestamp", () => {
    const result = studentEventSchema.safeParse({ ...eventFixtures.attempt, ts: "yesterday" });
    expect(result.success).toBe(false);
  });
});

describe("teacherEventSchema", () => {
  it.each(teacherTypes)("round-trips a %s event unchanged", (type) => {
    const fixture = eventFixtures[type];
    expect(teacherEventSchema.parse(JSON.parse(JSON.stringify(fixture)))).toEqual(fixture);
  });

  it.each(["learn_viewed", "readiness_completed"] as const)(
    "rejects the student-only %s event",
    (type) => {
      expect(teacherEventSchema.safeParse(eventFixtures[type]).success).toBe(false);
    },
  );

  it("rejects an unknown event type", () => {
    expect(teacherEventSchema.safeParse({ ...eventFixtures.assign, type: "expel" }).success).toBe(
      false,
    );
  });
});
