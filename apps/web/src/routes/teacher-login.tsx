import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, exitDemoMode } from "../data/api";
import { useLang } from "../i18n/lang-context";
import { useTeacher } from "../teacher/teacher-context";

export function TeacherLogin() {
  const { signIn } = useTeacher();
  const { ui } = useLang();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFailed(false);
    try {
      exitDemoMode();
      const { accessToken } = await apiClient().login({ email: email.trim(), password });
      await signIn(accessToken);
      navigate("/t/classrooms");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const field = "min-h-12 w-full rounded-xl border border-slate-300 px-3 text-lg";
  return (
    <form onSubmit={(e) => void submit(e)} className="mx-auto w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{ui("teacherSignIn")}</h1>
      <label className="block space-y-1">
        <span className="font-medium">{ui("email")}</span>
        <input
          className={field}
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="block space-y-1">
        <span className="font-medium">{ui("password")}</span>
        <input
          className={field}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {failed && (
        <p role="alert" className="text-red-700">
          {ui("teacherLoginFailed")}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || email.trim() === "" || password === ""}
        className="min-h-14 w-full rounded-xl bg-brand-700 text-lg font-bold text-white shadow-soft transition hover:bg-brand-800 disabled:opacity-50"
      >
        {ui(busy ? "signingIn" : "signIn")}
      </button>
    </form>
  );
}
