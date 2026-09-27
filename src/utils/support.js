import { makeId, readStorage, writeStorage } from "./storage.js";
import { ownerKey } from "./customerData.js";
const KEY = "gymdrobe-support-tickets";
export function allTickets() {
  const saved = readStorage(KEY, []);
  return Array.isArray(saved)
    ? saved.filter(
        (t) =>
          t &&
          typeof t.id === "string" &&
          t.ownerKey &&
          Array.isArray(t.messages),
      )
    : [];
}
export function ticketsFor(user) {
  return allTickets()
    .filter((t) => t.ownerKey === ownerKey(user))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function persistTicket(ticket) {
  const next = { ...ticket, updatedAt: new Date().toISOString() };
  return writeStorage(KEY, [
    next,
    ...allTickets().filter((t) => t.id !== ticket.id),
  ])
    ? next
    : null;
}
export function createTicket(user, data) {
  const now = new Date().toISOString();
  if (
    !String(data.subject || "").trim() ||
    String(data.message || "").trim().length < 10 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email || ""))
  )
    return null;
  return persistTicket({
    id: makeId("HELP"),
    ownerKey: ownerKey(user),
    subject: data.subject.trim(),
    category: data.category || "General",
    email: data.email.trim(),
    orderId: data.orderId || null,
    productId: data.productId || null,
    status: "open",
    createdAt: now,
    messages: [
      {
        id: makeId("message"),
        by: "customer",
        text: data.message.trim(),
        createdAt: now,
      },
    ],
  });
}
export function replyToTicket(id, user, text) {
  const ticket = ticketsFor(user).find((t) => t.id === id);
  if (!ticket || String(text).trim().length < 2) return null;
  return persistTicket({
    ...ticket,
    status: "open",
    messages: [
      ...ticket.messages,
      {
        id: makeId("message"),
        by: "customer",
        text: text.trim(),
        createdAt: new Date().toISOString(),
      },
    ],
  });
}