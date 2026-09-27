import { makeId, readStorage, userKey, writeStorage } from "./storage.js";
export const EMPTY_ADDRESS = {
  fullName: "",
  email: "",
  phone: "",
  addressLine: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
  label: "Home",
};
export function normalizeAddress(value = {}) {
  return {
    ...EMPTY_ADDRESS,
    ...value,
    fullName: String(value.fullName || value.name || ""),
    addressLine: String(value.addressLine || value.address || ""),
  };
}
export function addressErrors(address) {
  const result = {},
    text = (key) => String(address[key] || "").trim();
  if (text("fullName").length < 2) result.fullName = "Enter your full name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text("email")))
    result.email = "Enter a valid email.";
  if (!/^[6-9]\d{9}$/.test(text("phone")))
    result.phone = "Enter a valid 10-digit Indian mobile number.";
  if (text("addressLine").length < 5)
    result.addressLine = "Enter your house number and street.";
  if (!text("city")) result.city = "Enter your city.";
  if (!text("state")) result.state = "Enter your state.";
  if (!/^[1-9]\d{5}$/.test(text("pincode")))
    result.pincode = "Enter a valid 6-digit pincode.";
  return result;
}
export function getAddresses(user) {
  if (!user) return [];
  const value = readStorage(userKey("gymdrobe-addresses", user), []);
  return Array.isArray(value)
    ? value
        .filter((item) => item && item.id)
        .map((item) =>
          normalizeAddress({ ...item, email: item.email || user.email }),
        )
    : [];
}
export function saveAddresses(user, addresses) {
  return (
    Boolean(user) &&
    writeStorage(userKey("gymdrobe-addresses", user), addresses)
  );
}
function guestId() {
  const key = "gymdrobe-guest-id";
  let id = readStorage(key, null);
  if (typeof id !== "string") {
    id = makeId("guest");
    writeStorage(key, id);
  }
  return id;
}
export function ownerKey(user) {
  return user ? `user:${user.id}` : guestId();
}
export function allOrders() {
  const value = readStorage("gymdrobe-orders", []);
  return Array.isArray(value)
    ? value.filter(
        (order) =>
          order &&
          order.id &&
          Array.isArray(order.items) &&
          order.items.every(
            (item) =>
              item &&
              typeof item.name === "string" &&
              Number.isSafeInteger(Number(item.quantity)) &&
              Number(item.quantity) > 0 &&
              Number.isFinite(Number(item.price)),
          ),
      )
    : [];
}
export function ownsOrder(order, user) {
  if (order.ownerKey) return order.ownerKey === ownerKey(user);
  if (user)
    return (
      String(order.user?.id || "") === String(user.id) ||
      (!order.user?.id &&
        String(order.user?.email || "").toLowerCase() ===
          user.email.toLowerCase())
    );
  const legacy = readStorage("gymdrobe-last-order:guest", null);
  return !order.user && legacy?.id === order.id;
}
export function getOrders(user) {
  return allOrders()
    .filter((order) => ownsOrder(order, user))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
export function getOrder(id, user) {
  return getOrders(user).find((order) => String(order.id) === String(id));
}
export function persistOrder(order) {
  const existing = allOrders();
  const saved = writeStorage("gymdrobe-orders", [
    order,
    ...existing.filter((item) => item.id !== order.id),
  ]);
  if (saved && typeof window !== "undefined")
    window.dispatchEvent(new Event("gymdrobe-orders-updated"));
  return saved;
}
export function updateOrder(id, user, transform) {
  const order = getOrder(id, user);
  if (!order) return null;
  const next = { ...transform(order), updatedAt: new Date().toISOString() };
  return persistOrder(next) ? next : null;
}
export function orderTotal(order) {
  return Number(
    order.pricing?.finalTotal ?? order.pricing?.total ?? order.total ?? 0,
  );
}
export function orderStatus(order) {
  return String(order.status || "confirmed").replaceAll("-", " ");
}