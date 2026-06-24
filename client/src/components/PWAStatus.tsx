import { useEffect, useState } from "react";
import { Icon } from "./Icon";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Thin status bar: shows an offline notice when the network drops, and an
 * "Install" affordance when the browser fires `beforeinstallprompt`.
 */
export function PWAStatus() {
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" && !navigator.onLine,
  );
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setInstallEvt(null));
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  async function install() {
    if (!installEvt) return;
    await installEvt.prompt();
    await installEvt.userChoice;
    setInstallEvt(null);
  }

  if (offline) {
    return (
      <div className="bg-error-container text-on-error-container text-label-md px-container-margin py-2 flex items-center gap-2 justify-center">
        <Icon name="cloud_off" size={16} />
        Offline — showing cached data.
      </div>
    );
  }

  if (installEvt) {
    return (
      <div className="bg-primary-container text-on-primary-container text-label-md px-container-margin py-2 flex items-center gap-3 justify-center">
        <Icon name="install_mobile" size={16} />
        <span>Install AutoHired for one-tap access</span>
        <button
          onClick={install}
          className="bg-primary text-on-primary px-3 py-1 rounded-full text-label-sm active:scale-95 transition-transform"
        >
          Install
        </button>
        <button
          onClick={() => setInstallEvt(null)}
          aria-label="Dismiss"
          className="opacity-70 hover:opacity-100"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
    );
  }

  return null;
}
