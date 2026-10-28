import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SetuDb } from "../data/db";
import { saveProfile, setActiveProfile } from "../data/profiles";
import { TINY_CHAPTER, tinyPack } from "../test/fixtures";
import { renderStudent, teardown } from "../test/render-student";

const pack = tinyPack();
let db: SetuDb;
let n = 0;

const anjali = {
  studentId: "demo-anjali",
  firstName: "Anjali",
  rollNo: "1",
  classroomId: "demo-8b",
  lang: "en" as const,
};

beforeEach(async () => {
  n += 1;
  db = new SetuDb(`setu-readiness-${n}`);
  await saveProfile(db, anjali, "1111");
  await setActiveProfile(db, anjali.studentId);
});

afterEach(async () => {
  await teardown(db);
});

/** Answers with option `first` once, then with "4" (correct) until the summary shows. */
async function runCheck(first: string) {
  const user = userEvent.setup();
  let choice = first;
  for (let i = 0; i < 12; i++) {
    if (screen.queryByTestId("readiness-summary")) return;
    const before = (await screen.findByTestId("readiness-progress")).textContent;
    await user.click(await screen.findByRole("button", { name: choice }));
    choice = "4";
    await waitFor(() =>
      expect(
        screen.queryByTestId("readiness-summary") !== null ||
          screen.queryByTestId("readiness-progress")?.textContent !== before,
      ).toBe(true),
    );
  }
}

describe("readiness screen", () => {
  it("shows progress as question n of up to 12 and ends with a two-line summary", async () => {
    renderStudent(`/s/readiness/${TINY_CHAPTER}`, { db, pack });
    expect(await screen.findByTestId("readiness-progress")).toHaveTextContent(
      "Question 1 of up to 12",
    );
    await runCheck("4");
    const lines = await screen.findAllByTestId("readiness-line");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveTextContent("You showed 1 of the 1 skills we checked.");
    const events = await db.events.toArray();
    expect(events.filter((e) => e.type === "readiness_completed")).toHaveLength(1);
  });

  it("writes readiness attempts with the misconception of a wrong option", async () => {
    renderStudent(`/s/readiness/${TINY_CHAPTER}`, { db, pack });
    await runCheck("7");
    await screen.findByTestId("readiness-summary");
    const attempts = (await db.events.toArray()).filter((e) => e.type === "attempt");
    expect(attempts[0]).toMatchObject({
      mode: "readiness",
      correct: false,
      selectedOptionId: "b",
      misconceptionCode: "E-TRANSPOSE-SIGN",
      hintsUsed: 0,
    });
    expect(screen.getAllByTestId("readiness-line")[0]).toHaveTextContent("You showed 0 of the 1");
  });

  it("sends a student who already finished the check back home", async () => {
    const router = renderStudent(`/s/readiness/${TINY_CHAPTER}`, { db, pack });
    await runCheck("4");
    await screen.findByTestId("readiness-summary");
    await router.navigate("/s/home");
    await router.navigate(`/s/readiness/${TINY_CHAPTER}`);
    await waitFor(() => expect(router.state.location.pathname).toBe("/s/home"));
  });
});
