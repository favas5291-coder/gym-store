import { Link, useParams } from "react-router-dom";

import useCustomerOrder from "../hooks/useCustomerOrder.js";

import PurchasedKitSummary from "../components/PurchasedKitSummary.jsx";
import EmptyState from "../components/EmptyState.jsx";
import GuestOrderAccess from "../components/GuestOrderAccess.jsx";

import OrderPaymentDetails, {
  formatOrderDate,
  formatOrderStatus,
  getPaymentRows,
} from "../components/OrderPaymentDetails.jsx";

import { money } from "../utils/productPricing.js";

import {
  csvCell,
  downloadText,
} from "../utils/commerce.js";

import "../utils/CheckoutPage.css";

function recordedAmount(value) {
  if (
    !["number", "string"].includes(typeof value) ||
    !String(value).trim()
  ) {
    return null;
  }

  const amount = Number(value);

  return Number.isFinite(amount) && amount >= 0
    ? amount
    : null;
}

function showMoney(value) {
  const amount = recordedAmount(value);

  return amount == null
    ? "Not recorded"
    : money(amount);
}

function lineTotal(item) {
  const price = recordedAmount(item.price);
  const quantity = Number(item.quantity);

  if (
    price == null ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1
  ) {
    return null;
  }

  const total = price * quantity;

  return Number.isFinite(total)
    ? Math.round((total + Number.EPSILON) * 100) / 100
    : null;
}

function receiptStatus(status) {
  return status === "packed"
    ? "Packed & Ready"
    : formatOrderStatus(status);
}

function allocatedTotal(item) {
  const amount =
    item.priceAllocation?.linePaidPaise;

  return Number.isSafeInteger(amount) && amount >= 0
    ? amount / 100
    : "Not recorded";
}

