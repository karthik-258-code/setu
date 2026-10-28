import { Fragment } from "react";
import type { ReactNode } from "react";

/** Bold (`**x**`) and inline code (`` `x` ``) inside one line. */
function inline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .filter((part) => part !== "")
    .map((part, i) => {
      if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={i} className="rounded bg-slate-100 px-1">
            {part.slice(1, -1)}
          </code>
        );
      }
      return <Fragment key={i}>{part}</Fragment>;
    });
}

const BULLET = /^[-*]\s+/;
const NUMBERED = /^\d+[.)]\s+/;

/**
 * The resource markdown subset (ARCHITECTURE 6.2): paragraphs, bold, inline code and simple
 * lists. Builds React elements, never HTML strings.
 */
export function Markdown({ text }: { text: string }) {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block !== "");
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        const lines = block.split("\n").map((line) => line.trim());
        if (lines.every((line) => BULLET.test(line))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((line, j) => (
                <li key={j}>{inline(line.replace(BULLET, ""))}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((line) => NUMBERED.test(line))) {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5">
              {lines.map((line, j) => (
                <li key={j}>{inline(line.replace(NUMBERED, ""))}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i}>
            {lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
