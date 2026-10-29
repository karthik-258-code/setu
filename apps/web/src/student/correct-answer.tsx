import type { Question } from "@setu/engine";
import { L } from "../i18n/l";

/** The right answer of a question: the correct option's text, or the number. */
export function CorrectAnswer({ question }: { question: Question }) {
  if (question.type === "numeric") return <span>{question.answer}</span>;
  const option = question.options.find((o) => o.isCorrect);
  return option ? <L text={option.text} /> : null;
}
