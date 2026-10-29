import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { currentSessionId } from "../data/session";
import { L } from "../i18n/l";
import { useLang } from "../i18n/lang-context";
import { MODE_LABEL } from "../student/mode-labels";
import { OfflineStatus } from "../student/offline-status";
import { SyncChip, useAutoSync } from "../student/sync-status";
import { recommend, renderReason, routeFor } from "../student/recommend";
import { StudentGate, useStudent } from "../student/student-context";
import type { StudentData } from "../student/student-context";

/** One card: what to do next and why. Due re-checks come first because the policy puts them first. */
export function StudentHome() {
  return <StudentGate>{(data) => <HomeCard data={data} />}</StudentGate>;
}

function HomeCard({ data }: { data: StudentData }) {
  const { db, now, signOut } = useStudent();
  const { ui } = useLang();
  const navigate = useNavigate();
  const { pack, state, launch, profile } = data;
  const rec = useMemo(
    () => recommend(pack, state, launch.chapterId, now(), currentSessionId()),
    [pack, state, launch.chapterId, now],
  );
  const concept = rec.conceptId === undefined ? undefined : pack.graph.concepts[rec.conceptId];
  const target = routeFor(rec);
  const sync = useAutoSync(db, profile.studentId, state.eventCount);

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <header className="flex items-center justify-between gap-2">
        <p className="text-lg font-semibold">
          {ui("hello")}, {profile.firstName}
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="min-h-11 px-2 text-brand-800 underline"
        >
          {ui("switchStudent")}
        </button>
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <OfflineStatus />
        <SyncChip status={sync} />
      </div>
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p
          data-testid="home-mode"
          className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-800 ring-1 ring-brand-100"
        >
          {ui(MODE_LABEL[rec.mode])}
        </p>
        {concept && (
          <h1 className="text-xl font-semibold">
            <L text={concept.title} />
          </h1>
        )}
        <p data-testid="home-reason">
          <L text={renderReason(pack, rec)} />
        </p>
        {target !== null && (
          <button
            type="button"
            onClick={() => navigate(target, { state: { recommendation: rec } })}
            className="min-h-12 w-full rounded-xl bg-brand-700 text-lg font-semibold text-white shadow-sm transition hover:bg-brand-800 active:scale-[0.99]"
          >
            {ui("start")}
          </button>
        )}
      </section>
      <Link to="/s/progress" className="block min-h-11 py-2 text-center text-brand-800 underline">
        {ui("myProgress")}
      </Link>
    </div>
  );
}
