export function clearDeletedAccountData(user, storage = localStorage, transient = sessionStorage) {
  if (!user?.id) return;
  globalThis.dispatchEvent?.(new CustomEvent("gymdrobe-account-deleted", { detail: { userId: user.id } }));
  for (const area of [storage, transient]) {
    for (const key of Object.keys(area)) {
      if ((key.startsWith("gymdrobe-") && key.endsWith(`:${user.id}`)) ||
          key.startsWith(`gymdrobe-shopping-sync::${String(user.id).toLowerCase()}:`)) area.removeItem(key);
    }
  }
  for (const key of ["gymdrobe-support-tickets", "gymdrobe-orders"]) {
    const raw = storage.getItem(key);
    if (!raw) continue;
    const rows = JSON.parse(raw);
    if (Array.isArray(rows)) storage.setItem(key, JSON.stringify(rows.filter((row) => row.ownerKey !== `user:${user.id}` && row.userId !== user.id)));
  }
}
