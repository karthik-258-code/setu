import { useEffect, useRef, useState } from "react";
import { apiClient } from "../data/api";
import type { SetuDb } from "../data/db";
import { pendingEvents, syncOnce } from "../data/sync-queue";
import { format } from "../i18n/format";
import { useLang } from "../i18n/lang-context";

export interface SyncStatus {
  kind: "idle" | "sending" | "error";
  pending: number;
}

const MAX_BACKOFF_MS = 5 * 60 * 1000;

/**
 * Sends the student's events when the screen opens, whenever new events are recorded and when
 * the phone comes back online; after a failure it retries with doubling delays (2 s up to
 * 5 min). Never blocks the student.
 */
export function useAutoSync(db: SetuDb, studentId: string, eventCount: number): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>({ kind: "idle", pending: 0 });
  const failures = useRef(0);

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pendingCount = async () => {
      try {
        return (await pendingEvents(db, studentId)).length;
      } catch {
        return 0;
      }
    };
    const run = async () => {
      if (!navigator.onLine) {
        const pending = await pendingCount();
        if (live) setStatus({ kind: "idle", pending });
        return;
      }
      if (live) setStatus((s) => ({ ...s, kind: "sending" }));
      try {
        const result = await syncOnce(db, apiClient(), studentId);
        failures.current = 0;
        if (live) setStatus({ kind: "idle", pending: result.pending });
      } catch {
        const pending = await pendingCount();
        if (!live) return;
        setStatus({ kind: "error", pending });
        const delay = Math.min(MAX_BACKOFF_MS, 2000 * 2 ** failures.current);
        failures.current += 1;
        timer = setTimeout(() => void run(), delay);
      }
    };
    void run();
    const online = () => void run();
    window.addEventListener("online", online);
    return () => {
      live = false;
      if (timer !== undefined) clearTimeout(timer);
      window.removeEventListener("online", online);
    };
  }, [db, studentId, eventCount]);

  return status;
}

export function SyncChip({ status }: { status: SyncStatus }) {
  const { ui } = useLang();
  const text =
    status.kind === "sending"
      ? ui("syncSending")
      : status.pending === 0
        ? ui("syncAllSent")
        : format(ui("syncWaiting"), { count: status.pending });
  return (
    <span
      data-testid="sync-chip"
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        status.pending === 0 && status.kind !== "error" ? "bg-slate-100 text-slate-700" : "bg-amber-100 text-amber-900"
      }`}
    >
      {text}
    </span>
  );
}
