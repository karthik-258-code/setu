import { Link } from "react-router-dom";
import { useLang } from "../i18n/lang-context";
import type { StringKey } from "../i18n/strings";
import { Placeholder } from "./placeholder";

const ROLES: [string, StringKey][] = [
  ["/s/login", "roleStudent"],
  ["/t/login", "roleTeacher"],
  ["/demo", "roleDemo"],
];

export function RoleChooser() {
  const { ui } = useLang();
  return (
    <div className="space-y-4">
      <Placeholder name="role-chooser" />
      <nav className="flex flex-col gap-2">
        {ROLES.map(([to, key]) => (
          <Link
            key={to}
            to={to}
            className="flex min-h-12 items-center rounded-lg bg-white px-4 shadow-sm"
          >
            {ui(key)}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function Demo() {
  return <Placeholder name="demo" />;
}
