import { paperCheckQuestions } from "@setu/engine";
import type { AttemptEvent, Question } from "@setu/engine";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "../data/api";
import { newId } from "../data/ids";
import { format } from "../i18n/format";
import { L } from "../i18n/l";
import { useLang } from "../i18n/lang-context";
import { useClassView } from "../teacher/class-view";
import type { ClassView } from "../teacher/class-view";
import { TeacherGate } from "../teacher/teacher-context";
import { Toast } from "../teacher/toast";

/** Option letters as printed on the paper check (5.5). */
const LETTERS = ["a", "b", "c", "d", "e", "f"];
const RIGHT = "right";
const WRONG = "wrong";

export function TeacherPaperEntry() {
  const { id } = useParams();
  return (
    <TeacherGate>
      <PaperEntryScreen classroomId={id ?? ""} />
    </TeacherGate>
  );
}

function PaperEntryScreen({ classroomId }: { classroomId: string }) {
  const { status } = useClassView(classroomId);
  const { ui } = useLang();
  if (status.kind === "loading") return <p role="status">{ui("loading")}</p>;
  if (status.kind === "error") return <p role="alert">{ui("loadFailed")}</p>;
  if (status.kind === "no-chapter") return <p>{ui("noChapterLaunched")}</p>;
  return <PaperGrid view={status.view} />;
}

/** The marks a box cycles through: blank, right, then each wrong option (or "wrong" for numbers). */
function cycleOf(q: Question): string[] {
  if (q.type === "numeric") return ["", RIGHT, WRONG];
  return ["", RIGHT, ...q.options.filter((o) => !o.isCorrect).map((o) => o.id)];
}

function letterOf(q: Question, optionId: string): string {
  if (q.type !== "mcq") return optionId;
  const i = q.options.findIndex((o) => o.id === optionId);
  return LETTERS[i] ?? optionId;
}

