import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LangProvider } from "./i18n/lang-context";
import { routes } from "./router";

const CASES: { path: string; name: string; params: Record<string, string> }[] = [
  { path: "/", name: "role-chooser", params: {} },
  { path: "/demo", name: "demo", params: {} },
  {
    path: "/s/learn/M8.LEQ.ONE_SIDE",
    name: "student-learn",
    params: { conceptId: "M8.LEQ.ONE_SIDE" },
  },
  {
    path: "/s/solve/M8.LEQ.ONE_SIDE",
    name: "student-solve",
    params: { conceptId: "M8.LEQ.ONE_SIDE" },
  },
  {
    path: "/s/test/M8.LEQ.ONE_SIDE",
    name: "student-test",
    params: { conceptId: "M8.LEQ.ONE_SIDE" },
  },
  { path: "/s/progress", name: "student-progress", params: {} },
  { path: "/t/login", name: "teacher-login", params: {} },
  { path: "/t/classrooms", name: "teacher-classrooms", params: {} },
  { path: "/t/classrooms/c1/launch", name: "teacher-launch", params: { id: "c1" } },
  { path: "/t/classrooms/c1/gapmap", name: "teacher-gapmap", params: { id: "c1" } },
  { path: "/t/classrooms/c1/groups", name: "teacher-groups", params: { id: "c1" } },
  {
    path: "/t/classrooms/c1/students/s9",
    name: "teacher-student",
    params: { id: "c1", sid: "s9" },
  },
  { path: "/t/classrooms/c1/paper-entry", name: "teacher-paper-entry", params: { id: "c1" } },
  { path: "/t/classrooms/c1/weekly", name: "teacher-weekly", params: { id: "c1" } },
];

/** Routes whose screen is built; each has its own tests next to the screen. */
const BUILT_SCREENS = ["/s/login", "/s/profiles", "/s/home", "/s/readiness/:chapterId"];

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
