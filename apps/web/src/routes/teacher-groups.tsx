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
import { postForStudents } from "../teacher/teacher-events";
import { Toast } from "../teacher/toast";

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
  const { ui, t } = useLang();
  const { pack } = view;
  const [toast, setToast] = useState<string | null>(null);
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

  async function act(run: () => Promise<void>, message: string) {
    try {
      await run();
      setToast(message);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  const titleOf = (conceptId: string) => {
    const concept = pack.graph.concepts[conceptId];
    return concept ? t(concept.title).text : conceptId;
  };

  const markTaught = (g: ShownGroup, conceptId: string) =>
    act(
      () => postForStudents(view.classroom.id, teacherId, g.studentIds, { type: "mark_taught", conceptId }),
      format(ui("toastTaught"), { count: g.studentIds.length }),
    );

  const assignGroup = (g: ShownGroup, conceptId: string) => {
    const questionIds = g.suggestedQuestionIds.slice(0, WARM_UP_QUESTIONS);
    return act(
      () =>
        postForStudents(view.classroom.id, teacherId, g.studentIds, {
          type: "assign",
          conceptId,
          ...(questionIds.length > 0 ? { questionIds } : {}),
        }),
      format(ui("toastAssigned"), { concept: titleOf(conceptId), count: g.studentIds.length }),
    );
  };

  const select = "min-h-10 rounded-xl border border-slate-300 bg-white px-2 text-sm";
  const button = "min-h-11 rounded-xl border px-3";

  return (
    <div className="mx-auto w-full max-w-screen-xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">{ui("groups")}</h1>
          <p className="text-base font-medium leading-snug text-slate-600 sm:text-lg">
            <L text={pack.graph.chapters[view.chapterId]?.title ?? { en: view.chapterId, te: view.chapterId }} />
          </p>
        </div>
        <Link to="/t/classrooms" className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-slate-200 bg-white px-4 font-semibold text-brand-800 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50">
          {ui("back")}
        </Link>
      </header>
      {failed && (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 font-medium text-rose-900 ring-1 ring-rose-200">
          {ui("saveFailed")}
        </p>
      )}
      {groups.length === 0 && <p className="rounded-2xl bg-white p-6 font-medium text-slate-600 shadow-soft">{ui("noGroups")}</p>}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      {groups.map((g) => {
        const concept = g.conceptId === undefined ? undefined : pack.graph.concepts[g.conceptId];
        const mistake =
          g.dominantMisconception === undefined ? undefined : pack.misconceptions[g.dominantMisconception];
        const others = groups.filter((x) => x.id !== g.id);
        const warmUp = g.suggestedQuestionIds
          .slice(0, WARM_UP_QUESTIONS)
          .map((id) => pack.questions.find((q) => q.id === id))
          .filter((q) => q !== undefined);
        const tone =
          g.kind === "ready"
            ? { panel: "bg-emerald-50/70", badge: "bg-emerald-100 text-emerald-950" }
            : g.kind === "gap"
              ? { panel: "bg-rose-50/70", badge: "bg-rose-100 text-rose-950" }
              : g.kind === "not_attempted"
                ? { panel: "bg-slate-100", badge: "bg-slate-200 text-slate-800" }
                : { panel: "bg-brand-50", badge: "bg-brand-100 text-brand-900" };
        return (
          <section
            key={g.id}
            data-testid="group-card"
            data-group-id={g.id}
            className="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-200/80"
          >
            <header className={`flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-5 ${tone.panel}`}>
              <div className="min-w-0 space-y-2">
                {concept && (
                  <span className={`inline-flex min-h-7 items-center rounded-md px-2.5 text-xs font-bold ${tone.badge}`}>
                    {ui(KIND_LABEL[g.kind])}
                  </span>
                )}
                <h2 className="text-lg font-bold leading-snug text-slate-900 sm:text-xl">
                  {concept ? <L text={concept.title} /> : ui(KIND_LABEL[g.kind])}
                </h2>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="text-sm font-bold tabular-nums text-slate-700">
                  {format(ui("studentsCount"), { count: g.studentIds.length })}
                </span>
                {g.accepted && (
                  <span className="inline-flex min-h-7 items-center rounded-md bg-white/80 px-2.5 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200">
                    {ui("accepted")}
                  </span>
                )}
              </div>
            </header>
            <div className="space-y-4 p-4 sm:p-5">
              {mistake && (
                <p className="rounded-xl bg-amber-50 px-3.5 py-3 text-sm leading-6 text-amber-950 ring-1 ring-amber-200">
                  <span className="font-semibold">{ui("commonMistake")}:</span> <L text={mistake.label} />
                </p>
              )}
              <ul className="grid grid-cols-2 gap-x-4 gap-y-2" aria-label={format(ui("studentsCount"), { count: g.studentIds.length })}>
                {g.studentIds.map((studentId) => (
                  <li key={studentId} data-testid="student-chip" className="min-w-0 border-b border-slate-100 py-2">
                    <span className="block truncate text-sm font-semibold text-slate-800">{nameOf(studentId)}</span>
                    {others.length > 0 && (
                      <select
                        aria-label={format(ui("moveStudent"), { name: nameOf(studentId) })}
                        value=""
                        onChange={(e) => void move(studentId, g, e.target.value)}
                        className={`${select} mt-1.5 w-full min-h-10 bg-white text-xs text-slate-700`}
                      >
                        <option value="">{ui("choose")}</option>
                        {others.map((o) => (
                        <option key={o.id} value={o.id}>
                            {o.conceptId ? titleOf(o.conceptId) : ui(KIND_LABEL[o.kind])}
                          </option>
                        ))}
                      </select>
                    )}
                  </li>
                ))}
              </ul>
              {warmUp.length > 0 && (
                <div className="space-y-2 border-t border-slate-200 pt-4">
                  <h3 className="text-sm font-bold text-slate-800">{ui("warmUp")}</h3>
                  <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-6 text-slate-700" data-testid="warm-up">
                    {warmUp.map((q) => (
                      <li key={q.id}>
                        <L text={q.stem} />
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
              {!g.accepted && (
                <button
                  type="button"
                  onClick={() => void accept(g)}
                  className={`${button} border-brand-800 bg-brand-800 font-semibold text-white shadow-sm hover:bg-brand-900`}
                >
                  {ui("accept")}
                </button>
              )}
              {g.conceptId !== undefined && (
                <>
                  <button
                    type="button"
                    onClick={() => g.conceptId !== undefined && void markTaught(g, g.conceptId)}
                    className={`${button} border-brand-200 bg-brand-50 font-semibold text-brand-900 hover:bg-brand-100`}
                  >
                    {ui("markTaught")}
                  </button>
                  <button
                    type="button"
                    onClick={() => g.conceptId !== undefined && void assignGroup(g, g.conceptId)}
                    className={`${button} border-slate-300 bg-white font-semibold text-slate-800 hover:border-brand-300 hover:bg-brand-50`}
                  >
                    {ui("assign")}
                  </button>
                </>
              )}
              <button type="button" onClick={() => void dismiss(g)} className={`${button} border-transparent bg-transparent text-slate-600 hover:bg-slate-100`}>
                {ui("dismiss")}
              </button>
              {g.studentIds.length > 1 && (
                <button type="button" onClick={() => void split(g)} className={`${button} border-transparent bg-transparent text-slate-600 hover:bg-slate-100`}>
                  {ui("split")}
                </button>
              )}
              </div>
              {others.length > 0 && (
                <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
                  {ui("mergeInto")}
                  <select
                    value=""
                    onChange={(e) => void merge(g, e.target.value)}
                    className={`${select} min-h-10 min-w-32 bg-white text-slate-800`}
                  >
                    <option value="">{ui("choose")}</option>
                    {others.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.conceptId ? titleOf(o.conceptId) : ui(KIND_LABEL[o.kind])}
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
      <Toast message={toast} />
    </div>
  );
}
