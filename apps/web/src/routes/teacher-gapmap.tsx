import type { GapMapRow } from "@setu/engine";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "../i18n/format";
import { L } from "../i18n/l";
import { useLang } from "../i18n/lang-context";
import { useClassView } from "../teacher/class-view";
import type { ClassView } from "../teacher/class-view";
import { EvidenceDrawer } from "../teacher/evidence-drawer";
import { LEGEND, masteryColour } from "../teacher/mastery-colour";
import { TeacherGate } from "../teacher/teacher-context";

export function TeacherGapMap() {
  const { id } = useParams();
  return (
    <TeacherGate>
      <GapMapScreen classroomId={id ?? ""} />
    </TeacherGate>
  );
}

function GapMapScreen({ classroomId }: { classroomId: string }) {
  const { status } = useClassView(classroomId);
  const { ui } = useLang();
  if (status.kind === "loading") return <p role="status">{ui("loading")}</p>;
  if (status.kind === "error") return <p role="alert">{ui("loadFailed")}</p>;
  if (status.kind === "no-chapter") return <p>{ui("noChapterLaunched")}</p>;
  return <GapMapTable view={status.view} />;
}

function GapMapTable({ view }: { view: ClassView }) {
  const { ui } = useLang();
  const { pack, gapMap, classroom } = view;
  const [selected, setSelected] = useState<{ row: GapMapRow; conceptId: string } | null>(null);
  const { prerequisites, chapter } = gapMap.columns;
  const columns = [...prerequisites, ...chapter];
  const chapterInfo = pack.graph.chapters[view.chapterId];

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">
            {ui("gapMap")}
          </h1>
          {chapterInfo && <p className="text-base font-medium leading-snug text-slate-600 sm:text-lg"><L text={chapterInfo.title} /></p>}
        </div>
        <Link to="/t/classrooms" className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-slate-200 bg-white px-4 font-semibold text-brand-800 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50">
          {ui("back")}
        </Link>
      </header>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl bg-white px-4 py-3 shadow-soft sm:px-5">
        <p className="text-sm font-semibold text-slate-700">{ui("masteryLegend")}</p>
        <ul className="flex flex-wrap gap-2.5 text-xs font-semibold" aria-label="legend">
          {LEGEND.map((item) => (
            <li key={item.label} className="flex min-h-9 items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-slate-800">
              <span aria-hidden="true" className={`h-3.5 w-3.5 rounded-sm ${masteryColour(item.pKnown)}`} />
              {item.pKnown === null ? ui("notStarted") : item.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="overflow-x-auto overscroll-x-contain rounded-2xl bg-white shadow-soft ring-1 ring-slate-200/80">
        <table className="min-w-full border-separate border-spacing-1.5 text-sm" data-testid="gapmap" data-classroom={classroom.id}>
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              <th className="sticky left-0 z-20 min-w-44 bg-slate-50" />
              {prerequisites.length > 0 && (
                <th colSpan={prerequisites.length} className="rounded-lg bg-slate-50 px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">
                  {ui("prerequisites")}
                </th>
              )}
              <th colSpan={chapter.length} className="rounded-lg bg-brand-100 px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-brand-800">
                {ui("thisChapter")}
              </th>
            </tr>
            <tr>
              <th className="sticky left-0 z-20 min-w-44 bg-slate-50 px-3 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">{ui("student")}</th>
              {columns.map((conceptId, i) => {
                const concept = pack.graph.concepts[conceptId];
                return (
                  <th
                    key={conceptId}
                    scope="col"
                    title={conceptId}
                    className={`max-w-32 min-w-24 rounded-lg bg-slate-50 px-2.5 py-3 text-left align-bottom text-xs font-semibold leading-snug text-slate-700 ${i === prerequisites.length ? "bg-brand-50" : ""}`}
                  >
                    {concept ? <L text={concept.title} /> : conceptId}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {gapMap.rows.map((row) => (
              <tr key={row.studentId} className="group/row">
                {(() => {
                  const values = columns.map((conceptId) => row.mastery[conceptId] ?? null);
                  const seen = values.filter((value) => value !== null).length;
                  const progressLabel = format(ui("conceptsWithEvidence"), { seen, total: columns.length });
                  return (
                    <th scope="row" className="sticky left-0 z-[5] min-w-44 bg-white px-3 py-2.5 text-left shadow-[6px_0_12px_-12px_rgba(24,39,29,0.45)] group-hover/row:bg-brand-50">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          to={`/t/classrooms/${encodeURIComponent(classroom.id)}/students/${encodeURIComponent(row.studentId)}`}
                          className="min-w-0 truncate font-bold text-brand-800 underline decoration-brand-200 underline-offset-2 hover:decoration-brand-700"
                        >
                          {row.displayName}
                        </Link>
                        <span className="shrink-0 text-xs font-medium tabular-nums text-slate-500">#{row.rollNo}</span>
                      </div>
                      <div role="img" aria-label={progressLabel} className="mt-2">
                        <div aria-hidden="true" className="flex gap-0.5">
                          {values.map((value, index) => (
                            <span key={`${columns[index]}-${index}`} className={`h-3.5 min-w-1 flex-1 rounded-[2px] ${masteryColour(value)}`} />
                          ))}
                        </div>
                        <span className="mt-1 block text-[10px] font-semibold tabular-nums text-slate-600">{seen}/{columns.length}</span>
                      </div>
                    </th>
                  );
                })()}
                {columns.map((conceptId, i) => {
                  const p = row.mastery[conceptId] ?? null;
                  const root = row.rootCauseGap === conceptId;
                  const shown = p === null ? "\u2013" : `${Math.round(p * 100)}`;
                  return (
                    <td key={conceptId} className={`p-0.5 ${i === prerequisites.length ? "border-l-2 border-l-brand-600" : ""}`}>
                      <button
                        type="button"
                        data-testid={`cell-${row.studentId}-${conceptId}`}
                        aria-label={`${row.displayName}, ${conceptId}: ${p === null ? ui("notStarted") : `${shown}%`}${root ? `, ${ui("rootGap")}` : ""}`}
                        onClick={() => setSelected({ row, conceptId })}
                        className={`h-12 min-w-14 rounded-lg border border-white/80 text-xs font-bold tabular-nums shadow-sm transition hover:brightness-95 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-brand-700 ${masteryColour(p)} ${root ? "ring-2 ring-rose-800 ring-offset-1" : ""}`}
                      >
                        {shown}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <EvidenceDrawer
          classroomId={classroom.id}
          pack={pack}
          studentId={selected.row.studentId}
          studentName={selected.row.displayName}
          conceptId={selected.conceptId}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
