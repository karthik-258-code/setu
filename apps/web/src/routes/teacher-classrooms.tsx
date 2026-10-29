import type { ClassroomSummary } from "@setu/shared";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../data/api";
import { format } from "../i18n/format";
import { useLang } from "../i18n/lang-context";
import type { StringKey } from "../i18n/strings";
import { TeacherGate, useTeacher } from "../teacher/teacher-context";

const LINKS: { path: string; key: StringKey; description: StringKey; icon: "groups" | "launch" | "paper" | "weekly" }[] = [
  { path: "groups", key: "groups", description: "groupsDescription", icon: "groups" },
  { path: "launch", key: "launchChapter", description: "launchDescription", icon: "launch" },
  { path: "paper-entry", key: "paperEntry", description: "paperEntryDescription", icon: "paper" },
  { path: "weekly", key: "weekly", description: "weeklyDescription", icon: "weekly" },
];

export function TeacherClassrooms() {
  return (
    <TeacherGate>
      <ClassroomList />
    </TeacherGate>
  );
}

function ActionIcon({ kind, className = "" }: { kind: "gapmap" | "groups" | "launch" | "paper" | "weekly"; className?: string }) {
  const paths: Record<typeof kind, ReactNode> = {
    gapmap: <><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /><path d="M7 7h0M17 7h0M7 17h0M17 17h0" /></>,
    groups: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20zM16 5.4a3 3 0 0 1 0 5.8M17 14a4.5 4.5 0 0 1 3.5 4.4V20h-3" /></>,
    launch: <><path d="M12 3 4 12l8 9 8-9-8-9Z" /><path d="M9 12h6M12 9v6" /></>,
    paper: <><path d="M7 3h8l4 4v14H7zM15 3v5h5M10 12h6M10 16h6" /><path d="m3 7 1.5 1.5L7 6" /></>,
    weekly: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 6-7" /><path d="M16 6h4v4" /></>,
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {paths[kind]}
    </svg>
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
    <div className="mx-auto w-full max-w-6xl space-y-7 sm:space-y-9">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5 sm:pb-6">
        <div className="min-w-0 space-y-2">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl">{ui("myClassrooms")}</h1>
          <p className="max-w-xl text-sm leading-6 text-slate-600 sm:text-base">{ui("classroomHomeIntro")}</p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="min-h-11 shrink-0 rounded-xl border border-slate-200 bg-white px-3 font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          {ui("signOut")}
        </button>
      </header>

      {failed && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 font-medium text-rose-900">{ui("loadFailed")}</p>}
      {!failed && classrooms === null && <p role="status" className="rounded-xl bg-white px-4 py-6 text-slate-600">{ui("loading")}</p>}
      {classrooms?.length === 0 && <p className="rounded-xl bg-white px-4 py-6 font-medium text-slate-600">{ui("noClassrooms")}</p>}

      <ul className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {classrooms?.map((c) => (
          <li key={c.id} className="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-200/80">
            <div className="flex flex-wrap items-end justify-between gap-4 bg-brand-50 px-5 py-5 sm:px-6 sm:py-6">
              <h2 className="text-2xl font-bold leading-tight tracking-tight text-brand-950 sm:text-3xl">
                {format(ui("classLabel"), { level: c.classLevel, section: c.section })}
              </h2>
              <div className="space-y-1 text-right">
                <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-brand-800">{ui("classroomCodeLabel")}</p>
                <p className="rounded-lg bg-white px-3 py-1.5 font-mono text-sm font-bold tracking-[0.08em] text-slate-800 ring-1 ring-brand-100">{c.code}</p>
              </div>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              <Link
                to={`/t/classrooms/${encodeURIComponent(c.id)}/gapmap`}
                className="group flex min-h-24 items-center gap-4 rounded-xl bg-brand-800 p-4 text-white shadow-sm transition hover:bg-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 sm:px-5"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-50 ring-1 ring-white/15">
                  <ActionIcon kind="gapmap" className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-bold leading-snug">{ui("gapMap")}</span>
                  <span className="mt-0.5 block text-sm leading-5 text-brand-100">{ui("gapMapDescription")}</span>
                </span>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1">
                  <path d="M4 12h15M13 6l6 6-6 6" />
                </svg>
              </Link>

              <nav aria-label={format(ui("classLabel"), { level: c.classLevel, section: c.section })}>
                <ul className="grid grid-cols-1 gap-x-5 sm:grid-cols-2">
                  {LINKS.map(({ path, key, description, icon }) => (
                    <li key={path} className="border-b border-slate-100 last:border-0 sm:last:border-b">
                      <Link
                        to={`/t/classrooms/${encodeURIComponent(c.id)}/${path}`}
                        className="group flex min-h-[5.25rem] items-center gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-inset"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-brand-800 ring-1 ring-slate-200 transition group-hover:bg-brand-50 group-hover:ring-brand-200">
                          <ActionIcon kind={icon} className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-bold leading-5 text-slate-900 group-hover:text-brand-900">{ui(key)}</span>
                          <span className="mt-0.5 block text-xs leading-5 text-slate-600">{ui(description)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
