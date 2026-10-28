import type { WeeklyView } from "@setu/engine";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "../data/api";
import { format } from "../i18n/format";
import { useLang } from "../i18n/lang-context";
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

  if (failed) return <p role="alert">{ui("loadFailed")}</p>;
  if (weekly === null) return <p role="status">{ui("loading")}</p>;

  const names = new Map(view.gapMap.rows.map((r) => [r.studentId, r.displayName]));
  const titleOf = (conceptId: string) => {
    const c = view.pack.graph.concepts[conceptId];
    return c ? t(c.title).text : conceptId;
  };
  const date = new Intl.DateTimeFormat(lang === "te" ? "te-IN" : "en-IN", { day: "numeric", month: "long" });
  const empty = <p className="text-sm text-slate-600">{ui("nothingYet")}</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">
          {ui("weekly")}{" "}
          <span className="text-sm font-normal text-slate-600">
            {date.format(new Date(weekly.from))} – {date.format(new Date(weekly.to))}
          </span>
        </h1>
        <Link to="/t/classrooms" className="min-h-11 py-2 text-brand-800 underline">
          {ui("back")}
        </Link>
      </header>

      <section className="space-y-2" aria-labelledby="weekly-moved">
        <h2 id="weekly-moved" className="font-semibold">{ui("weeklyMoved")}</h2>
        {weekly.moved.length === 0 ? (
          empty
        ) : (
          <ul className="space-y-1">
            {weekly.moved.map((m) => (
              <li key={`${m.studentId}-${m.fromGroupId}-${m.toGroupId}`} className="rounded-md bg-white px-3 py-2 shadow-sm">
                <span className="font-medium">{names.get(m.studentId) ?? m.studentId}</span>: {m.fromGroupId} →{" "}
                {m.toGroupId}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2" aria-labelledby="weekly-blocking">
        <h2 id="weekly-blocking" className="font-semibold">{ui("weeklyBlocking")}</h2>
        {weekly.blockingConcepts.length === 0 ? (
          empty
        ) : (
          <ul className="space-y-1">
            {weekly.blockingConcepts.map((b) => (
              <li
                key={b.conceptId}
                data-testid="weekly-blocking"
                className="flex justify-between gap-2 rounded-md bg-white px-3 py-2 shadow-sm"
              >
                <span>{titleOf(b.conceptId)}</span>
                <span className="text-sm text-slate-600">{format(ui("studentsCount"), { count: b.studentCount })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2" aria-labelledby="weekly-rechecks">
        <h2 id="weekly-rechecks" className="font-semibold">{ui("weeklyRechecks")}</h2>
        {weekly.recheckResults.length === 0 ? (
          empty
        ) : (
          <ul className="space-y-1">
            {weekly.recheckResults.map((r) => {
              const total = r.passed + r.failed;
              return (
                <li
                  key={`${r.conceptId}-${r.taughtAt}`}
                  data-testid="weekly-recheck"
                  className="space-y-1 rounded-md bg-white px-3 py-2 shadow-sm"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{titleOf(r.conceptId)}</span>
                    <span className="text-sm text-slate-600">
                      {format(ui("taughtOn"), { date: date.format(new Date(r.taughtAt)) })}
                    </span>
                  </div>
                  <p className="text-sm">{format(ui("passedOf"), { passed: r.passed, total })}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
