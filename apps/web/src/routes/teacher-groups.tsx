import type { GapGroup, GroupEditEvent, GroupKind } from "@setu/engine";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "../data/api";
import { newId } from "../data/ids";
import { format } from "../i18n/format";
import { L } from "../i18n/l";
import { useLang } from "../i18n/lang-context";
import type { StringKey } from "../i18n/strings";
import { useClassView } from "../teacher/class-view";
import type { ClassView } from "../teacher/class-view";
import { TeacherGate, useTeacher } from "../teacher/teacher-context";

const KIND_LABEL: Record<GroupKind, StringKey> = {
  ready: "kindReady",
  gap: "kindGap",
  not_attempted: "kindNotAttempted",
  other: "kindOther",
};

const WARM_UP_QUESTIONS = 3;

interface ShownGroup extends GapGroup {
  accepted: boolean;
}

export function TeacherGroups() {
  const { id } = useParams();
  return (
    <TeacherGate>
      <GroupsScreen classroomId={id ?? ""} />
    </TeacherGate>
  );
}

function GroupsScreen({ classroomId }: { classroomId: string }) {
  const { status } = useClassView(classroomId);
  const { ui } = useLang();
  if (status.kind === "loading") return <p role="status">{ui("loading")}</p>;
  if (status.kind === "error") return <p role="alert">{ui("loadFailed")}</p>;
  if (status.kind === "no-chapter") return <p>{ui("noChapterLaunched")}</p>;
  return <GroupsBoard view={status.view} />;
}

/**
 * Suggested groups from the engine. Edits are teacher decisions recorded as `group_edit` events
 * (audit only, ARCHITECTURE 5.6); the board shows them at once, and a reload recomputes groups.
 */
