import { MASTERY_THRESHOLD } from "@setu/engine";

/** Heatmap colour for a pKnown value; grey when the student never touched the concept. */
export function masteryColour(pKnown: number | null): string {
  if (pKnown === null) return "bg-slate-200 text-slate-600";
  if (pKnown >= MASTERY_THRESHOLD) return "bg-green-800 text-white";
  if (pKnown >= 0.7) return "bg-lime-200 text-lime-950";
  if (pKnown >= 0.4) return "bg-amber-200 text-amber-950";
  return "bg-rose-200 text-rose-950";
}

export const LEGEND: { pKnown: number | null; label: string }[] = [
  { pKnown: 0.2, label: "< 40%" },
  { pKnown: 0.5, label: "40-69%" },
  { pKnown: 0.8, label: "70-89%" },
  { pKnown: 0.95, label: "\u2265 90%" },
  { pKnown: null, label: "\u2013" },
];
