import { replay } from "@setu/engine";
import type { ContentPack, StudentState } from "@setu/engine";
import type { ApiDeps } from "./deps";
import { ApiError } from "./errors";
import type { StoredClassroom } from "./store";

/** The classroom's latest launched chapter, or a 404 when nothing is launched yet. */
export function latestChapterId(classroom: StoredClassroom): string {
  const latest = classroom.launchedChapters[classroom.launchedChapters.length - 1];
  if (!latest) throw new ApiError(404, "NO_LAUNCH", "No chapter is launched for this classroom");
  return latest.chapterId;
}

export async function packFor(deps: ApiDeps, chapterId: string): Promise<ContentPack> {
  try {
    return await deps.loadPack(chapterId);
  } catch {
    throw new ApiError(404, "NOT_FOUND", `No pack for chapter ${chapterId}`);
  }
}

/** A student's state: the engine's `replay` over every stored event (events are the truth). */
export async function replayStudent(
  deps: ApiDeps,
  pack: ContentPack,
  studentId: string,
): Promise<StudentState> {
  return replay(pack, await deps.store.eventsForStudent(studentId), studentId);
}
