import { Link, Outlet } from "react-router-dom";
import { LANGUAGES } from "../i18n/strings";
import { useLang } from "../i18n/lang-context";

export function Shell() {
  const { lang, setLang, ui } = useLang();
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col">
      <header className="flex items-center justify-between gap-2 bg-brand-700 px-4 py-3 text-white">
        <Link to="/" className="text-lg font-bold">
          {ui("appName")}
        </Link>
        <div role="group" aria-label={ui("language")} className="flex gap-1">
          {LANGUAGES.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              lang={code}
              aria-pressed={lang === code}
              onClick={() => setLang(code)}
              className={`min-h-11 min-w-11 rounded-md px-3 text-sm font-medium ${
                lang === code ? "bg-white text-brand-800" : "bg-brand-800 text-white"
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
