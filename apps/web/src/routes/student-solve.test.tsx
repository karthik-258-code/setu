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

const anjali = {
  studentId: "demo-anjali",
  firstName: "Anjali",
  rollNo: "1",
  classroomId: "demo-8b",
  lang: "en" as const,
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

async function readyStudent(pack: ContentPack) {
  await saveProfile(db, anjali, "1111");
  await setActiveProfile(db, anjali.studentId);
  await appendEvent(
    db,
    pack,
    { type: "readiness_completed", studentId: anjali.studentId, chapterId: TINY_CHAPTER, summary },
    { now: () => new Date("2026-10-28T08:00:00.000Z"), sessionId: "earlier" },
  );
}

/** Opens home and follows its Solve card. */
async function openSolve(pack: ContentPack) {
  const user = userEvent.setup();
  const router = renderStudent("/s/home", { db, pack, now });
  expect(await screen.findByTestId("home-mode")).toHaveTextContent("Practise");
  await user.click(screen.getByRole("button", { name: "Start" }));
  await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/s\/solve\//));
  await screen.findByTestId("ladder");
  return { user, router };
}

beforeEach(() => {
  n += 1;
  db = new SetuDb(`setu-solve-${n}`);
});

afterEach(async () => {
  await teardown(db);
});

describe("solve screen", () => {
  it("marks a wrong answer at once, shows the right answer and writes a solve attempt", async () => {
    const pack = tinyPack();
    await readyStudent(pack);
    const { user } = await openSolve(pack);
    await user.click(screen.getByRole("button", { name: "7" }));
    const feedback = await screen.findByTestId("feedback");
    expect(feedback).toHaveTextContent("Not quite.");
    expect(feedback).toHaveTextContent("The answer is 4");
    const attempts = (await db.events.toArray()).filter((e) => e.type === "attempt");
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      mode: "solve",
      correct: false,
      misconceptionCode: "E-TRANSPOSE-SIGN",
      hintsUsed: 0,
    });
    expect(screen.getByRole("img", { name: /Level \d of 3/ })).toBeInTheDocument();
  });

  it("counts a used hint on the attempt", async () => {
    const base = tinyPack();
    const pack = {
      ...base,
      questions: base.questions.map((q) => ({ ...q, hint: { en: "Move the 3 across." } })),
    };
    await readyStudent(pack);
    const { user } = await openSolve(pack);
    await user.click(screen.getByRole("button", { name: "Show a hint" }));
    expect(screen.getByTestId("hint")).toHaveTextContent("Move the 3 across.");
    await user.click(screen.getByRole("button", { name: "4" }));
    expect(await screen.findByTestId("feedback")).toHaveTextContent("Correct!");
    const attempts = (await db.events.toArray()).filter((e) => e.type === "attempt");
    expect(attempts[0]).toMatchObject({ mode: "solve", correct: true, hintsUsed: 1 });
  });

  it("goes back home when the policy no longer picks Solve for this concept", async () => {
    const pack = tinyPack();
    await readyStudent(pack);
    const router = renderStudent("/s/solve/NOT.A.CONCEPT", { db, pack, now });
    await waitFor(() => expect(router.state.location.pathname).toBe("/s/home"));
  });
});
