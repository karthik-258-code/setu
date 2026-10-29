import type { Question } from "@setu/engine";
import { useState } from "react";
import { L } from "../i18n/l";
import { useLang } from "../i18n/lang-context";
import { parseNumber } from "./answer";
import type { Answer } from "./answer";

/** One question: MCQ options as large buttons, or a number field. Give it `key={question.id}`. */
export function QuestionCard({
  question,
  disabled,
  onAnswer,
}: {
  question: Question;
  disabled: boolean;
  onAnswer: (answer: Answer) => void;
}) {
  const { ui } = useLang();
  const [typed, setTyped] = useState("");
  const value = parseNumber(typed);

  return (
    <div className="space-y-4">
      <p className="text-lg">
        <L text={question.stem} />
      </p>
      {question.diagramSvg !== undefined && (
        <img
          src={`data:image/svg+xml;utf8,${encodeURIComponent(question.diagramSvg)}`}
          alt=""
          className="mx-auto max-h-48"
        />
      )}
      {question.type === "mcq" ? (
        <ul className="space-y-2">
          {question.options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onAnswer({ optionId: option.id })}
                className="min-h-12 w-full rounded-md border border-slate-300 bg-white px-4 text-left text-lg disabled:opacity-50"
              >
                <L text={option.text} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (value !== null) onAnswer({ value });
          }}
        >
          <label className="block space-y-1">
            <span className="font-medium">{ui("yourAnswer")}</span>
            <input
              className="min-h-12 w-full rounded-md border border-slate-300 px-3 text-lg"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            disabled={disabled || value === null}
            className="min-h-12 w-full rounded-md bg-brand-700 text-lg font-semibold text-white disabled:opacity-50"
          >
            {ui("submit")}
          </button>
        </form>
      )}
    </div>
  );
}
