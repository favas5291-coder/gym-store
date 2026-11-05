import { Capacitor } from "@capacitor/core";
import { createOrderPushSession } from "./orderPushSession.js";
import { notificationApi } from "../services/notificationApi.js";
import { captureOrderPushOptOut, finishOrderPushOptOut } from "./orderPushCleanup.js";

export const orderPushEnabled = () => Capacitor.isNativePlatform() && import.meta.env?.VITE_PUSH_ENABLED === "true";
let current = null, generation = 0, setup = Promise.resolve();
let snapshot = { status: "off", optedIn: false, userId: null };
const publish = value => { snapshot = value; globalThis.dispatchEvent?.(new CustomEvent("gymdrobe-order-push-status")); };
export const orderPushStatus = () => snapshot;
export function stopOrderPushSession(userId, token) {
  generation++;
  const old = current; current = null;
  let cleanup = old?.session.dispose();
  if (!old && userId && token) {
    try {
      const storage = globalThis.localStorage, captured = captureOrderPushOptOut(userId, storage);
      if (captured) cleanup = finishOrderPushOptOut(captured, notificationApi(token), storage).catch(() => {});
    } catch { /* A notification failure must not hold the shopping session open. */ }
  }
  setup = setup.catch(() => {}).then(() => cleanup).catch(() => {});
  publish({ status: "off", optedIn: false, userId: null });
  return setup;
}
export function setOrderPushSession(user, token, openOrder) {
  if (!orderPushEnabled()) return Promise.resolve();
  const userId = user?.id;
  if (current?.userId === userId && current?.token === token) { current.openOrder = openOrder; return setup; }
  const stop = stopOrderPushSession(), requested = generation;
  if (!userId || !token) return stop;
  setup = stop.then(async () => {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    if (requested !== generation) return;
    const owner = { userId, token, openOrder };
    const session = createOrderPushSession({ userId, plugin: PushNotifications, api: notificationApi(token), storage: localStorage,
      platform: Capacitor.getPlatform(), environment: Capacitor.getPlatform() === "ios" ? import.meta.env.VITE_APNS_ENVIRONMENT : "production",
      changed: value => { if (current === owner) publish(value); }, openOrder: path => { if (current === owner) owner.openOrder(path); } });
    owner.session = session; current = owner;
    await session.start();
  }).catch(() => publish({ userId, status: "error", optedIn: false, message: "Notifications could not start. Your shopping session is still available." }));
  return setup;
}
export const enableOrderPush = () => current?.session.enable();
export const disableOrderPush = () => current?.session.disable();
export const refreshOrderPush = () => current?.session.refresh();
globalThis.addEventListener?.("gymdrobe-account-deleted", () => { void stopOrderPushSession(); });
