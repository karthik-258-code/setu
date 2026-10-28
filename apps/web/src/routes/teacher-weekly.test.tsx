import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { apiClient, setApiClient } from "../data/api";
import { SetuDb } from "../data/db";
import { appendEvent } from "../data/event-store";
import { LocalDemoApiClient } from "../data/local-demo-api-client";
import { TINY_CHAPTER, tinyPack } from "../test/fixtures";
import { teardown } from "../test/render-student";
import { renderTeacher } from "../test/render-teacher";

const pack = tinyPack();
let db: SetuDb;
let n = 0;

beforeEach(async () => {
  n += 1;
  db = new SetuDb(`setu-weekly-${n}`);
  setApiClient(new LocalDemoApiClient(db, async () => pack, () => new Date("2026-10-29T12:00:00.000Z")));
  await db.meta.put({ key: "teacherToken", value: "demo:demo-teacher" });
  for (const [i, studentId] of ["demo-anjali", "demo-ravi"].entries()) {
    const ctx = { now: () => new Date(Date.UTC(2026, 9, 28, 8, i)), sessionId: `s-${studentId}` };
    await appendEvent(
      db,
      pack,
      {
        type: "readiness_completed",
        studentId,
        chapterId: TINY_CHAPTER,
        summary: {
          chapterId: TINY_CHAPTER,
          cleared: [],
          failed: ["M7.SEQ.TRANSPOSE"],
          uncertain: [],
          pending: [],
          itemsUsed: 1,
          advancedEntry: false,
          misconceptions: {},
          completedAt: "2026-10-28T08:00:00.000Z",
        },
      },
      ctx,
    );
  }
});

afterEach(async () => {
  await teardown(db);
});

describe("weekly view", () => {
  it("shows the engine's week: group moves, blocking concepts and re-check results", async () => {
    renderTeacher("/t/classrooms/demo-8b/weekly", { db });
    expect(await screen.findByRole("heading", { name: "Moved between groups" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Concepts blocking the most students" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Re-checks after mark taught" })).toBeInTheDocument();

    const weekly = await apiClient().getWeekly("demo-8b", TINY_CHAPTER);
    expect(screen.queryAllByTestId("weekly-blocking")).toHaveLength(weekly.blockingConcepts.length);
    for (const b of weekly.blockingConcepts) {
      expect(screen.getByText(b.conceptId)).toBeInTheDocument();
    }
    expect(screen.queryAllByTestId("weekly-recheck")).toHaveLength(weekly.recheckResults.length);
  });
});
