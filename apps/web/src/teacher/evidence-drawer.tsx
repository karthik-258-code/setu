import type { AttemptEvent, ContentPack } from "@setu/engine";
import { useEffect, useState } from "react";
import { apiClient } from "../data/api";
import { L } from "../i18n/l";
import { useLang } from "../i18n/lang-context";

/** The answer a student gave: the chosen option's text, or the number typed. */
function ChosenAnswer({ pack, attempt }: { pack: ContentPack; attempt: AttemptEvent }) {
  const question = pack.questions.find((q) => q.id === attempt.questionId);
  if (question?.type === "mcq" && attempt.selectedOptionId !== undefined) {
    const option = question.options.find((o) => o.id === attempt.selectedOptionId);
    if (option) return <L text={option.text} />;
  }
  if (attempt.value !== undefined) return <span>{attempt.value}</span>;
  return <span>{attempt.selectedOptionId ?? "\u2013"}</span>;
}

/** Attempts, chosen answers and misconception labels behind one Gap Map cell. */
export function EvidenceDrawer({
  classroomId,
  pack,
  studentId,
  studentName,
  conceptId,
  onClose,
}: {
  classroomId: string;
  pack: ContentPack;
  studentId: string;
  studentName: string;
  conceptId: string;
  onClose: () => void;
}) {
  const { ui } = useLang();
  const [attempts, setAttempts] = useState<AttemptEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const concept = pack.graph.concepts[conceptId];

  useEffect(() => {
    let live = true;
    setAttempts(null);
    apiClient()
      .getEvidence(classroomId, studentId, conceptId)
      .then((list) => {
        if (live) setAttempts([...list].sort((a, b) => b.ts.localeCompare(a.ts)));
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [classroomId, studentId, conceptId]);

  return (
    <>
    {/* Dims the Gap Map and sits above its sticky column; tapping it closes the drawer. */}
    <div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-30 bg-slate-900/40" />
    <aside
      role="dialog"
      aria-label={ui("evidence")}
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-h-[75vh] max-w-2xl space-y-3 overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-white p-4 shadow-2xl"
    >
      <div aria-hidden="true" className="mx-auto h-1.5 w-12 rounded-full bg-slate-300" />
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{studentName}</h2>
          {concept && (
            <p className="text-slate-700">
              <L text={concept.title} />
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} className="min-h-11 px-3 text-brand-800 underline">
          {ui("close")}
        </button>
      </header>
      {failed && <p role="alert">{ui("loadFailed")}</p>}
      {!failed && attempts === null && <p role="status">{ui("loading")}</p>}
      {attempts?.length === 0 && <p>{ui("noAttempts")}</p>}
      <ol className="space-y-2">
        {attempts?.map((a) => {
          const question = pack.questions.find((q) => q.id === a.questionId);
          const misconception =
            a.misconceptionCode === undefined ? undefined : pack.misconceptions[a.misconceptionCode];
          return (
            <li key={a.id} data-testid="evidence-attempt" className="space-y-1 rounded-xl border border-slate-200 p-3">
              <p className="text-sm text-slate-600">
                {a.mode} · {a.ts.slice(0, 10)}
              </p>
              {question && (
                <p>
                  <L text={question.stem} />
                </p>
              )}
              <p>
                {ui("answered")}: <ChosenAnswer pack={pack} attempt={a} />{" "}
                <span className={a.correct ? "text-green-800" : "text-red-800"}>
                  ({ui(a.correct ? "rightMark" : "wrongMark")})
                </span>
              </p>
              {misconception && (
                <p className="rounded bg-amber-100 px-2 py-1 text-sm text-amber-900">
                  <L text={misconception.label} />
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </aside>
    </>
  );
}
