import type { Question } from "@setu/engine";
import { useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { currentSessionId } from "../data/session";
import { L } from "../i18n/l";
import { useLang } from "../i18n/lang-context";
import { grade } from "../student/answer";
import type { Answer, Graded } from "../student/answer";
import { CorrectAnswer } from "../student/correct-answer";
import { LadderDots } from "../student/ladder-dots";
import { QuestionCard } from "../student/question-card";
import { recommend } from "../student/recommend";
import { StudentGate, useStudent } from "../student/student-context";
import type { StudentData } from "../student/student-context";

/** Practice on one concept, one question at a time, while the policy keeps choosing Solve. */
export function StudentSolve() {
  const { conceptId } = useParams();
  return (
    <StudentGate>{(data) => <SolveRunner data={data} conceptId={conceptId ?? ""} />}</StudentGate>
  );
}

/** The policy's next Solve question for `conceptId`, or null when it now wants something else. */
function nextSolveQuestion(data: StudentData, now: Date, conceptId: string): Question | null {
  const rec = recommend(data.pack, data.state, data.launch.chapterId, now, currentSessionId());
  if (rec.mode !== "solve" || rec.conceptId !== conceptId) return null;
  const id = rec.questionIds?.[0];
  return data.pack.questions.find((q) => q.id === id) ?? null;
}

function SolveRunner({ data, conceptId }: { data: StudentData; conceptId: string }) {
  const { now, record } = useStudent();
  const { ui } = useLang();
  const navigate = useNavigate();
  const [question, setQuestion] = useState(() => nextSolveQuestion(data, now(), conceptId));
  const [hintsUsed, setHintsUsed] = useState(0);
  const [result, setResult] = useState<Graded | null>(null);
  const [busy, setBusy] = useState(false);
  const shownAt = useRef(now());

  if (!question) return <Navigate to="/s/home" replace />;
  const concept = data.pack.graph.concepts[question.conceptId];

  async function answer(given: Answer) {
    if (!question || busy || result !== null) return;
    setBusy(true);
    try {
      const graded = grade(question, given);
      await record({
        type: "attempt",
        studentId: data.profile.studentId,
        questionId: question.id,
        conceptId: question.conceptId,
        mode: "solve",
        difficulty: question.difficulty,
        ...graded,
        hintsUsed,
        timeMs: Math.max(0, now().getTime() - shownAt.current.getTime()),
        source: "device",
      });
      setResult(graded);
    } finally {
      setBusy(false);
    }
  }

  function next() {
    const following = nextSolveQuestion(data, now(), conceptId);
    if (!following) {
      navigate("/s/home");
      return;
    }
    setQuestion(following);
    setHintsUsed(0);
    setResult(null);
    shownAt.current = now();
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <div className="flex items-center justify-between gap-2">
        {concept && (
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            <L text={concept.title} />
          </h1>
        )}
        <LadderDots difficulty={question.difficulty} />
      </div>
      <QuestionCard
        key={question.id}
        question={question}
        disabled={busy || result !== null}
        onAnswer={(a) => void answer(a)}
      />
      {question.hint !== undefined &&
        result === null &&
        (hintsUsed === 0 ? (
          <button
            type="button"
            onClick={() => setHintsUsed(1)}
            className="min-h-11 w-full rounded-xl border border-brand-700 text-brand-800"
          >
            {ui("showHint")}
          </button>
        ) : (
          <p data-testid="hint" className="rounded-xl bg-amber-50 p-3">
            <L text={question.hint} />
          </p>
        ))}
      {result !== null && (
        <div data-testid="feedback" role="status" className="space-y-2 rounded-xl bg-white p-4 shadow-soft">
          <p className={`font-semibold ${result.correct ? "text-green-800" : "text-red-800"}`}>
            {ui(result.correct ? "correct" : "notQuite")}
          </p>
          {!result.correct && (
            <p>
              {ui("theAnswerIs")} <CorrectAnswer question={question} />
            </p>
          )}
          {question.solution !== undefined && (
            <p>
              <L text={question.solution} />
            </p>
          )}
          <button
            type="button"
            onClick={next}
            className="min-h-12 w-full rounded-xl bg-brand-700 text-lg font-semibold text-white"
          >
            {ui("next")}
          </button>
        </div>
      )}
    </div>
  );
}
