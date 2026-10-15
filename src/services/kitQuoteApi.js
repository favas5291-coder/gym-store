const API_URL = String(
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api",
)
  .trim()
  .replace(/\/+$/, "");

const amount = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0;

export async function previewKitQuote(
  token,
  kit,
  {
    coupon = "",
    deliveryMethod = "standard",
    paymentMethod = "razorpay",
    signal,
  } = {},
) {
  if (!token) {
    throw new Error(
      "Admin sign-in is required.",
    );
  }

  const id = String(
    kit?.id || kit?._id || "",
  );

  if (
    !/^[a-f0-9]{24}$/i.test(id) ||
    !Number.isSafeInteger(kit?.version) ||
    kit.version < 0
  ) {
    throw new Error(
      "Reload the kit list before requesting a preview.",
    );
  }

  const controller =
    new AbortController();

  const abort = () =>
    controller.abort();

  if (signal?.aborted) {
    abort();
  }

  signal?.addEventListener(
    "abort",
    abort,
    { once: true },
  );

  const timer = setTimeout(
    abort,
    25000,
  );

  try {
    const response = await fetch(
      `${API_URL}/kits/admin/${encodeURIComponent(id)}/quote`,
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
          version: kit.version,
          coupon: coupon.trim(),
          deliveryMethod,
          paymentMethod,
        }),
      },
    );

    const data = await response
      .json()
      .catch(() => null);

    if (
      !response.ok ||
      data?.success !== true
    ) {
      const error = new Error(
        data?.message ||
        "The kit preview could not be read.",
      );

      error.status = response.status;
      error.code = data?.code;

      throw error;
    }

    const quote = data.quote;

    const pricingFields = [
      "subtotal",
      "kitDiscount",
      "totalAfterKitDiscount",
      "couponDiscount",
      "totalAfterCoupon",
      "shipping",
      "finalTotal",
    ];

    const itemFields = [
      "unitPrice",
      "lineSubtotal",
      "kitDiscount",
      "couponDiscount",
      "linePaid",
    ];

    if (
      !quote ||
      quote.kitId !== id.toLowerCase() ||
      quote.templateVersion !== kit.version ||
      quote.previewOnly !== true ||
      quote.purchaseEnabled !== false ||
      quote.inventoryReserved !== false ||
      !Array.isArray(quote.items) ||
      !quote.items.length ||
      !pricingFields.every(
        (key) =>
          amount(quote.pricing?.[key]),
      ) ||
      !amount(
        quote.payment?.amountToPayNow,
      ) ||
      !amount(
        quote.payment?.amountDue,
      ) ||
      !quote.items.every(
        (item) =>
          typeof item.name === "string" &&
          Number.isSafeInteger(
            item.quantity,
          ) &&
          item.quantity > 0 &&
          itemFields.every(
            (key) => amount(item[key]),
          ),
      )
    ) {
      throw new Error(
        "The server returned an incomplete kit preview. Reload and try again.",
      );
    }

    return quote;
  } catch (error) {
    if (
      signal?.aborted ||
      error.status
    ) {
      throw error;
    }

    if (error.name === "AbortError") {
      throw new Error(
        "The preview timed out. Check the backend and try again.",
      );
    }

    if (error instanceof TypeError) {
      throw new Error(
        "Cannot connect to the kit pricing service.",
      );
    }

    throw error;
  } finally {
    clearTimeout(timer);

    signal?.removeEventListener(
      "abort",
      abort,
    );
  }
}