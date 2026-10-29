import type { ContentPack } from "@setu/engine";
import { cleanup, render } from "@testing-library/react";
import { Outlet, RouterProvider, createMemoryRouter } from "react-router-dom";
import type { SetuDb } from "../data/db";
import { LangProvider } from "../i18n/lang-context";
import {
  StudentHome,
  StudentLearn,
  StudentLogin,
  StudentProfiles,
  StudentProgress,
  StudentReadiness,
  StudentSolve,
  StudentTest,
} from "../routes/student";
import { StudentProvider } from "../student/student-context";

/**
 * Unmounts rendered screens, lets their pending reads settle, then deletes the test database.
 * Call it in `afterEach` instead of `db.delete()` so no screen reads a closed database.
 */
export async function teardown(db: SetuDb): Promise<void> {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await db.delete();
}

/** Renders the student routes at `path` over a test database and a fixed pack and clock. */
export function renderStudent(
  path: string,
  options: { db: SetuDb; pack: ContentPack; now?: () => Date },
) {
  const router = createMemoryRouter(
    [
      {
        path: "/s",
        element: (
          <StudentProvider db={options.db} loadPack={async () => options.pack} now={options.now}>
            <Outlet />
          </StudentProvider>
        ),
        children: [
          { path: "login", element: <StudentLogin /> },
          { path: "profiles", element: <StudentProfiles /> },
          { path: "home", element: <StudentHome /> },
          { path: "readiness/:chapterId", element: <StudentReadiness /> },
          { path: "learn/:conceptId", element: <StudentLearn /> },
          { path: "solve/:conceptId", element: <StudentSolve /> },
          { path: "test/:conceptId", element: <StudentTest /> },
          { path: "progress", element: <StudentProgress /> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <LangProvider>
      <RouterProvider router={router} />
    </LangProvider>,
  );
  return router;
}
