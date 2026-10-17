export const TRACKING_STAGES = [
  "confirmed",
  "processing",
  "shipped",
  "out-for-delivery",
  "delivered",
];

export const CUSTOMER_STAGES = [
  {
    key: "confirmed",
    label: "Order Placed",
    caption:
      "Your fitness essentials are one step closer!",
  },
  {
    key: "packed",
    label: "Packed & Ready",
    caption:
      "Your items are packed and ready for pickup.",
  },
  {
    key: "shipped",
    label: "On the Way",
    caption:
      "Your parcel has started its journey to you!",
  },
  {
    key: "out-for-delivery",
    label: "Out for Delivery",
    caption:
      "Almost there! Your parcel is coming today.",
  },
  {
    key: "delivered",
    label: "Delivered",
    caption:
      "Your fitness essentials have arrived. Enjoy!",
  },
];

export const TRACKING_MESSAGES = {
  confirmed:
    "Your order is confirmed and awaiting preparation.",

  processing:
    "Your order is being prepared for dispatch.",

  shipped:
    "Your order is recorded as dispatched.",

  "out-for-delivery":
    "Your order is recorded as out for delivery. Keep your phone available for the delivery partner.",

  delivered:
    "Your order is recorded as delivered.",
};

export function trackingText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function recordedTime(value, now) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  const timestamp = Date.parse(value);

  return (
    Number.isFinite(timestamp) &&
    timestamp <= now
  )
    ? timestamp
    : null;
}

export function trackingEvents(
  order,
  now = Date.now(),
) {
  const rows = Array.isArray(
    order?.tracking?.events,
  )
    ? order.tracking.events
    : [];

  const seen = new Set();

  return rows
    .flatMap((row) => {
      if (
        !row ||
        typeof row !== "object" ||
        Array.isArray(row)
      ) {
        return [];
      }

      const status =
        trackingText(row.status);

      const description =
        trackingText(row.description);

      if (!status && !description) {
        return [];
      }

      const time = recordedTime(
        row.timestamp,
        now,
      );

      const timestamp =
        time == null
          ? ""
          : row.timestamp;

      const key = JSON.stringify([
        status,
        description,
        timestamp,
      ]);

      if (seen.has(key)) {
        return [];
      }

      seen.add(key);

      return [
        {
          key,
          status,
          description,
          timestamp,
          time,
        },
      ];
    })
    .sort(
      (a, b) =>
        (b.time ?? -Infinity) -
        (a.time ?? -Infinity),
    );
}

function indiaDay(timestamp) {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    ).formatToParts(
      new Date(timestamp),
    );

  const values = Object.fromEntries(
    parts.map((part) => [
      part.type,
      part.value,
    ]),
  );

  return (
    `${values.year}-` +
    `${values.month}-` +
    `${values.day}`
  );
}

export function deliveryEstimate(
  value,
  now = Date.now(),
) {
  const source =
    trackingText(value);

  if (!source) {
    return null;
  }

  let day;

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      source,
    )
  ) {
    const time = Date.parse(
      `${source}T12:00:00Z`,
    );

    if (
      !Number.isFinite(time) ||
      new Date(time)
        .toISOString()
        .slice(0, 10) !== source
    ) {
      return null;
    }

    day = source;
  } else {
    const time =
      Date.parse(source);

    if (
      !Number.isFinite(time)
    ) {
      return null;
    }

    day = indiaDay(time);
  }

  return {
    label: new Date(
      `${day}T12:00:00Z`,
    ).toLocaleDateString(
      "en-IN",
      {
        timeZone: "UTC",
        day: "numeric",
        month: "short",
        year: "numeric",
      },
    ),

    overdue:
      day < indiaDay(now),
  };
}

export function trackingSummary(
  order,
  now = Date.now(),
) {
  const status =
    order?.status === "packed"
      ? "processing"
      : trackingText(
          order?.status,
        );

  const events =
    trackingEvents(order, now);

  const active =
    TRACKING_STAGES.includes(
      status,
    );

  const deliveredAt =
    status === "delivered"
      ? recordedTime(
          order?.delivery?.deliveredAt,
          now,
        ) != null
        ? order.delivery.deliveredAt
        : events.find(
            (event) =>
              event.status ===
                "delivered" &&
              event.timestamp,
          )?.timestamp || ""
      : "";

  return {
    status,
    events,
    deliveredAt,

    currentIndex:
      TRACKING_STAGES.indexOf(
        status,
      ),

    cancelled:
      status === "cancelled",

    pending:
      status === "payment-pending",

    estimate:
      active &&
      status !== "delivered"
        ? deliveryEstimate(
            order?.tracking
              ?.estimatedDelivery,
            now,
          )
        : null,
  };
}

