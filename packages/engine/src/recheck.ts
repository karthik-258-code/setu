import { RECHECK_INTERVALS_DAYS } from "./types";
import type {
  AttemptEvent,
  ConceptId,
  IsoTimestamp,
  Mode,
  Recheck,
  RecheckKind,
  StudentState,
} from "./types";

/** Questions in one re-check or verification round (ARCHITECTURE 5.4, R1 and R2). */
export const RECHECK_QUESTIONS = 3;

const DAY_MS = 86_400_000;

/** `ts` plus `days` whole days, as an ISO timestamp in UTC. Throws on an invalid timestamp. */
export function addDays(ts: IsoTimestamp, days: number): IsoTimestamp {
  const t = Date.parse(ts);
  if (!Number.isFinite(t)) throw new RangeError(`Invalid timestamp: ${ts}`);
  return new Date(t + days * DAY_MS).toISOString();
}

function byDue(a: Recheck, b: Recheck): number {
  return (
    Date.parse(a.dueAt) - Date.parse(b.dueAt) ||
    (a.conceptId < b.conceptId ? -1 : a.conceptId > b.conceptId ? 1 : 0)
  );
}

/** The first spaced re-check after a concept is mastered (ARCHITECTURE 5.5). */
export function scheduleSpaced(conceptId: ConceptId, masteredAt: IsoTimestamp): Recheck[] {
  const first = RECHECK_INTERVALS_DAYS[0];
  if (first === undefined) return [];
  return [{ conceptId, dueAt: addDays(masteredAt, first), intervalDays: first, kind: "spaced" }];
}

/**
 * The spaced re-check that follows a passed one, counted from `masteredAt` (2, then 7, then 21
 * days). Null after the last interval, or if `recheck.intervalDays` is not one of the intervals.
 */
export function nextSpaced(recheck: Recheck, masteredAt: IsoTimestamp): Recheck | null {
  const i = RECHECK_INTERVALS_DAYS.indexOf(recheck.intervalDays);
  const next = i >= 0 ? RECHECK_INTERVALS_DAYS[i + 1] : undefined;
  if (next === undefined) return null;
  return {
    conceptId: recheck.conceptId,
    dueAt: addDays(masteredAt, next),
    intervalDays: next,
    kind: "spaced",
  };
}

/** Re-checks with `dueAt <= now`, earliest first, then by concept id. */
export function dueRechecks(state: StudentState, now: IsoTimestamp): Recheck[] {
  const t = Date.parse(now);
  return state.rechecks.filter((r) => Date.parse(r.dueAt) <= t).sort(byDue);
}

/** The earliest re-check of one of `kinds` on `conceptId` that is due at `ts`, if any. */
export function activeRecheck(
  rechecks: readonly Recheck[],
  conceptId: ConceptId,
  kinds: readonly RecheckKind[],
  ts: IsoTimestamp,
): Recheck | undefined {
  const t = Date.parse(ts);
  return rechecks
    .filter((r) => r.conceptId === conceptId && kinds.includes(r.kind) && Date.parse(r.dueAt) <= t)
    .sort(byDue)[0];
}

/** Attempts on `conceptId` in `mode` at or after `since`: the size of the current round. */
export function roundAttempts(
  attempts: readonly AttemptEvent[],
  conceptId: ConceptId,
  mode: Mode,
  since: IsoTimestamp,
): number {
  const t = Date.parse(since);
  return attempts.filter(
    (a) => a.conceptId === conceptId && a.mode === mode && Date.parse(a.ts) >= t,
  ).length;
}
