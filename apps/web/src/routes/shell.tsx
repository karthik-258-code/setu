import { Link, Outlet } from "react-router-dom";
import { LANGUAGES } from "../i18n/strings";
import { useLang } from "../i18n/lang-context";

export function Shell() {
  const { lang, setLang, ui } = useLang();
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-brand-800">
          <span aria-hidden="true" className="inline-block h-7 w-7 rounded-lg bg-brand-700" />
          {ui("appName")}
        </Link>
        <div role="group" aria-label={ui("language")} className="flex gap-1 rounded-full bg-slate-100 p-1">
          {LANGUAGES.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              lang={code}
              aria-pressed={lang === code}
              onClick={() => setLang(code)}
              className={`min-h-9 min-w-11 rounded-full px-3 text-sm font-medium transition-colors ${
                lang === code ? "bg-white text-brand-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
