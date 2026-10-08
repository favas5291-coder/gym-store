import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import useOrderUpdates from "../hooks/useOrderUpdates.js";
import { useCatalog } from "../context/CatalogContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useStore } from "../context/StoreContext.jsx";

import { returnEligibility } from "../utils/commerce.js";

import {
  getCartItemKey,
  normalizeCartItem,
  validateCartItem,
} from "../utils/cartUtils.js";

import {
  getOrder as getLocalOrder,
  orderTotal,
  updateOrder,
} from "../utils/customerData.js";

import {
  getOrderById,
  cancelOrder as cancelRemoteOrder,
} from "../services/orderApi.js";

import { money } from "../utils/productPricing.js";

import {
  ProductImage,
  productPath,
} from "../components/StorefrontShared.jsx";

import OrderPaymentDetails, {
  formatOrderDate,
  formatOrderStatus,
} from "../components/OrderPaymentDetails.jsx";

import EmptyState from "../components/EmptyState.jsx";
import Modal from "../components/Modal.jsx";

function recordedAmount(value) {
  if (value == null || value === "") return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : null;
}

function showMoney(value) {
  const parsed = recordedAmount(value);
  return parsed === null ? "Not recorded" : money(parsed);
}

function totalFor(order) {
  return (
    recordedAmount(order.payment?.totalAmount) ??
    recordedAmount(order.pricing?.finalTotal) ??
    orderTotal(order)
  );
}

function variantLabel(size, color) {
  return [
    color,
    size != null && size !== "" ? `Size ${size}` : "",
  ]
    .filter(Boolean)
    .join(" · ") || "Default variant";
}

function deliveredTime(order) {
  const direct = Date.parse(order.delivery?.deliveredAt);

  if (Number.isFinite(direct)) return direct;

  const events = Array.isArray(order.tracking?.events)
    ? order.tracking.events
    : [];

  for (let index = events.length - 1; index >= 0; index--) {
    if (events[index]?.status !== "delivered") continue;

    const time = Date.parse(events[index].timestamp);
    if (Number.isFinite(time)) return time;
  }

  return null;
}

// Match the current backend's order-level request rules.
// Item eligibility is also checked on the request page.
function canRequestReturn(order, signedIn) {
  if (!signedIn) {
    return Boolean(returnEligibility(order)?.eligible);
  }

  if (order.status !== "delivered") return false;

  const status = order.returnRequest?.status || "not-requested";

  if (!["not-requested", "rejected"].includes(status)) {
    return false;
  }

  const delivered = deliveredTime(order);
  const now = Date.now();

  return (
    delivered !== null &&
    delivered <= now &&
    now <= delivered + 7 * 86400000
  );
}

function requestMessage(order, signedIn) {
  const request = order.returnRequest || {};
  const type = request.type === "exchange" ? "exchange" : "return";

  if (!signedIn) {
    return `This guest ${type} request is stored on this device. It has not been sent to GymDrobe support.`;
  }

  switch (request.status) {
    case "requested":
      return `Your ${type} request is waiting for GymDrobe review.`;

    case "approved":
      return type === "exchange"
        ? "Your exchange request is approved. Check the store response and tracking for the next steps."
        : "Your return request is approved. Follow the store instructions for returning the selected items. Approval does not mean the refund is complete.";

    case "rejected":
      return `Your ${type} request was not approved. Read the store response below or contact support.`;

    case "completed":
      return type === "exchange"
        ? "Your exchange request is marked as completed. Check tracking or contact support for replacement delivery details."
        : "Your return is marked as completed. The payment details show the recorded refund status.";

    default:
      return "";
  }
}

function cancellationMessage(order) {
  const refund = order.refund || {};
  const amount = recordedAmount(refund.amount);
  const amountText =
    amount !== null && amount > 0 ? ` of ${money(amount)}` : "";

  if (["refunded", "processed", "completed"].includes(refund.status)) {
    return `Order cancelled. Refund${amountText} is recorded as completed.`;
  }

  if (refund.status === "manual-required") {
    return `Order cancelled. Refund${amountText} requires GymDrobe review.`;
  }

  if (refund.status === "pending") {
    return `Order cancelled. Refund${amountText} is pending confirmation.`;
  }

  return "Order cancelled successfully.";
}

