export const TRACKING_STAGES = [
  "confirmed",
  "processing",
  "shipped",
  "out-for-delivery",
  "delivered",
];

export const TRACKING_MESSAGES = {
  confirmed: "Your order is confirmed and awaiting preparation.",
  processing: "Your order is being prepared for dispatch.",
  shipped: "Your order is recorded as dispatched.",
  "out-for-delivery":
    "Your order is recorded as out for delivery. Keep your phone available for the delivery partner.",
  delivered: "Your order is recorded as delivered.",
};

export function trackingText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function recordedTime(value, now) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) && timestamp <= now
    ? timestamp
    : null;
}

export function trackingEvents(order, now = Date.now()) {
  const rows = Array.isArray(order?.tracking?.events)
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

      const status = trackingText(row.status);
      const description = trackingText(row.description);

      if (!status && !description) {
        return [];
      }

      const time = recordedTime(row.timestamp, now);
      const timestamp = time == null ? "" : row.timestamp;
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
        (b.time ?? -Infinity) - (a.time ?? -Infinity),
    );
}

function indiaDay(timestamp) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function deliveryEstimate(value, now = Date.now()) {
  const source = trackingText(value);

  if (!source) {
    return null;
  }

  let day;

  if (/^\d{4}-\d{2}-\d{2}$/.test(source)) {
    const time = Date.parse(`${source}T12:00:00Z`);

    if (
      !Number.isFinite(time) ||
      new Date(time).toISOString().slice(0, 10) !== source
    ) {
      return null;
    }

    day = source;
  } else {
    const time = Date.parse(source);

    if (!Number.isFinite(time)) {
      return null;
    }

    day = indiaDay(time);
  }

  return {
    label: new Date(`${day}T12:00:00Z`).toLocaleDateString(
      "en-IN",
      {
        timeZone: "UTC",
        day: "numeric",
        month: "short",
        year: "numeric",
      },
    ),
    overdue: day < indiaDay(now),
  };
}

export function trackingSummary(order, now = Date.now()) {
  const status =
    order?.status === "packed"
      ? "processing"
      : trackingText(order?.status);

  const events = trackingEvents(order, now);
  const active = TRACKING_STAGES.includes(status);

  const deliveredAt =
    status === "delivered"
      ? recordedTime(order?.delivery?.deliveredAt, now) != null
        ? order.delivery.deliveredAt
        : events.find(
            (event) =>
              event.status === "delivered" &&
              event.timestamp,
          )?.timestamp || ""
      : "";

  return {
    status,
    events,
    deliveredAt,
    currentIndex: TRACKING_STAGES.indexOf(status),
    cancelled: status === "cancelled",
    pending: status === "payment-pending",
    estimate:
      active && status !== "delivered"
        ? deliveryEstimate(
            order?.tracking?.estimatedDelivery,
            now,
          )
        : null,
  };
}