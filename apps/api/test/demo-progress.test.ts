import { describe, expect, it } from "vitest";
import type { StudentEvent } from "@setu/engine";
import { planDemoProgress, remapDemoEventsToRoster } from "../src/demo-progress";

const event: StudentEvent = {
  type: "readiness_completed",
  id: "00000000-0000-4000-8000-000000000001",
  studentId: "demo-anjali",
  ts: "2026-10-26T04:10:00.000Z",
  chapterId: "CH.M8.LINEAR_EQ_ONE_VAR",
  summary: {
    chapterId: "CH.M8.LINEAR_EQ_ONE_VAR",
    cleared: [],
    failed: [],
    uncertain: [],
    pending: [],
    itemsUsed: 0,
    advancedEntry: true,
    misconceptions: {},
    completedAt: "2026-10-26T04:10:00.000Z",
  },
};

describe("remapDemoEventsToRoster", () => {
  it("maps generated student ids to database ids by roll number", () => {
    const result = remapDemoEventsToRoster(
      [event],
      [{ studentId: "demo-anjali", rollNo: "1" }],
      [{ id: "db-student-1", rollNo: "1" }],
    );

    expect(result).toEqual([{ ...event, studentId: "db-student-1" }]);
  });

  it("excludes progress for the specified roster rolls", () => {
    expect(
      remapDemoEventsToRoster(
        [event],
        [{ studentId: "demo-anjali", rollNo: "1" }],
        [{ id: "db-student-1", rollNo: "1" }],
        ["1"],
      ),
    ).toEqual([]);
  });

  it("refuses to map demo activity when the matching roll is absent", () => {
    expect(() =>
      remapDemoEventsToRoster(
        [event],
        [{ studentId: "demo-anjali", rollNo: "1" }],
        [{ id: "db-student-2", rollNo: "2" }],
      ),
    ).toThrow("No database student found for demo roll 1");
  });

  it("returns only missing demo events so repeated runs do not duplicate activity", () => {
    const mappedEvent = { ...event, studentId: "db-student-1" };
    const second = { ...mappedEvent, id: "00000000-0000-4000-8000-000000000002" };
    expect(planDemoProgress([mappedEvent, second], [{ id: event.id, studentId: "db-student-1" }])).toEqual({
      pending: [second],
      skippedStudents: 0,
    });
  });

  it("preserves students with existing activity while seeding other students", () => {
    const studentOneEvent = { ...event, studentId: "db-student-1" };
    const anotherStudentEvent = { ...event, id: "00000000-0000-4000-8000-000000000002", studentId: "db-student-2" };
    expect(
      planDemoProgress([studentOneEvent, anotherStudentEvent], [{ id: "real-student-event", studentId: "db-student-1" }]),
    ).toEqual({ pending: [anotherStudentEvent], skippedStudents: 1 });
  });

  it("appends generated events to existing activity when explicitly allowed", () => {
    const mappedEvent = { ...event, studentId: "db-student-1" };
    expect(
      planDemoProgress([mappedEvent], [{ id: "real-student-event", studentId: "db-student-1" }], {
        allowExistingActivity: true,
      }),
    ).toEqual({ pending: [mappedEvent], skippedStudents: 0 });
  });

  it("rejects generated event ids that already belong to a different student", () => {
    expect(() => planDemoProgress([event], [{ id: event.id, studentId: "db-student-2" }])).toThrow(
      `Generated event ${event.id} already belongs to another student`,
    );
  });
});
