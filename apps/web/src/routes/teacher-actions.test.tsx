import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setApiClient } from "../data/api";
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
  db = new SetuDb(`setu-actions-${n}`);
  setApiClient(new LocalDemoApiClient(db, async () => pack));
  await db.meta.put({ key: "teacherToken", value: "demo:demo-teacher" });
});

afterEach(async () => {
  await teardown(db);
});

async function eventsOfType(type: string) {
  return (await db.events.toArray()).filter((e) => e.type === type);
}

/** Both demo students fail the Class 7 prerequisite with the same misconception. */
async function plantGap() {
  let minute = 0;
  for (const studentId of ["demo-anjali", "demo-ravi"]) {
    const at = () => new Date(Date.UTC(2026, 9, 28, 8, minute));
    minute += 1;
    await appendEvent(
      db,
      pack,
      {
        type: "attempt",
        studentId,
        questionId: "M7.SEQ.TRANSPOSE.Q01",
        conceptId: "M7.SEQ.TRANSPOSE",
        mode: "readiness",
        difficulty: 1,
        correct: false,
        selectedOptionId: "b",
        misconceptionCode: "E-TRANSPOSE-SIGN",
        hintsUsed: 0,
        timeMs: 8000,
        source: "device",
      },
      { now: at, sessionId: `s-${studentId}` },
    );
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
          misconceptions: { "E-TRANSPOSE-SIGN": 1 },
          completedAt: at().toISOString(),
        },
      },
      { now: () => new Date(at().getTime() + 1000), sessionId: `s-${studentId}` },
    );
  }
}

describe("teacher actions", () => {
  it("marks a gap group taught and says how many re-checks were scheduled", async () => {
    await plantGap();
    const user = userEvent.setup();
    renderTeacher("/t/classrooms/demo-8b/groups", { db });
    const [button] = await screen.findAllByRole("button", { name: "Mark taught" });
    if (!button) throw new Error("No group with a concept");
    await user.click(button);
    const toast = await screen.findByTestId("toast");
    const count = Number(/for (\d+) students/.exec(toast.textContent ?? "")?.[1]);
    expect(count).toBeGreaterThan(0);
    expect(await eventsOfType("mark_taught")).toHaveLength(count);
  });

  it("saves an override with a note, assigns a concept and locks extension for one student", async () => {
    const user = userEvent.setup();
    renderTeacher("/t/classrooms/demo-8b/students/demo-ravi", { db });
    await user.selectOptions(await screen.findByLabelText("Concept"), "M8.LEQ.ONE_SIDE");
    await user.click(screen.getByLabelText("Mastered (seen in class)"));
    await user.type(screen.getByLabelText("Note"), "Solved it on the board");
    await user.click(screen.getByRole("button", { name: "Save override" }));
    expect(await screen.findByTestId("toast")).toHaveTextContent(
      "Ravi will get a short check to confirm M8.LEQ.ONE_SIDE.",
    );
    expect(await eventsOfType("teacher_override")).toEqual([
      expect.objectContaining({
        studentId: "demo-ravi",
        teacherId: "demo-teacher",
        conceptId: "M8.LEQ.ONE_SIDE",
        mastered: true,
        note: "Solved it on the board",
      }),
    ]);

    await user.click(screen.getByRole("button", { name: "Assign" }));
    await waitFor(async () => expect(await eventsOfType("assign")).toHaveLength(1));
    expect(screen.getByTestId("toast")).toHaveTextContent("M8.LEQ.ONE_SIDE assigned to 1 students.");

    await user.click(screen.getByRole("button", { name: "Lock" }));
    expect(await screen.findByText("Extension problems locked for Ravi.")).toBeInTheDocument();
    expect(await eventsOfType("extension_lock")).toEqual([
      expect.objectContaining({ studentId: "demo-ravi", locked: true }),
    ]);
  });
});
