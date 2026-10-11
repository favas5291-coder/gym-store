import { getCartItemKey } from "./cartUtils.js";
import { addressErrors } from "./customerData.js";
import { roundMoney } from "./productPricing.js";

export function checkoutAddress(value = {}) {
  const result = {};

  for (const key of [
    "fullName",
    "email",
    "phone",
    "addressLine",
    "landmark",
    "city",
    "state",
    "pincode",
    "label",
  ]) {
    result[key] = String(value[key] ?? "").trim();
  }

  result.email = result.email.toLowerCase();
  result.phone = result.phone.replace(/\D/g, "");
  result.pincode = result.pincode.replace(/\D/g, "");
  result.label ||= "Home";

  return result;
}

export function checkoutAddressErrors(value) {
  const errors = addressErrors(value);

  const limits = {
    fullName: 100,
    email: 150,
    addressLine: 200,
    landmark: 150,
    city: 100,
    state: 100,
    label: 30,
  };

  for (const [key, maximum] of Object.entries(limits)) {
    if (value[key]?.length > maximum) {
      errors[key] = `Use no more than ${maximum} characters.`;
    }

    if (/[\u0000-\u001f\u007f]/.test(value[key] || "")) {
      errors[key] = "Remove unsupported characters.";
    }
  }

  return errors;
}

export function paymentAmounts(pricing, method) {
  const now =
    method === "cod-partial"
      ? Math.round(
          Math.round(pricing.totalAfterCoupon * 100) / 10,
        ) / 100
      : pricing.finalTotal;

  return {
    now,
    due: roundMoney(pricing.finalTotal - now),
    paise: Math.round(now * 100),
  };
}

export function checkoutFingerprint(payload, priceRows = []) {
  return JSON.stringify({
    source: payload.source,
    paymentMethod: payload.paymentMethod,

    items: payload.items
      .map((item) => [
        getCartItemKey(item),
        Number(item.quantity),
      ])
      .sort((a, b) => a[0].localeCompare(b[0])),

    coupon: payload.coupon || null,
    deliveryMethod: payload.deliveryMethod,
    shippingAddress: checkoutAddress(payload.shippingAddress),
    giftMessage: payload.giftMessage || "",
    orderNote: payload.orderNote || "",
    expectedTotal: payload.expectedTotal,

    prices: priceRows
      .map((row) => [getCartItemKey(row), row.price])
      .sort((a, b) => a[0].localeCompare(b[0])),
  });
}

function invalid(message) {
  return Object.assign(new Error(message), {
    code: "PAYMENT_RESPONSE_INVALID",
  });
}

function paise(value) {
  if (
    !["number", "string"].includes(typeof value) ||
    !String(value).trim()
  ) {
    return null;
  }

  const parsed = Number(value);
  const result = Math.round(parsed * 100);

  return Number.isFinite(parsed) &&
    parsed >= 0 &&
    Number.isSafeInteger(result) &&
    Math.abs(parsed * 100 - result) < 0.000001
    ? result
    : null;
}

export function validateGateway(data, record) {
  const expected = paymentAmounts(
    record.pricing,
    record.payload.paymentMethod,
  );

  if (
    !/^rzp_(test|live)_[A-Za-z0-9]+$/.test(data?.keyId || "") ||
    !/^order_[A-Za-z0-9]+$/.test(data?.razorpayOrderId || "") ||
    typeof data?.orderNumber !== "string" ||
    !data.orderNumber.trim() ||
    data.currency !== "INR" ||
    data.paymentMethod !== record.payload.paymentMethod ||
    !Number.isSafeInteger(data.amount) ||
    data.amount !== expected.paise ||
    data.amount < 100 ||
    (record.orderId && record.orderId !== data.orderNumber) ||
    (record.gatewayId &&
      record.gatewayId !== data.razorpayOrderId) ||
    paise(data.paymentSummary?.totalAmount) !==
      paise(record.pricing.finalTotal) ||
    paise(data.paymentSummary?.amountToPayNow) !== expected.paise ||
    paise(data.paymentSummary?.amountDue) !== paise(expected.due)
  ) {
    throw invalid(
      "Payment details differ from your reviewed order. Do not pay; check the order or contact support.",
    );
  }

  return expected;
}

export function orderIsComplete(order) {
  return (
    [
      "confirmed",
      "processing",
      "packed",
      "shipped",
      "out-for-delivery",
      "delivered",
    ].includes(order?.status) &&
    ["paid", "partially-paid"].includes(order?.payment?.status) &&
    !["pending", "manual-required", "refunded", "processed"].includes(
      order?.refund?.status,
    )
  );
}

export function validateConfirmedOrder(order, record, userId) {
  const id = String(order?.orderNumber || order?.id || "");
  const owner = String(order?.user?.id || order?.user?._id || "");

  if (
    !id ||
    !orderIsComplete(order) ||
    owner !== String(userId) ||
    (record.orderId && record.orderId !== id)
  ) {
    throw invalid(
      "Order confirmation needs review. Do not pay again; check My orders.",
    );
  }

  if (record.payload) {
    const method = record.payload.paymentMethod;
    const total = paise(record.pricing.finalTotal);
    const paid = paise(order.payment.amountPaid);
    const due = paise(order.payment.amountDue);

    const expected = paymentAmounts(record.pricing, method);

    const partial =
      method === "cod-partial" &&
      order.payment.status === "partially-paid";

    if (
      order.payment.method !== method ||
      paise(order.pricing?.finalTotal) !== total ||
      paid == null ||
      due == null ||
      paid + due !== total ||
      (partial
        ? paid !== expected.paise || due !== paise(expected.due)
        : paid !== total || due !== 0)
    ) {
      throw invalid(
        "Recorded payment amounts need review. Do not pay again; contact support with your order number.",
      );
    }
  }

  return { ...order, id };
}

// Preserve other variants and quantities added during payment.
export function subtractPurchasedItems(current, purchased) {
  const remaining = new Map();

  for (const item of purchased || []) {
    const quantity = Number(item?.quantity);

    if (Number.isSafeInteger(quantity) && quantity > 0) {
      const key = getCartItemKey(item);

      remaining.set(
        key,
        (remaining.get(key) || 0) + quantity,
      );
    }
  }

  return (Array.isArray(current) ? current : []).flatMap((item) => {
    const key = getCartItemKey(item);
    const quantity = Number(item?.quantity);

    const remove = Math.min(
      remaining.get(key) || 0,
      Number.isSafeInteger(quantity) ? quantity : 0,
    );

    remaining.set(
      key,
      (remaining.get(key) || 0) - remove,
    );

    if (remove === 0) return [item];

    return quantity > remove
      ? [{ ...item, quantity: quantity - remove }]
      : [];
  });
}