function cancellationDescription(order, signedIn) {
  if (!signedIn) {
    return "This cancels the guest preview order stored on this device. It does not send a cancellation or refund request to GymDrobe.";
  }

  const paid = recordedAmount(order.payment?.amountPaid);
  const method = order.payment?.method || order.paymentMethod;

  if (
    ["razorpay", "cod-partial"].includes(method) &&
    paid !== null &&
    paid > 0
  ) {
    return `If cancellation succeeds, the remaining delivery balance will not be collected. A refund request for the recorded payment of ${money(paid)} will be handled separately. Check the updated refund status after cancellation.`;
  }

  return "Request cancellation of this order. GymDrobe will check its current status before confirming the cancellation.";
}

function OrderDetail({ id }) {
  const revision = useOrderUpdates();
  const { products, refreshProducts } = useCatalog();
  const { user, token, loading: authLoading, authError } = useAuth();
  const store = useStore();
  const { notify } = store;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);

  const [action, setAction] = useState(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const mounted = useRef(false);
  const submitting = useRef(false);

  // Ignore a load that started before a successful cancellation.
  const mutationVersion = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;
    const version = mutationVersion.current;

    function active() {
      return !cancelled && version === mutationVersion.current;
    }

    async function loadOrder() {
      setLoading(true);
      setLoadError("");

      try {
        if (authError) {
          throw new Error(authError);
        }

        let nextOrder;

        if (user) {
          if (!token) {
            throw new Error(
              "Your sign-in session has expired. Please sign in again.",
            );
          }

          nextOrder = await getOrderById(token, id);
        } else {
          nextOrder = getLocalOrder(id, null);
        }

        if (active()) {
          setOrder(nextOrder || null);
        }
      } catch (loadFailure) {
        if (active()) {
          setOrder(null);
          setLoadError(
            loadFailure.message || "Your order could not be loaded.",
          );
        }
      } finally {
        if (active()) {
          setLoading(false);
        }
      }
    }

    loadOrder();

    return () => {
      cancelled = true;
    };
  }, [
    id,
    user?.id,
    user?._id,
    token,
    authLoading,
    authError,
    revision,
    reload,
  ]);

  function findProduct(item) {
    const rows = Array.isArray(products) ? products : [];

    return rows.find((product) => {
      const productIds = [product.id, product._id]
        .filter((value) => value != null)
        .map(String);

      const itemIds = [item.id, item.productId]
        .filter((value) => value != null)
        .map(String);

      return (
        itemIds.some((value) => productIds.includes(value)) ||
        (
          item.legacyId != null &&
          product.legacyId != null &&
          String(item.legacyId) === String(product.legacyId)
        ) ||
        (
          Boolean(item.slug) &&
          String(item.slug) === String(product.slug)
        )
      );
    });
  }

  function itemPath(item) {
    const product = findProduct(item);
    const identifier = product?.id ?? product?._id;

    return identifier != null ? productPath(identifier) : "/shop";
  }

  function reorder() {
    const currentCart =
      typeof store.latestCart === "function"
        ? store.latestCart()
        : store.cart;

    let next = [...(Array.isArray(currentCart) ? currentCart : [])];
    let added = 0;
    const skipped = [];

    for (const item of order.items || []) {
      const found = findProduct(item);

      if (!found) {
        skipped.push(item.name || "Unavailable product");
        continue;
      }

      const product = {
        ...found,
        id: found.id ?? found._id,
      };

      const size = item.selectedSize ?? null;
      const color = item.selectedColor ?? null;

      const key = getCartItemKey({
        id: product.id,
        selectedSize: size,
        selectedColor: color,
      });

      const existing = next.find(
        (row) => getCartItemKey(row) === key,
      );

      const quantity =
        Number(item.quantity) + Number(existing?.quantity || 0);

      const check = validateCartItem(product, quantity, size, color);

      if (!check.valid) {
        skipped.push(item.name || product.name);
        continue;
      }

      next = [
        ...next.filter((row) => getCartItemKey(row) !== key),
        normalizeCartItem(product, quantity, size, color),
      ];

      added += 1;
    }

    if (!added) {
      notify(
        "No selections could be added. Check current stock and variants in the shop.",
        "info",
      );
      return;
    }

    const saved = store.setCart(next);

    // StoreContext shows its own storage warning when persistence fails.
    if (saved === false) return;

    notify(
      `${added} ${added === 1 ? "selection" : "selections"} added at current prices.${
        skipped.length
          ? ` Unavailable: ${[...new Set(skipped)].join(", ")}.`
          : ""
      }`,
      skipped.length ? "info" : "success",
    );
  }

  async function confirmCancellation(event) {
    event.preventDefault();

    if (submitting.current || action !== "cancel") return;

    const cleanReason = reason.trim();

    if (cleanReason.length < 5 || cleanReason.length > 500) {
      setError("Enter a cancellation reason of 5–500 characters.");
      return;
    }

    submitting.current = true;
    setActionLoading(true);
    setError("");

    try {
      let updated;

      if (user) {
        if (!token) {
          throw new Error("Please sign in again before cancelling.");
        }

        updated = await cancelRemoteOrder(token, id, cleanReason);
      } else {
        const current = getLocalOrder(id, null);

        if (
          !current ||
          !["confirmed", "pending", "processing"].includes(current.status)
        ) {
          throw new Error(
            "The order status changed. Refresh the order before continuing.",
          );
        }

        const now = new Date().toISOString();

        updated = updateOrder(id, null, (old) => ({
          ...old,
          status: "cancelled",
          cancellation: {
            ...old.cancellation,
            status: "cancelled",
            reason: cleanReason,
            cancelledAt: now,
          },
          tracking: {
            ...old.tracking,
            events: [
              ...(Array.isArray(old.tracking?.events)
                ? old.tracking.events
                : []),
              {
                status: "cancelled",
                description: "Preview cancellation saved",
                timestamp: now,
              },
            ],
          },
        }));
      }

      if (!updated) {
        throw new Error(
          "The updated order was not returned. Refresh the order to check its status before retrying.",
        );
      }

      if (!mounted.current) return;

      mutationVersion.current += 1;
      setOrder(updated);
      setLoading(false);
      setAction(null);
      setReason("");

      notify(
        user
          ? cancellationMessage(updated)
          : "Guest preview order cancelled on this device.",
        "success",
      );

      if (user && typeof refreshProducts === "function") {
        // Cancellation has succeeded even if catalog refresh fails.
        try {
          await refreshProducts();
        } catch {
          // The catalog can be refreshed separately.
        }
      }
    } catch (cancelFailure) {
      if (mounted.current) {
        setError(
          `${cancelFailure.message || "Unable to cancel this order."} If your connection was interrupted, refresh the order to check whether cancellation succeeded before retrying.`,
        );
      }
    } finally {
      submitting.current = false;

      if (mounted.current) {
        setActionLoading(false);
      }
    }
  }

  if (authLoading || loading) {
    return (
      <div className="page narrow">
        <div className="empty-state" role="status">
          <h3>Loading order…</h3>
          <p>Getting your latest order details.</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page narrow">
        <EmptyState
          title="Order could not be loaded"
          to="/orders"
          label="View my orders"
        >
          {loadError}
        </EmptyState>

        <button
          type="button"
          className="button secondary"
          onClick={() => setReload((value) => value + 1)}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!order) {
    return (
      <EmptyState
        title="Order not found"
        to="/orders"
        label="View my orders"
      >
        This order is not available for your current account or guest session.
      </EmptyState>
    );
  }

  const signedIn = Boolean(user);
  const displayId = order.orderNumber || order.id || id;
  const routeId = encodeURIComponent(displayId);
  const address = order.shippingAddress || {};
  const pricing = order.pricing || {};
  const request = order.returnRequest || {};

  const hasRequest = Boolean(
    request.status &&
    !["none", "not-requested"].includes(request.status),
  );

  const isExchange = request.type === "exchange";

  const canCancel = (
    signedIn
      ? ["confirmed", "processing"]
      : ["confirmed", "pending", "processing"]
  ).includes(order.status);

  const canReturn = canRequestReturn(order, signedIn);

  const deliveryLabel =
    order.delivery?.label ||
    (
      order.deliveryMethod === "express"
        ? "Express delivery"
        : order.deliveryMethod === "standard"
          ? "Standard delivery"
          : "Not recorded"
    );

  return (
    <div className="page narrow">
      <Link className="text-link" to="/orders">
        ← All orders
      </Link>

      <div className="page-heading">
        <div>
          <h1>Order details</h1>
          <p className="order-id">{displayId}</p>
          <p className="muted">{formatOrderDate(order.createdAt)}</p>
        </div>

        <span
          className={`status-pill ${
            order.status === "cancelled" ? "cancelled" : ""
          }`}
        >
          {formatOrderStatus(order.status)}
        </span>
      </div>

      <div className="notice">
        {signedIn
          ? "This order is loaded from your GymDrobe account."
          : "Guest preview order. This order is stored on this device."}
      </div>

      <div className="purchase-actions">
        <button
          type="button"
          className="button secondary compact"
          disabled={actionLoading}
          onClick={() => setReload((value) => value + 1)}
        >
          Refresh order
        </button>
      </div>

      <div className="checkout-layout">
        <div>
          {(order.items || []).map((item, index) => {
            const path = itemPath(item);

            const unitPrice = recordedAmount(item.price);
            const quantity = Number(item.quantity);

            const lineTotal =
              unitPrice !== null &&
              Number.isSafeInteger(quantity) &&
              quantity > 0
                ? unitPrice * quantity
                : null;

            return (
              <article
                className="bag-item"
                key={`${displayId}-${index}`}
              >
                <Link className="bag-photo" to={path}>
                  <ProductImage product={item} />
                </Link>

                <div className="bag-copy">
                  <h2>{item.name}</h2>
                  <p>
                    {variantLabel(item.selectedSize, item.selectedColor)}
                  </p>
                  <p>Quantity: {item.quantity}</p>
                  {item.sku && <p className="muted">SKU: {item.sku}</p>}
                  <strong>{showMoney(lineTotal)}</strong>

                  <p>
                    <Link className="text-link" to={path}>
                      View product
                    </Link>
                  </p>
                </div>
              </article>
            );
          })}

          <section className="panel">
            <h2>DELIVERY ADDRESS</h2>
            <strong>{address.fullName || address.name}</strong>

            <p>
              {address.addressLine || address.address}
              {address.landmark ? `, ${address.landmark}` : ""}
              <br />
              {[address.city, address.state, address.pincode]
                .filter(Boolean)
                .join(", ")}
            </p>

            {address.phone && <p>{address.phone}</p>}
            {address.email && <p>{address.email}</p>}
            <p>Delivery: {deliveryLabel}</p>
          </section>

          {order.giftMessage && (
            <p className="panel">
              <strong>Gift message:</strong> {order.giftMessage}
            </p>
          )}

          {order.orderNote && (
            <p className="panel">
              <strong>Delivery instructions:</strong> {order.orderNote}
            </p>
          )}

          <div className="purchase-actions">
            <Link
              className="button secondary"
              to={`/orders/${routeId}/receipt`}
            >
              View receipt
            </Link>

            <button
              type="button"
              className="button secondary"
              disabled={actionLoading}
              onClick={reorder}
            >
              Buy again
            </button>

            <Link
              className="button secondary"
              to={`/help?order=${routeId}`}
            >
              Get order help
            </Link>

            <Link
              className="button secondary"
              to={`/orders/${routeId}/track`}
            >
              Track order
            </Link>

            {canCancel && (
              <button
                type="button"
                className="button secondary"
                disabled={actionLoading}
                onClick={() => {
                  setAction("cancel");
                  setReason("");
                  setError("");
                }}
              >
                Cancel order
              </button>
            )}

            {canReturn && (
              <Link
                className="button secondary"
                to={`/orders/${routeId}/return`}
              >
                {request.status === "rejected"
                  ? "Submit a new return / exchange request"
                  : "Return / exchange items"}
              </Link>
            )}
          </div>

          {order.status === "delivered" &&
            !canReturn &&
            !hasRequest && (
              <p className="muted">
                Return availability depends on the recorded delivery date
                and request window. Contact support if you need help.
              </p>
            )}

          {order.status === "cancelled" && (
            <section className="panel">
              <h3>Order cancelled</h3>

              {order.cancellation?.reason && (
                <p>
                  <strong>Reason:</strong> {order.cancellation.reason}
                </p>
              )}

              {order.cancellation?.cancelledAt && (
                <p className="muted">
                  Cancelled on{" "}
                  {formatOrderDate(order.cancellation.cancelledAt)}
                </p>
              )}

              <p className="muted">
                Check payment details for any recorded refund updates.
              </p>
            </section>
          )}

          {hasRequest && (
            <section className="panel">
              <div className="page-heading">
                <div>
                  <h3>
                    {isExchange ? "Exchange" : "Return"} request
                  </h3>
                  {request.id && (
                    <p className="order-id">{request.id}</p>
                  )}
                </div>

                <span className="status-pill">
                  {formatOrderStatus(request.status)}
                </span>
              </div>

              <p className="notice">
                {requestMessage(order, signedIn)}
              </p>

              {request.reason && (
                <p>
                  <strong>Reason:</strong> {request.reason}
                </p>
              )}

              {Array.isArray(request.items) &&
                request.items.length > 0 && (
                  <div>
                    <h4>Requested items</h4>

                    {request.items.map((row, index) => {
                      const item = order.items?.[row.index];
                      if (!item) return null;

                      return (
                        <div
                          className="bag-item"
                          key={`${displayId}-request-${index}`}
                        >
                          <div className="bag-copy">
                            <strong>{item.name}</strong>
                            <p>Quantity: {row.quantity}</p>

                            <p className="muted">
                              Original:{" "}
                              {variantLabel(
                                item.selectedSize,
                                item.selectedColor,
                              )}
                            </p>

                            {isExchange && (
                              <p>
                                <strong>Replacement:</strong>{" "}
                                {variantLabel(row.size, row.color)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              {request.response && (
                <div className="notice">
                  <strong>GymDrobe response:</strong>{" "}
                  {request.response}
                </div>
              )}

              {[
                ["Requested on", request.requestedAt],
                ["Responded on", request.respondedAt],
                ["Approved on", request.approvedAt],
                ["Rejected on", request.rejectedAt],
                ["Completed on", request.completedAt],
              ]
                .filter(([, date]) => Boolean(date))
                .map(([label, date]) => (
                  <p className="muted" key={label}>
                    {label} {formatOrderDate(date)}
                  </p>
                ))}

              {signedIn &&
                isExchange &&
                request.exchangeInventoryReservedAt && (
                  <p className="muted">
                    Replacement selection reserved on{" "}
                    {formatOrderDate(
                      request.exchangeInventoryReservedAt,
                    )}
                    . Reservation does not confirm shipment.
                  </p>
                )}
            </section>
          )}
        </div>

        <aside className="order-totals">
          <section className="panel">
            <h2>ORDER SUMMARY</h2>

            <dl className="receipt-totals">
              <div>
                <dt>Items subtotal</dt>
                <dd>{showMoney(pricing.subtotal)}</dd>
              </div>

              <div>
                <dt>Coupon savings</dt>
                <dd>{showMoney(pricing.couponDiscount)}</dd>
              </div>

              <div>
                <dt>Delivery</dt>
                <dd>{showMoney(pricing.shipping)}</dd>
              </div>

              <div className="total">
                <dt><strong>Order total</strong></dt>
                <dd><strong>{showMoney(totalFor(order))}</strong></dd>
              </div>
            </dl>

            {order.coupon?.code && (
              <p className="muted">
                Coupon: {order.coupon.code}
              </p>
            )}
          </section>

          <OrderPaymentDetails order={order} />
        </aside>
      </div>

      {action === "cancel" && (
        <Modal
          title="Cancel this order?"
          onClose={() => {
            if (submitting.current) return;
            setAction(null);
            setError("");
          }}
        >
          <form
            onSubmit={confirmCancellation}
            aria-busy={actionLoading}
          >
            <p>{cancellationDescription(order, signedIn)}</p>

            <div className="field">
              <label htmlFor="order-cancel-reason">
                Cancellation reason
              </label>

              <textarea
                id="order-cancel-reason"
                rows={4}
                required
                minLength={5}
                maxLength={500}
                value={reason}
                disabled={actionLoading}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>

            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}

            <div className="purchase-actions">
              <button
                type="submit"
                className="button"
                disabled={actionLoading}
              >
                {actionLoading ? "Cancelling…" : "Confirm cancellation"}
              </button>

              <button
                type="button"
                className="button secondary"
                disabled={actionLoading}
                onClick={() => {
                  setAction(null);
                  setError("");
                }}
              >
                Keep order
              </button>
            </div>

            {actionLoading && (
              <p className="muted" role="status">
                Checking cancellation and updating your order…
              </p>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}

export default function OrderDetailsPage() {
  const { orderId } = useParams();
  const { user, token } = useAuth();

  return (
    <OrderDetail
      key={`${orderId}-${user?.id || user?._id || "guest"}-${token || ""}`}
      id={orderId}
    />
  );
}