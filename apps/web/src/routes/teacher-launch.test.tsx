import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { apiClient, setApiClient } from "../data/api";
import { SetuDb } from "../data/db";
import { LocalDemoApiClient } from "../data/local-demo-api-client";
import { TINY_CHAPTER, tinyPack } from "../test/fixtures";
import { teardown } from "../test/render-student";
import { renderTeacher } from "../test/render-teacher";

const pack = tinyPack();
let db: SetuDb;
let n = 0;

beforeEach(async () => {
  n += 1;
  db = new SetuDb(`setu-launch-${n}`);
  setApiClient(new LocalDemoApiClient(db, async () => pack));
  await db.meta.put({ key: "teacherToken", value: "demo:demo-teacher" });
});

afterEach(async () => {
  await teardown(db);
});

describe("launch chapter", () => {
  it("lists chapters by class, prints a difficulty-2 paper check and launches with a trimmed prerequisite", async () => {
    const user = userEvent.setup();
    renderTeacher("/t/classrooms/demo-8b/launch", { db });
    expect(await screen.findByText("Class 7")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: TINY_CHAPTER })).toBeChecked();
    const prereq = await screen.findByRole("checkbox", { name: /M7\.SEQ\.TRANSPOSE/ });
    expect(prereq).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Print paper check" }));
    const questions = await screen.findAllByTestId("paper-question");
    expect(questions).toHaveLength(1);
    expect(questions[0]).toHaveTextContent("Question 2");

    await user.click(prereq);
    await user.click(screen.getByRole("button", { name: "Launch" }));
    expect(await screen.findByTestId("toast")).toHaveTextContent("up to 12 questions");
    await waitFor(async () => {
      const classroom = (await apiClient().getClassrooms())[0];
      expect(classroom?.launchedChapters.at(-1)).toMatchObject({
        chapterId: TINY_CHAPTER,
        trimmed: ["M7.SEQ.TRANSPOSE"],
      });
    });
  });
});
