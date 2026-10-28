import type { ClassroomSummary } from "@setu/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../data/api";
import { format } from "../i18n/format";
import { useLang } from "../i18n/lang-context";
import type { StringKey } from "../i18n/strings";
import { TeacherGate, useTeacher } from "../teacher/teacher-context";

const LINKS: [string, StringKey][] = [
  ["gapmap", "gapMap"],
  ["groups", "groups"],
  ["launch", "launchChapter"],
  ["weekly", "weekly"],
];

export function TeacherClassrooms() {
  return (
    <TeacherGate>
      <ClassroomList />
    </TeacherGate>
  );
}

function ClassroomList() {
  const { signOut } = useTeacher();
  const { ui } = useLang();
  const [classrooms, setClassrooms] = useState<ClassroomSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    apiClient()
      .getClassrooms()
      .then((list) => {
        if (live) setClassrooms(list);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{ui("myClassrooms")}</h1>
        <button
          type="button"
          onClick={() => void signOut()}
          className="min-h-11 px-2 text-brand-800 underline"
        >
          {ui("signOut")}
        </button>
      </header>
      {failed && <p role="alert">{ui("loadFailed")}</p>}
      {!failed && classrooms === null && <p role="status">{ui("loading")}</p>}
      {classrooms?.length === 0 && <p>{ui("noClassrooms")}</p>}
      <ul className="space-y-3">
        {classrooms?.map((c) => (
          <li key={c.id} className="space-y-2 rounded-lg bg-white p-4 shadow-sm">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">
                {format(ui("classLabel"), { level: c.classLevel, section: c.section })}
              </h2>
              <span className="font-mono text-sm text-slate-600">{c.code}</span>
            </div>
            <nav className="flex flex-wrap gap-2">
              {LINKS.map(([path, key]) => (
                <Link
                  key={path}
                  to={`/t/classrooms/${encodeURIComponent(c.id)}/${path}`}
                  className="flex min-h-11 items-center rounded-md border border-slate-300 px-3"
                >
                  {ui(key)}
                </Link>
              ))}
            </nav>
          </li>
        ))}
      </ul>
    </div>
  );
}
