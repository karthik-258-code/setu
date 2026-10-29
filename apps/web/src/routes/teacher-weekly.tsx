import type { WeeklyView } from "@setu/engine";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "../data/api";
import { format } from "../i18n/format";
import { L } from "../i18n/l";
import { useLang } from "../i18n/lang-context";
import type { StringKey } from "../i18n/strings";
import { useClassView } from "../teacher/class-view";
import type { ClassView } from "../teacher/class-view";
import { TeacherGate } from "../teacher/teacher-context";

export function TeacherWeekly() {
  const { id } = useParams();
  return (
    <TeacherGate>
      <WeeklyScreen classroomId={id ?? ""} />
    </TeacherGate>
  );
}

function WeeklyScreen({ classroomId }: { classroomId: string }) {
  const { status } = useClassView(classroomId);
  const { ui } = useLang();
  if (status.kind === "loading") return <p role="status">{ui("loading")}</p>;
  if (status.kind === "error") return <p role="alert">{ui("loadFailed")}</p>;
  if (status.kind === "no-chapter") return <p>{ui("noChapterLaunched")}</p>;
  return <WeeklyReport view={status.view} />;
}

/** The past seven days from `ApiClient.getWeekly`, built by the engine's `buildWeeklyView`. */
function WeeklyReport({ view }: { view: ClassView }) {
  const { lang, ui, t } = useLang();
  const [weekly, setWeekly] = useState<WeeklyView | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    apiClient()
      .getWeekly(view.classroom.id, view.chapterId)
      .then((w) => {
        if (live) setWeekly(w);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [view.classroom.id, view.chapterId]);

  if (failed) return <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 font-medium text-rose-900">{ui("loadFailed")}</p>;
  if (weekly === null) return <p role="status">{ui("loading")}</p>;

  const names = new Map(view.gapMap.rows.map((r) => [r.studentId, r.displayName]));
  const titleOf = (conceptId: string) => {
    const c = view.pack.graph.concepts[conceptId];
    return c ? t(c.title).text : conceptId;
  };
  const groupKind: Record<string, StringKey> = {
    ready: "kindReady",
    not_attempted: "kindNotAttempted",
    other: "kindOther",
  };
  const groupOf = (id: string) => {
    if (id.startsWith("gap:")) return titleOf(id.slice("gap:".length));
    const kind = groupKind[id];
    return kind ? ui(kind) : ui("kindOther");
  };
  const groupTone = (id: string) =>
    id === "ready"
      ? "bg-emerald-50 text-emerald-950 ring-emerald-200"
      : id === "not_attempted"
        ? "bg-slate-100 text-slate-800 ring-slate-200"
        : id === "other"
          ? "bg-amber-50 text-amber-950 ring-amber-200"
          : "bg-brand-50 text-brand-950 ring-brand-200";
  const date = new Intl.DateTimeFormat(lang === "te" ? "te-IN" : "en-IN", { day: "numeric", month: "long" });
  const empty = <p className="rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-600">{ui("nothingYet")}</p>;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 sm:space-y-9">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5 sm:pb-6">
        <div className="min-w-0 space-y-2">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl">{ui("weekly")}</h1>
          <p className="inline-flex min-h-8 items-center rounded-lg bg-brand-50 px-3 text-sm font-semibold tabular-nums text-brand-950 ring-1 ring-brand-100">
            {date.format(new Date(weekly.from))} – {date.format(new Date(weekly.to))}
          </p>
          <p className="text-sm font-medium text-slate-600"><L text={view.pack.graph.chapters[view.chapterId]?.title ?? { en: view.chapterId, te: view.chapterId }} /></p>
        </div>
        <Link to="/t/classrooms" className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-slate-200 bg-white px-4 font-semibold text-brand-800 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50">
          {ui("back")}
        </Link>
      </header>

      <section className="space-y-3" aria-labelledby="weekly-moved">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <h2 id="weekly-moved" className="text-lg font-bold tracking-tight text-slate-900">{ui("weeklyMoved")}</h2>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold tabular-nums text-brand-900 ring-1 ring-brand-100">{format(ui("weeklyMovesCount"), { count: weekly.moved.length })}</span>
        </div>
        {weekly.moved.length === 0 ? empty : (
          <ul className="divide-y divide-slate-100 rounded-2xl bg-white px-4 ring-1 ring-slate-200/80 sm:px-5">
            {weekly.moved.map((m) => (
              <li key={`${m.studentId}-${m.fromGroupId}-${m.toGroupId}`} className="grid grid-cols-1 items-center gap-2 py-3 sm:grid-cols-[minmax(9rem,0.7fr)_minmax(0,1.3fr)] sm:gap-4">
                <span className="truncate font-bold text-slate-900">{names.get(m.studentId) ?? m.studentId}</span>
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className={`inline-flex min-h-8 max-w-full items-center truncate rounded-lg px-2.5 ring-1 ${groupTone(m.fromGroupId)}`}>{format(ui("weeklyFrom"), { group: groupOf(m.fromGroupId) })}</span>
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-slate-400"><path d="M4 12h15M13 6l6 6-6 6" /></svg>
                  <span className={`inline-flex min-h-8 max-w-full items-center truncate rounded-lg px-2.5 ring-1 ${groupTone(m.toGroupId)}`}>{format(ui("weeklyTo"), { group: groupOf(m.toGroupId) })}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="weekly-blocking">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <h2 id="weekly-blocking" className="text-lg font-bold tracking-tight text-slate-900">{ui("weeklyBlocking")}</h2>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold tabular-nums text-amber-950 ring-1 ring-amber-200">{format(ui("weeklyConceptCount"), { count: weekly.blockingConcepts.length })}</span>
        </div>
        {weekly.blockingConcepts.length === 0 ? empty : (
          <ul className="divide-y divide-amber-100 rounded-2xl bg-amber-50/70 px-4 ring-1 ring-amber-100 sm:px-5">
            {weekly.blockingConcepts.map((b) => (
              <li key={b.conceptId} data-testid="weekly-blocking" className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0 font-semibold leading-5 text-amber-950">{titleOf(b.conceptId)}</span>
                <span className="shrink-0 rounded-lg bg-white px-3 py-2 text-sm font-bold tabular-nums text-amber-950 ring-1 ring-amber-200">{format(ui("studentsCount"), { count: b.studentCount })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="weekly-rechecks">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <h2 id="weekly-rechecks" className="text-lg font-bold tracking-tight text-slate-900">{ui("weeklyRechecks")}</h2>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold tabular-nums text-emerald-950 ring-1 ring-emerald-200">{format(ui("weeklyRecheckCount"), { count: weekly.recheckResults.length })}</span>
        </div>
        {weekly.recheckResults.length === 0 ? empty : (
          <ul className="divide-y divide-slate-100 rounded-2xl bg-white px-4 ring-1 ring-slate-200/80 sm:px-5">
            {weekly.recheckResults.map((r) => {
              const total = r.passed + r.failed;
              return (
                <li key={`${r.conceptId}-${r.taughtAt}`} data-testid="weekly-recheck" className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,0.8fr)] sm:items-center sm:gap-6">
                  <div className="min-w-0 space-y-1">
                    <span className="block font-bold text-slate-900">{titleOf(r.conceptId)}</span>
                    <span className="block text-sm text-slate-600">{format(ui("taughtOn"), { date: date.format(new Date(r.taughtAt)) })}</span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-800">{total === 0 ? ui("waitingForRecheck") : format(ui("passedOf"), { passed: r.passed, total })}</p>
                    {total > 0 && <div role="img" aria-label={format(ui("passedOf"), { passed: r.passed, total })} className="h-2.5 overflow-hidden rounded-full bg-rose-100"><div className="h-full rounded-full bg-emerald-700" style={{ width: `${(r.passed / total) * 100}%` }} /></div>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
