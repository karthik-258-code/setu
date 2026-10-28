import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setApiClient } from "../data/api";
import { SetuDb } from "../data/db";
import { LocalDemoApiClient } from "../data/local-demo-api-client";
import { tinyPack } from "../test/fixtures";
import { teardown } from "../test/render-student";
import { renderTeacher } from "../test/render-teacher";

const pack = tinyPack();
let db: SetuDb;
let n = 0;

beforeEach(() => {
  n += 1;
  db = new SetuDb(`setu-teacher-${n}`);
  setApiClient(new LocalDemoApiClient(db, async () => pack));
});

afterEach(async () => {
  await teardown(db);
});

async function signIn(password: string) {
  const user = userEvent.setup();
  const router = renderTeacher("/t/login", { db });
  await user.type(await screen.findByLabelText("Email"), "teacher@demo.setu.app");
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  return { user, router };
}

describe("teacher login and classrooms", () => {
  it("signs the demo teacher in and lists the classroom with its code and screens", async () => {
    const { router } = await signIn("setu-demo");
    await waitFor(() => expect(router.state.location.pathname).toBe("/t/classrooms"));
    expect(await screen.findByRole("heading", { name: "Class 8 B" })).toBeInTheDocument();
    expect(screen.getByText("DEMO8B")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gap Map" })).toHaveAttribute(
      "href",
      "/t/classrooms/demo-8b/gapmap",
    );
  });

  it("shows an error for a wrong password and stays signed out", async () => {
    const { router } = await signIn("wrong");
    expect(await screen.findByRole("alert")).toHaveTextContent("not right");
    expect(router.state.location.pathname).toBe("/t/login");
    expect(await db.meta.get("teacherToken")).toBeUndefined();
  });

  it("sends a signed-out device from the classrooms list to the login", async () => {
    const router = renderTeacher("/t/classrooms", { db });
    await waitFor(() => expect(router.state.location.pathname).toBe("/t/login"));
  });

  it("signs out back to the login", async () => {
    const { user, router } = await signIn("setu-demo");
    await user.click(await screen.findByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/t/login"));
  });
});
