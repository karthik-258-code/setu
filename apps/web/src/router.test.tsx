import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LangProvider } from "./i18n/lang-context";
import { routes } from "./router";

/** Every route of ARCHITECTURE 7.2; each screen has its own tests next to it. */
const ROUTES = [
  "/",
  "/demo",
  "/s/login",
  "/s/profiles",
  "/s/home",
  "/s/readiness/:chapterId",
  "/s/learn/:conceptId",
  "/s/solve/:conceptId",
  "/s/test/:conceptId",
  "/s/progress",
  "/t/login",
  "/t/classrooms",
  "/t/classrooms/:id/launch",
  "/t/classrooms/:id/gapmap",
  "/t/classrooms/:id/groups",
  "/t/classrooms/:id/students/:sid",
  "/t/classrooms/:id/paper-entry",
  "/t/classrooms/:id/weekly",
];

describe("routes", () => {
  it("opens on a landing page with student login, teacher login and the demo", async () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/"] });
    render(
      <LangProvider>
        <RouterProvider router={router} />
      </LangProvider>,
    );
    expect(await screen.findByRole("link", { name: /Student login/ })).toHaveAttribute("href", "/s/login");
    expect(screen.getByRole("link", { name: /Teacher login/ })).toHaveAttribute("href", "/t/login");
    expect(screen.getByRole("link", { name: /Try the demo/ })).toHaveAttribute("href", "/demo");
    expect(screen.queryByTestId("route-name")).toBeNull();
  });

  it("covers every route of ARCHITECTURE 7.2", () => {
    expect(new Set(ROUTES).size).toBe(18);
  });
});
