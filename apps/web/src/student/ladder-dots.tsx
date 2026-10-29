import type { Difficulty } from "@setu/engine";
import { format } from "../i18n/format";
import { useLang } from "../i18n/lang-context";

const STEPS: Difficulty[] = [1, 2, 3];

/** The difficulty ladder as three dots, filled up to the current level. */
export function LadderDots({ difficulty }: { difficulty: Difficulty }) {
  const { ui } = useLang();
  return (
    <div
      role="img"
      aria-label={format(ui("levelOf"), { level: difficulty })}
      data-testid="ladder"
      className="flex gap-1"
    >
      {STEPS.map((step) => (
        <span
          key={step}
          data-filled={step <= difficulty}
          className={`h-3 w-3 rounded-full ${step <= difficulty ? "bg-brand-700" : "bg-slate-300"}`}
        />
      ))}
    </div>
  );
}
