import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setApiClient } from "../data/api";
import { SetuDb } from "../data/db";
import { LocalDemoApiClient } from "../data/local-demo-api-client";
import { teacherIdFromToken } from "../teacher/teacher-context";
import { tinyPack } from "../test/fixtures";
import { teardown } from "../test/render-student";
import { renderTeacher } from "../test/render-teacher";

const pack = tinyPack();
let db: SetuDb;
let n = 0;

beforeEach(async () => {
  n += 1;
  db = new SetuDb(`setu-groups-${n}`);
  setApiClient(new LocalDemoApiClient(db, async () => pack));
  await db.meta.put({ key: "teacherToken", value: "demo:demo-teacher" });
});

afterEach(async () => {
  await teardown(db);
});

async function editCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const e of await db.events.toArray()) {
    if (e.type === "group_edit") counts[e.action] = (counts[e.action] ?? 0) + 1;
  }
  return counts;
}

function cardById(id: string): HTMLElement {
  const card = screen.getAllByTestId("group-card").find((c) => c.dataset.groupId === id);
  if (!card) throw new Error(`No group card ${id}`);
  return card;
}

describe("groups", () => {
  it("splits, moves, merges, accepts and dismisses, writing one group_edit per student", async () => {
    const user = userEvent.setup();
    renderTeacher("/t/classrooms/demo-8b/groups", { db });
    await screen.findAllByTestId("group-card");
    const start = screen
      .getAllByTestId("group-card")
      .find((c) => within(c).getAllByTestId("student-chip").length >= 2);
    if (!start) throw new Error("Expected a group with both demo students");
    const id = start.dataset.groupId ?? "";

    await user.click(within(start).getByRole("button", { name: "Split" }));
    await waitFor(() => expect(cardById(`${id}.b`)).toBeInTheDocument());
    expect(within(cardById(id)).getAllByTestId("student-chip")).toHaveLength(1);

    const stayer = within(cardById(id)).getByTestId("student-chip").textContent ?? "";
    const name = stayer.replace(/Choose.*$/s, "").trim();
    await user.selectOptions(within(cardById(id)).getByLabelText(`Move ${name}`), `${id}.b`);
    await waitFor(() => expect(within(cardById(`${id}.b`)).getAllByTestId("student-chip")).toHaveLength(2));

    await user.click(within(cardById(`${id}.b`)).getByRole("button", { name: "Split" }));
    await waitFor(() => expect(cardById(`${id}.b.b`)).toBeInTheDocument());
    await user.selectOptions(within(cardById(`${id}.b.b`)).getByLabelText("Merge into"), `${id}.b`);
    await waitFor(() => expect(within(cardById(`${id}.b`)).getAllByTestId("student-chip")).toHaveLength(2));

    await user.click(within(cardById(`${id}.b`)).getByRole("button", { name: "Accept" }));
    expect(await within(cardById(`${id}.b`)).findByText("Accepted")).toBeInTheDocument();
    await user.click(within(cardById(`${id}.b`)).getByRole("button", { name: "Dismiss" }));
    await waitFor(() =>
      expect(screen.queryAllByTestId("group-card").some((c) => c.dataset.groupId === `${id}.b`)).toBe(false),
    );

    expect(await editCounts()).toEqual({ split: 2, move: 1, merge: 1, accept: 2, dismiss: 2 });
    const edit = (await db.events.toArray()).find((e) => e.type === "group_edit");
    expect(edit).toMatchObject({ teacherId: "demo-teacher", chapterId: pack.chapterId });
  });

  it("reads the teacher id from demo tokens and from a JWT sub claim", () => {
    expect(teacherIdFromToken("demo:t-42")).toBe("t-42");
    const payload = btoa(JSON.stringify({ sub: "t-7" })).replace(/=+$/, "");
    expect(teacherIdFromToken(`h.${payload}.s`)).toBe("t-7");
    expect(() => teacherIdFromToken("opaque")).toThrow();
  });
});
