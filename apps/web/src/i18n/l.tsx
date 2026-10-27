import type { LocalizedText } from "@setu/engine";
import { useLang } from "./lang-context";

/** Renders LocalizedText in the active language; marks English fallbacks with "English only". */
export function L({ text, className }: { text: LocalizedText; className?: string }) {
  const { t, ui } = useLang();
  const { text: shown, fallback } = t(text);
  if (!fallback) return <span className={className}>{shown}</span>;
  return (
    <span className={className}>
      <span lang="en">{shown}</span>{" "}
      <span
        data-testid="english-only"
        className="ml-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 align-middle text-xs font-medium text-amber-900"
      >
        {ui("englishOnly")}
      </span>
    </span>
  );
}
