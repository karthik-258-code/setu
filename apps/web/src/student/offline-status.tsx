import { useEffect, useState } from "react";
import { useLang } from "../i18n/lang-context";

/**
 * "Downloaded for offline" once the service worker has precached the app (the pack is already
 * in Dexie whenever this renders), and a notice while the phone is offline. Never blocks.
 */
export function OfflineStatus() {
  const { ui } = useLang();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [appCached, setAppCached] = useState(false);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  useEffect(() => {
    let live = true;
    // Absent in browsers without service workers and in tests; then only the pack is offline.
    const container = "serviceWorker" in navigator ? navigator.serviceWorker : undefined;
    if (!container) return;
    void container.ready.then(() => {
      if (live) setAppCached(true);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span
        data-testid="offline-ready"
        className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-900"
      >
        {ui(appCached ? "offlineReady" : "lessonsSaved")}
      </span>
      {!online && (
        <span
          role="status"
          data-testid="offline-now"
          className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900"
        >
          {ui("offlineNow")}
        </span>
      )}
    </div>
  );
}
