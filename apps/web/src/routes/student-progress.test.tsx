import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SetuDb } from "../data/db";
import { appendEvent } from "../data/event-store";
import { saveProfile, setActiveProfile } from "../data/profiles";
import { tinyPack } from "../test/fixtures";
import { renderStudent, teardown } from "../test/render-student";

const pack = tinyPack();
let db: SetuDb;
let n = 0;

beforeEach(async () => {
  n += 1;
  db = new SetuDb(`setu-progress-${n}`);
  await saveProfile(
    db,
    { studentId: "demo-ravi", firstName: "Ravi", rollNo: "2", classroomId: "demo-8b", lang: "en" },
    "2222",
  );
  await setActiveProfile(db, "demo-ravi");
});

afterEach(async () => {
  await teardown(db);
});

describe("progress screen", () => {
  it("groups concepts by class with mastery bars, untouched concepts and the next re-check", async () => {
    const ctx = { now: () => new Date("2026-10-28T08:00:00.000Z"), sessionId: "s1" };
    await appendEvent(
      db,
      pack,
      {
        type: "attempt",
        studentId: "demo-ravi",
        questionId: "M7.SEQ.TRANSPOSE.Q02",
        conceptId: "M7.SEQ.TRANSPOSE",
        mode: "solve",
        difficulty: 2,
        correct: true,
        selectedOptionId: "a",
        hintsUsed: 0,
        timeMs: 9000,
        source: "device",
      },
      ctx,
    );
    await appendEvent(
      db,
      pack,
      { type: "mark_taught", studentId: "demo-ravi", teacherId: "t1", conceptId: "M7.SEQ.TRANSPOSE" },
      { ...ctx, now: () => new Date("2026-10-28T08:05:00.000Z") },
    );
    renderStudent("/s/progress", { db, pack });
    expect(await screen.findByText("Class 7")).toBeInTheDocument();
    expect(screen.getByText("Class 8")).toBeInTheDocument();
    const practised = screen.getByRole("progressbar", { name: "M7.SEQ.TRANSPOSE" });
    expect(Number(practised.getAttribute("aria-valuenow"))).toBeGreaterThan(0);
    expect(screen.getByRole("progressbar", { name: "M8.LEQ.ONE_SIDE" })).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("Not started")).toBeInTheDocument();
    expect(screen.getByText(/^Next check /)).toBeInTheDocument();
  });
});