export default function ReceiptPage() {
  const { orderId } = useParams();

  const {
    order,
    loading,
    error,
    refreshError,
    lastUpdated,
    isAccountOrder: isRemoteOrder,
    isGuestOrder,
    refresh,
    refreshing,
  } = useCustomerOrder(orderId);

  if (loading) {
    return (
      <div className="page narrow receipt-page">
        <div
          className="empty-state"
          role="status"
        >
          <h3>Loading receipt…</h3>
          <p>Getting your order information.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page narrow receipt-page">
        <EmptyState
          title="Receipt could not be loaded"
          to="/orders"
          label="View orders"
        >
          {error}
        </EmptyState>

        <GuestOrderAccess />

        <button
          type="button"
          className="button secondary"
          disabled={refreshing}
          onClick={refresh}
        >
          {refreshing ? "Retrying…" : "Retry"}
        </button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="page narrow receipt-page">
        <EmptyState
          title="Receipt not found"
          to="/orders"
          label="View orders"
        >
          Check your orders or restore the private
          access code saved after guest checkout.
        </EmptyState>

        <GuestOrderAccess />
      </div>
    );
  }

  const displayId =
    order.orderNumber || order.id || orderId;

  const address = order.shippingAddress || {};
  const pricing = order.pricing || {};

  const total = recordedAmount(
    pricing.finalTotal ??
      pricing.total ??
      order.total,
  );

  const items = Array.isArray(order.items)
    ? order.items.filter(
        (item) =>
          item &&
          typeof item === "object" &&
          !Array.isArray(item),
      )
    : [];

  function downloadCsv() {
    const rows = [
      [
        "Summary",
        isRemoteOrder
          ? "GymDrobe order summary"
          : "Local preview only; not a confirmed purchase",
      ],

      ["Order", displayId],
      ["Date", order.createdAt || ""],
      ["Status", receiptStatus(order.status)],
      ["Last checked", lastUpdated || "Not recorded"],

      ...(order.metadata?.demo === true
        ? [["Mode", "Razorpay test mode"]]
        : []),

      [],

      [
        "Product",
        "Size",
        "Colour",
        "Quantity",
        "Unit INR before order savings",
        "Line INR before order savings",
        "Kit",
        "Allocated item total INR",
      ],

      ...items.map((item) => [
        item.name,
        item.selectedSize || "",
        item.selectedColor || "",
        item.quantity,

        recordedAmount(item.price) ??
          "Not recorded",

        lineTotal(item) ?? "Not recorded",

        order.kitSnapshots?.find(
          (kit) =>
            kit.groupId === item.kit?.groupId,
        )?.name || "",

        allocatedTotal(item),
      ]),

      [],

      [
        "Items subtotal INR",
        pricing.subtotal ?? "Not recorded",
      ],

      [
        "Kit savings INR",
        pricing.kitDiscount ?? 0,
      ],

      [
        "Coupon savings INR",
        pricing.couponDiscount ?? "Not recorded",
      ],

      [
        "Delivery INR",
        pricing.shipping ?? "Not recorded",
      ],

      [
        "Order total INR",
        total ?? "Not recorded",
      ],

      [],

      ...getPaymentRows(order).map(
        ([label, value]) => [
          typeof value === "number"
            ? `${label} INR`
            : label,

          value,
        ],
      ),
    ];

    const safeName = String(displayId).replace(
      /[^a-zA-Z0-9_-]/g,
      "_",
    );

    downloadText(
      `${safeName}-receipt.csv`,

      rows
        .map((row) =>
          row.map(csvCell).join(","),
        )
        .join("\r\n"),

      "text/csv;charset=utf-8",
    );
  }

  return (
    <div className="page narrow receipt-page">
      <div className="receipt-actions">
        <Link
          className="text-link"
          to={`/orders/${encodeURIComponent(displayId)}`}
        >
          ← Order details
        </Link>

        <div className="purchase-actions">
          <button
            className="button secondary"
            type="button"
            onClick={refresh}
            disabled={refreshing}
          >
            {refreshing
              ? "Refreshing…"
              : "Refresh receipt"}
          </button>

          <button
            className="button secondary"
            type="button"
            onClick={downloadCsv}
          >
            Download CSV
          </button>

          <button
            className="button"
            type="button"
            onClick={() => window.print()}
          >
            Print / save PDF
          </button>
        </div>
      </div>

      {(isGuestOrder || !isRemoteOrder) && (
        <div className="receipt-actions">
          <div
            style={{
              width: "100%",
              minWidth: 0,
            }}
          >
            {isRemoteOrder ? (
              <details className="gd-guest-access">
                <summary>
                  Private guest order access
                </summary>

                <GuestOrderAccess backup />
              </details>
            ) : (
              <GuestOrderAccess />
            )}
          </div>
        </div>
      )}

      <article className="receipt-sheet">
        <div className="page-heading">
          <div>
            <p className="eyebrow">
              GYMDROBE
            </p>

            <h1>Order receipt</h1>
          </div>

          <span
            className={`status-pill ${
              order.status === "cancelled"
                ? "cancelled"
                : ""
            }`}
          >
            {receiptStatus(order.status)}
          </span>
        </div>

        <p className="order-id">
          {displayId}
        </p>

        <p>
          {formatOrderDate(order.createdAt)}
        </p>

        <p className="notice">
          {isRemoteOrder
            ? isGuestOrder
              ? "This summary is generated securely from your GymDrobe guest order."
              : "This summary is generated from your GymDrobe order."
            : "Local preview only. This summary is stored on this device and does not confirm a real order or payment."}
          {" "}
          It is not a tax invoice or independent
          proof of payment.
        </p>

        {lastUpdated && (
          <p className="muted">
            Last checked:{" "}
            {formatOrderDate(lastUpdated)}.
          </p>
        )}

        {refreshError && (
          <p
            className="field-error"
            role="alert"
          >
            {refreshError} Showing the last
            successfully loaded receipt. Refresh
            to check the latest payment and
            refund updates.
          </p>
        )}

        {order.metadata?.demo === true && (
          <p className="notice">
            Test order · Razorpay test mode.
          </p>
        )}

        <h2>DELIVER TO</h2>

        <p>
          {address.fullName || address.name}

          <br />

          {address.addressLine || address.address}

          {address.landmark
            ? `, ${address.landmark}`
            : ""}

          <br />

          {[
            address.city,
            address.state,
            address.pincode,
          ]
            .filter(Boolean)
            .join(", ")}

          {address.phone && (
            <>
              <br />
              {address.phone}
            </>
          )}

          {address.email && (
            <>
              <br />
              {address.email}
            </>
          )}
        </p>

        <div className="comparison-scroll">
          <table className="data-table">
            <caption className="muted">
              Order items and prices in INR before kit
              and coupon savings
            </caption>

            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Qty</th>
                <th scope="col">Unit price</th>
                <th scope="col">Total</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item, index) => (
                <tr
                  key={`${
                    item.id ||
                    item.productId ||
                    item.slug ||
                    "item"
                  }-${index}`}
                >
                  <td>
                    {item.name}

                    <small>
                      {[
                        item.selectedColor,

                        item.selectedSize &&
                          `Size ${item.selectedSize}`,
                      ]
                        .filter(Boolean)
                        .join(" / ")}
                    </small>
                  </td>

                  <td>{item.quantity}</td>

                  <td>
                    {showMoney(item.price)}
                  </td>

                  <td>
                    {showMoney(lineTotal(item))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="receipt-totals">
          <div>
            <dt>Subtotal</dt>

            <dd>
              {showMoney(pricing.subtotal)}
            </dd>
          </div>

          <div>
            <dt>Kit savings</dt>

            <dd>
              {showMoney(
                pricing.kitDiscount ?? 0,
              )}
            </dd>
          </div>

          <div>
            <dt>Coupon savings</dt>

            <dd>
              {showMoney(pricing.couponDiscount)}
            </dd>
          </div>

          <div>
            <dt>Delivery</dt>

            <dd>
              {showMoney(pricing.shipping)}
            </dd>
          </div>

          <div>
            <dt>
              <strong>Order total</strong>
            </dt>

            <dd>
              <strong>
                {showMoney(total)}
              </strong>
            </dd>
          </div>
        </dl>

        <PurchasedKitSummary order={order} />

        <OrderPaymentDetails order={order} />

        <p>
          Delivery:{" "}

          {order.delivery?.label ||
            (order.deliveryMethod === "express"
              ? "Express delivery"
              : order.deliveryMethod === "standard"
                ? "Standard delivery"
                : "Not recorded")}
        </p>

        {order.giftMessage && (
          <p>
            <strong>Gift message:</strong>{" "}
            {order.giftMessage}
          </p>
        )}

        {order.orderNote && (
          <p>
            <strong>Delivery instructions:</strong>{" "}
            {order.orderNote}
          </p>
        )}
      </article>
    </div>
  );
}