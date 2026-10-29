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

describe("test screen", () => {
  it("verifies a teacher override with hint-free questions and shows the outcome and what comes next", async () => {
    await appendEvent(
      db,
      pack,
      { type: "teacher_override", studentId: "demo-anjali", teacherId: "t1", conceptId: "M8.LEQ.ONE_SIDE", mastered: true },
      { now: () => new Date("2026-10-28T08:30:00.000Z"), sessionId: "teacher" },
    );
    const user = userEvent.setup();
    const router = renderStudent("/s/home", { db, pack, now });
    expect(await screen.findByTestId("home-mode")).toHaveTextContent("Confirm");
    await user.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/s/test/M8.LEQ.ONE_SIDE"));
    expect(await screen.findByTestId("test-progress")).toHaveTextContent(/^Question 1 of \d$/);
    const total = Number(/of (\d)$/.exec(screen.getByTestId("test-progress").textContent ?? "")?.[1]);
    for (let k = 1; k <= total; k++) {
      expect(screen.queryByRole("button", { name: "Show a hint" })).toBeNull();
      await user.click(await screen.findByRole("button", { name: "4" }));
      if (k < total) {
        await waitFor(() =>
          expect(screen.getByTestId("test-progress")).toHaveTextContent(`Question ${k + 1} of ${total}`),
        );
      }
    }
    expect(await screen.findByTestId("test-result")).toHaveTextContent(`${total} of ${total} correct`);
    expect(screen.getByTestId("test-outcome")).toHaveTextContent("M8.LEQ.ONE_SIDE");
    expect(screen.getByTestId("test-next")).not.toBeEmptyDOMElement();
    const verify = (await db.events.toArray()).filter((e) => e.type === "attempt" && e.mode === "verify");
    expect(verify).toHaveLength(total);
    expect(verify.every((e) => e.type === "attempt" && e.hintsUsed === 0)).toBe(true);
  });

  it("goes home when the policy is not asking for a test on this concept", async () => {
    const router = renderStudent("/s/test/M8.LEQ.ONE_SIDE", { db, pack, now });
    await waitFor(() => expect(router.state.location.pathname).toBe("/s/home"));
  });
});
