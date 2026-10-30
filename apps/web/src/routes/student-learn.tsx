import type { Resource } from "@setu/engine";
import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { currentSessionId } from "../data/session";
import { L } from "../i18n/l";
import { useLang } from "../i18n/lang-context";
import { translate } from "../i18n/translate";
import type { UiLang } from "../i18n/translate";
import { Markdown } from "../student/markdown";
import { recommend } from "../student/recommend";
import { StudentGate, useStudent } from "../student/student-context";
import type { StudentData } from "../student/student-context";

/** The explanation or targeted worked example the policy chose, then on to practice. */
export function StudentLearn() {
  const { conceptId } = useParams();
  return (
    <StudentGate>{(data) => <LearnView data={data} conceptId={conceptId ?? ""} />}</StudentGate>
  );
}

function chosenResource(data: StudentData, now: Date, conceptId: string): Resource | null {
  const rec = recommend(data.pack, data.state, data.launch.chapterId, now, currentSessionId());
  if (rec.mode !== "learn" || rec.conceptId !== conceptId) return null;
  return data.pack.resources.find((r) => r.id === rec.resourceId) ?? null;
}

function LearnView({ data, conceptId }: { data: StudentData; conceptId: string }) {
  const { now, record } = useStudent();
  const { lang, ui } = useLang();
  const navigate = useNavigate();
  const [resource] = useState(() => chosenResource(data, now(), conceptId));
  const [shown, setShown] = useState<UiLang>(lang);
  const [busy, setBusy] = useState(false);

  if (!resource) return <Navigate to="/s/home" replace />;
  const concept = data.pack.graph.concepts[resource.conceptId];
  const body = translate(resource.body, shown);
  const hasTelugu = resource.body.te !== undefined && resource.body.te.trim() !== "";

  async function understood() {
    if (!resource || busy) return;
    setBusy(true);
    try {
      await record({
        type: "learn_viewed",
        studentId: data.profile.studentId,
        conceptId: resource.conceptId,
        resourceId: resource.id,
      });
      navigate("/s/home");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      {concept && (
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          <L text={concept.title} />
        </h1>
      )}
      {hasTelugu && (
        <button
          type="button"
          onClick={() => setShown(shown === "te" ? "en" : "te")}
          className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm"
        >
          {ui(shown === "te" ? "readInEnglish" : "readInTelugu")}
        </button>
      )}
      <article data-testid="learn-body" lang={body.fallback ? "en" : shown} className="rounded-2xl border border-slate-200 bg-white p-5 text-base leading-7 shadow-soft sm:p-6">
        {body.fallback && (
          <span
            data-testid="english-only"
            className="mb-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900"
          >
            {ui("englishOnly")}
          </span>
        )}
        <Markdown text={body.text} />
        {resource.diagramSvg !== undefined && (
          <img
            src={`data:image/svg+xml;utf8,${encodeURIComponent(resource.diagramSvg)}`}
            alt=""
            className="mx-auto mt-3 max-h-56"
          />
        )}
      </article>
      <button
        type="button"
        disabled={busy}
        onClick={() => void understood()}
        className="min-h-12 w-full rounded-xl bg-brand-700 text-lg font-semibold text-white disabled:opacity-50"
      >
        {ui("understood")}
      </button>
    </div>
  );
}
