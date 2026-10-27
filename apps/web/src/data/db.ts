import type { ContentPack, Lang, StudentEvent, StudentId, StudentState } from "@setu/engine";
import Dexie from "dexie";
import type { EntityTable, Table } from "dexie";

export interface Profile {
  studentId: StudentId;
  firstName: string;
  rollNo: string;
  classroomId: string;
  lang: Lang;
  /** SHA-256 with the per-device salt stored in `meta`. */
  pinHash: string;
}

export interface StoredPack {
  chapterId: string;
  packVersion: string;
  pack: ContentPack;
}

/** `synced`: 0 = waiting to upload, 1 = accepted by the server. */
export type StoredEvent = StudentEvent & { synced: 0 | 1 };

export interface MetaEntry {
  key: string;
  value: unknown;
}

export class SetuDb extends Dexie {
  profiles!: EntityTable<Profile, "studentId">;
  packs!: EntityTable<StoredPack, "chapterId">;
  // Table, not EntityTable: EntityTable's insert type is not distributive over the event union.
  events!: Table<StoredEvent, string>;
  states!: EntityTable<StudentState, "studentId">;
  meta!: EntityTable<MetaEntry, "key">;

  constructor(name = "setu") {
    super(name);
    this.version(1).stores({
      profiles: "studentId",
      packs: "chapterId",
      events: "id, [studentId+ts], synced",
      states: "studentId",
      meta: "key",
    });
  }
}

export const db = new SetuDb();