function knownTime(value, now) {
  if (
    !(
      typeof value === "string" ||
      value instanceof Date
    ) ||
    !String(value).trim()
  ) {
    return "";
  }

  const time =
    new Date(value).getTime();

  return (
    Number.isFinite(time) &&
    time <= now
  )
    ? new Date(time).toISOString()
    : "";
}

function customerIndex(value) {
  return CUSTOMER_STAGES.findIndex(
    (row) => row.key === value,
  );
}

// Progress comes from saved statuses and
// recorded milestone dates.
//
// Delivery estimates and elapsed time never
// advance the delivery stage.
export function customerTracking(
  order,
  {
    parcel = null,
    now = Date.now(),
  } = {},
) {
  const pending =
    order?.status ===
    "payment-pending";

  const cancelled =
    order?.status === "cancelled" ||
    order?.cancellation?.status ===
      "cancelled";

  const events = trackingEvents(
    order,
    now,
  ).filter(
    (row) => row.time != null,
  );

  const tracking =
    parcel ||
    order?.tracking ||
    {};

  const sourceStatus = parcel
    ? parcel.status
    : order?.status;

  const times = {};

  if (!parcel) {
    for (
      const event of [
        ...events,
      ].reverse()
    ) {
      if (
        customerIndex(
          event.status,
        ) >= 0 &&
        !times[event.status]
      ) {
        times[event.status] =
          event.timestamp;
      }
    }
  }

  times.confirmed =
    times.confirmed ||
    knownTime(
      order?.payment?.verifiedAt,
      now,
    ) ||
    (
      !pending
        ? knownTime(
            order?.createdAt,
            now,
          )
        : ""
    );

  times.packed =
    knownTime(
      tracking.packedAt,
      now,
    ) ||
    times.packed ||
    "";

  if (parcel) {
    times.shipped =
      knownTime(
        parcel.shippedAt,
        now,
      );

    times["out-for-delivery"] =
      knownTime(
        parcel.outForDeliveryAt,
        now,
      );

    times.delivered =
      knownTime(
        parcel.deliveredAt,
        now,
      );
  } else {
    times.delivered =
      knownTime(
        order?.delivery?.deliveredAt,
        now,
      ) ||
      times.delivered ||
      "";
  }

  let index =
    customerIndex(sourceStatus);

  if (
    [
      "processing",
      "collecting",
      "packing",
    ].includes(sourceStatus)
  ) {
    index = 0;
  }

  for (
    const [key, value] of
    Object.entries(times)
  ) {
    if (
      value &&
      (
        key !== "confirmed" ||
        index >= 0 ||
        cancelled
      )
    ) {
      index = Math.max(
        index,
        customerIndex(key),
      );
    }
  }

  if (pending) {
    index = -1;
  }

  const current =
    CUSTOMER_STAGES[index];

  let label =
    current?.label ||
    "Tracking details pending";

  if (
    index === 0 &&
    sourceStatus === "processing"
  ) {
    label =
      "Preparing your order";
  }

  if (
    index === 0 &&
    [
      "collecting",
      "packing",
    ].includes(sourceStatus)
  ) {
    label =
      "Collecting items for your parcel";
  }

  const paymentReceived =
    [
      "paid",
      "partially-paid",
    ].includes(
      order?.payment?.status,
    ) ||
    Number(
      order?.payment?.amountPaid,
    ) > 0;

  if (pending) {
    label = paymentReceived
      ? "Payment received · order confirmation pending"
      : "Awaiting payment";
  }

  if (cancelled) {
    label = "Order cancelled";
  }

  const steps =
    CUSTOMER_STAGES.map(
      (stage, position) => {
        const recorded =
          Boolean(
            times[stage.key],
          ) ||
          (
            position === index &&
            !pending
          ) ||
          (
            position === 0 &&
            index >= 0
          );

        const state =
          position === index
            ? "current"
            : position < index
              ? recorded
                ? "complete"
                : "unrecorded"
              : "upcoming";

        let caption =
          stage.caption;

        if (
          state === "upcoming"
        ) {
          caption = {
            confirmed:
              "Your journey starts once the order is confirmed.",

            packed:
              "We’ll confirm when your items are packed for pickup.",

            shipped:
              "We’ll let you know once your parcel is dispatched.",

            "out-for-delivery":
              "We’ll update you when your parcel is out for delivery.",

            delivered:
              "We’ll confirm when your fitness essentials arrive.",
          }[stage.key];
        }

        if (
          stage.key ===
            "out-for-delivery" &&
          state === "complete"
        ) {
          caption =
            "Your parcel went out for delivery.";
        }

        if (
          state === "unrecorded"
        ) {
          caption =
            "This earlier step wasn’t recorded separately.";
        }

        if (
          cancelled &&
          state === "current"
        ) {
          caption =
            "Last confirmed update before cancellation.";
        }

        if (
          stage.key ===
            "out-for-delivery" &&
          state === "current" &&
          (
            !times[stage.key] ||
            indiaDay(
              Date.parse(
                times[stage.key],
              ),
            ) !== indiaDay(now)
          )
        ) {
          caption =
            "Your parcel is with the delivery partner. We’re waiting for the next update.";
        }

        return {
          ...stage,
          state,
          caption,

          timestamp:
            times[stage.key] || "",
        };
      },
    );

  let latest = !parcel
    ? events[0] || null
    : null;

  function addUpdate(
    timestamp,
    description,
  ) {
    const value =
      knownTime(timestamp, now);

    if (
      value &&
      (
        !latest ||
        Date.parse(value) >=
          Date.parse(
            latest.timestamp,
          )
      )
    ) {
      latest = {
        timestamp: value,
        description,
      };
    }
  }

  for (
    const stage of CUSTOMER_STAGES
  ) {
    addUpdate(
      times[stage.key],
      `${stage.label} confirmed.`,
    );
  }

  if (parcel) {
    addUpdate(
      parcel.updatedAt,
      "Parcel tracking updated by GymDrobe.",
    );
  }

  const issue =
    tracking.exception;

  if (
    issue &&
    [
      "delayed",
      "delivery-attempt-failed",
    ].includes(issue.type)
  ) {
    addUpdate(
      issue.updatedAt,
      issue.message,
    );
  }

  const exception =
    !cancelled &&
    index !== 4 &&
    issue &&
    [
      "delayed",
      "delivery-attempt-failed",
    ].includes(issue.type)
      ? {
          ...issue,

          updatedAt:
            knownTime(
              issue.updatedAt,
              now,
            ),
        }
      : null;

  return {
    index,
    label,
    steps,
    pending,
    cancelled,
    paymentReceived,
    latest,
    exception,

    estimate:
      index >= 0 &&
      index < 4 &&
      !cancelled
        ? deliveryEstimate(
            tracking.estimatedDelivery,
            now,
          )
        : null,

    events:
      parcel ? [] : events,
  };
}

export function shipmentTracking(
  order,
) {
  const snapshots =
    Array.isArray(
      order?.shippingSnapshot
        ?.shipments,
    )
      ? order.shippingSnapshot
          .shipments
      : [];

  const parcels =
    Array.isArray(
      order?.fulfillmentProgress
        ?.parcels,
    )
      ? order.fulfillmentProgress
          .parcels
      : [];

  if (
    !snapshots.length &&
    !order?.kitSnapshots?.length
  ) {
    return null;
  }

  const rows = snapshots.map(
    (snapshot) => ({
      snapshot,

      parcel:
        parcels.find(
          (row) =>
            row.key ===
            snapshot.key,
        ) || {
          key: snapshot.key,
          status: "collecting",
        },
    }),
  );

  const allDelivered =
    rows.length > 0 &&
    parcels.length ===
      rows.length &&
    rows.every(
      (row) =>
        row.parcel.status ===
        "delivered",
    );

  const delivered = rows.filter(
    (row) =>
      row.parcel.status ===
      "delivered",
  ).length;

  return {
    rows,
    allDelivered,
    delivered,
    count: rows.length,
  };
}