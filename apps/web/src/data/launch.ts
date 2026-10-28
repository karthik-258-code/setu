import type { ApiClient, LaunchedChapter } from "@setu/shared";
import type { SetuDb } from "./db";

/** The chapter v0.1 is built around, used until a teacher's launch has been seen on this device. */
export const DEFAULT_LAUNCH: LaunchedChapter = {
  chapterId: "CH.M8.LINEAR_EQ_ONE_VAR",
  trimmed: [],
  launchedAt: "2026-10-27T00:00:00.000Z",
};

function launchKey(classroomId: string): string {
  return `launch:${classroomId}`;
}

/** The classroom's latest launch as last seen on this device, or the default chapter. */
export async function storedLaunch(db: SetuDb, classroomId: string): Promise<LaunchedChapter> {
  const stored = (await db.meta.get(launchKey(classroomId)))?.value as LaunchedChapter | undefined;
  return stored ?? DEFAULT_LAUNCH;
}

/**
 * Asks the client for the classroom's latest launched chapter and stores it. When the request
 * fails (offline, or a client that does not show classrooms to students), the stored launch is
 * kept, so a student is never blocked.
 */
export async function refreshLaunch(
  db: SetuDb,
  client: ApiClient,
  classroomId: string,
): Promise<LaunchedChapter> {
  try {
    const classroom = (await client.getClassrooms()).find((c) => c.id === classroomId);
    const latest = classroom?.launchedChapters[classroom.launchedChapters.length - 1];
    if (latest) {
      await db.meta.put({ key: launchKey(classroomId), value: latest });
      return latest;
    }
  } catch {
    // Keep the stored launch: the student can carry on offline.
  }
  return storedLaunch(db, classroomId);
}
