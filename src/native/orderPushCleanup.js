// Logout cleanup must also work in a rollback build whose native push plugin
// is excluded. Only opaque metadata is stored; account ownership is enforced
// again by the authenticated disable endpoint.
export function captureOrderPushOptOut(userId, storage) {
  try {
    const key = `gymdrobe-order-push:${userId}`, value = JSON.parse(storage.getItem(key) || "null");
    if (value?.owner !== userId || typeof value.binding !== "string" || !/^[a-f0-9]{64}$/.test(value.device)) return null;
    const captured = { ...value, optedIn: false, pendingDisable: true };
    try { storage.setItem(key, JSON.stringify(captured)); } catch { /* Still try authenticated server cleanup. */ }
    return captured;
  } catch { return null; }
}
export async function finishOrderPushOptOut(captured, api, storage) {
  await api.disable({ device: captured.device, binding: captured.binding });
  try {
    const key = `gymdrobe-order-push:${captured.owner}`, current = JSON.parse(storage.getItem(key) || "null");
    // A late cleanup acknowledgement cannot change a newer consent/binding.
    if (current?.owner === captured.owner && current.binding === captured.binding && current.optedIn === false) storage.setItem(key, JSON.stringify({ ...current, pendingDisable: false }));
  } catch { /* Server cleanup already succeeded. Do not block sign-out. */ }
}
