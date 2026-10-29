import { MASTERY_THRESHOLD } from "@setu/engine";
import type { Mode, Question, Recommendation } from "@setu/engine";
import { useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { currentSessionId } from "../data/session";
import { format } from "../i18n/format";
import { L } from "../i18n/l";
import { useLang } from "../i18n/lang-context";
import { grade } from "../student/answer";
import type { Answer } from "../student/answer";
import { MODE_LABEL } from "../student/mode-labels";
import { QuestionCard } from "../student/question-card";
import { recommend } from "../student/recommend";
import { StudentGate, useStudent } from "../student/student-context";
import type { StudentData } from "../student/student-context";

type TestMode = Extract<Mode, "test" | "recheck" | "verify" | "extension">;

function testMode(rec: Recommendation): TestMode | null {
  const { mode } = rec;
  return mode === "test" || mode === "recheck" || mode === "verify" || mode === "extension"
    ? mode
    : null;
}

interface ChosenTest {
  mode: TestMode;
  questions: Question[];
}

/** The policy's test, re-check, verification or extension set for `conceptId`, if it wants one. */
function chosenTest(data: StudentData, now: Date, conceptId: string): ChosenTest | null {
  const rec = recommend(data.pack, data.state, data.launch.chapterId, now, currentSessionId());
  const mode = testMode(rec);
  if (mode === null || rec.conceptId !== conceptId) return null;
  const questions = (rec.questionIds ?? [])
    .map((id) => data.pack.questions.find((q) => q.id === id))
    .filter((q): q is Question => q !== undefined);
  return questions.length === 0 ? null : { mode, questions };
}

/** A short set without hints; the result shows the mastery outcome and what comes next. */
export function StudentTest() {
  const { conceptId } = useParams();
  return (
    <StudentGate>{(data) => <TestRunner data={data} conceptId={conceptId ?? ""} />}</StudentGate>
  );
}

function TestRunner({ data, conceptId }: { data: StudentData; conceptId: string }) {
  const { now, record } = useStudent();
  const { lang, ui, t } = useLang();
  const navigate = useNavigate();
  const [test] = useState(() => chosenTest(data, now(), conceptId));
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [busy, setBusy] = useState(false);
  const shownAt = useRef(now());

  if (!test) return <Navigate to="/s/home" replace />;
  const question = test.questions[index];

  async function answer(given: Answer) {
    if (!test || !question || busy) return;
    setBusy(true);
    try {
      const graded = grade(question, given);
      await record({
        type: "attempt",
        studentId: data.profile.studentId,
        questionId: question.id,
        conceptId: question.conceptId,
        mode: test.mode,
        difficulty: question.difficulty,
        ...graded,
        hintsUsed: 0,
        timeMs: Math.max(0, now().getTime() - shownAt.current.getTime()),
        source: "device",
      });
      if (graded.correct) setCorrect((c) => c + 1);
      setIndex((i) => i + 1);
      shownAt.current = now();
    } finally {
      setBusy(false);
    }
  }

  const heading = <h1 className="text-xl font-semibold">{ui(MODE_LABEL[test.mode])}</h1>;

  if (!question) {
    const concept = data.pack.graph.concepts[conceptId];
    const title = concept ? t(concept.title).text : conceptId;
    const mastery = data.state.mastery[conceptId];
    const mastered =
      mastery !== undefined &&
      mastery.masteredAt !== undefined &&
      mastery.pKnown >= MASTERY_THRESHOLD &&
      mastery.pendingVerification !== true;
    const recheck = data.state.rechecks
      .filter((r) => r.conceptId === conceptId)
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
    const dateFormat = new Intl.DateTimeFormat(lang === "te" ? "te-IN" : "en-IN", {
      day: "numeric",
      month: "long",
    });
    return (
      <div data-testid="test-result" className="mx-auto max-w-sm space-y-4">
        {heading}
        <p className="text-lg font-semibold">
          {format(ui("scoreOf"), { correct, total: test.questions.length })}
        </p>
        {test.mode !== "extension" && (
          <>
            <p data-testid="test-outcome">
              {format(ui(mastered ? "outcomeMastered" : "outcomeNotYet"), { concept: title })}
            </p>
            <p data-testid="test-next">
              {mastered && recheck
                ? format(ui("nextRecheckOn"), { date: dateFormat.format(new Date(recheck.dueAt)) })
                : ui("nextPractice")}
            </p>
          </>
        )}
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

  const concept = data.pack.graph.concepts[question.conceptId];
  return (
    <div className="mx-auto max-w-sm space-y-4">
      {heading}
      {concept && (
        <p className="font-medium">
          <L text={concept.title} />
        </p>
      )}
      <p data-testid="test-progress" className="text-sm text-slate-600">
        {format(ui("questionOf"), { n: index + 1, total: test.questions.length })}
      </p>
      <QuestionCard
        key={question.id}
        question={question}
        disabled={busy}
        onAnswer={(a) => void answer(a)}
      />
    </div>
  );
}
