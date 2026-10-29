import type { Recommendation } from "@setu/engine";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SetuDb } from "../data/db";
import { saveProfile, setActiveProfile } from "../data/profiles";
import { renderReason, routeFor } from "../student/recommend";
import { TINY_CHAPTER, tinyPack } from "../test/fixtures";
import { renderStudent, teardown } from "../test/render-student";

const pack = tinyPack();
let db: SetuDb;
let n = 0;

beforeEach(() => {
  n += 1;
  db = new SetuDb(`setu-home-${n}`);
});

afterEach(async () => {
  await teardown(db);
});

const anjali = {
  studentId: "demo-anjali",
  firstName: "Anjali",
  rollNo: "1",
  classroomId: "demo-8b",
  lang: "en" as const,
};

describe("home card", () => {
  it("sends a signed-out phone to the profile picker", async () => {
    await saveProfile(db, anjali, "1111");
    await setActiveProfile(db, null);
    const router = renderStudent("/s/home", { db, pack });
    await waitFor(() => expect(router.state.location.pathname).toBe("/s/profiles"));
  });

  it("offers the readiness check to a new student and opens it with the one primary button", async () => {
    await saveProfile(db, anjali, "1111");
    await setActiveProfile(db, anjali.studentId);
    const user = userEvent.setup();
    const router = renderStudent("/s/home", { db, pack });
    expect(await screen.findByTestId("home-mode")).toHaveTextContent("Getting started");
    expect(screen.getByTestId("home-reason")).toHaveTextContent("R0_READINESS");
    await user.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/s/readiness/${TINY_CHAPTER}`),
    );
  });

  it("lets another student take the phone from the home screen", async () => {
    await saveProfile(db, anjali, "1111");
    await setActiveProfile(db, anjali.studentId);
    const user = userEvent.setup();
    const router = renderStudent("/s/home", { db, pack });
    await user.click(await screen.findByRole("button", { name: "Switch student" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/s/profiles"));
  });
});

describe("offline indicator", () => {
  it("shows the lessons are saved and says so while the phone is offline", async () => {
    await saveProfile(db, anjali, "1111");
    await setActiveProfile(db, anjali.studentId);
    renderStudent("/s/home", { db, pack });
    expect(await screen.findByTestId("offline-ready")).toHaveTextContent("Lessons saved on this phone");
    expect(screen.queryByTestId("offline-now")).toBeNull();
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByTestId("offline-now")).toHaveTextContent("your work is saved");
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByTestId("offline-now")).toBeNull();
  });
});

describe("recommendation helpers", () => {
  const recheck: Recommendation = {
    studentId: "s1",
    chapterId: TINY_CHAPTER,
    mode: "recheck",
    conceptId: "M7.SEQ.TRANSPOSE",
    difficulty: 2,
    questionIds: [],
    recheckKind: "spaced",
    ruleId: "R2_RECHECK_DUE",
    reasonParams: { chapterId: TINY_CHAPTER, conceptId: "M7.SEQ.TRANSPOSE", count: 3 },
  };

  it("fills concept and chapter titles and numbers in every language of the template", () => {
    const withTemplate = {
      ...pack,
      reasonTemplates: {
        ...pack.reasonTemplates,
        R2_RECHECK_DUE: { en: "Check {concept} in {chapter}: {count}", te: "{concept} {count}" },
      },
    };
    expect(renderReason(withTemplate, recheck)).toEqual({
      en: `Check M7.SEQ.TRANSPOSE in ${TINY_CHAPTER}: 3`,
      te: "M7.SEQ.TRANSPOSE 3",
    });
  });

  it("routes a due re-check to the test screen and has no route when everything is done", () => {
    expect(routeFor(recheck)).toBe("/s/test/M7.SEQ.TRANSPOSE");
    expect(routeFor({ ...recheck, mode: "done", ruleId: "R9_DONE" })).toBeNull();
  });
});
