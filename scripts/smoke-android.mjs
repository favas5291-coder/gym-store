import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";

const output = "test-results/android";
const adb = (...args) => execFileSync("adb", args, { encoding: "utf8", timeout: 20000 }).trim();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await fs.mkdir(output, { recursive: true });
let socket;
let state;
const messages = [];
try {
  const pid = adb("shell", "pidof", "-s", "com.gymdrobe.app");
  assert.match(pid, /^\d+$/);
  adb("forward", "tcp:9222", `localabstract:webview_devtools_remote_${pid}`);
  let target;
  for (let attempt = 0; attempt < 30 && !target; attempt++) {
    try {
      const tabs = await (await fetch("http://127.0.0.1:9222/json")).json();
      target = tabs.find((tab) => tab.type === "page" && tab.webSocketDebuggerUrl);
    } catch { /* WebView debug server can start after the Activity. */ }
    if (!target) await delay(1000);
  }
  assert.ok(target, "Android WebView did not expose a debug target");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WebView debug connection timed out")), 10000);
    socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("WebView debug connection failed")); }, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject, timer } = pending.get(message.id);
      pending.delete(message.id); clearTimeout(timer);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown" || message.method === "Runtime.consoleAPICalled") {
      messages.push(message);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const call = ++id;
    const timer = setTimeout(() => { pending.delete(call); reject(new Error(`WebView ${method} timed out`)); }, 10000);
    pending.set(call, { resolve, reject, timer });
    socket.send(JSON.stringify({ id: call, method, params }));
  });
  const evaluate = async (expression) => {
    const response = await send("Runtime.evaluate", { expression, returnByValue: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  };
  await send("Runtime.enable");
  const snapshot = () => evaluate(`({
    href: location.href, title: document.title,
    platform: window.Capacitor?.getPlatform?.(), native: window.Capacitor?.isNativePlatform?.(),
    appPlugin: window.Capacitor?.isPluginAvailable?.('App'),
    pluginNames: window.Capacitor?.PluginHeaders?.map(p => p.name),
    headings: [...document.querySelectorAll('h1,h2')].map(el => el.textContent),
    nativeLoginVisible: [...document.querySelectorAll('.native-google-signin')].some(el => el.getClientRects().length > 0),
    appLinkSeen: window.__gymdrobeSmokeLink,
  })`);
  state = await snapshot();
  console.log("ANDROID_INITIAL", JSON.stringify(state));
  // Observe the real Android event as well as the resulting router navigation.
  await evaluate(`window.Capacitor.Plugins.App.addListener('appUrlOpen', event => { window.__gymdrobeSmokeLink = event.url; }); true`);
  adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "gymdrobe://app/login", "com.gymdrobe.app");
  for (let attempt = 0; attempt < 40; attempt++) {
    state = await snapshot();
    if (new URL(state.href).pathname === "/login" && state.nativeLoginVisible) break;
    await delay(1000);
  }
  console.log("ANDROID_LOGIN", JSON.stringify(state));
  assert.equal(state.native, true, "APK must use the native Capacitor bridge");
  assert.equal(new URL(state.href).pathname, "/login", "Android app link must navigate to login");
  assert.equal(state.nativeLoginVisible, true, "Native Google sign-in button must be visible");
} finally {
  await fs.writeFile(`${output}/webview-state.json`, JSON.stringify({ state, messages }, null, 2));
  socket?.close();
}
