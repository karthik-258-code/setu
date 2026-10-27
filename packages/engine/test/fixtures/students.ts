import {
  initialState,
  mulberry32,
  nextReadinessQuestion,
  readinessSummary,
  recordReadinessAnswer,
  startReadiness,
} from "../../src/index";
import type { ContentPack, Question, StudentEvent } from "../../src/index";
import { at, attempt } from "./pack";
import { SPINE_CHAPTER_ID } from "./readiness";

function wrongCode(question: Question): string | undefined {
  if (question.type !== "mcq") return undefined;
  return question.options.find((o) => !o.isCorrect)?.misconceptionCode;
}

/**
 * Plays a real Readiness Check for `studentId` and returns its events, the completion last.
 * `isCorrect` decides each answer; wrong answers carry the option's misconception code.
 */
export function readinessEvents(
  pack: ContentPack,
  isCorrect: (question: Question) => boolean,
  studentId: string,
  chapterId: string = SPINE_CHAPTER_ID,
): StudentEvent[] {
  const rng = mulberry32(7);
  let session = startReadiness(pack, initialState(studentId), chapterId, []);
  const events: StudentEvent[] = [];
  for (let n = 1; n <= 100; n++) {
    const next = nextReadinessQuestion(pack, session, rng);
    session = next.session;
    const question = next.question;
    if (!question) {
      events.push({
        id: `${studentId}-readiness-done`,
        type: "readiness_completed",
        studentId,
        ts: at(30),
        chapterId,
        summary: readinessSummary(session, at(30)),
      });
      return events;
    }
    const correct = isCorrect(question);
    const code = correct ? undefined : wrongCode(question);
    const event = attempt(`${studentId}-r${n}`, question.conceptId, {
      studentId,
      questionId: question.id,
      mode: "readiness",
      difficulty: question.difficulty,
      correct,
      ts: at(n),
      ...(code !== undefined ? { misconceptionCode: code } : {}),
    });
    events.push(event);
    session = recordReadinessAnswer(pack, session, event);
  }
  throw new Error("readiness check did not finish within 100 questions");
}

/** Answers every question correctly except those on the listed concepts. */
export function wrongOn(...conceptIds: string[]): (question: Question) => boolean {
  return (question) => !conceptIds.includes(question.conceptId);
}
