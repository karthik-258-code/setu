import { ancestors } from "@setu/engine";
import type { ClassLevel, Concept } from "@setu/engine";
import { Link } from "react-router-dom";
import { format } from "../i18n/format";
import { L } from "../i18n/l";
import { useLang } from "../i18n/lang-context";
import { StudentGate } from "../student/student-context";
import type { StudentData } from "../student/student-context";

/** Every concept on the path to the launched chapter, by class, with what the student has shown. */
export function StudentProgress() {
  return <StudentGate>{(data) => <ProgressView data={data} />}</StudentGate>;
}

function ProgressView({ data }: { data: StudentData }) {
  const { lang, ui } = useLang();
  const { pack, state, launch } = data;
  const chapter = pack.graph.chapters[launch.chapterId];
  const ids = new Set<string>();
  for (const id of chapter?.conceptIds ?? []) {
    ids.add(id);
    for (const a of ancestors(pack.graph, id)) ids.add(a);
  }
  const concepts = pack.graph.topoOrder
    .filter((id) => ids.has(id))
    .map((id) => pack.graph.concepts[id])
    .filter((c): c is Concept => c !== undefined);
  const levels = [...new Set(concepts.map((c) => c.classLevel))].sort((a, b) => a - b) as ClassLevel[];
  const date = new Intl.DateTimeFormat(lang === "te" ? "te-IN" : "en-IN", {
    day: "numeric",
    month: "long",
  });

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <header className="flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">{ui("myProgress")}</h1>
        <Link to="/s/home" className="min-h-11 py-2 text-brand-800 underline">
          {ui("back")}
        </Link>
      </header>
      {levels.map((level) => (
        <section key={level} className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-600">{format(ui("classOnly"), { level })}</h2>
          <ul className="space-y-2">
            {concepts
              .filter((c) => c.classLevel === level)
              .map((c) => {
                const m = state.mastery[c.id];
                const percent = m ? Math.round(m.pKnown * 100) : null;
                const recheck = state.rechecks
                  .filter((r) => r.conceptId === c.id)
                  .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
                return (
                  <li key={c.id} data-testid="progress-concept" className="space-y-1 rounded-md bg-white p-3 shadow-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span id={`concept-${c.id}`} className="font-medium">
                        <L text={c.title} />
                      </span>
                      <span className="text-sm text-slate-600">
                        {percent === null ? ui("notStarted") : `${percent}%`}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-labelledby={`concept-${c.id}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={percent ?? 0}
                      className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
                    >
                      <div
                        className={`h-full ${m?.masteredAt !== undefined ? "bg-green-600" : "bg-brand-700"}`}
                        style={{ width: `${percent ?? 0}%` }}
                      />
                    </div>
                    {m?.masteredAt !== undefined && (
                      <p className="text-xs text-green-800">
                        {format(ui("masteredOn"), { date: date.format(new Date(m.masteredAt)) })}
                      </p>
                    )}
                    {recheck && (
                      <p className="text-xs text-slate-600">
                        {format(ui("nextCheckOn"), { date: date.format(new Date(recheck.dueAt)) })}
                      </p>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