/** Student x question grid for the printed Readiness Check; saves `attempt` events with source paper. */
function PaperGrid({ view }: { view: ClassView }) {
  const { ui } = useLang();
  const launched = view.classroom.launchedChapters;
  const trimmed = launched[launched.length - 1]?.trimmed ?? [];
  const [questions] = useState(() => paperCheckQuestions(view.pack, view.chapterId, trimmed));
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const key = (studentId: string, questionId: string) => `${studentId}|${questionId}`;

  function tap(studentId: string, q: Question) {
    const k = key(studentId, q.id);
    const cycle = cycleOf(q);
    const next = cycle[(cycle.indexOf(marks[k] ?? "") + 1) % cycle.length] ?? "";
    setMarks((m) => ({ ...m, [k]: next }));
  }

  function label(q: Question, mark: string): string {
    if (mark === "") return ui("blankCell");
    if (mark === RIGHT) return ui("rightCell");
    return format(ui("wrongCell"), { option: mark === WRONG ? "" : letterOf(q, mark) }).trim();
  }

  async function save() {
    setBusy(true);
    try {
      const ts = new Date().toISOString();
      const students = new Set<string>();
      let answers = 0;
      for (const row of view.gapMap.rows) {
        for (const q of questions) {
          const mark = marks[key(row.studentId, q.id)] ?? "";
          if (mark === "") continue;
          const wrongOption =
            q.type === "mcq" && mark !== RIGHT ? q.options.find((o) => o.id === mark) : undefined;
          const chosen =
            q.type === "mcq" ? (mark === RIGHT ? q.options.find((o) => o.isCorrect) : wrongOption) : undefined;
          const attempt: AttemptEvent = {
            type: "attempt",
            id: newId(),
            studentId: row.studentId,
            ts,
            questionId: q.id,
            conceptId: q.conceptId,
            mode: "readiness",
            difficulty: q.difficulty,
            correct: mark === RIGHT,
            ...(chosen ? { selectedOptionId: chosen.id } : {}),
            ...(q.type === "numeric" && mark === RIGHT ? { value: q.answer } : {}),
            ...(wrongOption?.misconceptionCode !== undefined
              ? { misconceptionCode: wrongOption.misconceptionCode }
              : {}),
            hintsUsed: 0,
            timeMs: 0,
            source: "paper",
          };
          await apiClient().postTeacherEvent(view.classroom.id, attempt);
          students.add(row.studentId);
          answers += 1;
        }
      }
      setMarks({});
      setToast(format(ui("toastPaper"), { answers, students: students.size }));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const filled = Object.values(marks).some((m) => m !== "");
  const markedCount = Object.values(marks).filter((m) => m !== "").length;
  const totalCount = view.gapMap.rows.length * questions.length;
  const shownMark = (q: Question, mark: string) =>
    mark === "" ? "\u00b7" : mark === RIGHT ? "\u2713" : mark === WRONG ? "\u2717" : letterOf(q, mark);
  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-5 sm:space-y-6">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5 sm:pb-6">
        <div className="min-w-0 space-y-2">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl">{ui("paperEntry")}</h1>
          <p className="text-base font-medium leading-snug text-slate-600 sm:text-lg">
            <L text={view.pack.graph.chapters[view.chapterId]?.title ?? { en: view.chapterId, te: view.chapterId }} />
          </p>
        </div>
        <Link to="/t/classrooms" className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-slate-200 bg-white px-4 font-semibold text-brand-800 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50">
          {ui("back")}
        </Link>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 px-4 py-3 ring-1 ring-brand-100 sm:px-5">
        <p className="max-w-2xl text-sm font-medium leading-6 text-brand-950">{ui("paperEntryHelp")}</p>
        <p aria-live="polite" className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-bold tabular-nums text-brand-950 ring-1 ring-brand-200">
          {format(ui("paperMarksOf"), { marked: markedCount, total: totalCount })}
        </p>
      </div>
      {failed && (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 font-medium text-rose-900">
          {ui("saveFailed")}
        </p>
      )}
      <div className="overflow-x-auto overscroll-x-contain rounded-2xl bg-white shadow-soft ring-1 ring-slate-200/80">
        <table className="min-w-max border-separate border-spacing-x-1 border-spacing-y-1 text-sm" data-testid="paper-grid">
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              <th className="sticky left-0 z-20 min-w-44 rounded-lg bg-slate-50 px-3 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">{ui("student")}</th>
              {questions.map((q, i) => (
                <th key={q.id} scope="col" aria-label={format(ui("questionNumber"), { number: i + 1 })} title={q.id} className="h-12 min-w-12 px-1 text-center font-medium">
                  <span aria-hidden="true" className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-brand-50 px-2 text-xs font-bold tabular-nums text-brand-900 ring-1 ring-brand-100">
                    {i + 1}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.gapMap.rows.map((row) => (
              <tr key={row.studentId} className="group/row">
                <th scope="row" className="sticky left-0 z-[5] min-w-44 whitespace-nowrap rounded-lg bg-white px-3 py-2.5 text-left font-semibold text-slate-900 shadow-[6px_0_12px_-12px_rgba(24,39,29,0.45)] group-hover/row:bg-brand-50">
                  {row.displayName} <span className="text-xs font-medium tabular-nums text-slate-500">#{row.rollNo}</span>
                </th>
                {questions.map((q, i) => {
                  const mark = marks[key(row.studentId, q.id)] ?? "";
                  return (
                    <td key={q.id} className="p-0.5">
                      <button
                        type="button"
                        aria-label={`${row.displayName}, ${i + 1}: ${label(q, mark)}`}
                        onClick={() => tap(row.studentId, q)}
                        className={`h-11 w-11 rounded-lg border text-sm font-bold tabular-nums transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-1 ${mark === RIGHT ? "border-emerald-700 bg-emerald-100 text-emerald-950" : mark === "" ? "border-slate-300 bg-slate-50 text-slate-500" : "border-rose-700 bg-rose-100 text-rose-950"}`}
                      >
                        {shownMark(q, mark)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-700" aria-label={ui("paperEntry")}>
        {[
          { key: "blankLegend" as const, mark: "·", tone: "border-slate-300 bg-slate-50 text-slate-500" },
          { key: "correctLegend" as const, mark: "✓", tone: "border-emerald-700 bg-emerald-100 text-emerald-950" },
          { key: "wrongLegend" as const, mark: "×", tone: "border-rose-700 bg-rose-100 text-rose-950" },
        ].map((item) => (
          <li key={item.key} className="inline-flex items-center gap-2">
            <span aria-hidden="true" className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-sm ${item.tone}`}>{item.mark}</span>
            {ui(item.key)}
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={busy || !filled}
        onClick={() => void save()}
        className="min-h-12 rounded-xl bg-brand-800 px-5 font-semibold text-white shadow-sm transition hover:bg-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {ui("savePaper")}
      </button>
      <Toast message={toast} />
    </div>
  );
}
