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

const base = tinyPack();
const pack: ContentPack = {
  ...base,
  resources: ["M7.SEQ.TRANSPOSE", "M8.LEQ.ONE_SIDE"].map((conceptId) => ({
    id: `${conceptId}.R01`,
    conceptId,
    type: "explanation" as const,
    body: {
      en: "Move a term with **its sign changed**, as in `x + 3 = 7`.\n\n- subtract 3\n- read x",
      te: "తెలుగు వివరణ",
    },
    reviewStatus: "draft" as const,
  })),
};

const summary: ReadinessSummary = {
  chapterId: TINY_CHAPTER,
  cleared: [],
  failed: ["M7.SEQ.TRANSPOSE"],
  uncertain: [],
  pending: [],
  itemsUsed: 1,
  advancedEntry: false,
  misconceptions: {},
  completedAt: "2026-10-28T08:00:00.000Z",
};

beforeEach(async () => {
  n += 1;
  db = new SetuDb(`setu-learn-${n}`);
  await saveProfile(db, { studentId: "demo-anjali", firstName: "Anjali", rollNo: "1", classroomId: "demo-8b", lang: "en" }, "1111");
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

describe("learn screen", () => {
  it("renders the resource markdown, switches language and records learn_viewed", async () => {
    const user = userEvent.setup();
    const router = renderStudent("/s/home", { db, pack, now });
    expect(await screen.findByTestId("home-mode")).toHaveTextContent("Learn");
    await user.click(screen.getByRole("button", { name: "Start" }));
    const body = await screen.findByTestId("learn-body");
    expect(screen.getByText("its sign changed").tagName).toBe("STRONG");
    expect(screen.getByText("x + 3 = 7").tagName).toBe("CODE");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Read in Telugu" }));
    expect(body).toHaveTextContent("తెలుగు వివరణ");
    await user.click(screen.getByRole("button", { name: "I understood, let me try" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/s/home"));
    const viewed = (await db.events.toArray()).filter((e) => e.type === "learn_viewed");
    expect(viewed).toHaveLength(1);
    expect(viewed[0]).toMatchObject({ resourceId: expect.stringMatching(/\.R01$/) as unknown });
  });

  it("goes home when the policy is not asking to learn this concept", async () => {
    const router = renderStudent("/s/learn/NOT.A.CONCEPT", { db, pack, now });
    await waitFor(() => expect(router.state.location.pathname).toBe("/s/home"));
  });
});
