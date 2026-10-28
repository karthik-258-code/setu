/**
 * Everything a teacher screen shows for one classroom's latest launched chapter, read through
 * `ApiClient` so it works with the demo client and the API alike.
 */
import type { ContentPack, GapGroup, GapMap } from "@setu/engine";
import type { ClassroomSummary } from "@setu/shared";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../data/api";

export interface ClassView {
  classroom: ClassroomSummary;
  chapterId: string;
  pack: ContentPack;
  gapMap: GapMap;
  groups: GapGroup[];
}

export type ClassViewStatus =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "no-chapter" }
  | { kind: "ready"; view: ClassView };

export function useClassView(classroomId: string): {
  status: ClassViewStatus;
  reload: () => void;
} {
  const [status, setStatus] = useState<ClassViewStatus>({ kind: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const client = apiClient();
        const classroom = (await client.getClassrooms()).find((c) => c.id === classroomId);
        const launched = classroom?.launchedChapters ?? [];
        const chapterId = launched[launched.length - 1]?.chapterId;
        if (!classroom || chapterId === undefined) {
          if (live) setStatus({ kind: "no-chapter" });
          return;
        }
        const [pack, gapMap, groups] = await Promise.all([
          client.getPack(chapterId),
          client.getGapMap(classroomId, chapterId),
          client.getGroups(classroomId, chapterId),
        ]);
        if (live) setStatus({ kind: "ready", view: { classroom, chapterId, pack, gapMap, groups } });
      } catch {
        if (live) setStatus({ kind: "error" });
      }
    };
    void load();
    return () => {
      live = false;
    };
  }, [classroomId, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { status, reload };
}
