import { chapterExternalPrereqs, paperCheckQuestions } from "@setu/engine";
import type { Chapter, ContentPack, Question } from "@setu/engine";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "../data/api";
import { DEFAULT_LAUNCH } from "../data/launch";
import { format } from "../i18n/format";
import { L } from "../i18n/l";
import { useLang } from "../i18n/lang-context";
import { TeacherGate } from "../teacher/teacher-context";
import { Toast } from "../teacher/toast";

/** Classes whose chapters a teacher can launch in v0.1 (BUILD_PLAN 5.5). */
const LAUNCH_CLASSES = [7, 8, 9, 10] as const;
const LETTERS = ["a", "b", "c", "d", "e", "f"];

export function TeacherLaunch() {
  const { id } = useParams();
  return (
    <TeacherGate>
      <LaunchScreen classroomId={id ?? ""} />
    </TeacherGate>
  );
}

function LaunchScreen({ classroomId }: { classroomId: string }) {
  const { ui, t } = useLang();
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [pack, setPack] = useState<ContentPack | null>(null);
  const [trimmed, setTrimmed] = useState<string[]>([]);
  const [paper, setPaper] = useState<Question[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // The chapter list comes from the graph in the classroom's current pack.
  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const client = apiClient();
        const classroom = (await client.getClassrooms()).find((c) => c.id === classroomId);
        const launched = classroom?.launchedChapters ?? [];
        const current = launched[launched.length - 1]?.chapterId ?? DEFAULT_LAUNCH.chapterId;
        const currentPack = await client.getPack(current);
        const list = Object.values(currentPack.graph.chapters)
          .filter((c) => (LAUNCH_CLASSES as readonly number[]).includes(c.classLevel))
          .sort((a, b) => a.classLevel - b.classLevel || a.id.localeCompare(b.id));
        if (live) {
          setChapters(list);
          setChapterId(current);
        }
      } catch {
        if (live) setFailed(true);
      }
    };
    void load();
    return () => {
      live = false;
    };
  }, [classroomId]);

  // The selected chapter's own pack holds its prerequisites' questions.
  useEffect(() => {
    if (chapterId === null) return;
    let live = true;
    setPack(null);
    setTrimmed([]);
    setPaper(null);
    apiClient()
      .getPack(chapterId)
      .then((p) => {
        if (live) setPack(p);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [chapterId]);

  if (failed) return <p role="alert">{ui("loadFailed")}</p>;
  if (chapters === null) return <p role="status">{ui("loading")}</p>;

  const chapter = chapterId === null ? undefined : pack?.graph.chapters[chapterId];
  const chapterTitle = chapter ? t(chapter.title).text : (chapterId ?? "");
  const prereqs = pack && chapterId !== null ? chapterExternalPrereqs(pack.graph, chapterId) : [];

  async function launch() {
    if (chapterId === null) return;
    try {
      await apiClient().launchChapter(classroomId, { chapterId, trimmed });
      setToast(format(ui("toastLaunched"), { chapter: chapterTitle }));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  const button = "min-h-11 rounded-xl border px-3";
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <header className="flex items-baseline justify-between gap-2 print:hidden">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{ui("launchChapter")}</h1>
        <Link to="/t/classrooms" className="min-h-11 py-2 text-brand-800 underline">
          {ui("back")}
        </Link>
      </header>
      <fieldset className="space-y-3 print:hidden">
        <legend className="font-medium">{ui("chooseChapter")}</legend>
        {LAUNCH_CLASSES.map((level) => {
          const ofClass = chapters.filter((c) => c.classLevel === level);
          if (ofClass.length === 0) return null;
          return (
            <div key={level} className="space-y-1">
              <h2 className="text-sm font-semibold text-slate-600">{format(ui("classOnly"), { level })}</h2>
              {ofClass.map((c) => (
                <label key={c.id} className="flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 shadow-soft">
                  <input
                    type="radio"
                    name="chapter"
                    value={c.id}
                    checked={chapterId === c.id}
                    onChange={() => setChapterId(c.id)}
                  />
                  <L text={c.title} />
                </label>
              ))}
            </div>
          );
        })}
      </fieldset>
      {pack === null ? (
        <p role="status" className="print:hidden">{ui("loading")}</p>
      ) : (
        <section className="space-y-2 print:hidden">
          <h2 className="font-semibold">{ui("prerequisites")}</h2>
          <p className="text-sm text-slate-600">{ui("prereqHelp")}</p>
          {prereqs.length === 0 && <p>{ui("noPrereqs")}</p>}
          <ul className="space-y-1">
            {prereqs.map((id) => {
              const c = pack.graph.concepts[id];
              return (
                <li key={id}>
                  <label className="flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!trimmed.includes(id)}
                      onChange={(e) =>
                        setTrimmed((now) =>
                          e.target.checked ? now.filter((x) => x !== id) : [...now, id],
                        )
                      }
                    />
                    {c ? <L text={c.title} /> : id}
                    {c && <span className="text-xs text-slate-500">({format(ui("classOnly"), { level: c.classLevel })})</span>}
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void launch()}
              className={`${button} border-brand-700 bg-brand-700 font-semibold text-white`}
            >
              {ui("launch")}
            </button>
            <button
              type="button"
              onClick={() => chapterId !== null && setPaper(paperCheckQuestions(pack, chapterId, trimmed))}
              className={`${button} border-slate-300`}
            >
              {ui("printPaperCheck")}
            </button>
          </div>
        </section>
      )}
      {paper !== null && pack !== null && (
        <article data-testid="paper-check" className="space-y-3 rounded-xl bg-white p-4 shadow-soft print:shadow-none">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{format(ui("paperCheckTitle"), { chapter: chapterTitle })}</h2>
            <button type="button" onClick={() => window.print()} className={`${button} border-slate-300 print:hidden`}>
              {ui("print")}
            </button>
          </div>
          <p>{ui("nameRollLine")}</p>
          <ol className="list-decimal space-y-3 pl-6">
            {paper.map((q) => (
              <li key={q.id} data-testid="paper-question" className="break-inside-avoid">
                <L text={q.stem} />
                {q.type === "mcq" ? (
                  <ul className="mt-1 space-y-0.5">
                    {q.options.map((o, i) => (
                      <li key={o.id}>
                        ({LETTERS[i] ?? o.id}) <L text={o.text} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1">________</p>
                )}
              </li>
            ))}
          </ol>
        </article>
      )}
      <Toast message={toast} />
    </div>
  );
}
