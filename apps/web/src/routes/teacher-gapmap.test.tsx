import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setApiClient } from "../data/api";
import { SetuDb } from "../data/db";
import { appendEvent } from "../data/event-store";
import { LocalDemoApiClient } from "../data/local-demo-api-client";
import { tinyPack } from "../test/fixtures";
import { teardown } from "../test/render-student";
import { renderTeacher } from "../test/render-teacher";

const pack = tinyPack();
let db: SetuDb;
let n = 0;

beforeEach(async () => {
  n += 1;
  db = new SetuDb(`setu-gapmap-${n}`);
  setApiClient(new LocalDemoApiClient(db, async () => pack));
  await db.meta.put({ key: "teacherToken", value: "demo:teacher" });
  await appendEvent(
    db,
    pack,
    {
      type: "attempt",
      studentId: "demo-anjali",
      questionId: "M7.SEQ.TRANSPOSE.Q01",
      conceptId: "M7.SEQ.TRANSPOSE",
      mode: "readiness",
      difficulty: 1,
      correct: false,
      selectedOptionId: "b",
      misconceptionCode: "E-TRANSPOSE-SIGN",
      hintsUsed: 0,
      timeMs: 9000,
      source: "device",
    },
    { now: () => new Date("2026-10-28T08:00:00.000Z"), sessionId: "s1" },
  );
});

afterEach(async () => {
  await teardown(db);
});

describe("gap map", () => {
  it("shows concept progress beside each pinned student name", async () => {
    renderTeacher("/t/classrooms/demo-8b/gapmap", { db });
    const table = await screen.findByTestId("gapmap");

    expect(within(table).getByRole("img", { name: "1 of 2 concepts with evidence" })).toBeInTheDocument();
  });

  it("puts prerequisite columns before chapter columns, greys untouched cells and opens evidence on tap", async () => {
    const user = userEvent.setup();
    renderTeacher("/t/classrooms/demo-8b/gapmap", { db });
    const table = await screen.findByTestId("gapmap");
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((h) => h.getAttribute("title"))
      .filter((t): t is string => t !== null);
    expect(headers.indexOf("M7.SEQ.TRANSPOSE")).toBeLessThan(headers.indexOf("M8.LEQ.ONE_SIDE"));
    expect(screen.getByTestId("cell-demo-ravi-M7.SEQ.TRANSPOSE")).toHaveClass("bg-slate-200");
    const touched = screen.getByTestId("cell-demo-anjali-M7.SEQ.TRANSPOSE");
    expect(touched).not.toHaveClass("bg-slate-200");
    await user.click(touched);
    const drawer = await screen.findByRole("dialog", { name: "Evidence" });
    const attempt = await within(drawer).findByTestId("evidence-attempt");
    expect(attempt).toHaveTextContent("Question 1");
    expect(attempt).toHaveTextContent("Answered: 7 (Wrong)");
    expect(attempt).toHaveTextContent("Keeps the sign when moving a term");
    await user.click(within(drawer).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders a window of a large class and scrolls to later students", async () => {
    const client = new LocalDemoApiClient(db, async () => pack);
    const getGapMap = client.getGapMap.bind(client);
    client.getGapMap = async (classroomId, chapterId) => {
      const gapMap = await getGapMap(classroomId, chapterId);
      const template = gapMap.rows[0];
      if (!template) throw new Error("The large-roster test needs a template row");
      return {
        ...gapMap,
        rows: Array.from({ length: 120 }, (_, index) => ({
          ...template,
          studentId: `student-${String(index).padStart(3, "0")}`,
          displayName: `Student ${index + 1}`,
          rollNo: String(index + 1),
        })),
      };
    };
    setApiClient(client);
    renderTeacher("/t/classrooms/demo-8b/gapmap", { db });

    const table = await screen.findByTestId("gapmap");
    const initialRows = within(table).getAllByTestId(/^gapmap-row-/);
    expect(table).toHaveAttribute("aria-rowcount", "122");
    expect(initialRows.length).toBeLessThan(30);
    expect(screen.queryByTestId("gapmap-row-student-119")).not.toBeInTheDocument();

    const scrollContainer = screen.getByTestId("gapmap-scroll");
    scrollContainer.scrollTop = 110 * 64;
    fireEvent.scroll(scrollContainer);

    const finalRow = await screen.findByTestId("gapmap-row-student-119");
    expect(finalRow).toHaveAttribute("aria-rowindex", "122");
    expect(screen.queryByTestId("gapmap-row-student-000")).not.toBeInTheDocument();
  });

  it("sends a signed-out device to the teacher login", async () => {
    await db.meta.delete("teacherToken");
    const router = renderTeacher("/t/classrooms/demo-8b/gapmap", { db });
    await screen.findByLabelText("Email");
    expect(router.state.location.pathname).toBe("/t/login");
  });
});
