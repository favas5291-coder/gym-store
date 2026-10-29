// Tokens stay in memory. Saved choices contain only random IDs and opt-in.
export function createOrderPushSession({ userId, plugin, api, storage, platform, environment,
  uuid = () => crypto.randomUUID(), now = Date.now, changed = () => {}, openOrder = () => {} }) {
  const key = `gymdrobe-order-push:${userId}`;
  let active = true, record = null, listeners = [], pending = Promise.resolve(), timer, busy = false;
  const emit = (status, message = "") => { if (active) changed({ userId, status, message, optedIn: record?.optedIn === true }); };
  const save = value => { storage.setItem(key, JSON.stringify(value)); record = value; };
  const read = () => { const raw = storage.getItem(key); return raw ? JSON.parse(raw) : null; };
  const valid = value => value && value.owner === userId && /^[a-f0-9-]{36}$/i.test(value.binding) && /^[a-f0-9-]{36}$/i.test(value.installationId) && Number.isSafeInteger(value.claimAt);
  const cancelTimer = () => { clearTimeout(timer); timer = null; };
  async function disableBinding(value) {
    if (value?.device && value?.binding) await api.disable({ device: value.device, binding: value.binding });
  }
  async function onToken(event) {
    if (!active || !record?.optedIn || typeof event?.value !== "string") return;
    const captured = { ...record };
    pending = pending.catch(() => {}).then(async () => {
      if (!active || record?.binding !== captured.binding || !record.optedIn) return;
      const result = await api.register({ installationId: captured.installationId, binding: captured.binding,
        token: event.value, platform, environment, orderUpdates: true, refresh: captured.registered === true, claimAt: captured.claimAt });
      cancelTimer();
      if (!active || record?.binding !== captured.binding || !record.optedIn) {
        await disableBinding(result).catch(() => {}); return;
      }
      try { save({ ...record, device: result.device, registered: true, pendingDisable: false }); }
      catch { await disableBinding(result).catch(() => {}); await plugin.unregister().catch(() => {}); throw new Error("STORAGE_UNAVAILABLE"); }
      emit("on", "Order updates are on for this device.");
    }).catch(() => { cancelTimer(); emit("error", "Order updates could not be saved. Retry or turn them off."); });
    return pending;
  }
  async function register() {
    emit("registering", "Saving this device’s order updates…");
    cancelTimer();
    timer = setTimeout(() => emit("error", "The device did not finish registration. Please retry."), 20000);
    await plugin.register();
  }
  async function start() {
    try {
      record = read();
      if (record && !valid(record)) throw new Error("STORAGE_UNAVAILABLE");
      const listen = async (name, callback) => {
        const handle = await plugin.addListener(name, callback);
        if (!active) await handle.remove(); else listeners.push(handle);
      };
      await listen("registration", onToken);
      await listen("registrationError", () => { cancelTimer(); emit("error", "This device could not register. Please retry."); });
      await listen("pushNotificationActionPerformed", event => {
        if (!active) return;
        const url = event?.notification?.data?.url;
        if (typeof url === "string" && /^https:\/\/www\.gymdrobe\.com\/orders\/[a-f0-9]{24}$/i.test(url)) openOrder(new URL(url).pathname);
      });
      await refresh();
    } catch { emit("error", "Notification settings could not load. Your shopping session is still available."); }
  }
  async function refresh() {
    if (!active) return;
    try {
      const settings = await api.read();
      if (!active) return;
      if (!settings.available) { emit("unavailable", "Order notifications are not available yet."); return; }
      if (record?.pendingDisable) {
        await disableBinding(record);
        if (!active) return;
        save({ ...record, pendingDisable: false });
      }
      if (!record?.optedIn) { emit("off", "Order updates are off for this device."); return; }
      const owned = settings.devices.some(device => device._id === record.device && device.binding === record.binding && device.enabled);
      if (record.registered && !owned) { save({ ...record, optedIn: false, registered: false }); emit("off", "Order updates are off. Choose them again for this account."); return; }
      const permission = await plugin.checkPermissions();
      if (!active) return;
      if (permission.receive !== "granted") { emit("denied", "Allow notifications in your phone’s settings, then retry."); return; }
      await register(); // Restoration never requests permission.
    } catch { emit("error", "Notification settings could not load. Your shopping session is still available."); }
  }
  async function enable() {
    if (!active || busy) return;
    busy = true;
    try {
      const settings = await api.read();
      if (!active) return;
      if (!settings.available) { emit("unavailable", "Order notifications are not available yet."); return; }
      let permission = await plugin.checkPermissions();
      if (!active) return;
      if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") permission = await plugin.requestPermissions();
      if (!active) return;
      if (permission.receive !== "granted") { emit("denied", "Allow notifications in your phone’s settings, then retry."); return; }
      const raw = storage.getItem("gymdrobe-notification-installation");
      const previous = raw ? JSON.parse(raw) : null;
      const installation = { id: previous?.id || uuid(), claimAt: Math.max(now(), (previous?.claimAt || 0) + 1) };
      storage.setItem("gymdrobe-notification-installation", JSON.stringify(installation));
      save({ owner: userId, installationId: installation.id, binding: uuid(), claimAt: installation.claimAt, optedIn: true, registered: false });
      if (platform === "android") await plugin.createChannel({ id: "gymdrobe-orders", name: "Order updates", description: "Updates to your GymDrobe orders", importance: 3, visibility: 0 });
      if (active) await register();
    } catch { cancelTimer(); emit("error", "Order updates could not be enabled. Please retry."); }
    finally { busy = false; }
  }
  function disable() {
    cancelTimer();
    const old = record;
    if (old) record = { ...old, optedIn: false, pendingDisable: Boolean(old.device) };
    try { if (record) save(record); }
    catch { emit("error", "This device could not save your preference. Check your phone’s notification settings."); }
    pending = pending.catch(() => {}).then(async () => {
      try {
        await disableBinding(old);
        if (active && record?.binding === old?.binding && record) save({ ...record, pendingDisable: false });
      } catch { emit("error", "Reconnect to finish turning off updates. You can also disable notifications in your phone’s settings."); }
      finally { await plugin.unregister().catch(() => {}); }
    });
    emit("off", "Order updates are off for this device.");
    return pending;
  }
  function dispose() {
    const done = disable(); active = false; cancelTimer();
    for (const handle of listeners) void handle.remove(); listeners = [];
    return done;
  }
  return { start, refresh, enable, disable, dispose };
}
