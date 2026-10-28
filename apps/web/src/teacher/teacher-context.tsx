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

/** Dexie `meta` key of the signed-in teacher's access token. */
export const TEACHER_TOKEN_KEY = "teacherToken";
const TOKEN_KEY = TEACHER_TOKEN_KEY;

/** The teacher id an access token names: `demo:<id>` tokens, or the `sub` claim of a JWT. */
export function teacherIdFromToken(token: string): string {
  if (token.startsWith("demo:")) return token.slice("demo:".length);
  const payload = token.split(".")[1];
  if (payload !== undefined) {
    try {
      const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
        sub?: unknown;
      };
      if (typeof claims.sub === "string" && claims.sub !== "") return claims.sub;
    } catch {
      // Not a JWT: fall through to the error below.
    }
  }
  throw new Error("The access token does not name a teacher");
}

interface TeacherContextValue {
  db: SetuDb;
  /** null while the stored token is being read. */
  signedIn: boolean | null;
  /** The signed-in teacher, stamped on teacher events; null when signed out. */
  teacherId: string | null;
  signIn: (accessToken: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const TeacherContext = createContext<TeacherContextValue | null>(null);

export function TeacherProvider({ children, db = defaultDb }: { children: ReactNode; db?: SetuDb }) {
  // undefined while reading, null when signed out.
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    void db.meta.get(TOKEN_KEY).then((row) => {
      if (live) setToken(typeof row?.value === "string" ? row.value : null);
    });
    return () => {
      live = false;
    };
  }, [db]);

  const signIn = useCallback(
    async (accessToken: string) => {
      await db.meta.put({ key: TOKEN_KEY, value: accessToken });
      setToken(accessToken);
    },
    [db],
  );

  const signOut = useCallback(async () => {
    await db.meta.delete(TOKEN_KEY);
    setToken(null);
  }, [db]);

  const signedIn = token === undefined ? null : token !== null;
  const teacherId = typeof token === "string" ? teacherIdFromToken(token) : null;
  const value = useMemo(
    () => ({ db, signedIn, teacherId, signIn, signOut }),
    [db, signedIn, teacherId, signIn, signOut],
  );
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
