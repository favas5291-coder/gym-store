import { getKitGroup } from "../utils/cartUtils.js";

const API_URL = String(
  import.meta.env.VITE_API_URL ||
    "http://localhost:5000/api",
)
  .trim()
  .replace(/\/+$/, "");

function paise(value) {
  const result = Math.round(value * 100);

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    !Number.isSafeInteger(result) ||
    Math.abs(value * 100 - result) > 0.00001
  ) {
    throw new Error(
      "The server pricing response could not be verified.",
    );
  }

  return result;
}

function verify(
  quote,
  paymentMethod,
  deliveryMethod,
) {
  if (
    quote?.previewOnly !== true ||
    quote.purchaseEnabled !== false ||
    quote.inventoryReserved !== false ||
    quote.shippingIsEstimate !== true ||
    !Array.isArray(quote.items) ||
    !quote.items.length ||
    quote.items.length > 50 ||
    !Array.isArray(quote.kitSnapshots) ||
    quote.kitSnapshots.length > 20 ||
    quote.method !== deliveryMethod ||
    quote.payment?.method !== paymentMethod ||
    quote.pricing?.currency !== "INR"
  ) {
    throw new Error(
      "The checkout preview could not be verified.",
    );
  }

  const pricing = quote.pricing;

  const totals = [
    "subtotal",
    "kitDiscount",
    "couponDiscount",
    "totalAfterCoupon",
    "shipping",
    "finalTotal",
  ].map((key) => paise(pricing[key]));

  if (
    totals[0] - totals[1] - totals[2] !== totals[3] ||
    totals[3] + totals[4] !== totals[5]
  ) {
    throw new Error(
      "The checkout totals do not reconcile. Please retry.",
    );
  }

  const now = paise(quote.payment.amountToPayNow);
  const due = paise(quote.payment.amountDue);

  const expectedNow =
    paymentMethod === "cod-partial"
      ? Math.round(totals[3] / 10)
      : totals[5];

  if (
    now < 100 ||
    now + due !== totals[5] ||
    now !== expectedNow ||
    quote.payment.advancePercentage !==
      (paymentMethod === "cod-partial" ? 10 : 0)
  ) {
    throw new Error(
      "The payment estimate could not be verified.",
    );
  }

  const groups = new Map();

  for (const kit of quote.kitSnapshots) {
    if (
      typeof kit.groupId !== "string" ||
      groups.has(kit.groupId) ||
      typeof kit.name !== "string" ||
      !/^[a-f0-9]{24}$/i.test(kit.template || "") ||
      !Number.isSafeInteger(kit.templateVersion)
    ) {
      throw new Error(
        "The kit summary could not be verified.",
      );
    }

    groups.set(kit.groupId, {
      snapshot: kit,
      sums: [0, 0, 0, 0],
      slots: new Set(),
    });
  }

  const sums = [0, 0, 0, 0];

  for (const item of quote.items) {
    const allocation = item.priceAllocation;

    if (
      typeof item.name !== "string" ||
      !/^[a-f0-9]{24}$/i.test(item.product || "") ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99 ||
      !allocation ||
      allocation.quantity !== item.quantity
    ) {
      throw new Error(
        "An order component could not be verified.",
      );
    }

    const values = [
      allocation.lineSubtotalPaise,
      allocation.kitDiscountPaise,
      allocation.couponDiscountPaise,
      allocation.linePaidPaise,
    ];

    if (
      !values.every(
        (value) =>
          Number.isSafeInteger(value) &&
          value >= 0,
      ) ||
      values[0] !== paise(item.price) * item.quantity ||
      values[0] - values[1] - values[2] !== values[3] ||
      !Number.isSafeInteger(allocation.unitBasePaise) ||
      allocation.unitBasePaise < 0 ||
      !Number.isSafeInteger(allocation.extraPaiseUnits) ||
      allocation.extraPaiseUnits < 0 ||
      allocation.extraPaiseUnits >= item.quantity ||
      allocation.unitBasePaise * item.quantity +
        allocation.extraPaiseUnits !==
        values[3]
    ) {
      throw new Error(
        "Component discounts could not be verified.",
      );
    }

    values.forEach((value, index) => {
      sums[index] += value;
    });

    if (item.kit) {
      const group = groups.get(item.kit.groupId);

      if (
        !group ||
        typeof item.kit.slotKey !== "string" ||
        group.slots.has(item.kit.slotKey)
      ) {
        throw new Error(
          "Kit components could not be matched to their summary.",
        );
      }

      group.slots.add(item.kit.slotKey);

      values.forEach((value, index) => {
        group.sums[index] += value;
      });
    } else if (values[1] !== 0) {
      throw new Error(
        "An individual product has an invalid kit discount.",
      );
    }
  }

  if (
    !sums.every(
      (value, index) =>
        Number.isSafeInteger(value) &&
        value === totals[index],
    )
  ) {
    throw new Error(
      "Order components do not match the checkout totals.",
    );
  }

  for (const group of groups.values()) {
    const fields = [
      "subtotalPaise",
      "kitDiscountPaise",
      "couponDiscountPaise",
      "linePaidPaise",
    ];

    if (
      !group.slots.size ||
      !group.sums.every(
        (value, index) =>
          value === group.snapshot[fields[index]],
      )
    ) {
      throw new Error(
        "Kit amounts do not match their components.",
      );
    }
  }

  return quote;
}

