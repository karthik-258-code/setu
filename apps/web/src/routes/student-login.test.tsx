import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setApiClient } from "../data/api";
import { SetuDb } from "../data/db";
import { LocalDemoApiClient } from "../data/local-demo-api-client";
import { activeProfile, saveProfile } from "../data/profiles";
import { tinyPack } from "../test/fixtures";
import { renderStudent } from "../test/render-student";

const pack = tinyPack();
let db: SetuDb;
let n = 0;

beforeEach(() => {
  n += 1;
  db = new SetuDb(`setu-login-${n}`);
  setApiClient(new LocalDemoApiClient(db, async () => pack));
});

afterEach(async () => {
  await db.delete();
});

const ravi = {
  studentId: "demo-ravi",
  firstName: "Ravi",
  rollNo: "2",
  classroomId: "demo-8b",
  lang: "te" as const,
};

describe("student login", () => {
  it("signs a student in with classroom code, roll number and PIN, saves a hashed profile and opens home", async () => {
    const user = userEvent.setup();
    const router = renderStudent("/s/login", { db, pack });
    await user.type(await screen.findByLabelText("Classroom code"), "demo8b");
    await user.type(screen.getByLabelText("Roll number"), "2");
    await user.type(screen.getByLabelText("4-digit PIN"), "2222");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/s/home"));
    const profile = await activeProfile(db);
    expect(profile?.firstName).toBe("Ravi");
    expect(profile?.pinHash).toMatch(/^[0-9a-f]{64}$/);
    expect(document.documentElement.lang).toBe("te");
  });

  it("shows an error for a wrong PIN and stays on the login screen", async () => {
    const user = userEvent.setup();
    const router = renderStudent("/s/login", { db, pack });
    await user.type(await screen.findByLabelText("Classroom code"), "DEMO8B");
    await user.type(screen.getByLabelText("Roll number"), "2");
    await user.type(screen.getByLabelText("4-digit PIN"), "9999");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("not right");
    expect(router.state.location.pathname).toBe("/s/login");
    expect(await db.profiles.count()).toBe(0);
  });
});

describe("profile picker", () => {
  it("opens a profile on this phone with the right PIN only", async () => {
    await saveProfile(db, ravi, "2222");
    await saveProfile(db, { ...ravi, studentId: "demo-anjali", firstName: "Anjali", rollNo: "1" }, "1111");
    const user = userEvent.setup();
    const router = renderStudent("/s/profiles", { db, pack });
    await user.click(await screen.findByRole("button", { name: /Ravi/ }));
    await user.type(screen.getByLabelText("Enter your PIN"), "1111");
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("not right");
    await user.type(screen.getByLabelText("Enter your PIN"), "2222");
    await user.click(screen.getByRole("button", { name: "Open" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/s/home"));
    expect((await activeProfile(db))?.studentId).toBe("demo-ravi");
  });

  it("sends a phone with no profiles to the login screen", async () => {
    const router = renderStudent("/s/profiles", { db, pack });
    await waitFor(() => expect(router.state.location.pathname).toBe("/s/login"));
  });

});
