import { createContext, useContext, useEffect, useRef, useState } from "react";

const PwaContext = createContext(null);

export default function PwaProvider({ children }) {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [updateReady, setUpdateReady] = useState(false);
  const registration = useRef(null);
  const applyingUpdate = useRef(false);

  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const readDisplay = () => setInstalled(display.matches || navigator.standalone === true);
    const capturePrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const didInstall = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    const readConnection = () => setOnline(navigator.onLine);
    readDisplay();
    display.addEventListener("change", readDisplay);
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", didInstall);
    window.addEventListener("online", readConnection);
    window.addEventListener("offline", readConnection);
    return () => {
      display.removeEventListener("change", readDisplay);
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", didInstall);
      window.removeEventListener("online", readConnection);
      window.removeEventListener("offline", readConnection);
    };
  }, []);

  useEffect(() => {
    // Development and preview fixtures must not install a persistent worker.
    if (!import.meta.env.PROD || !window.isSecureContext || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    let stopWatching = () => {};
    const controllerChanged = () => {
      // A new release must never reload an active shopping or payment session.
      if (applyingUpdate.current) window.location.reload();
    };
    const register = async () => {
      try {
        const worker = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        if (cancelled) return;
        registration.current = worker;
        setUpdateReady(Boolean(worker.waiting));
        let installing;
        const stateChanged = () => {
          if (installing?.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateReady(Boolean(worker.waiting));
          }
        };
        const watch = () => {
          installing?.removeEventListener("statechange", stateChanged);
          installing = worker.installing;
          installing?.addEventListener("statechange", stateChanged);
        };
        watch();
        worker.addEventListener("updatefound", watch);
        stopWatching = () => {
          worker.removeEventListener("updatefound", watch);
          installing?.removeEventListener("statechange", stateChanged);
        };
      } catch (error) {
        // Installation support is optional; the storefront stays usable.
        console.warn("GymDrobe offline support could not start:", error.message);
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", controllerChanged);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => {
      cancelled = true;
      stopWatching();
      window.removeEventListener("load", register);
      navigator.serviceWorker.removeEventListener("controllerchange", controllerChanged);
    };
  }, []);

  async function install() {
    if (!installPrompt) return "unavailable";
    // Browser prompts are single-use and must run directly from the user's click.
    const prompt = installPrompt;
    setInstallPrompt(null);
    try {
      await prompt.prompt();
      return (await prompt.userChoice).outcome;
    } catch {
      return "unavailable";
    }
  }

  function update() {
    const waiting = registration.current?.waiting;
    if (!waiting) return;
    applyingUpdate.current = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
  }

  return <PwaContext.Provider value={{ canInstall: Boolean(installPrompt), installed, online, updateReady, install, update }}>{children}</PwaContext.Provider>;
}

export function usePwa() {
  return useContext(PwaContext);
}