export async function getCheckoutQuote(
  token,
  {
    items,
    coupon = "",
    deliveryMethod = "standard",
    paymentMethod = "razorpay",
  },
  { signal } = {},
) {
  if (
    typeof token !== "string" ||
    !token.trim()
  ) {
    throw new Error(
      "Please sign in to review checkout prices.",
    );
  }

  if (
    !Array.isArray(items) ||
    !items.length ||
    items.length > 50
  ) {
    throw new Error(
      "Choose between 1 and 50 order components.",
    );
  }

  if (
    !["standard", "express"].includes(deliveryMethod) ||
    !["razorpay", "cod-partial"].includes(paymentMethod) ||
    typeof coupon !== "string" ||
    coupon.length > 50
  ) {
    throw new Error(
      "Check the coupon, delivery and payment choices.",
    );
  }

  const rows = items.map((item) => {
    const id = String(
      item?.id ??
        item?.productId ??
        item?.product ??
        "",
    );

    if (
      !id ||
      !Number.isSafeInteger(item?.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99
    ) {
      throw new Error(
        "Check product IDs and quantities in your bag.",
      );
    }

    const row = {
      id,
      quantity: item.quantity,
      selectedSize: item.selectedSize ?? null,
      selectedColor: item.selectedColor ?? null,
    };

    if (
      Object.prototype.hasOwnProperty.call(
        item,
        "kitGroup",
      )
    ) {
      const group = getKitGroup(item);

      if (!group) {
        throw new Error(
          "This kit grouping is invalid. Reopen the kit builder.",
        );
      }

      row.kitGroup = {
        id: group.id,
        kitId: group.kitId,
        version: group.version,
        slotKey: group.slotKey,
      };
    }

    return row;
  });

  const controller = new AbortController();
  let timedOut = false;

  const abort = () => controller.abort();

  if (signal?.aborted) abort();

  signal?.addEventListener(
    "abort",
    abort,
    { once: true },
  );

  const timer = setTimeout(() => {
    timedOut = true;
    abort();
  }, 25000);

  try {
    const response = await fetch(
      `${API_URL}/payments/checkout/quote`,
      {
        method: "POST",
        cache: "no-store",
        signal: controller.signal,

        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          items: rows,
          coupon: coupon.trim(),
          deliveryMethod,
          paymentMethod,
        }),
      },
    );

    const data = await response.json().catch(() => null);

    if (
      !response.ok ||
      data?.success !== true
    ) {
      const error = new Error(
        data?.message ||
          "Checkout prices could not be loaded. Please retry.",
      );

      error.status = response.status;
      error.code = data?.code;

      throw error;
    }

    return verify(
      data.quote,
      paymentMethod,
      deliveryMethod,
    );
  } catch (error) {
    if (signal?.aborted) throw error;

    if (timedOut) {
      throw new Error(
        "The pricing check took too long. Please retry. No payment was started.",
      );
    }

    if (error instanceof TypeError) {
      throw new Error(
        "Cannot connect to GymDrobe. Check your connection and retry.",
      );
    }

    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}