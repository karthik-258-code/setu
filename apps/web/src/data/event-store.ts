/**
 * Events are the source of truth (AGENTS.md): screens append events through `appendEvent` and
 * read state through `loadState`; nothing writes a `StudentState` by hand. The `states` table is
 * only a cache of `replay(pack, events)`.
 */
import { applyEvent, replay } from "@setu/engine";
import type { ContentPack, StudentEvent, StudentId, StudentState } from "@setu/engine";
import type { SetuDb, StoredEvent } from "./db";
import { newId } from "./ids";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** An event as a screen creates it; `appendEvent` adds `id`, `ts` and `sessionId`. */
export type NewEvent = DistributiveOmit<StudentEvent, "id" | "ts" | "sessionId">;

export interface EventContext {
  now: () => Date;
  sessionId: string;
}

/** The pack a cached state was replayed with; state depends on it (`pack.chapterId`, graph). */
interface PackStamp {
  chapterId: string;
  packVersion: string;
}

function stampKey(studentId: StudentId): string {
  return `statePack:${studentId}`;
}

function toEvent(row: StoredEvent): StudentEvent {
  const event: Partial<StoredEvent> = { ...row };
  delete event.synced;
  return event as StudentEvent;
}

function eventsOf(db: SetuDb, studentId: StudentId) {
  return db.events.where("[studentId+ts]").between([studentId, ""], [studentId, "\uffff"]);
}

/** A student's stored events, without the `synced` flag. */
export async function studentEvents(db: SetuDb, studentId: StudentId): Promise<StudentEvent[]> {
  return (await eventsOf(db, studentId).toArray()).map(toEvent);
}

async function cachedState(
  db: SetuDb,
  pack: ContentPack,
  studentId: StudentId,
): Promise<StudentState | undefined> {
  const state = await db.states.get(studentId);
  const stamp = (await db.meta.get(stampKey(studentId)))?.value as PackStamp | undefined;
  if (!state || !stamp) return undefined;
  if (stamp.chapterId !== pack.chapterId || stamp.packVersion !== pack.packVersion) return undefined;
  return state;
}

async function saveState(db: SetuDb, pack: ContentPack, state: StudentState): Promise<void> {
  const stamp: PackStamp = { chapterId: pack.chapterId, packVersion: pack.packVersion };
  await db.states.put(state);
  await db.meta.put({ key: stampKey(state.studentId), value: stamp });
}

/**
 * The student's state for `pack`: the cached state when it was replayed with the same pack and
 * counts every stored event, otherwise a full replay of the stored events (which is then cached).
 */
export async function loadState(
  db: SetuDb,
  pack: ContentPack,
  studentId: StudentId,
): Promise<StudentState> {
  return db.transaction("rw", db.events, db.states, db.meta, async () => {
    const cached = await cachedState(db, pack, studentId);
    if (cached && cached.eventCount === (await eventsOf(db, studentId).count())) return cached;
    const state = replay(pack, await studentEvents(db, studentId), studentId);
    await saveState(db, pack, state);
    return state;
  });
}

/**
 * Stores one event, unsynced, with a fresh UUID, the current time and the sitting's id, and
 * updates the cached state. The event is applied on top of the cache only when the cache is
 * current and the event is strictly newer than its last event; otherwise all events are replayed,
 * so the `ts`-then-`id` order of replay always holds.
 */
export async function appendEvent(
  db: SetuDb,
  pack: ContentPack,
  draft: NewEvent,
  ctx: EventContext,
): Promise<{ event: StudentEvent; state: StudentState }> {
  const event = {
    ...draft,
    id: newId(),
    ts: ctx.now().toISOString(),
    sessionId: ctx.sessionId,
  } as StudentEvent;
  return db.transaction("rw", db.events, db.states, db.meta, async () => {
    const countBefore = await eventsOf(db, event.studentId).count();
    const cached = await cachedState(db, pack, event.studentId);
    await db.events.add({ ...event, synced: 0 });
    const state =
      cached !== undefined &&
      cached.eventCount === countBefore &&
      (cached.lastEventTs === undefined || Date.parse(cached.lastEventTs) < Date.parse(event.ts))
        ? applyEvent(pack, cached, event)
        : replay(pack, await studentEvents(db, event.studentId), event.studentId);
    await saveState(db, pack, state);
    return { event, state };
  });
}
