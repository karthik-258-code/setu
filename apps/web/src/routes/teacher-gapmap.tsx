import type { GapMapRow } from "@setu/engine";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
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
    <div className="space-y-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">
          {ui("gapMap")}
          {chapterInfo && (
            <>
              {" · "}
              <L text={chapterInfo.title} />
            </>
          )}
        </h1>
        <Link to="/t/classrooms" className="min-h-11 py-2 text-brand-800 underline">
          {ui("back")}
        </Link>
      </header>
      <ul className="flex flex-wrap gap-2 text-xs" aria-label="legend">
        {LEGEND.map((item) => (
          <li key={item.label} className={`rounded px-2 py-1 ${masteryColour(item.pKnown)}`}>
            {item.pKnown === null ? ui("notStarted") : item.label}
          </li>
        ))}
      </ul>
      <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="border-collapse text-sm" data-testid="gapmap" data-classroom={classroom.id}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white" />
              {prerequisites.length > 0 && (
                <th colSpan={prerequisites.length} className="border-b px-2 py-1 text-left text-slate-600">
                  {ui("prerequisites")}
                </th>
              )}
              <th colSpan={chapter.length} className="border-b border-l-2 border-l-slate-400 px-2 py-1 text-left text-slate-600">
                {ui("thisChapter")}
              </th>
            </tr>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left">{ui("student")}</th>
              {columns.map((conceptId, i) => {
                const concept = pack.graph.concepts[conceptId];
                return (
                  <th
                    key={conceptId}
                    scope="col"
                    title={conceptId}
                    className={`max-w-24 px-1 py-1 text-left align-bottom text-xs font-medium ${i === prerequisites.length ? "border-l-2 border-l-slate-400" : ""}`}
                  >
                    {concept ? <L text={concept.title} /> : conceptId}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {gapMap.rows.map((row) => (
              <tr key={row.studentId} className="border-t border-slate-100">
                <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1 text-left font-medium">
                  <Link
                    to={`/t/classrooms/${encodeURIComponent(classroom.id)}/students/${encodeURIComponent(row.studentId)}`}
                    className="text-brand-800 underline"
                  >
                    {row.displayName}
                  </Link>{" "}
                  <span className="text-xs text-slate-500">#{row.rollNo}</span>
                </th>
                {columns.map((conceptId, i) => {
                  const p = row.mastery[conceptId] ?? null;
                  const root = row.rootCauseGap === conceptId;
                  const shown = p === null ? "\u2013" : `${Math.round(p * 100)}`;
                  return (
                    <td key={conceptId} className={`p-0.5 ${i === prerequisites.length ? "border-l-2 border-l-slate-400" : ""}`}>
                      <button
                        type="button"
                        data-testid={`cell-${row.studentId}-${conceptId}`}
                        aria-label={`${row.displayName}, ${conceptId}: ${p === null ? ui("notStarted") : `${shown}%`}${root ? `, ${ui("rootGap")}` : ""}`}
                        onClick={() => setSelected({ row, conceptId })}
                        className={`h-10 w-12 rounded text-xs ${masteryColour(p)} ${root ? "ring-2 ring-red-700" : ""}`}
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
