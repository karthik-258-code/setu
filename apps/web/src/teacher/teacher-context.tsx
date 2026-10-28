/**
 * The teacher signed in on this device. The token from `ApiClient.login` is kept in Dexie so a
 * teacher stays signed in offline; screens behind `TeacherGate` need it.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { db as defaultDb } from "../data/db";
import type { SetuDb } from "../data/db";
import { useLang } from "../i18n/lang-context";

const TOKEN_KEY = "teacherToken";

interface TeacherContextValue {
  db: SetuDb;
  /** null while the stored token is being read. */
  signedIn: boolean | null;
  signIn: (accessToken: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const TeacherContext = createContext<TeacherContextValue | null>(null);

export function TeacherProvider({ children, db = defaultDb }: { children: ReactNode; db?: SetuDb }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    void db.meta.get(TOKEN_KEY).then((row) => {
      if (live) setSignedIn(typeof row?.value === "string");
    });
    return () => {
      live = false;
    };
  }, [db]);

  const signIn = useCallback(
    async (accessToken: string) => {
      await db.meta.put({ key: TOKEN_KEY, value: accessToken });
      setSignedIn(true);
    },
    [db],
  );

  const signOut = useCallback(async () => {
    await db.meta.delete(TOKEN_KEY);
    setSignedIn(false);
  }, [db]);

  const value = useMemo(() => ({ db, signedIn, signIn, signOut }), [db, signedIn, signIn, signOut]);
  return <TeacherContext.Provider value={value}>{children}</TeacherContext.Provider>;
}

export function useTeacher(): TeacherContextValue {
  const value = useContext(TeacherContext);
  if (value === null) throw new Error("useTeacher must be used inside <TeacherProvider>");
  return value;
}

/** Renders `children` for a signed-in teacher; sends anyone else to the teacher login. */
export function TeacherGate({ children }: { children: ReactNode }) {
  const { signedIn } = useTeacher();
  const { ui } = useLang();
  if (signedIn === null) return <p role="status">{ui("loading")}</p>;
  if (!signedIn) return <Navigate to="/t/login" replace />;
  return <>{children}</>;
}
