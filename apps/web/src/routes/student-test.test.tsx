import type { ContentPack, ReadinessSummary } from "@setu/engine";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SetuDb } from "../data/db";
import { appendEvent } from "../data/event-store";
import { saveProfile, setActiveProfile } from "../data/profiles";
import { TINY_CHAPTER, tinyPack } from "../test/fixtures";
import { renderStudent, teardown } from "../test/render-student";

let db: SetuDb;
let n = 0;
const now = () => new Date("2026-10-28T09:00:00.000Z");

/** The tiny pack with four variants of every question, so practice never runs out. */
const base = tinyPack();
const pack: ContentPack = {
  ...base,
  questions: base.questions.flatMap((q) =>
    [1, 2, 3, 4].map((k) => ({ ...q, id: `${q.id}.V${k}` })),
  ),
};

const summary: ReadinessSummary = {
  chapterId: TINY_CHAPTER,
  cleared: ["M7.SEQ.TRANSPOSE"],
  failed: [],
  uncertain: [],
  pending: [],
  itemsUsed: 2,
  advancedEntry: false,
  misconceptions: {},
  completedAt: "2026-10-28T08:00:00.000Z",
};

beforeEach(async () => {
  n += 1;
  db = new SetuDb(`setu-test-${n}`);
  await saveProfile(
    db,
    { studentId: "demo-anjali", firstName: "Anjali", rollNo: "1", classroomId: "demo-8b", lang: "en" },
    "1111",
  );
  await setActiveProfile(db, "demo-anjali");
  await appendEvent(
    db,
    pack,
    { type: "readiness_completed", studentId: "demo-anjali", chapterId: TINY_CHAPTER, summary },
    { now: () => new Date("2026-10-28T08:00:00.000Z"), sessionId: "earlier" },
  );
});

afterEach(async () => {
  await teardown(db);
});

const pause = () => new Promise((resolve) => setTimeout(resolve, 10));

/** Practises with correct answers, following home, until home offers a Test. */
async function practiseUntilTest(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByTestId("home-mode");
  for (let i = 0; i < 120; i++) {
    const mode = screen.queryByTestId("home-mode");
    if (mode) {
      if (mode.textContent === "Test") return;
      await user.click(screen.getByRole("button", { name: "Start" }));
    } else if (screen.queryByTestId("feedback")) {
      await user.click(screen.getByRole("button", { name: "Next" }));
    } else {
      const four = screen.queryByRole("button", { name: "4" });
      if (four && !(four as HTMLButtonElement).disabled) {
        await user.click(four);
        await screen.findByTestId("feedback");
      }
    }
    await pause();
  }
  throw new Error("Home never offered a Test");
}

describe("test screen", () => {
  it("asks three questions without hints and shows the mastery outcome and the next re-check", async () => {
    const user = userEvent.setup();
    const router = renderStudent("/s/home", { db, pack, now });
    await practiseUntilTest(user);
    await user.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/s\/test\//));
    for (let k = 1; k <= 3; k++) {
      expect(await screen.findByTestId("test-progress")).toHaveTextContent(`Question ${k} of 3`);
      expect(screen.queryByRole("button", { name: "Show a hint" })).toBeNull();
      await user.click(screen.getByRole("button", { name: "4" }));
      if (k < 3) await waitFor(() => expect(screen.getByTestId("test-progress")).toHaveTextContent(`Question ${k + 1} of 3`));
    }
    expect(await screen.findByTestId("test-result")).toHaveTextContent("3 of 3 correct");
    expect(screen.getByTestId("test-outcome")).toHaveTextContent("You have mastered");
    expect(screen.getByTestId("test-next")).toHaveTextContent("Next quick check on");
    const tests = (await db.events.toArray()).filter((e) => e.type === "attempt" && e.mode === "test");
    expect(tests).toHaveLength(3);
    expect(tests.every((e) => e.type === "attempt" && e.hintsUsed === 0)).toBe(true);
  });

  it("goes home when the policy is not asking for a test on this concept", async () => {
    const router = renderStudent("/s/test/M8.LEQ.ONE_SIDE", { db, pack, now });
    await waitFor(() => expect(router.state.location.pathname).toBe("/s/home"));
  });
});
