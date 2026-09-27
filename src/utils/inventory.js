import { getTotalStock, getVariantStock, getCartItemKey } from "./cartUtils.js";

// Device-local inventory ledger for preview orders. Live stock must be reserved transactionally on a server.
export function applyReservations(catalogue, orders) {
  const result = catalogue.map((p) => ({
    ...p,
    variants: p.variants ? structuredClone(p.variants) : undefined,
  }));
  for (const order of orders) {
    if (!order?.metadata?.inventoryReserved || order.status === "cancelled")
      continue;
    for (const item of order.items || []) {
      const product = result.find((p) => String(p.id) === String(item.id));
      if (!product || !Number.isSafeInteger(item.quantity) || item.quantity < 1)
        continue;
      const available = getVariantStock(
        product,
        item.selectedSize,
        item.selectedColor,
      );
      const next = Math.max(0, available - item.quantity);
      if (!product.variants) product.stock = next;
      else {
        const group = product.colors?.length
          ? product.variants[item.selectedColor]
          : product.variants;
        if (group && typeof group === "object")
          group[product.sizes?.length ? item.selectedSize : "default"] = next;
      }
    }
  }
  return result.map((p) => ({ ...p, stock: getTotalStock(p) }));
}

export function reservedQuantity(orders, product, size, color) {
  const key = getCartItemKey({
    id: product.id,
    selectedSize: size,
    selectedColor: color,
  });
  return orders
    .filter(
      (order) =>
        order?.metadata?.inventoryReserved && order.status !== "cancelled",
    )
    .reduce(
      (sum, order) =>
        sum +
        (order.items || [])
          .filter((item) => getCartItemKey(item) === key)
          .reduce((n, item) => n + item.quantity, 0),
      0,
    );
}

export const ORDER_TRANSITIONS = Object.freeze({
  confirmed: ["processing", "cancelled"],
  pending: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["out-for-delivery"],
  "out-for-delivery": ["delivered"],
  delivered: [],
  cancelled: [],
});

export function advanceOrder(
  order,
  status,
  details = {},
  now = new Date().toISOString(),
) {
  if (!(ORDER_TRANSITIONS[order.status] || []).includes(status))
    throw new Error("This order status transition is not available.");
  if (
    status === "shipped" &&
    (!String(details.carrier || "").trim() ||
      !String(details.trackingNumber || "").trim())
  )
    throw new Error("Enter the recorded carrier and tracking number.");
  return {
    ...order,
    status,
    updatedAt: now,
    ...(status === "delivered" ? { deliveredAt: now } : {}),
    delivery: {
      ...order.delivery,
      status,
      ...(status === "delivered" ? { deliveredAt: now } : {}),
    },
    tracking: {
      ...order.tracking,
      ...(status === "shipped"
        ? {
            carrier: String(details.carrier).trim(),
            trackingNumber: String(details.trackingNumber).trim(),
          }
        : {}),
      events: [
        ...(order.tracking?.events || []),
        {
          status,
          timestamp: now,
          description: `Store console preview: ${status.replaceAll("-", " ")}`,
        },
      ],
    },
    // A delivery event does not automatically claim a payment was received.
  };
}