import {
  READINESS_MAX_ITEMS,
  mulberry32,
  nextReadinessQuestion,
  readinessSummary,
  recordReadinessAnswer,
  startReadiness,
} from "@setu/engine";
import type { AttemptEvent, ReadinessSession, ReadinessSummary } from "@setu/engine";
import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import type { NewEvent } from "../data/event-store";
import { newId } from "../data/ids";
import { currentSessionId } from "../data/session";
import { format } from "../i18n/format";
import { useLang } from "../i18n/lang-context";
import { grade } from "../student/answer";
import type { Answer } from "../student/answer";
import { QuestionCard } from "../student/question-card";
import { recommend, seedFrom } from "../student/recommend";
import { StudentGate, useStudent } from "../student/student-context";
import type { StudentData } from "../student/student-context";

/** The Chapter Readiness Check (ARCHITECTURE 5.3), run by the engine one question at a time. */
export function StudentReadiness() {
  const { chapterId } = useParams();
  return (
    <StudentGate>
      {(data) => <ReadinessRunner data={data} chapterId={chapterId ?? data.launch.chapterId} />}
    </StudentGate>
  );
}

interface Finished {
  summary: ReadinessSummary;
  nextConceptId?: string;
}

function ReadinessRunner({ data, chapterId }: { data: StudentData; chapterId: string }) {
  const { now, record } = useStudent();
  const { ui, t } = useLang();
  const navigate = useNavigate();
  const { pack, profile } = data;
  const [alreadyDone] = useState(() => data.state.readiness[chapterId] !== undefined);
  const [rng] = useState(() =>
    mulberry32(seedFrom(`${profile.studentId}:${currentSessionId()}:readiness:${chapterId}`)),
  );
  const [step, setStep] = useState(() => {
    const trimmed = chapterId === data.launch.chapterId ? data.launch.trimmed : [];
    return nextReadinessQuestion(pack, startReadiness(pack, data.state, chapterId, trimmed), rng);
  });
  const [finished, setFinished] = useState<Finished | null>(null);
  const [busy, setBusy] = useState(false);
  const shownAt = useRef(now());
  const finishing = useRef(false);

  async function finish(session: ReadinessSession) {
    if (finishing.current) return;
    finishing.current = true;
    const summary = readinessSummary(session, now().toISOString());
    const state = await record({
      type: "readiness_completed",
      studentId: profile.studentId,
      chapterId,
      summary,
    });
    const rec = recommend(pack, state, data.launch.chapterId, now(), currentSessionId());
    setFinished({ summary, ...(rec.conceptId !== undefined ? { nextConceptId: rec.conceptId } : {}) });
  }

  // A check with nothing to ask (no prerequisites with questions) completes straight away.
  useEffect(() => {
    if (!alreadyDone && step.question === null) void finish(step.session);
  });

  if (alreadyDone && finished === null) return <Navigate to="/s/home" replace />;

  async function answer(given: Answer) {
    const { session, question } = step;
    const current = session.current;
    if (busy || !question || !current) return;
    setBusy(true);
    try {
      const graded = grade(question, given);
      const draft: Extract<NewEvent, { type: "attempt" }> = {
        type: "attempt",
        studentId: profile.studentId,
        questionId: question.id,
        conceptId: current.conceptId,
        mode: "readiness",
        difficulty: question.difficulty,
        ...graded,
        hintsUsed: 0,
        timeMs: Math.max(0, now().getTime() - shownAt.current.getTime()),
        source: "device",
      };
      const attempt: AttemptEvent = { ...draft, id: newId(), ts: now().toISOString() };
      const after = recordReadinessAnswer(pack, session, attempt);
      await record(draft);
      const next = nextReadinessQuestion(pack, after, rng);
      if (next.question === null) await finish(next.session);
      setStep(next);
      shownAt.current = now();
    } finally {
      setBusy(false);
    }
  }

  if (finished) {
    const { cleared, failed, uncertain } = finished.summary;
    const total = cleared.length + failed.length + uncertain.length;
    const first =
      total === 0
        ? ui("readinessNoChecks")
        : format(ui("readinessCleared"), { cleared: cleared.length, total });
    const concept =
      finished.nextConceptId === undefined ? undefined : pack.graph.concepts[finished.nextConceptId];
    const chapter = pack.graph.chapters[chapterId];
    const second =
      concept !== undefined && concept.chapterId !== chapterId
        ? format(ui("readinessStartWith"), { concept: t(concept.title).text })
        : format(ui("readinessReady"), { chapter: chapter ? t(chapter.title).text : chapterId });
    return (
      <div data-testid="readiness-summary" className="mx-auto max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">{ui("readinessTitle")}</h1>
        <p data-testid="readiness-line">{first}</p>
        <p data-testid="readiness-line">{second}</p>
        <button
          type="button"
          onClick={() => navigate("/s/home")}
          className="min-h-12 w-full rounded-md bg-brand-700 text-lg font-semibold text-white"
        >
          {ui("continue")}
        </button>
      </div>
    );
  }

  if (!step.question) return <p role="status">{ui("loading")}</p>;

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-semibold">{ui("readinessTitle")}</h1>
      <p data-testid="readiness-progress" className="text-sm text-slate-600">
        {format(ui("questionOfUpTo"), {
          n: step.session.askedQuestionIds.length,
          max: READINESS_MAX_ITEMS,
        })}
      </p>
      <QuestionCard
        key={step.question.id}
        question={step.question}
        disabled={busy}
        onAnswer={(a) => void answer(a)}
      />
    </div>
  );
}
