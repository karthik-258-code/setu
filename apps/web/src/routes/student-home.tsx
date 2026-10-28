import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { currentSessionId } from "../data/session";
import { L } from "../i18n/l";
import { useLang } from "../i18n/lang-context";
import { MODE_LABEL } from "../student/mode-labels";
import { OfflineStatus } from "../student/offline-status";
import { recommend, renderReason, routeFor } from "../student/recommend";
import { StudentGate, useStudent } from "../student/student-context";
import type { StudentData } from "../student/student-context";

/** One card: what to do next and why. Due re-checks come first because the policy puts them first. */
export function StudentHome() {
  return <StudentGate>{(data) => <HomeCard data={data} />}</StudentGate>;
}

function HomeCard({ data }: { data: StudentData }) {
  const { now, signOut } = useStudent();
  const { ui } = useLang();
  const navigate = useNavigate();
  const { pack, state, launch, profile } = data;
  const rec = useMemo(
    () => recommend(pack, state, launch.chapterId, now(), currentSessionId()),
    [pack, state, launch.chapterId, now],
  );
  const concept = rec.conceptId === undefined ? undefined : pack.graph.concepts[rec.conceptId];
  const target = routeFor(rec);

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
      <OfflineStatus />
      <section className="space-y-3 rounded-lg bg-white p-4 shadow-sm">
        <p
          data-testid="home-mode"
          className="inline-block rounded bg-slate-100 px-2 py-0.5 text-sm font-medium text-slate-800"
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
            className="min-h-12 w-full rounded-md bg-brand-700 text-lg font-semibold text-white"
          >
            {ui("start")}
          </button>
        )}
      </section>
    </div>
  );
}
