import { useLayoutEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { isNativeApp, nativeRouteFromUrl, nativeRouteFromEvent } from "./platform.js";
import { clearInterruptedNativePayment, interruptedNativePayment, nativePaymentActive } from "./payment.js";
import "./native.css";

export default function NativeAppController() {
  const navigate = useNavigate();
  const navigation = useRef(navigate);
  navigation.current = navigate;
  useLayoutEffect(() => {
    const go = (...args) => navigation.current(...args);
    if (!isNativeApp()) return;
    document.documentElement.classList.add("gymdrobe-native");
    let disposed = false;
    const listeners = [];
    const listen = async (app, event, callback) => {
      const handle = await app.addListener(event, callback);
      if (disposed) await handle.remove();
      else listeners.push(handle);
    };
    const openLink = (event) => {
      const route = nativeRouteFromEvent(event);
      const blocked = nativePaymentActive();
      if (window.Capacitor?.DEBUG) console.info("Native route decision", JSON.stringify({ eventType: typeof event, route: route?.split("?")[0] || null, blocked }));
      if (route && !blocked) go(route);
    };
    const externalLink = async (event) => {
      const anchor = event.target.closest?.("a[href]");
      if (!anchor || event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey) return;
      let url;
      try { url = new URL(anchor.href); } catch { return; }
      if (!["https:", "http:"].includes(url.protocol) || url.origin === location.origin) return;
      event.preventDefault();
      const internal = nativeRouteFromUrl(url.href);
      if (internal) { if (!nativePaymentActive()) go(internal); return; }
      // Keep remote sites outside the WebView and its native bridge.
      try { const { Browser } = await import("@capacitor/browser"); await Browser.open({ url: url.href }); } catch { /* Keep the current page if opening fails. */ }
    };
    document.addEventListener("click", externalLink);

    async function start() {

      const { App } = await import("@capacitor/app");
      if (disposed) return;
      await listen(App, "appUrlOpen", openLink);
      // A keyboard plugin failure must not stop app links or payment recovery.
      import("@capacitor/keyboard").then(async ({ Keyboard }) => {
        await listen(Keyboard, "keyboardWillShow", () => document.documentElement.classList.add("native-keyboard-open"));
        await listen(Keyboard, "keyboardWillHide", () => document.documentElement.classList.remove("native-keyboard-open"));
      }).catch(() => {});
      await listen(App, "backButton", async () => {
        if (nativePaymentActive()) return;
        const dialog = [...document.querySelectorAll('[role="dialog"], dialog[open]')].find((element) => element.getAttribute("aria-hidden") !== "true" && element.getClientRects().length > 0);
        if (dialog) { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return; }
        const focused = document.activeElement;
        if (focused?.matches("input, textarea, [contenteditable=true]")) {
          focused.blur();
          const { Keyboard } = await import("@capacitor/keyboard");
          await Keyboard.hide();
          return;
        }
        if (Number(history.state?.idx) > 0) go(-1);
        else if (location.pathname !== "/") go("/", { replace: true });
        else await App.minimizeApp();
      });
      await listen(App, "appRestoredResult", (result) => {
        if (result.pluginId === "GymDrobeCheckout") {
          clearInterruptedNativePayment();
          go("/checkout", { replace: true });
        }
      });
      const launched = await App.getLaunchUrl();
      if (disposed) return;
      if (interruptedNativePayment()) {
        clearInterruptedNativePayment();
        go("/checkout", { replace: true });
      } else if (launched?.url) openLink(launched);
      const { SplashScreen } = await import("@capacitor/splash-screen");
      await SplashScreen.hide();
    }
    start().catch((error) => {
      console.warn("Native app controls could not start:", error.code || error.message);
    });
    return () => {
      disposed = true;
      document.removeEventListener("click", externalLink);
      for (const handle of listeners) handle.remove();
    };
  }, []);
  return null;
}
