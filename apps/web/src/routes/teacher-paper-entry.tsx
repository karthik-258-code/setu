import { paperCheckQuestions } from "@setu/engine";
import type { AttemptEvent, Question } from "@setu/engine";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "../data/api";
import { newId } from "../data/ids";
import { format } from "../i18n/format";
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
  const shownMark = (q: Question, mark: string) =>
    mark === "" ? "\u00b7" : mark === RIGHT ? "\u2713" : mark === WRONG ? "\u2717" : letterOf(q, mark);
  return (
    <div className="space-y-3">
      <header className="flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">{ui("paperEntry")}</h1>
        <Link to="/t/classrooms" className="min-h-11 py-2 text-brand-800 underline">
          {ui("back")}
        </Link>
      </header>
      <p className="text-sm text-slate-600">{ui("paperEntryHelp")}</p>
      {failed && (
        <p role="alert" className="text-red-700">
          {ui("saveFailed")}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="border-collapse text-sm" data-testid="paper-grid">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left">{ui("student")}</th>
              {questions.map((q, i) => (
                <th key={q.id} scope="col" title={q.id} className="px-1 py-1 text-center font-medium">
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.gapMap.rows.map((row) => (
              <tr key={row.studentId} className="border-t border-slate-100">
                <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1 text-left font-medium">
                  {row.displayName} <span className="text-xs text-slate-500">#{row.rollNo}</span>
                </th>
                {questions.map((q, i) => {
                  const mark = marks[key(row.studentId, q.id)] ?? "";
                  return (
                    <td key={q.id} className="p-0.5">
                      <button
                        type="button"
                        aria-label={`${row.displayName}, ${i + 1}: ${label(q, mark)}`}
                        onClick={() => tap(row.studentId, q)}
                        className={`h-10 w-10 rounded border text-sm ${mark === RIGHT ? "border-green-600 bg-green-100" : mark === "" ? "border-slate-300" : "border-red-500 bg-red-100"}`}
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
      <button
        type="button"
        disabled={busy || !filled}
        onClick={() => void save()}
        className="min-h-12 rounded-md bg-brand-700 px-4 font-semibold text-white disabled:opacity-50"
      >
        {ui("savePaper")}
      </button>
      <Toast message={toast} />
    </div>
  );
}
