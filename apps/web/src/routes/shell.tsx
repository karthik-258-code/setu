import { Link, Outlet } from "react-router-dom";
import { LANGUAGES } from "../i18n/strings";
import { useLang } from "../i18n/lang-context";

export function Shell() {
  const { lang, setLang, ui } = useLang();
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-h-11 items-center gap-3 text-lg font-bold tracking-tight text-brand-800">
          <svg aria-hidden="true" viewBox="0 0 32 32" className="h-8 w-8 shrink-0">
            <rect width="32" height="32" rx="10" fill="currentColor" />
            <path d="M8 20c2.2-5.5 5-8 8-8s5.8 2.5 8 8M8 22h16" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="2.2" />
          </svg>
          {ui("appName")}
        </Link>
        <div role="group" aria-label={ui("language")} className="flex gap-1 rounded-full bg-slate-100 p-1 ring-1 ring-slate-200">
          {LANGUAGES.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              lang={code}
              aria-pressed={lang === code}
              onClick={() => setLang(code)}
                className={`min-h-11 min-w-12 rounded-full px-3 text-sm font-semibold transition-colors ${
                lang === code ? "bg-white text-brand-800 shadow-soft" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      <main className="mx-auto w-full max-w-screen-2xl flex-1 p-4 sm:p-6 lg:px-8 lg:py-7">
        <Outlet />
      </main>
    </div>
  );
}
