/**
 * The signed-in student on this device: their profile, the launched chapter, its pack and the
 * replayed state. Screens change state only through `record`, which appends an event.
 */
import type { ContentPack, StudentState } from "@setu/engine";
import type { LaunchedChapter } from "@setu/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { db as defaultDb } from "../data/db";
import type { Profile, SetuDb } from "../data/db";
import { appendEvent, loadState } from "../data/event-store";
import type { NewEvent } from "../data/event-store";
import { apiClient } from "../data/api";
import { refreshLaunch } from "../data/launch";
import { getPack } from "../data/packs";
import { activeProfile, setActiveProfile, setProfileLang } from "../data/profiles";
import { currentSessionId, startNewSession } from "../data/session";
import { useLang } from "../i18n/lang-context";

export interface StudentData {
  profile: Profile;
  launch: LaunchedChapter;
  pack: ContentPack;
  state: StudentState;
}

export type StudentStatus =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "error"; error: Error }
  | { kind: "ready"; data: StudentData };

interface StudentContextValue {
  db: SetuDb;
  status: StudentStatus;
  now: () => Date;
  /** Appends an event for the signed-in student and returns the new state. */
  record: (draft: NewEvent) => Promise<StudentState>;
  /** Makes `studentId` the active profile, applies their language and starts a new sitting. */
  signIn: (studentId: string) => Promise<void>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
}

const StudentContext = createContext<StudentContextValue | null>(null);

export interface StudentProviderProps {
  children: ReactNode;
  db?: SetuDb;
  loadPack?: (db: SetuDb, chapterId: string) => Promise<ContentPack>;
  now?: () => Date;
}

const systemNow = () => new Date();

export function StudentProvider({
  children,
  db = defaultDb,
  loadPack = getPack,
  now = systemNow,
}: StudentProviderProps) {
  const { lang, setLang } = useLang();
  const [status, setStatus] = useState<StudentStatus>({ kind: "loading" });

  const reload = useCallback(async () => {
    try {
      const profile = await activeProfile(db);
      if (!profile) {
        setStatus({ kind: "signed-out" });
        return;
      }
      // The classroom's latest launch when online; the copy stored on this device when not.
      const launch = await refreshLaunch(db, apiClient(), profile.classroomId);
      const pack = await loadPack(db, launch.chapterId);
      const state = await loadState(db, pack, profile.studentId);
      setStatus({ kind: "ready", data: { profile, launch, pack, state } });
    } catch (error) {
      setStatus({ kind: "error", error: error instanceof Error ? error : new Error(String(error)) });
    }
  }, [db, loadPack]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const signIn = useCallback(
    async (studentId: string) => {
      setStatus({ kind: "loading" });
      await setActiveProfile(db, studentId);
      startNewSession();
      const profile = await db.profiles.get(studentId);
      if (profile?.lang === "en" || profile?.lang === "te") setLang(profile.lang);
      await reload();
    },
    [db, reload, setLang],
  );

  const signOut = useCallback(async () => {
    await setActiveProfile(db, null);
    setStatus({ kind: "signed-out" });
  }, [db]);

  // The language toggle is per student: remember a change for the signed-in profile.
  const readyId = status.kind === "ready" ? status.data.profile.studentId : null;
  const readyLang = status.kind === "ready" ? status.data.profile.lang : null;
  useEffect(() => {
    if (readyId === null || readyLang === lang) return;
    void setProfileLang(db, readyId, lang).then(() =>
      setStatus((s) =>
        s.kind === "ready" && s.data.profile.studentId === readyId
          ? { kind: "ready", data: { ...s.data, profile: { ...s.data.profile, lang } } }
          : s,
      ),
    );
  }, [db, lang, readyId, readyLang]);

  const record = useCallback(
    async (draft: NewEvent) => {
      if (status.kind !== "ready") throw new Error("No student is signed in");
      const { pack, profile } = status.data;
      const { state } = await appendEvent(db, pack, draft, { now, sessionId: currentSessionId() });
      setStatus((s) =>
        s.kind === "ready" && s.data.profile.studentId === profile.studentId
          ? { kind: "ready", data: { ...s.data, state } }
          : s,
      );
      return state;
    },
    [db, now, status],
  );

  const value = useMemo<StudentContextValue>(
    () => ({ db, status, now, record, signIn, signOut, reload }),
    [db, status, now, record, signIn, signOut, reload],
  );
  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export function useStudent(): StudentContextValue {
  const value = useContext(StudentContext);
  if (value === null) throw new Error("useStudent must be used inside <StudentProvider>");
  return value;
}

/**
 * Renders `children` with the signed-in student's data; shows loading or a retry message, and
 * sends a device with no active profile to the profile picker.
 */
export function StudentGate({ children }: { children: (data: StudentData) => ReactNode }) {
  const { status, reload } = useStudent();
  const { ui } = useLang();
  if (status.kind === "loading") return <p role="status">{ui("loading")}</p>;
  if (status.kind === "signed-out") return <Navigate to="/s/profiles" replace />;
  if (status.kind === "error") {
    return (
      <div role="alert" className="space-y-3">
        <p>{ui("loadFailed")}</p>
        <button
          type="button"
          onClick={() => void reload()}
          className="min-h-11 rounded-xl bg-brand-700 px-4 font-medium text-white"
        >
          {ui("tryAgain")}
        </button>
      </div>
    );
  }
  return <>{children(status.data)}</>;
}