function GroupsBoard({ view }: { view: ClassView }) {
  const { teacherId } = useTeacher();
  const { ui } = useLang();
  const { pack } = view;
  const [groups, setGroups] = useState<ShownGroup[]>(() =>
    view.groups.map((g) => ({ ...g, accepted: false })),
  );
  const [failed, setFailed] = useState(false);
  const names = new Map(view.gapMap.rows.map((r) => [r.studentId, r.displayName]));
  const nameOf = (studentId: string) => names.get(studentId) ?? studentId;

  async function apply(
    next: ShownGroup[],
    action: GroupEditEvent["action"],
    studentIds: readonly string[],
    fromGroupId: string,
    toGroupId?: string,
  ) {
    try {
      if (teacherId === null) throw new Error("No teacher is signed in");
      const ts = new Date().toISOString();
      for (const studentId of studentIds) {
        await apiClient().postTeacherEvent(view.classroom.id, {
          type: "group_edit",
          id: newId(),
          studentId,
          ts,
          teacherId,
          chapterId: view.chapterId,
          action,
          fromGroupId,
          ...(toGroupId !== undefined ? { toGroupId } : {}),
        });
      }
      setGroups(next.filter((g) => g.studentIds.length > 0));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  const accept = (g: ShownGroup) =>
    apply(
      groups.map((x) => (x.id === g.id ? { ...x, accepted: true } : x)),
      "accept",
      g.studentIds,
      g.id,
    );

  const dismiss = (g: ShownGroup) =>
    apply(
      groups.filter((x) => x.id !== g.id),
      "dismiss",
      g.studentIds,
      g.id,
    );

  const split = (g: ShownGroup) => {
    const keep = g.studentIds.slice(0, Math.ceil(g.studentIds.length / 2));
    const moved = g.studentIds.slice(keep.length);
    const newGroupId = `${g.id}.b`;
    const next = groups.flatMap((x) =>
      x.id === g.id
        ? [
            { ...x, studentIds: keep },
            { ...x, id: newGroupId, studentIds: moved, accepted: false },
          ]
        : [x],
    );
    return apply(next, "split", moved, g.id, newGroupId);
  };

  const merge = (g: ShownGroup, targetId: string) => {
    const next = groups
      .filter((x) => x.id !== g.id)
      .map((x) =>
        x.id === targetId
          ? { ...x, studentIds: [...x.studentIds, ...g.studentIds.filter((s) => !x.studentIds.includes(s))] }
          : x,
      );
    return apply(next, "merge", g.studentIds, g.id, targetId);
  };

  const move = (studentId: string, from: ShownGroup, targetId: string) => {
    const next = groups.map((x) => {
      if (x.id === from.id) return { ...x, studentIds: x.studentIds.filter((s) => s !== studentId) };
      if (x.id === targetId) return { ...x, studentIds: [...x.studentIds, studentId] };
      return x;
    });
    return apply(next, "move", [studentId], from.id, targetId);
  };

  const select = "min-h-9 rounded-md border border-slate-300 bg-white px-2 text-sm";
  const button = "min-h-11 rounded-md border px-3";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">{ui("groups")}</h1>
        <Link to="/t/classrooms" className="min-h-11 py-2 text-brand-800 underline">
          {ui("back")}
        </Link>
      </header>
      {failed && (
        <p role="alert" className="text-red-700">
          {ui("saveFailed")}
        </p>
      )}
      {groups.length === 0 && <p>{ui("noGroups")}</p>}
      {groups.map((g) => {
        const concept = g.conceptId === undefined ? undefined : pack.graph.concepts[g.conceptId];
        const mistake =
          g.dominantMisconception === undefined ? undefined : pack.misconceptions[g.dominantMisconception];
        const others = groups.filter((x) => x.id !== g.id);
        const warmUp = g.suggestedQuestionIds
          .slice(0, WARM_UP_QUESTIONS)
          .map((id) => pack.questions.find((q) => q.id === id))
          .filter((q) => q !== undefined);
        return (
          <section
            key={g.id}
            data-testid="group-card"
            data-group-id={g.id}
            className="space-y-3 rounded-lg bg-white p-4 shadow-sm"
          >
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">
                {ui(KIND_LABEL[g.kind])}
                {concept && (
                  <>
                    {": "}
                    <L text={concept.title} />
                  </>
                )}
              </h2>
              {g.accepted && (
                <span className="rounded bg-green-100 px-2 py-0.5 text-sm text-green-900">
                  {ui("accepted")}
                </span>
              )}
            </header>
            {mistake && (
              <p className="text-sm">
                {ui("commonMistake")}: <L text={mistake.label} />
              </p>
            )}
            <ul className="flex flex-wrap gap-2">
              {g.studentIds.map((studentId) => (
                <li
                  key={studentId}
                  data-testid="student-chip"
                  className="flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1"
                >
                  <span>{nameOf(studentId)}</span>
                  {others.length > 0 && (
                    <select
                      aria-label={format(ui("moveStudent"), { name: nameOf(studentId) })}
                      value=""
                      onChange={(e) => void move(studentId, g, e.target.value)}
                      className={select}
                    >
                      <option value="">{ui("choose")}</option>
                      {others.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.id}
                        </option>
                      ))}
                    </select>
                  )}
                </li>
              ))}
            </ul>
            {warmUp.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-slate-700">{ui("warmUp")}</h3>
                <ol className="list-decimal space-y-1 pl-5 text-sm" data-testid="warm-up">
                  {warmUp.map((q) => (
                    <li key={q.id}>
                      <L text={q.stem} />
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {!g.accepted && (
                <button
                  type="button"
                  onClick={() => void accept(g)}
                  className={`${button} border-brand-700 bg-brand-700 text-white`}
                >
                  {ui("accept")}
                </button>
              )}
              <button type="button" onClick={() => void dismiss(g)} className={`${button} border-slate-300`}>
                {ui("dismiss")}
              </button>
              {g.studentIds.length > 1 && (
                <button type="button" onClick={() => void split(g)} className={`${button} border-slate-300`}>
                  {ui("split")}
                </button>
              )}
              {others.length > 0 && (
                <label className="flex items-center gap-1 text-sm">
                  {ui("mergeInto")}
                  <select
                    value=""
                    onChange={(e) => void merge(g, e.target.value)}
                    className={select}
                  >
                    <option value="">{ui("choose")}</option>
                    {others.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
