import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ContentPack } from "@setu/engine";
import { enterDemoMode, exitDemoMode } from "../data/api";
import { db as defaultDb } from "../data/db";
import type { SetuDb } from "../data/db";
import { loadDemoClassroom } from "../data/demo-load";
import type { FetchJson } from "../data/demo-load";
import { DEMO_CLASSROOM, DEMO_TEACHER } from "../data/demo-seed";
import { useLang } from "../i18n/lang-context";
import type { StringKey } from "../i18n/strings";
import { TEACHER_TOKEN_KEY } from "../teacher/teacher-context";

const ROLES: { to: string; label: StringKey; hint: StringKey; primary: boolean }[] = [
  { to: "/s/login", label: "roleStudent", hint: "roleStudentHint", primary: true },
  { to: "/t/login", label: "roleTeacher", hint: "roleTeacherHint", primary: false },
  { to: "/demo", label: "roleDemo", hint: "roleDemoHint", primary: false },
];

/** The landing page: one entry each for students, teachers and the demo. */
export function RoleChooser() {
  const { ui } = useLang();
  useEffect(() => exitDemoMode(), []);
  return (
    <div className="mx-auto w-full max-w-md space-y-6 pt-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold text-brand-800">{ui("appName")}</h1>
        <p className="text-slate-600">{ui("tagline")}</p>
      </div>
      <nav className="flex flex-col gap-3">
        {ROLES.map((r) => (
          <Link
            key={r.to}
            to={r.to}
            className={`block rounded-2xl border px-5 py-4 shadow-soft transition active:scale-[0.99] ${
              r.primary
                ? "border-brand-700 bg-brand-700 text-white hover:bg-brand-800"
                : "border-slate-200 bg-white text-slate-900 hover:border-brand-600"
            }`}
          >
            <span className="block text-lg font-semibold">{ui(r.label)}</span>
            <span className={`block text-sm ${r.primary ? "text-brand-50" : "text-slate-600"}`}>
              {ui(r.hint)}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** Loads the seeded classroom, signs the demo teacher in and lands on the Gap Map (6.1). */
export function Demo({
  db = defaultDb,
  load,
  loadPack,
}: {
  db?: SetuDb;
  load?: FetchJson;
  loadPack?: (chapterId: string) => Promise<ContentPack>;
}) {
  const { ui } = useLang();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const run = async () => {
      try {
        enterDemoMode(db, loadPack);
        await loadDemoClassroom(db, load);
        await db.meta.put({ key: TEACHER_TOKEN_KEY, value: `demo:${DEMO_TEACHER.teacherId}` });
        if (live) navigate(`/t/classrooms/${DEMO_CLASSROOM.id}/gapmap`, { replace: true });
      } catch {
        exitDemoMode();
        if (live) setFailed(true);
      }
    };
    void run();
    return () => {
      live = false;
    };
  }, [db, load, loadPack, navigate]);

  if (failed) return <p role="alert">{ui("demoFailed")}</p>;
  return <p role="status">{ui("demoLoading")}</p>;
}
