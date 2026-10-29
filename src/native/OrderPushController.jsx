import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { orderPushEnabled, setOrderPushSession, refreshOrderPush } from "./orderPush.js";
import { nativePaymentActive } from "./payment.js";
export default function OrderPushController() {
  const { user, token } = useAuth(), navigate = useNavigate(), navigation = useRef(navigate);
  navigation.current = navigate;
  useEffect(() => {
    if (!orderPushEnabled()) return;
    void setOrderPushSession(user, token, path => { if (!nativePaymentActive()) navigation.current(path); });
  }, [user?.id, token]);
  useEffect(() => {
    if (!orderPushEnabled()) return;
    let cancelled = false, handle;
    import("@capacitor/app").then(async ({ App }) => {
      const listener = await App.addListener("appStateChange", ({ isActive }) => { if (isActive) void refreshOrderPush(); });
      if (cancelled) await listener.remove(); else handle = listener;
    }).catch(() => {});
    return () => { cancelled = true; void handle?.remove(); };
  }, []);
  return null;
}
