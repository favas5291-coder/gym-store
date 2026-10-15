import PurchasedKitSummary from "../components/PurchasedKitSummary.jsx";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Link,
  useParams,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";
import { useStore } from "../context/StoreContext.jsx";

import useCustomerOrder from "../hooks/useCustomerOrder.js";

import {
  getOrderById,
  cancelOrder,
} from "../services/orderApi.js";

import { money } from "../utils/productPricing.js";

import {
  orderOwnedBy,
  findReturnProduct,
  itemReturnAvailability,
} from "../utils/customerReturns.js";

import {
  recordedAmount,
  purchasedOptions,
  cancellationAvailability,
  cancellationReason,
  cancellationReviewKey,
  sameOrder,
  confirmedCancellation,
  cancellationAttemptKey,
  readCancellationAttempt,
  saveCancellationAttempt,
  clearCancellationAttempt,
  buildReorder,
  returnRequestMessage,
} from "../utils/customerOrderDetails.js";

import {
  trackingText,
} from "../utils/orderTracking.js";

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

function showMoney(value) {
  const amount = recordedAmount(value);

  return amount == null
    ? "Not recorded"
    : money(amount);
}

function OrderDetail({
  orderId,
  userId,
  token,
}) {
  const data = useCustomerOrder(orderId, {
    autoRefresh: true,
  });

  const catalog = useCatalog();
  const store = useStore();

  const catalogRef = useRef(catalog);
  const storeRef = useRef(store);

  catalogRef.current = catalog;
  storeRef.current = store;

  const key = cancellationAttemptKey(
    userId,
    orderId,
  );

  const pending = useRef(
    userId
      ? readCancellationAttempt(key)
      : null,
  );

  const [awaiting, setAwaiting] = useState(
    Boolean(pending.current),
  );

  const [receipt, setReceipt] = useState(null);
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [accessError, setAccessError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  const mounted = useRef(false);
  const lock = useRef(false);
  const requestController = useRef(null);
  const errorRef = useRef(null);

  const order =
    data.order &&
    receipt &&
    data.order.status !== "cancelled"
      ? receipt
      : data.order;

  const orderRef = useRef(order);
  orderRef.current = order;

  const { notify } = store;

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      requestController.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);

  const fetchOwned = useCallback(
    async (signal) => {
      const next = await getOrderById(
        token,
        orderId,
        { signal },
      );

      if (!orderOwnedBy(next, userId)) {
        throw Object.assign(
          new Error(
            "This order is not available to your account.",
          ),
          { status: 403 },
        );
      }

      if (
        orderRef.current &&
        !sameOrder(next, orderRef.current)
      ) {
        throw new Error(
          "The server returned a different order. Contact support before continuing.",
        );
      }

      return next;
    },
    [token, orderId, userId],
  );

  const finishCancellation = useCallback(
    (next) => {
      if (
        !confirmedCancellation(
          next,
          orderRef.current,
          userId,
        )
      ) {
        return false;
      }

      const submitted = Boolean(
        pending.current,
      );

      clearCancellationAttempt(key);
      pending.current = null;

      setAwaiting(false);
      setReceipt(next);
      setAction(null);
      setReason("");
      setError("");
      setAccessError("");

      if (submitted) {
        notify(
          "Your order is recorded as cancelled. Check payment details for refund progress.",
          "success",
        );
      }

      return true;
    },
    [key, userId, notify],
  );

  useEffect(() => {
    if (
      pending.current &&
      data.order &&
      !data.error
    ) {
      finishCancellation(data.order);
    }
  }, [
    data.order,
    data.error,
    finishCancellation,
  ]);

  async function checkCancellation() {
    if (lock.current || !userId) {
      return;
    }

    lock.current = true;
    setBusy(true);
    setError("");

    const controller = new AbortController();
    requestController.current = controller;

    try {
      const next = await fetchOwned(
        controller.signal,
      );

      if (!mounted.current) {
        return;
      }

      setAccessError("");

      if (
        !finishCancellation(next) &&
        pending.current
      ) {
        setError(
          "Cancellation is still unconfirmed. Do not submit another cancellation. Check again or contact support with your order number.",
        );
      }

      await data.refresh();
    } catch (failure) {
      if (mounted.current) {
        setError(
          failure.message ||
            "Unable to check this order.",
        );

        if (
          [401, 403, 404].includes(
            failure.status,
          )
        ) {
          setAccessError(failure.message);
        }
      }
    } finally {
      lock.current = false;

      if (mounted.current) {
        setBusy(false);
      }
    }
  }

  async function confirmCancellation(event) {
    event.preventDefault();

    if (
      lock.current ||
      pending.current ||
      action !== "cancel" ||
      !userId ||
      !order ||
      data.refreshing ||
      data.refreshError ||
      !cancellationAvailability(order).eligible
    ) {
      return;
    }

    lock.current = true;
    setBusy(true);
    setError("");

    const controller = new AbortController();
    requestController.current = controller;

    let sent = false;

    try {
      const cleanReason = cancellationReason(
        reason,
      );

      const fresh = await fetchOwned(
        controller.signal,
      );

      if (!mounted.current) {
        return;
      }

      if (
        !cancellationAvailability(fresh).eligible ||
        cancellationReviewKey(fresh) !==
          cancellationReviewKey(order)
      ) {
        await data.refresh();

        if (mounted.current) {
          if (
            !cancellationAvailability(fresh).eligible
          ) {
            setAction(null);
          }

          setError(
            "Your order changed. Review the refreshed order before requesting cancellation.",
          );
        }

        return;
      }

      if (
        !saveCancellationAttempt(
          key,
          cleanReason,
        )
      ) {
        throw new Error(
          "Cancellation recovery could not be saved. Allow browser session storage and try again, or contact support.",
        );
      }

      pending.current = {
        reason: cleanReason,
      };

      setAwaiting(true);
      sent = true;

      const next = await cancelOrder(
        token,
        orderId,
        cleanReason,
        { signal: controller.signal },
      );

      if (!mounted.current) {
        return;
      }

      if (!finishCancellation(next)) {
        throw Object.assign(
          new Error(
            "The server did not confirm cancellation of this order.",
          ),
          { saveResultUnknown: true },
        );
      }

      await data.refresh();
    } catch (failure) {
      if (!mounted.current) {
        return;
      }

      if (
        sent &&
        failure.saveResultUnknown !== false
      ) {
        setAwaiting(true);

        setError(
          "Cancellation may have been saved. Checking its status; do not submit another request.",
        );

        try {
          const next = await fetchOwned(
            controller.signal,
          );

          if (!mounted.current) {
            return;
          }

          if (!finishCancellation(next)) {
            setError(
              "The cancellation result is still unconfirmed. Use Check cancellation status or contact support before taking another action.",
            );
          }

          await data.refresh();
        } catch (readFailure) {
          if (mounted.current) {
            setError(
              readFailure.message ||
                "Unable to confirm cancellation. Check its status before retrying.",
            );

            if (
              [401, 403, 404].includes(
                readFailure.status,
              )
            ) {
              setAccessError(
                readFailure.message,
              );
            }
          }
        }
      } else {
        if (sent) {
          clearCancellationAttempt(key);
          pending.current = null;
          setAwaiting(false);
        }

        setError(
          failure.message ||
            "Cancellation could not be completed.",
        );

        if (
          [401, 403, 404].includes(
            failure.status,
          )
        ) {
          setAccessError(failure.message);
        }
      }
    } finally {
      lock.current = false;

      if (mounted.current) {
        setBusy(false);
      }
    }
  }

  function reorderPlan() {
    const current = catalogRef.current;
    const shopping = storeRef.current;

    const ready =
      current.catalogReady === true ||
      (
        current.loaded === true &&
        !current.loading &&
        !current.error
      );

    const products =
      typeof current.getLatestProducts === "function"
        ? current.getLatestProducts()
        : current.products;

    const cart =
      typeof shopping.latestCart === "function"
        ? shopping.latestCart()
        : shopping.cart;

    return buildReorder(
      orderRef.current,
      products,
      cart,
      ready &&
        shopping.catalogReady !== false,
    );
  }

  function addReorder() {
    if (
      lock.current ||
      awaiting ||
      data.refreshError ||
      !preview
    ) {
      return;
    }

    lock.current = true;

    try {
      const current = reorderPlan();

      if (current.key !== preview.key) {
        setPreview(current);

        setError(
          "Products, prices or your bag changed. Review the updated selections before adding them.",
        );

        return;
      }

      if (
        current.message ||
        !current.additions.length
      ) {
        setError(current.message);
        return;
      }

      if (
        storeRef.current.setCart(
          current.next,
        ) === false
      ) {
        setError(
          "Your bag could not be saved. Your order has not been changed. Check browser storage and try again.",
        );

        return;
      }

      notify(
        `${current.additions.length} selection${
          current.additions.length === 1
            ? ""
            : "s"
        } added at current prices. Review your bag before checkout.`,
        "success",
      );

      setAction(null);
      setPreview(null);
      setError("");
    } finally {
      lock.current = false;
    }
  }

  const failure =
    accessError || data.error;

  if (failure) {
    return (
      <div className="page narrow">
        <EmptyState
          title="Order could not be loaded"
          to="/orders"
          label="View my orders"
        >
          {failure}
        </EmptyState>

        <div className="purchase-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy || data.refreshing}
            onClick={
              userId
                ? checkCancellation
                : data.refresh
            }
          >
            Retry
          </button>

          <Link
            className="button secondary"
            to="/login"
          >
            Check sign-in
          </Link>

          <Link
            className="text-link"
            to="/help"
          >
            Contact support
          </Link>
        </div>
      </div>
    );
  }

  if (data.loading) {
    return (
      <div
        className="page narrow"
        role="status"
      >
        <h1>Loading order…</h1>
        <p>Getting your recorded order details.</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="page narrow">
        <EmptyState
          title="Order not found"
          to="/orders"
          label="View my orders"
        >
          This order is not available for your
          current account or local preview.
        </EmptyState>
      </div>
    );
  }

  const signedIn = Boolean(userId);

  const displayId =
    order.orderNumber || order.id || orderId;

  const routeId = encodeURIComponent(
    order.id || order._id || orderId,
  );

  const helpPath =
    `/help?${new URLSearchParams({
      order: String(displayId),
    })}`;

  const items = Array.isArray(order.items)
    ? order.items
    : [];

  const products = Array.isArray(catalog.products)
    ? catalog.products
    : [];

  const address = order.shippingAddress || {};
  const pricing = order.pricing || {};
  const request = order.returnRequest || {};

  const hasRequest = [
    "requested",
    "approved",
    "rejected",
    "completed",
  ].includes(request.status);

  const canCancel =
    signedIn &&
    cancellationAvailability(order).eligible;

  const canReturn =
    signedIn &&
    items.some(
      (item) =>
        itemReturnAvailability(order, item).eligible,
    );

  const blocked =
    busy ||
    awaiting ||
    data.refreshing ||
    Boolean(data.refreshError);

  const total = recordedAmount(
    pricing.finalTotal,
  );

  const paymentTotal = recordedAmount(
    order.payment?.totalAmount,
  );

  const deliveryLabel =
    trackingText(order.delivery?.label) ||
    ({
      standard: "Standard delivery",
      express: "Express delivery",
    })[order.deliveryMethod] ||
    "Not recorded";

  return (
    <div className="page narrow">
      <Link
        className="text-link"
        to="/orders"
      >
        ← All orders
      </Link>

      <div className="page-heading">
        <div>
          <h1>Order details</h1>

          <p className="order-id">
            {displayId}
          </p>

          <p className="muted">
            {formatOrderDate(order.createdAt)}
          </p>
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

      <p className="notice">
        {signedIn
          ? "This order is loaded from your GymDrobe account."
          : "Local preview only. It cannot send a real cancellation, return or refund request to GymDrobe."}
      </p>

      {order.metadata?.demo === true && (
        <p className="notice">
          Test order. The recorded payment used
          Razorpay test mode.
        </p>
      )}

      {data.refreshError && (
        <p
          className="field-error"
          role="alert"
        >
          {data.refreshError} Showing previously
          loaded information. Refresh successfully
          before changing this order.
        </p>
      )}

      {awaiting && (
        <section className="panel">
          <h2>CHECK CANCELLATION STATUS</h2>

          <p>
            A cancellation attempt is awaiting
            confirmation. Do not submit another
            cancellation or pay again until this
            is resolved.
          </p>

          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={checkCancellation}
          >
            {busy
              ? "Checking…"
              : "Check cancellation status"}
          </button>{" "}

          <Link
            className="text-link"
            to={helpPath}
          >
            Contact support
          </Link>
        </section>
      )}

      {error && (!action || awaiting) && (
        <p
          ref={errorRef}
          className="field-error"
          role="alert"
          tabIndex={-1}
        >
          {error}
        </p>
      )}

      <button
        type="button"
        className="button secondary compact"
        disabled={busy || data.refreshing}
        onClick={
          awaiting
            ? checkCancellation
            : data.refresh
        }
      >
        {data.refreshing
          ? "Refreshing…"
          : "Refresh order"}
      </button>

      <div className="checkout-layout">
        <div>
          {items.map((item, index) => {
            if (!item) {
              return (
                <p
                  key={index}
                  className="field-error"
                >
                  An order item needs support review.
                </p>
              );
            }

            const product = findReturnProduct(
              products,
              item,
            );

            const id =
              product?.id ?? product?._id;

            const path =
              id != null
                ? productPath(id)
                : null;

            const unit = recordedAmount(
              item.price,
            );

            const quantity = item.quantity;

            const line =
              unit != null &&
              Number.isSafeInteger(quantity) &&
              quantity > 0 &&
              Number.isSafeInteger(
                Math.round(
                  unit * quantity * 100,
                ),
              )
                ? unit * quantity
                : null;

            return (
              <article
                className="bag-item"
                key={`${displayId}-${index}`}
              >
                {path ? (
                  <Link
                    className="bag-photo"
                    to={path}
                  >
                    <ProductImage product={item} />
                  </Link>
                ) : (
                  <div className="bag-photo">
                    <ProductImage product={item} />
                  </div>
                )}

                <div className="bag-copy">
                  <h2>
                    {trackingText(item.name) ||
                      "Purchased item"}
                  </h2>

                  {trackingText(item.brand) && (
                    <p className="muted">
                      {item.brand}
                    </p>
                  )}

                  <p>
                    Purchased options:{" "}
                    {purchasedOptions(
                      item.selectedSize,
                      item.selectedColor,
                    )}
                  </p>

                  <p>
                    Quantity:{" "}
                    {Number.isSafeInteger(quantity) &&
                    quantity > 0
                      ? quantity
                      : "Needs review"}
                  </p>

                  {trackingText(item.sku) && (
                    <p className="muted">
                      Purchased SKU: {item.sku}
                    </p>
                  )}

                  <p>
                    Purchased unit price:{" "}
                    {showMoney(unit)}
                  </p>

                  <strong>
                    {showMoney(line)}
                  </strong>

                  <p className="muted">
                    Item prices are before any
                    kit and coupon allocations.
                  </p>

                  {trackingText(
                    item.returnPolicy,
                  ) && (
                    <p className="muted">
                      Return policy:{" "}
                      {item.returnPolicy}
                    </p>
                  )}

                  {trackingText(
                    item.returnConditions,
                  ) && (
                    <p className="muted">
                      {item.returnConditions}
                    </p>
                  )}

                  <p>
                    {path ? (
                      <Link
                        className="text-link"
                        to={path}
                      >
                        View current product
                      </Link>
                    ) : (
                      <span className="muted">
                        The original product is
                        no longer listed.
                      </span>
                    )}
                  </p>
                </div>
              </article>
            );
          })}

          <section className="panel">
            <h2>DELIVERY ADDRESS</h2>

            <strong>
              {trackingText(address.fullName) ||
                trackingText(address.name)}
            </strong>

            <p>
              {trackingText(address.addressLine) ||
                trackingText(address.address)}

              {trackingText(address.landmark) &&
                `, ${address.landmark}`}

              <br />

              {[
                address.city,
                address.state,
                address.pincode,
              ]
                .map(trackingText)
                .filter(Boolean)
                .join(", ")}
            </p>

            {trackingText(address.phone) && (
              <p>{address.phone}</p>
            )}

            {trackingText(address.email) && (
              <p>{address.email}</p>
            )}

            <p>
              Delivery: {deliveryLabel}
            </p>
          </section>

          {trackingText(order.giftMessage) && (
            <p className="panel">
              <strong>Gift message:</strong>{" "}
              {order.giftMessage}
            </p>
          )}

          {trackingText(order.orderNote) && (
            <p className="panel">
              <strong>
                Delivery instructions:
              </strong>{" "}
              {order.orderNote}
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
              disabled={
                blocked || catalog.loading
              }
              onClick={() => {
                setPreview(reorderPlan());
                setError("");
                setAction("reorder");
              }}
            >
              Buy again
            </button>

            <Link
              className="button secondary"
              to={helpPath}
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
                disabled={blocked}
                onClick={() => {
                  setAction("cancel");
                  setReason("");
                  setError("");
                }}
              >
                Cancel order
              </button>
            )}

            {canReturn && !blocked && (
              <Link
                className="button secondary"
                to={`/orders/${routeId}/return`}
              >
                {request.status === "rejected"
                  ? "Request return / exchange review again"
                  : "Return / exchange items"}
              </Link>
            )}
          </div>

          {order.status === "delivered" &&
            !canReturn &&
            !hasRequest && (
              <p className="muted">
                Return availability depends on
                recorded payment, delivery and
                each item&apos;s purchased
                conditions and deadline.
                Contact support about damaged,
                incorrect or faulty items.
              </p>
            )}

          {order.status === "cancelled" && (
            <section className="panel">
              <h2>ORDER CANCELLED</h2>

              {trackingText(
                order.cancellation?.reason,
              ) && (
                <p>
                  Reason:{" "}
                  {order.cancellation.reason}
                </p>
              )}

              {order.cancellation?.cancelledAt && (
                <p className="muted">
                  Recorded cancellation:{" "}
                  {formatOrderDate(
                    order.cancellation.cancelledAt,
                  )}
                </p>
              )}

              <p>
                Check payment details for any
                refund. Cancellation confirmation
                is separate from refund completion.
              </p>
            </section>
          )}

          {hasRequest && (
            <section className="panel">
              <div className="page-heading">
                <div>
                  <h2>
                    {request.type === "exchange"
                      ? "EXCHANGE"
                      : "RETURN"}{" "}
                    REQUEST
                  </h2>

                  {trackingText(request.id) && (
                    <p className="order-id">
                      {request.id}
                    </p>
                  )}
                </div>

                <span className="status-pill">
                  {formatOrderStatus(
                    request.status,
                  )}
                </span>
              </div>

              <p className="notice">
                {signedIn
                  ? returnRequestMessage(request)
                  : "This is a local preview request. It has not been submitted to GymDrobe."}
              </p>

              {trackingText(request.reason) && (
                <p>
                  <strong>Reason:</strong>{" "}
                  {request.reason}
                </p>
              )}

              {(
                Array.isArray(request.items)
                  ? request.items
                  : []
              ).map((row, index) => {
                const item =
                  Number.isSafeInteger(row?.index)
                    ? items[row.index]
                    : null;

                if (!item) {
                  return (
                    <p
                      className="muted"
                      key={index}
                    >
                      A requested item needs
                      support review.
                    </p>
                  );
                }

                return (
                  <div
                    className="bag-item"
                    key={`request-${index}`}
                  >
                    <div className="bag-copy">
                      <strong>
                        {trackingText(item.name)}
                      </strong>

                      <p>
                        Requested quantity:{" "}
                        {Number.isSafeInteger(
                          row.quantity,
                        )
                          ? row.quantity
                          : "Not recorded"}
                      </p>

                      <p>
                        Original options:{" "}
                        {purchasedOptions(
                          item.selectedSize,
                          item.selectedColor,
                        )}
                      </p>

                      {request.type === "exchange" && (
                        <p>
                          Replacement options:{" "}
                          {purchasedOptions(
                            row.size,
                            row.color,
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {trackingText(request.response) && (
                <p className="notice">
                  <strong>
                    GymDrobe response:
                  </strong>{" "}
                  {request.response}
                </p>
              )}

              {[
                ["Requested", request.requestedAt],
                ["Responded", request.respondedAt],
                ["Approved", request.approvedAt],
                ["Rejected", request.rejectedAt],

                [
                  "Inspection completed",
                  request.inspectionCompletedAt,
                ],

                [
                  "Request completed",
                  request.completedAt,
                ],
              ]
                .filter(([, date]) => date)
                .map(([label, date]) => (
                  <p
                    className="muted"
                    key={label}
                  >
                    {label}:{" "}
                    {formatOrderDate(date)}
                  </p>
                ))}

              {request.type === "exchange" &&
                request.exchangeInventoryReservedAt && (
                  <p className="muted">
                    Replacement stock recorded as
                    reserved:{" "}
                    {formatOrderDate(
                      request.exchangeInventoryReservedAt,
                    )}
                    . This does not confirm
                    replacement shipment or delivery.
                  </p>
                )}

              <Link
                className="text-link"
                to={helpPath}
              >
                Get help with this request
              </Link>
            </section>
          )}
        </div>

        <aside className="order-totals">
          <section className="panel">
            <PurchasedKitSummary order={order} />

            <h2>ORDER SUMMARY</h2>

            <dl className="receipt-totals">
              {[
                [
                  "Items subtotal",
                  pricing.subtotal,
                ],
                [
                  "Kit savings",
                  pricing.kitDiscount ?? 0,
                ],
                [
                  "Coupon savings",
                  pricing.couponDiscount,
                ],
                [
                  "Delivery",
                  pricing.shipping,
                ],
                [
                  "Order total",
                  pricing.finalTotal,
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{showMoney(value)}</dd>
                </div>
              ))}
            </dl>

            {trackingText(order.coupon?.code) && (
              <p className="muted">
                Coupon: {order.coupon.code}
              </p>
            )}

            {total != null &&
              paymentTotal != null &&
              total !== paymentTotal && (
                <p
                  className="field-error"
                  role="alert"
                >
                  The order and payment totals
                  differ. Contact support to
                  reconcile them before paying again.
                </p>
              )}
          </section>

          <OrderPaymentDetails order={order} />
        </aside>
      </div>

      {action === "cancel" && !awaiting && (
        <Modal
          title="Cancel this order?"
          onClose={() => {
            if (!lock.current) {
              setAction(null);
              setError("");
            }
          }}
        >
          <form
            onSubmit={confirmCancellation}
            aria-busy={busy}
          >
            <p>
              GymDrobe will verify that this order
              can still be cancelled. Cancellation
              and refund completion are separate.
            </p>

            {Number(order.payment?.amountPaid) > 0 && (
              <p>
                Recorded amount paid:{" "}
                {showMoney(
                  order.payment.amountPaid,
                )}
                . If cancellation succeeds, check
                the updated refund status.
                A remaining COD balance will not
                be collected for a cancelled order.
              </p>
            )}

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
                disabled={busy}
                onChange={(event) =>
                  setReason(event.target.value)
                }
              />
            </div>

            {error && (
              <p
                ref={errorRef}
                tabIndex={-1}
                className="field-error"
                role="alert"
              >
                {error}
              </p>
            )}

            <div className="purchase-actions">
              <button
                type="submit"
                className="button"
                disabled={
                  busy ||
                  data.refreshing ||
                  Boolean(data.refreshError)
                }
              >
                {busy
                  ? "Checking cancellation…"
                  : "Confirm cancellation"}
              </button>

              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  setAction(null);
                  setError("");
                }}
              >
                Keep order
              </button>
            </div>
          </form>
        </Modal>
      )}

      {action === "reorder" && preview && (
        <Modal
          title="Review products to buy again"
          onClose={() => {
            if (!lock.current) {
              setAction(null);
              setPreview(null);
              setError("");
            }
          }}
        >
          <p>
            Your previous coupons are not reapplied.
            These are current product prices;
            shipping and eligible discounts are
            calculated in your bag and checkout.
          </p>

          {preview.additions.map(
            (row, index) => (
              <div
                className="bag-item"
                key={`reorder-${index}`}
              >
                <div className="bag-photo">
                  <ProductImage
                    product={row.product}
                  />
                </div>

                <div className="bag-copy">
                  <strong>{row.name}</strong>

                  <p>
                    {purchasedOptions(
                      row.size,
                      row.color,
                    )}{" "}
                    · Quantity to add:{" "}
                    {row.quantity}
                  </p>

                  <p>
                    Current unit price:{" "}
                    {money(row.price)}
                  </p>

                  {row.previousPrice != null &&
                    row.previousPrice !== row.price && (
                      <p className="muted">
                        Previous purchased unit price:{" "}
                        {money(row.previousPrice)}
                      </p>
                    )}

                  <p>
                    Products to add:{" "}
                    {money(
                      row.price * row.quantity,
                    )}
                  </p>
                </div>
              </div>
            ),
          )}

          {preview.skipped.length > 0 && (
            <section className="notice">
              <h3>Not being added</h3>

              <ul>
                {preview.skipped.map(
                  (row, index) => (
                    <li key={index}>
                      <strong>{row.name}:</strong>{" "}
                      {row.message}
                    </li>
                  ),
                )}
              </ul>
            </section>
          )}

          {preview.message && (
            <p className="notice">
              {preview.message}
            </p>
          )}

          {preview.additions.length > 0 && (
            <p>
              <strong>
                New items subtotal:{" "}
                {money(preview.subtotal)}
              </strong>
            </p>
          )}

          {error && (
            <p
              ref={errorRef}
              tabIndex={-1}
              className="field-error"
              role="alert"
            >
              {error}
            </p>
          )}

          <div className="purchase-actions">
            <button
              type="button"
              className="button"
              disabled={
                blocked ||
                catalog.loading ||
                !preview.additions.length ||
                Boolean(preview.message)
              }
              onClick={addReorder}
            >
              Add available selections to bag
            </button>

            <Link
              className="button secondary"
              to="/cart"
            >
              Review bag
            </Link>

            <Link
              className="text-link"
              to="/shop"
            >
              Browse products
            </Link>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function OrderDetailsPage() {
  const { orderId = "" } = useParams();

  const {
    user,
    token,
    loading,
    authError,
    retrySession,
  } = useAuth();

  if (loading) {
    return (
      <div
        className="page narrow"
        role="status"
      >
        Checking your account…
      </div>
    );
  }

  if (authError) {
    return (
      <div className="page narrow panel">
        <h1>Unable to check your account</h1>

        <p
          className="field-error"
          role="alert"
        >
          {authError}
        </p>

        <button
          type="button"
          className="button"
          onClick={retrySession}
        >
          Try again
        </button>
      </div>
    );
  }

  const userId = String(
    user?.id || user?._id || "",
  );

  if (
    user?.isActive === false ||
    (user && (!userId || !token)) ||
    (token && !userId)
  ) {
    return (
      <div className="page narrow panel">
        <h1>Account unavailable</h1>

        <p>
          Sign in with the account that placed this
          order, or contact support.
        </p>

        <div className="purchase-actions">
          <Link
            className="button"
            to={`/login?${new URLSearchParams({
              next:
                `/orders/${encodeURIComponent(orderId)}`,
            })}`}
          >
            Sign in
          </Link>

          <Link
            className="button secondary"
            to="/help"
          >
            Contact support
          </Link>
        </div>
      </div>
    );
  }

  return (
    <OrderDetail
      key={`${userId || "guest"}:${orderId}:${token || ""}`}
      orderId={orderId}
      userId={userId}
      token={token}
    />
  );
}