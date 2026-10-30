import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "../i18n/format";
import { useLang } from "../i18n/lang-context";
import { useClassView } from "../teacher/class-view";
import type { ClassView } from "../teacher/class-view";
import { TeacherGate, useTeacher } from "../teacher/teacher-context";
import { postForStudents } from "../teacher/teacher-events";
import type { TeacherEventDraft } from "../teacher/teacher-events";
import { Toast } from "../teacher/toast";

export function TeacherStudent() {
  const { id, sid } = useParams();
  return (
    <TeacherGate>
      <StudentScreen classroomId={id ?? ""} studentId={sid ?? ""} />
    </TeacherGate>
  );
}

function StudentScreen({ classroomId, studentId }: { classroomId: string; studentId: string }) {
  const { status } = useClassView(classroomId);
  const { ui } = useLang();
  if (status.kind === "loading") return <p role="status">{ui("loading")}</p>;
  if (status.kind === "error") return <p role="alert">{ui("loadFailed")}</p>;
  if (status.kind === "no-chapter") return <p>{ui("noChapterLaunched")}</p>;
  return <StudentActions view={status.view} studentId={studentId} />;
}

/** Override with a note, assign and the extension lock for one student. */
function StudentActions({ view, studentId }: { view: ClassView; studentId: string }) {
  const { teacherId } = useTeacher();
  const { ui, t } = useLang();
  const { pack, gapMap } = view;
  const columns = [...gapMap.columns.prerequisites, ...gapMap.columns.chapter];
  const row = gapMap.rows.find((r) => r.studentId === studentId);
  const [conceptId, setConceptId] = useState(columns[0] ?? "");
  const [mastered, setMastered] = useState(true);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  if (!row) return <p role="alert">{ui("loadFailed")}</p>;
  const name = row.displayName;
  const concept = pack.graph.concepts[conceptId];
  const title = concept ? t(concept.title).text : conceptId;

  async function act(draft: TeacherEventDraft, message: string) {
    try {
      await postForStudents(view.classroom.id, teacherId, [studentId], draft);
      setToast(message);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  function saveOverride(event: FormEvent) {
    event.preventDefault();
    const trimmed = note.trim();
    void act(
      {
        type: "teacher_override",
        conceptId,
        mastered,
        ...(trimmed !== "" ? { note: trimmed } : {}),
      },
      format(ui(mastered ? "toastOverrideMastered" : "toastOverrideNot"), { name, concept: title }),
    );
  }

  const button = "min-h-11 rounded-xl border border-slate-300 px-3";
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <header className="flex items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {name} <span className="text-sm text-slate-500">#{row.rollNo}</span>
        </h1>
        <Link
          to={`/t/classrooms/${encodeURIComponent(view.classroom.id)}/gapmap`}
          className="min-h-11 py-2 text-brand-800 underline"
        >
          {ui("back")}
        </Link>
      </header>
      {failed && (
        <p role="alert" className="text-red-700">
          {ui("saveFailed")}
        </p>
      )}
      <label className="block space-y-1">
        <span className="font-medium">{ui("concept")}</span>
        <select
          value={conceptId}
          onChange={(e) => setConceptId(e.target.value)}
          className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-2"
        >
          {columns.map((id) => {
            const c = pack.graph.concepts[id];
            return (
              <option key={id} value={id}>
                {c ? t(c.title).text : id}
              </option>
            );
          })}
        </select>
      </label>
      <form onSubmit={saveOverride} className="space-y-3 rounded-xl bg-white p-4 shadow-soft">
        <h2 className="font-semibold">{ui("override")}</h2>
        <label className="flex min-h-11 items-center gap-2">
          <input type="radio" name="override" checked={mastered} onChange={() => setMastered(true)} />
          {ui("markMastered")}
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input type="radio" name="override" checked={!mastered} onChange={() => setMastered(false)} />
          {ui("markNotMastered")}
        </label>
        <label className="block space-y-1">
          <span>{ui("note")}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-300 px-2 py-1"
          />
        </label>
        <button type="submit" disabled={conceptId === ""} className={`${button} bg-brand-700 text-white`}>
          {ui("saveOverride")}
        </button>
      </form>
      <button
        type="button"
        disabled={conceptId === ""}
        onClick={() =>
          void act({ type: "assign", conceptId }, format(ui("toastAssigned"), { concept: title, count: 1 }))
        }
        className={button}
      >
        {ui("assign")}
      </button>
      <section className="space-y-2">
        <h2 className="font-semibold">{ui("extension")}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              void act({ type: "extension_lock", locked: true }, format(ui("toastLocked"), { name }))
            }
            className={button}
          >
            {ui("lockExtension")}
          </button>
          <button
            type="button"
            onClick={() =>
              void act({ type: "extension_lock", locked: false }, format(ui("toastUnlocked"), { name }))
            }
            className={button}
          >
            {ui("unlockExtension")}
          </button>
        </div>
      </section>
      <Toast message={toast} />
    </div>
  );
}
