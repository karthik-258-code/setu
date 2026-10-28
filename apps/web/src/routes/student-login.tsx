import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "../data/api";
import { refreshLaunch } from "../data/launch";
import { PIN_PATTERN } from "../data/pin";
import { listProfiles, saveProfile } from "../data/profiles";
import { useLang } from "../i18n/lang-context";
import { useStudent } from "../student/student-context";

const field = "min-h-12 w-full rounded-md border border-slate-300 px-3 text-lg";

/** Classroom code + roll number + 4-digit PIN; adds the student's profile to this device. */
export function StudentLogin() {
  const { db, signIn } = useStudent();
  const { ui } = useLang();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hasProfiles, setHasProfiles] = useState(false);

  useEffect(() => {
    void listProfiles(db).then((profiles) => setHasProfiles(profiles.length > 0));
  }, [db]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFailed(false);
    try {
      const client = apiClient();
      const { student } = await client.studentLogin({
        classroomCode: code.trim().toUpperCase(),
        rollNo: rollNo.trim(),
        pin,
      });
      await saveProfile(db, student, pin);
      await refreshLaunch(db, client, student.classroomId);
      await signIn(student.studentId);
      navigate("/s/home");
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mx-auto max-w-sm space-y-4">
      <label className="block space-y-1">
        <span className="font-medium">{ui("classroomCode")}</span>
        <input
          className={field}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          required
        />
      </label>
      <label className="block space-y-1">
        <span className="font-medium">{ui("rollNo")}</span>
        <input
          className={field}
          value={rollNo}
          onChange={(e) => setRollNo(e.target.value)}
          inputMode="numeric"
          autoComplete="off"
          required
        />
      </label>
      <label className="block space-y-1">
        <span className="font-medium">{ui("pin")}</span>
        <input
          className={field}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          required
        />
      </label>
      {failed && (
        <p role="alert" className="text-red-700">
          {ui("loginFailed")}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !PIN_PATTERN.test(pin)}
        className="min-h-12 w-full rounded-md bg-brand-700 text-lg font-semibold text-white disabled:opacity-50"
      >
        {busy ? ui("signingIn") : ui("signIn")}
      </button>
      {hasProfiles && (
        <Link to="/s/profiles" className="block text-center text-brand-800 underline">
          {ui("switchStudent")}
        </Link>
      )}
    </form>
  );
}
