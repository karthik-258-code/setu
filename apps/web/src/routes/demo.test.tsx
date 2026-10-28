import { render, screen, waitFor } from "@testing-library/react";
import { Outlet, RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setApiClient } from "../data/api";
import { SetuDb } from "../data/db";
import { LocalDemoApiClient } from "../data/local-demo-api-client";
import { LangProvider } from "../i18n/lang-context";
import { TeacherProvider } from "../teacher/teacher-context";
import { TINY_CHAPTER, tinyPack } from "../test/fixtures";
import { teardown } from "../test/render-student";
import { Demo } from "./pages";
import { TeacherGapMap } from "./teacher";

const pack = tinyPack();
let db: SetuDb;
let n = 0;

beforeEach(() => {
  n += 1;
  db = new SetuDb(`setu-demo-${n}`);
  setApiClient(new LocalDemoApiClient(db, async () => pack));
});

afterEach(async () => {
  await teardown(db);
});

const students = [
  { studentId: "demo-anjali", firstName: "Anjali", rollNo: "1", lang: "te", pin: "1111" },
  { studentId: "demo-ravi", firstName: "Ravi", rollNo: "2", lang: "te", pin: "2222" },
  { studentId: "demo-s03", firstName: "Lakshmi", rollNo: "3", lang: "en", pin: "3003" },
];

const attempt = {
  type: "attempt",
  id: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
  studentId: "demo-s03",
  ts: "2026-10-26T04:00:00.000Z",
  sessionId: "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
  questionId: "M7.SEQ.TRANSPOSE.Q01",
  conceptId: "M7.SEQ.TRANSPOSE",
  mode: "readiness",
  difficulty: 1,
  correct: false,
  selectedOptionId: "b",
  misconceptionCode: "E-TRANSPOSE-SIGN",
  hintsUsed: 0,
  timeMs: 30000,
  source: "device",
};

function renderDemo(seed: unknown) {
  const router = createMemoryRouter(
    [
      { path: "/demo", element: <Demo db={db} load={async () => seed} /> },
      {
        path: "/t",
        element: (
          <TeacherProvider db={db}>
            <Outlet />
          </TeacherProvider>
        ),
        children: [{ path: "classrooms/:id/gapmap", element: <TeacherGapMap /> }],
      },
    ],
    { initialEntries: ["/demo"] },
  );
  render(
    <LangProvider>
      <RouterProvider router={router} />
    </LangProvider>,
  );
  return router;
}

describe("/demo", () => {
  it("stores the seeded roster and events, signs the teacher in and opens the Gap Map", async () => {
    const router = renderDemo({ packVersion: "tiny-1", chapterId: TINY_CHAPTER, students, events: [attempt] });
    await waitFor(() => expect(router.state.location.pathname).toBe("/t/classrooms/demo-8b/gapmap"));
    const cell = await screen.findByTestId("cell-demo-s03-M7.SEQ.TRANSPOSE");
    expect(cell).not.toHaveClass("bg-slate-200");
    expect(await db.events.count()).toBe(1);
    expect(await db.meta.get("teacherToken")).toMatchObject({ value: "demo:demo-teacher" });
  });

  it("refuses a seed with an invalid event and says how to build it", async () => {
    renderDemo({ packVersion: "tiny-1", students, events: [{ ...attempt, mode: "guess" }] });
    expect(await screen.findByRole("alert")).toHaveTextContent("pnpm content:pack");
    expect(await db.events.count()).toBe(0);
  });
});
