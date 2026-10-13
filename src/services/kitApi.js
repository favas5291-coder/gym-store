const API_URL = String(
  import.meta.env.VITE_API_URL || "http://localhost:5000/api",
)
  .trim()
  .replace(/\/+$/, "");

function id(value) {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{24}$/i.test(value)
  ) {
    throw new Error("This kit link is invalid.");
  }

  return encodeURIComponent(value.toLowerCase());
}

async function request(
  path,
  { body, signal } = {},
) {
  const controller = new AbortController();
  const abort = () => controller.abort();

  if (signal?.aborted) abort();

  signal?.addEventListener("abort", abort, {
    once: true,
  });

  const timer = setTimeout(abort, 25000);

  try {
    const response = await fetch(
      `${API_URL}/kits${path}`,
      {
        method: body ? "POST" : "GET",
        signal: controller.signal,
        cache: "no-store",

        headers: {
          Accept: "application/json",
          ...(body
            ? { "Content-Type": "application/json" }
            : {}),
        },

        body: body
          ? JSON.stringify(body)
          : undefined,
      },
    );

    const data = await response.json().catch(() => null);

    if (!response.ok || data?.success !== true) {
      const error = new Error(
        data?.message ||
          "Fitness Kits could not be loaded.",
      );

      error.status = response.status;
      error.code = data?.code;
      throw error;
    }

    return data;
  } catch (error) {
    if (signal?.aborted || error.status) {
      throw error;
    }

    if (error.name === "AbortError") {
      throw new Error(
        "Fitness Kits took too long to load. Please retry.",
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

export async function getFitnessKits(options) {
  const data = await request("", options);

  if (
    !Array.isArray(data.kits) ||
    data.kits.some(
      (kit) =>
        !/^[a-f0-9]{24}$/i.test(kit.id || "") ||
        typeof kit.name !== "string",
    )
  ) {
    throw new Error(
      "The kit list could not be read.",
    );
  }

  return data.kits;
}

export async function getFitnessKit(kitId, options) {
  const data = await request(
    `/${id(kitId)}`,
    options,
  );

  if (
    data.kit?.id !== kitId.toLowerCase() ||
    !Number.isSafeInteger(data.kit.version) ||
    !Array.isArray(data.kit.slots) ||
    !Array.isArray(data.products) ||
    data.kit.slots.some(
      (slot) =>
        !Array.isArray(slot.allowedProducts) ||
        typeof slot.key !== "string",
    )
  ) {
    throw new Error(
      "This kit is incomplete. Please try again later.",
    );
  }

  return data;
}

export async function quoteFitnessKit(
  kit,
  selections,
  {
    coupon = "",
    deliveryMethod = "standard",
    paymentMethod = "razorpay",
    signal,
  } = {},
) {
  const data = await request(
    `/${id(kit.id)}/quote`,
    {
      signal,
      body: {
        version: kit.version,
        selections,
        coupon: coupon.trim(),
        deliveryMethod,
        paymentMethod,
      },
    },
  );

  const quote = data.quote;

  const fields = [
    "subtotal",
    "kitDiscount",
    "couponDiscount",
    "totalAfterCoupon",
    "shipping",
    "finalTotal",
  ];

  if (
    quote?.kitId !== kit.id ||
    quote.templateVersion !== kit.version ||
    quote.purchaseEnabled !== false ||
    quote.inventoryReserved !== false ||
    !fields.every(
      (key) =>
        typeof quote.pricing?.[key] === "number" &&
        Number.isFinite(quote.pricing[key]) &&
        quote.pricing[key] >= 0,
    ) ||
    ![
      quote.payment?.amountToPayNow,
      quote.payment?.amountDue,
    ].every(
      (value) =>
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0,
    )
  ) {
    throw new Error(
      "The kit estimate could not be verified. Please retry.",
    );
  }

  return quote;
}