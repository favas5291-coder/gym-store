const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api"
).trim().replace(/\/+$/, "");

function failure(message, details = {}) {
  return Object.assign(
    new Error(message),
    details,
  );
}

function clean(
  value,
  name,
  maximum,
  minimum = 0,
) {
  if (typeof value !== "string") {
    throw failure(`Check ${name}.`);
  }

  const text = value.trim();

  if (
    text.length < minimum ||
    text.length > maximum ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)
  ) {
    throw failure(`Check ${name}.`);
  }

  return text;
}

export function inspectionPayload(
  order,
  draft = {},
  response = "",
) {
  const request = order?.returnRequest;
  const rows = request?.items;

  if (
    !request?.id ||
    !Array.isArray(rows) ||
    !rows.length ||
    rows.length > 50 ||
    draft.received !== true
  ) {
    throw failure(
      "Confirm all requested original items were received and inspected.",
    );
  }

  const seen = new Set();

  const inspectionItems = rows.map(row => {
    if (!row || typeof row !== "object") {
      throw failure(
        "Check the recorded request items.",
      );
    }

    const item = order.items?.[row.index];
    const entry = draft.items?.[row.index];

    const text =
      entry?.quantity == null
        ? ""
        : String(entry.quantity).trim();

    const quantity =
      text === "" ? NaN : Number(text);

    if (
      !Number.isSafeInteger(row.index) ||
      row.index < 0 ||
      seen.has(row.index) ||
      !item ||
      !Number.isSafeInteger(row.quantity) ||
      row.quantity < 1 ||
      row.quantity > item.quantity ||
      !Number.isSafeInteger(quantity) ||
      quantity < 0 ||
      quantity > row.quantity
    ) {
      throw failure(
        "Enter a saleable quantity from zero to the requested quantity for every item.",
      );
    }

    seen.add(row.index);

    const note = clean(
      entry?.note ?? "",
      "the inspection note",
      500,
    );

    if (
      quantity < row.quantity &&
      note.length < 3
    ) {
      throw failure(
        "Explain why each damaged or held item is not being restocked.",
      );
    }

    return {
      index: row.index,
      restockQuantity: quantity,
      note,
    };
  });

  return {
    requestId: clean(
      request.id,
      "the request ID",
      100,
      1,
    ),
    itemsReceived: true,
    inspectionItems,
    response: clean(
      response,
      "the customer message",
      1000,
    ),
  };
}

export async function completeInspectedReturn(
  token,
  orderId,
  body,
  { signal } = {},
) {
  if (
    typeof token !== "string" ||
    !token.trim()
  ) {
    throw failure(
      "Please sign in with an administrator account.",
      { status: 401 },
    );
  }

  const id = clean(
    String(orderId ?? ""),
    "the order ID",
    150,
    1,
  );

  if (signal?.aborted) {
    throw failure(
      "Request cancelled before submission.",
    );
  }

  const controller = new AbortController();
  const cancel = () => controller.abort();

  signal?.addEventListener(
    "abort",
    cancel,
    { once: true },
  );

  const timer = setTimeout(cancel, 30000);

  let started = false;

  try {
    const encodedBody = JSON.stringify(body);

    started = true;

    const response = await fetch(
      `${API_URL}/orders/admin/returns/${encodeURIComponent(id)}/complete`,
      {
        method: "PUT",
        cache: "no-store",
        signal: controller.signal,

        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token.trim()}`,
        },

        body: encodedBody,
      },
    );

    const data = await response.json().catch(
      () => null,
    );

    if (
      !response.ok ||
      data?.success !== true
    ) {
      throw failure(
        data?.message ||
          "Inspection could not be confirmed. Reload the request.",
        {
          status: response.status,
          code: data?.code,

          saveResultUnknown:
            response.status >= 500 ||
            data?.saveResultUnknown === true ||
            (
              response.ok &&
              data?.success !== false
            ),
        },
      );
    }

    const order = data.order;
    const request = order?.returnRequest;
    const saved = request?.inspectionItems;

    if (
      !order ||
      String(order.orderNumber || order.id) !== id ||
      request?.id !== body.requestId ||
      request.status !== "completed" ||
      !request.inspectionCompletedAt ||
      !Array.isArray(saved) ||
      saved.length !== body.inspectionItems.length ||
      body.inspectionItems.some(row => {
        const found = saved.find(
          item => item.index === row.index,
        );

        return (
          !found ||
          found.restockQuantity !==
            row.restockQuantity ||
          found.note !== row.note
        );
      })
    ) {
      throw failure(
        "Saved inspection details were not returned. Reload the request before retrying.",
        { saveResultUnknown: true },
      );
    }

    return order;
  } catch (error) {
    if (
      error.status !== undefined ||
      error.saveResultUnknown !== undefined
    ) {
      throw error;
    }

    throw failure(
      started
        ? "The inspection result is unknown. Reload the request before retrying."
        : "Inspection could not be prepared. Check the entered information.",
      { saveResultUnknown: started },
    );
  } finally {
    clearTimeout(timer);

    signal?.removeEventListener(
      "abort",
      cancel,
    );
  }
}