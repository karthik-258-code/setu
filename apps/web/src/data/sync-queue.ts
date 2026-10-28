/**
 * Uploads a student's unsynced events in batches of at most `MAX_SYNC_EVENTS` (ARCHITECTURE
 * 8.2). Accepted events are marked synced; rejected ones are kept with their reason in `meta`
 * and not sent again, so nothing is silently dropped and a bad event cannot block the queue.
 */
import type { StudentEvent } from "@setu/engine";
import { MAX_SYNC_EVENTS } from "@setu/shared";
import type { ApiClient } from "@setu/shared";
import type { SetuDb, StoredEvent } from "./db";

const REJECTED_KEY = "sync:rejected";

export interface SyncResult {
  sent: number;
  accepted: number;
  rejected: number;
  pending: number;
}

async function rejectedReasons(db: SetuDb): Promise<Record<string, string>> {
  return ((await db.meta.get(REJECTED_KEY))?.value ?? {}) as Record<string, string>;
}

function toEvent(row: StoredEvent): StudentEvent {
  const event: Partial<StoredEvent> = { ...row };
  delete event.synced;
  return event as StudentEvent;
}

/** The student's events still waiting to upload, oldest first, without rejected ones. */
export async function pendingEvents(db: SetuDb, studentId: string): Promise<StudentEvent[]> {
  const rejected = await rejectedReasons(db);
  const rows = await db.events
    .where("synced")
    .equals(0)
    .filter((e) => e.studentId === studentId && rejected[e.id] === undefined)
    .toArray();
  return rows
    .sort((a, b) => (a.ts === b.ts ? (a.id < b.id ? -1 : 1) : a.ts < b.ts ? -1 : 1))
    .map(toEvent);
}

export async function syncOnce(db: SetuDb, client: ApiClient, studentId: string): Promise<SyncResult> {
  const total: SyncResult = { sent: 0, accepted: 0, rejected: 0, pending: 0 };
  for (;;) {
    const batch = (await pendingEvents(db, studentId)).slice(0, MAX_SYNC_EVENTS);
    if (batch.length === 0) break;
    const response = await client.sync(batch);
    total.sent += batch.length;
    total.accepted += response.accepted.length;
    total.rejected += response.rejected.length;
    await db.events
      .where("id")
      .anyOf(response.accepted)
      .modify((e) => {
        e.synced = 1;
      });
    if (response.rejected.length > 0) {
      const reasons = await rejectedReasons(db);
      for (const r of response.rejected) reasons[r.id] = r.reason;
      await db.meta.put({ key: REJECTED_KEY, value: reasons });
    }
    // A server that neither accepts nor rejects anything would loop forever; stop instead.
    if (response.accepted.length + response.rejected.length === 0) break;
  }
  total.pending = (await pendingEvents(db, studentId)).length;
  return total;
}
