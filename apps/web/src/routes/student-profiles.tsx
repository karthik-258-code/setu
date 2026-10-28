import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import type { Profile } from "../data/db";
import { PIN_PATTERN } from "../data/pin";
import { checkPin, listProfiles } from "../data/profiles";
import { useLang } from "../i18n/lang-context";
import { useStudent } from "../student/student-context";

/** Shared-device profile switcher: pick your name, enter your PIN. */
export function StudentProfiles() {
  const { db, signIn } = useStudent();
  const { ui } = useLang();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [chosen, setChosen] = useState<Profile | null>(null);
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    void listProfiles(db).then(setProfiles);
  }, [db]);

  if (profiles === null) return <p role="status">{ui("loading")}</p>;
  if (profiles.length === 0) return <Navigate to="/s/login" replace />;

  async function open(event: FormEvent, profile: Profile) {
    event.preventDefault();
    if (!(await checkPin(db, profile.studentId, pin))) {
      setWrong(true);
      setPin("");
      return;
    }
    await signIn(profile.studentId);
    navigate("/s/home");
  }

  if (chosen) {
    return (
      <form onSubmit={(e) => void open(e, chosen)} className="mx-auto max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">{chosen.firstName}</h1>
        <label className="block space-y-1">
          <span className="font-medium">{ui("enterPin")}</span>
          <input
            className="min-h-12 w-full rounded-md border border-slate-300 px-3 text-lg"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
          />
        </label>
        {wrong && (
          <p role="alert" className="text-red-700">
            {ui("wrongPin")}
          </p>
        )}
        <button
          type="submit"
          disabled={!PIN_PATTERN.test(pin)}
          className="min-h-12 w-full rounded-md bg-brand-700 text-lg font-semibold text-white disabled:opacity-50"
        >
          {ui("open")}
        </button>
        <button
          type="button"
          onClick={() => {
            setChosen(null);
            setPin("");
            setWrong(false);
          }}
          className="min-h-11 w-full text-brand-800 underline"
        >
          {ui("back")}
        </button>
      </form>
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-3">
      <h1 className="text-xl font-semibold">{ui("whoIsLearning")}</h1>
      <ul className="space-y-2">
        {profiles.map((p) => (
          <li key={p.studentId}>
            <button
              type="button"
              onClick={() => setChosen(p)}
              className="flex min-h-14 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-4 text-left text-lg"
            >
              <span>{p.firstName}</span>
              <span className="text-sm text-slate-600">
                {ui("rollShort")} {p.rollNo}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Link to="/s/login" className="block min-h-11 py-2 text-center text-brand-800 underline">
        {ui("addStudent")}
      </Link>
    </div>
  );
}
