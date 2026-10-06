import { Link, useParams } from "react-router-dom";

import useCustomerOrder from "../hooks/useCustomerOrder.js";

import {
  orderTotal,
} from "../utils/customerData.js";

import { money } from "../utils/productPricing.js";

import {
  csvCell,
  downloadText,
} from "../utils/commerce.js";

import EmptyState from "../components/EmptyState.jsx";

import OrderPaymentDetails, {
  formatOrderDate,
  formatOrderStatus,
  getPaymentRows,
} from "../components/OrderPaymentDetails.jsx";

function showMoney(value) {
  if (value == null || value === "") {
    return "Not recorded";
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? money(number)
    : "Not recorded";
}

export default function ReceiptPage() {
  const { orderId } = useParams();

  const {
    order,
    loading,
    error,
    isAccountOrder,
    refresh,
    refreshing,
  } = useCustomerOrder(orderId);

  if (loading) {
    return (
      <div className="page narrow receipt-page">
        <div className="empty-state" role="status">
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
      <EmptyState
        title="Receipt not found"
        to="/orders"
        label="View orders"
      >
        This order is not available for your current
        account or guest session.
      </EmptyState>
    );
  }

  const displayId =
    order.orderNumber || order.id || orderId;

  const address = order.shippingAddress || {};
  const pricing = order.pricing || {};

  function downloadCsv() {
    const rows = [
      ["Order", displayId],
      ["Date", order.createdAt || ""],
      ["Status", formatOrderStatus(order.status)],
      [],
      [
        "Product",
        "Size",
        "Colour",
        "Quantity",
        "Unit INR",
        "Line INR",
      ],
      ...(order.items || []).map((item) => [
        item.name,
        item.selectedSize || "",
        item.selectedColor || "",
        item.quantity,
        item.price,
        Number(item.quantity || 0) *
          Number(item.price || 0),
      ]),
      [],
      [
        "Items subtotal INR",
        pricing.subtotal ?? "Not recorded",
      ],
      [
        "Coupon savings INR",
        pricing.couponDiscount ?? "Not recorded",
      ],
      [
        "Delivery INR",
        pricing.shipping ?? "Not recorded",
      ],
      ["Order total INR", orderTotal(order)],
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

      <article className="receipt-sheet">
        <div className="page-heading">
          <div>
            <p className="eyebrow">GYMDROBE</p>
            <h1>Order receipt</h1>
          </div>

          <span
            className={`status-pill ${
              order.status === "cancelled"
                ? "cancelled"
                : ""
            }`}
          >
            {formatOrderStatus(order.status)}
          </span>
        </div>

        <p className="order-id">{displayId}</p>
        <p>{formatOrderDate(order.createdAt)}</p>

        <p className="notice">
          {isAccountOrder
            ? "This summary is generated from your GymDrobe account order."
            : "This guest order summary is stored on this device."}
          {" "}
          It is not a tax invoice or independent
          proof of payment.
        </p>

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
              Order items and prices in INR
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
              {(order.items || []).map(
                (item, index) => (
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
                    <td>{showMoney(item.price)}</td>

                    <td>
                      {money(
                        Number(item.price || 0) *
                          Number(item.quantity || 0),
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>

        <dl className="receipt-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{showMoney(pricing.subtotal)}</dd>
          </div>

          <div>
            <dt>Coupon savings</dt>
            <dd>
              {showMoney(pricing.couponDiscount)}
            </dd>
          </div>

          <div>
            <dt>Delivery</dt>
            <dd>{showMoney(pricing.shipping)}</dd>
          </div>

          <div>
            <dt>
              <strong>Order total</strong>
            </dt>
            <dd>
              <strong>
                {money(orderTotal(order))}
              </strong>
            </dd>
          </div>
        </dl>

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