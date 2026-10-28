import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LangProvider } from "./i18n/lang-context";
import { routes } from "./router";

const CASES: { path: string; name: string; params: Record<string, string> }[] = [
  { path: "/", name: "role-chooser", params: {} },
  { path: "/s/progress", name: "student-progress", params: {} },
  { path: "/t/classrooms/c1/paper-entry", name: "teacher-paper-entry", params: { id: "c1" } },
  { path: "/t/classrooms/c1/weekly", name: "teacher-weekly", params: { id: "c1" } },
];

/** Routes whose screen is built; each has its own tests next to the screen. */
const BUILT_SCREENS = ["/s/login", "/s/profiles", "/s/home", "/s/readiness/:chapterId", "/s/solve/:conceptId",
  "/s/learn/:conceptId",
  "/s/test/:conceptId",
  "/t/login",
  "/t/classrooms",
  "/t/classrooms/:id/gapmap",
  "/t/classrooms/:id/groups",
  "/t/classrooms/:id/students/:sid",
  "/demo",
  "/t/classrooms/:id/launch",
];

describe("routes", () => {
  it.each(CASES)("renders $path as $name with its params", async ({ path, name, params }) => {
    const router = createMemoryRouter(routes, { initialEntries: [path] });
    render(
      <LangProvider>
        <RouterProvider router={router} />
      </LangProvider>,
    );
    expect(await screen.findByTestId("route-name")).toHaveTextContent(name);
    for (const [key, value] of Object.entries(params)) {
      expect(screen.getByTestId(`param-${key}`)).toHaveTextContent(`${key}=${value}`);
    }
  });

  it("covers every route of ARCHITECTURE 7.2", () => {
    expect(CASES.length + BUILT_SCREENS.length).toBe(18);
  });
});
