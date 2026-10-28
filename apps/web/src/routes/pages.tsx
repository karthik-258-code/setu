import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db as defaultDb } from "../data/db";
import type { SetuDb } from "../data/db";
import { loadDemoClassroom } from "../data/demo-load";
import type { FetchJson } from "../data/demo-load";
import { DEMO_CLASSROOM, DEMO_TEACHER } from "../data/demo-seed";
import { useLang } from "../i18n/lang-context";
import { TEACHER_TOKEN_KEY } from "../teacher/teacher-context";
import type { StringKey } from "../i18n/strings";
import { Placeholder } from "./placeholder";

const ROLES: [string, StringKey][] = [
  ["/s/login", "roleStudent"],
  ["/t/login", "roleTeacher"],
  ["/demo", "roleDemo"],
];

export function RoleChooser() {
  const { ui } = useLang();
  return (
    <div className="space-y-4">
      <Placeholder name="role-chooser" />
      <nav className="flex flex-col gap-2">
        {ROLES.map(([to, key]) => (
          <Link
            key={to}
            to={to}
            className="flex min-h-12 items-center rounded-lg bg-white px-4 shadow-sm"
          >
            {ui(key)}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** Loads the seeded classroom, signs the demo teacher in and lands on the Gap Map (6.1). */
export function Demo({ db = defaultDb, load }: { db?: SetuDb; load?: FetchJson }) {
  const { ui } = useLang();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const run = async () => {
      try {
        await loadDemoClassroom(db, load);
        await db.meta.put({ key: TEACHER_TOKEN_KEY, value: `demo:${DEMO_TEACHER.teacherId}` });
        if (live) navigate(`/t/classrooms/${DEMO_CLASSROOM.id}/gapmap`, { replace: true });
      } catch {
        if (live) setFailed(true);
      }
    };
    void run();
    return () => {
      live = false;
    };
  }, [db, load, navigate]);

  if (failed) return <p role="alert">{ui("demoFailed")}</p>;
  return <p role="status">{ui("demoLoading")}</p>;
}
