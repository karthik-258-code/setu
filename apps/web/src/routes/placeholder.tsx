import { useParams } from "react-router-dom";
import { useLang } from "../i18n/lang-context";

/** The only placeholder in the app: shows the route name and its params until the screen lands. */
export function Placeholder({ name }: { name: string }) {
  const params = useParams();
  const { ui } = useLang();
  const entries = Object.entries(params);
  return (
    <section data-testid="placeholder" className="space-y-3">
      <h1 className="text-xl font-semibold text-brand-800">
        <span className="sr-only">{ui("screen")}: </span>
        <span data-testid="route-name">{name}</span>
      </h1>
      <dl className="rounded-lg bg-white p-3 text-sm shadow-sm">
        <dt className="font-medium text-slate-600">{ui("parameters")}</dt>
        {entries.length === 0 ? (
          <dd className="text-slate-500">{ui("noParameters")}</dd>
        ) : (
          entries.map(([key, value]) => (
            <dd key={key} data-testid={`param-${key}`} className="break-all font-mono">
              {key}={value}
            </dd>
          ))
        )}
      </dl>
    </section>
  );
}
