import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setApiClient } from "../data/api";
import { SetuDb } from "../data/db";
import { LocalDemoApiClient } from "../data/local-demo-api-client";
import { tinyPack } from "../test/fixtures";
import { teardown } from "../test/render-student";
import { renderTeacher } from "../test/render-teacher";

const pack = tinyPack();
let db: SetuDb;
let n = 0;

beforeEach(async () => {
  n += 1;
  db = new SetuDb(`setu-paper-${n}`);
  setApiClient(new LocalDemoApiClient(db, async () => pack));
  await db.meta.put({ key: "teacherToken", value: "demo:demo-teacher" });
});

afterEach(async () => {
  await teardown(db);
});

async function attempts() {
  return (await db.events.toArray()).filter((e) => e.type === "attempt");
}

describe("paper entry", () => {
  it("cycles a box through right, each wrong option and blank, and saves paper attempts", async () => {
    const user = userEvent.setup();
    renderTeacher("/t/classrooms/demo-8b/paper-entry", { db });
    await user.click(await screen.findByRole("button", { name: "Anjali, 1: blank" }));
    expect(screen.getByRole("button", { name: "Anjali, 1: right" })).toBeInTheDocument();

    const ravi = screen.getByRole("button", { name: "Ravi, 1: blank" });
    await user.click(ravi);
    await user.click(ravi);
    expect(screen.getByRole("button", { name: "Ravi, 1: wrong b" })).toBeInTheDocument();
    await user.click(ravi);
    expect(screen.getByRole("button", { name: "Ravi, 1: blank" })).toBeInTheDocument();
    await user.click(ravi);
    await user.click(ravi);

    await user.click(screen.getByRole("button", { name: "Save paper results" }));
    expect(await screen.findByTestId("toast")).toHaveTextContent("2 answers saved for 2 students.");
    await waitFor(async () => expect(await attempts()).toHaveLength(2));
    expect(await attempts()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          studentId: "demo-anjali",
          correct: true,
          selectedOptionId: "a",
          source: "paper",
          mode: "readiness",
        }),
        expect.objectContaining({
          studentId: "demo-ravi",
          correct: false,
          selectedOptionId: "b",
          misconceptionCode: "E-TRANSPOSE-SIGN",
          source: "paper",
        }),
      ]),
    );
    expect(screen.getByRole("button", { name: "Anjali, 1: blank" })).toBeInTheDocument();
  });
});
