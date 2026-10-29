import { userKey } from "./storage.js";
import { getKitGroup } from "./cartUtils.js";

export const shoppingSyncEnabled = () => import.meta.env?.VITE_SHOPPING_SYNC_ENABLED === "true";
const safeId = user => {
  const id = String(user?.id || "").toLowerCase();
  if (!/^[a-f0-9]{24}$/.test(id)) throw new Error("A verified account is required to save shopping changes.");
  return id;
};
export const journalPrefix = user => `gymdrobe-shopping-sync::${safeId(user)}:`;
export function shoppingStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}
const identifier = row => String(row?.productId ?? row?.id ?? row?._id ?? row?.legacyId ?? row);
export function compactShopping(cart, wishlist) {
  return {
    cart: cart.map(row => {
      const group = getKitGroup(row);
      return { productId: identifier(row), selectedSize: row.selectedSize == null ? null : String(row.selectedSize),
        selectedColor: row.selectedColor == null ? null : String(row.selectedColor), quantity: Number(row.quantity),
        ...(group ? { kitGroup: { id: group.id, kitId: group.kitId, version: group.version, name: group.name, level: group.level, slotKey: group.slotKey } } : {}) };
    }),
    wishlist: [...new Set(wishlist.map(identifier))],
  };
}
export const selectionKey = row => JSON.stringify([row.productId, row.selectedSize, row.selectedColor, row.kitGroup?.id || null, row.kitGroup?.slotKey || null]);
const withoutQuantity = ({ quantity, ...row }) => row;
export function shoppingChanges(before, after) {
  const changes = [], old = new Map(before.cart.map(row => [selectionKey(row), row]));
  for (const row of after.cart) {
    const key = selectionKey(row), previous = old.get(key);
    if (previous && JSON.stringify(withoutQuantity(previous)) !== JSON.stringify(withoutQuantity(row))) {
      changes.push({ type: "remove", line: withoutQuantity(previous) }, { type: "adjust", line: withoutQuantity(row), delta: row.quantity });
    } else {
      const delta = row.quantity - (previous?.quantity || 0);
      if (delta) changes.push({ type: "adjust", line: withoutQuantity(row), delta });
    }
    old.delete(key);
  }
  for (const row of old.values()) changes.push({ type: "remove", line: withoutQuantity(row) });
  const wishes = new Set(after.wishlist), previousWishes = new Set(before.wishlist);
  for (const id of wishes) if (!previousWishes.has(id)) changes.push({ type: "wish", productId: id, saved: true });
  for (const id of previousWishes) if (!wishes.has(id)) changes.push({ type: "wish", productId: id, saved: false });
  return changes;
}
function read(storage, key, fallback) {
  const raw = storage.getItem(key);
  return raw == null ? fallback : JSON.parse(raw);
}
function put(storage, key, value) {
  if (!storage) throw new Error("Device storage is unavailable.");
  const encoded = JSON.stringify(value), current = storage.getItem(key);
  if (current !== null && current !== encoded) throw new Error("This saved shopping change needs review.");
  storage.setItem(key, encoded);
  if (storage.getItem(key) !== encoded) throw new Error("This shopping change could not be saved.");
}
export function pendingShopping(user, { storage = shoppingStorage() } = {}) {
  if (!storage) throw new Error("Device storage is unavailable.");
  const candidates = captureShoppingJournal(user, { storage }).map(entry => {
    try { return { ...entry, parsed: JSON.parse(entry.value) }; } catch { return entry; }
  });
  const superseded = new Set(candidates.flatMap(entry =>
    entry.parsed?.changes?.some(change => change.type === "replace" && change.confirmed === true) && Array.isArray(entry.parsed.supersedes)
      ? entry.parsed.supersedes : []));
  const rows = [];
  for (const entry of candidates) {
    if (superseded.has(entry.id)) continue;
    const value = entry.parsed;
    if (!value || entry.id !== value.id || !Array.isArray(value.changes) || !Number.isSafeInteger(value.issuedAt)) {
      throw new Error("A saved shopping change needs review.");
    }
    rows.push(value);
  }
  if (rows.length > 500) throw new Error("Your saved shopping changes need review.");
  return rows.sort((a, b) => Number(Boolean(b.supersedes)) - Number(Boolean(a.supersedes)) ||
    Number(b.changes[0]?.type === "seed") - Number(a.changes[0]?.type === "seed") || a.issuedAt - b.issuedAt || a.id.localeCompare(b.id));
}
export function captureShoppingJournal(user, { storage = shoppingStorage() } = {}) {
  if (!storage) throw new Error("Device storage is unavailable.");
  const prefix = journalPrefix(user) + "op:", entries = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) entries.push({ key, id: key.slice(prefix.length), value: storage.getItem(key) });
  }
  return entries;
}
export function appendShopping(user, changes, { storage = shoppingStorage(), now = Date.now, uuid = () => crypto.randomUUID(), id, issuedAt, supersedes, reviewRevision } = {}) {
  if (!changes.length) return null;
  const count = supersedes ? captureShoppingJournal(user, { storage }).filter(entry => !supersedes.includes(entry.id)).length : pendingShopping(user, { storage }).length;
  if (count >= 500) throw new Error("Your saved shopping changes need review.");
  const entry = { id: id || uuid(), issuedAt: issuedAt ?? now(), changes, ...(supersedes ? { supersedes } : {}),
    ...(reviewRevision !== undefined ? { reviewRevision } : {}) };
  put(storage, journalPrefix(user) + "op:" + entry.id, entry);
  globalThis.dispatchEvent?.(new Event("gymdrobe-shopping-change"));
  return entry;
}
export function markShoppingReviewed(user, { storage = shoppingStorage() } = {}) {
  const value = JSON.stringify({ seedId: "review-" + crypto.randomUUID() });
  const key = journalPrefix(user) + "initialized";
  storage.setItem(key, value);
  if (storage.getItem(key) !== value) throw new Error("Device storage could not save your review.");
}
export function initializeShoppingJournal(user, options = {}) {
  const storage = options.storage ?? shoppingStorage(), prefix = journalPrefix(user);
  if (!storage) throw new Error("Device storage is unavailable.");
  const initialized = read(storage, prefix + "initialized", null);
  if (initialized !== null) {
    if (!initialized || typeof initialized.seedId !== "string") throw new Error("Your saved shopping information needs review.");
    return;
  }
  const selection = compactShopping(read(storage, userKey("gymdrobe-cart", user), []), read(storage, userKey("gymdrobe-wishlist", user), []));
  const entry = appendShopping(user, [{ type: "seed", selection }], { ...options, storage });
  // Repeated seeds merge by maximum, so even an interrupted marker write cannot
  // duplicate quantities. Guest additions are separate durable operations.
  storage.setItem(prefix + "initialized", JSON.stringify({ seedId: entry.id }));
}
export function recordShoppingChange(user, before, after, options = {}) {
  initializeShoppingJournal(user, options);
  return appendShopping(user, shoppingChanges(before, after), options);
}
export function acknowledgeShopping(user, entry, { storage = shoppingStorage() } = {}) {
  const key = journalPrefix(user) + "op:" + entry.id;
  const saved = storage.getItem(key);
  if (saved !== null && saved !== JSON.stringify(entry)) throw new Error("The saved shopping change changed while syncing.");
  for (const id of entry.supersedes || []) {
    const oldKey = journalPrefix(user) + "op:" + id;
    if (oldKey === key) continue;
    storage.removeItem(oldKey);
    if (storage.getItem(oldKey) !== null) throw new Error("Device storage could not clear the reviewed changes.");
  }
  storage.removeItem(key);
  if (storage.getItem(key) !== null) throw new Error("The saved shopping receipt could not be cleared.");
}
export function clearShoppingJournal(user, { storage = shoppingStorage() } = {}) {
  if (!storage) return;
  const prefix = journalPrefix(user), keys = [];
  for (let index = 0; index < storage.length; index++) if (storage.key(index)?.startsWith(prefix)) keys.push(storage.key(index));
  for (const key of keys) storage.removeItem(key);
}
