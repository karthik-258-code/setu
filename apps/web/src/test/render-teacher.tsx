import { render } from "@testing-library/react";
import { Outlet, RouterProvider, createMemoryRouter } from "react-router-dom";
import type { SetuDb } from "../data/db";
import { LangProvider } from "../i18n/lang-context";
import { TeacherClassrooms, TeacherGapMap, TeacherGroups, TeacherLogin } from "../routes/teacher";
import { TeacherProvider } from "../teacher/teacher-context";

/** Renders the teacher routes at `path` over a test database. */
export function renderTeacher(path: string, options: { db: SetuDb }) {
  const router = createMemoryRouter(
    [
      {
        path: "/t",
        element: (
          <TeacherProvider db={options.db}>
            <Outlet />
          </TeacherProvider>
        ),
        children: [
          { path: "login", element: <TeacherLogin /> },
          { path: "classrooms", element: <TeacherClassrooms /> },
          { path: "classrooms/:id/gapmap", element: <TeacherGapMap /> },
          { path: "classrooms/:id/groups", element: <TeacherGroups /> },
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
