import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import useOrderUpdates from "../hooks/useOrderUpdates.js";

import { useAuth } from "../context/AuthContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";

import {
  getOrder as getLocalOrder,
} from "../utils/customerData.js";

import { optionLabels } from "../utils/productInformation.js";
import { money } from "../utils/productPricing.js";
import { guestAccess } from "../utils/guestCheckout.js";

import {
  orderOwnedBy,
  returnAvailability,
  itemReturnAvailability,
  findReturnProduct,
  replacementOptions,
  replacementStock,
  returnPayload,
  returnReviewKey,
  matchingReturn,
  returnAttemptKey,
  readReturnAttempt,
  saveReturnAttempt,
  clearReturnAttempt,
} from "../utils/customerReturns.js";

import {
  getOrderById,
  requestReturn,
} from "../services/orderApi.js";

import EmptyState from "../components/EmptyState.jsx";
import GuestOrderAccess from "../components/GuestOrderAccess.jsx";

import "../utils/CheckoutPage.css";

function defaultRow(item) {
  return {
    selected: false,
    quantity: 1,
    size: item.selectedSize ?? "",
    color: item.selectedColor ?? "",
  };
}

function when(value) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Confirm with support"
    : date.toLocaleString("en-IN");
}

function unitPrice(value) {
  if (
    !["number", "string"].includes(typeof value) ||
    !String(value).trim()
  ) {
    return "Not recorded";
  }

  const number = Number(value);

  return Number.isFinite(number) && number >= 0
    ? money(number)
    : "Not recorded";
}

function ReturnForm({ orderId, userId, token }) {
  const revision = useOrderUpdates();

  const catalog = useCatalog();
  const { notify } = useStore();
  const navigate = useNavigate();

  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;

  const key = returnAttemptKey(userId, orderId);

  const pending = useRef(readReturnAttempt(key));

  const [awaiting, setAwaiting] = useState(
    Boolean(pending.current),
  );

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [type, setType] = useState("return");
  const [chosen, setChosen] = useState({});
  const [reason, setReason] = useState("");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [now, setNow] = useState(Date.now);

  const mounted = useRef(false);
  const lock = useRef(false);
  const generation = useRef(0);

  const readController = useRef(null);
  const saveController = useRef(null);
  const latestOrder = useRef(null);
  const errorRef = useRef(null);

  useEffect(() => {
    mounted.current = true;

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 30000);

    return () => {
      mounted.current = false;
      generation.current++;

      window.clearInterval(timer);

      readController.current?.abort();
      saveController.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);

  const fetchOwnedOrder = useCallback(
    async (signal) => {
      const next = await getOrderById(
        token,
        orderId,
        { signal },
      );

      if (!orderOwnedBy(next, userId)) {
        throw Object.assign(
          new Error(
            "This order is not available through your current account or private guest access.",
          ),
          { status: 403 },
        );
      }

      return next;
    },
    [token, orderId, userId],
  );

  const adoptOrder = useCallback((next) => {
    if (
      latestOrder.current &&
      returnReviewKey(latestOrder.current) !==
        returnReviewKey(next)
    ) {
      setChosen({});
    }

    latestOrder.current = next;
    setOrder(next);
  }, []);

  const confirmSaved = useCallback(
    (next) => {
      const attempt = pending.current;

      if (
        !attempt ||
        !matchingReturn(
          next,
          attempt.payload,
          attempt.previousId,
        )
      ) {
        return false;
      }

      clearReturnAttempt(key);
      pending.current = null;

      setAwaiting(false);
      adoptOrder(next);

      notify(
        "Your request is recorded. Check order details for review updates.",
        "success",
      );

      navigate(
        `/orders/${encodeURIComponent(
          next.orderNumber || next.id,
        )}`,
        { replace: true },
      );

      return true;
    },
    [key, adoptOrder, navigate, notify],
  );

  const loadOrder = useCallback(async () => {
    if (lock.current) return;

    readController.current?.abort();

    const controller = new AbortController();
    readController.current = controller;

    const version = ++generation.current;

    setLoading(true);
    setLoadError("");

    try {
      const next = await fetchOwnedOrder(
        controller.signal,
      );

      if (
        !mounted.current ||
        version !== generation.current
      ) {
        return;
      }

      adoptOrder(next);

      if (
        !confirmSaved(next) &&
        pending.current
      ) {
        setError(
          "The saved result is still unconfirmed. Check request status again or contact support before making another request.",
        );
      }
    } catch (failure) {
      if (
        mounted.current &&
        version === generation.current &&
        failure.name !== "AbortError"
      ) {
        if (
          [401, 403, 404].includes(failure.status)
        ) {
          setOrder(null);
          latestOrder.current = null;
        }

        setLoadError(
          failure.message ||
            "Unable to load this order.",
        );
      }
    } finally {
      if (
        mounted.current &&
        version === generation.current
      ) {
        setLoading(false);
      }
    }
  }, [
    fetchOwnedOrder,
    adoptOrder,
    confirmSaved,
  ]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder, revision]);

  function changeRow(index, item, update) {
    setChosen((current) => ({
      ...current,

      [index]: {
        ...defaultRow(item),
        ...current[index],
        ...update,
      },
    }));

    setError("");
  }

  async function submit(event) {
    event.preventDefault();

    if (
      lock.current ||
      loading ||
      pending.current ||
      !order
    ) {
      return;
    }

    lock.current = true;
    generation.current++;

    readController.current?.abort();

    setSubmitting(true);
    setError("");

    const controller = new AbortController();
    saveController.current = controller;

    let sent = false;

    try {
      const initial = catalogRef.current;

      returnPayload(
        order,
        chosen,
        type,
        reason,
        initial.products,
        initial.catalogReady === true ||
          (
            initial.loaded === true &&
            !initial.loading &&
            !initial.error
          ),
      );

      const fresh = await fetchOwnedOrder(
        controller.signal,
      );

      if (!mounted.current) return;

      if (
        returnReviewKey(fresh) !==
        returnReviewKey(order)
      ) {
        adoptOrder(fresh);

        setError(
          "Your order changed. Review its latest items and request status before submitting.",
        );

        return;
      }

      const current = catalogRef.current;

      const payload = returnPayload(
        fresh,
        chosen,
        type,
        reason,
        current.products,
        current.catalogReady === true ||
          (
            current.loaded === true &&
            !current.loading &&
            !current.error
          ),
      );

      const attempt = {
        previousId:
          fresh.returnRequest?.id || "",
        payload,
      };

      if (!saveReturnAttempt(key, attempt)) {
        throw new Error(
          "Request recovery could not be saved. Allow browser session storage and try again, or contact support.",
        );
      }

      pending.current = attempt;

      setAwaiting(true);
      sent = true;

      const updated = await requestReturn(
        token,
        orderId,
        payload,
        { signal: controller.signal },
      );

      if (!mounted.current) return;

      if (
        !orderOwnedBy(updated, userId) ||
        !confirmSaved(updated)
      ) {
        throw Object.assign(
          new Error(
            "The server did not return matching saved request details.",
          ),
          { saveResultUnknown: true },
        );
      }
    } catch (failure) {
      if (!mounted.current) return;

      if (
        sent &&
        failure.saveResultUnknown !== false
      ) {
        setAwaiting(true);

        setError(
          "Your request may have been saved. We will check its status; do not submit another request yet.",
        );

        try {
          const fresh = await fetchOwnedOrder(
            controller.signal,
          );

          if (!mounted.current) return;

          adoptOrder(fresh);

          if (confirmSaved(fresh)) return;

          setError(
            "The request could not be confirmed yet. Use Check request status or contact support. Submitting this form does not issue a refund or replacement shipment.",
          );
        } catch (readFailure) {
          if (mounted.current) {
            if (
              [401, 403, 404].includes(
                readFailure.status,
              )
            ) {
              setOrder(null);
              latestOrder.current = null;
            }

            setLoadError(
              readFailure.message ||
                "Unable to check request status.",
            );
          }
        }
      } else {
        if (sent) {
          clearReturnAttempt(key);
          pending.current = null;
          setAwaiting(false);
        }

        setError(
          failure.message ||
            "Unable to submit your request.",
        );

        if (
          [401, 403, 404].includes(failure.status)
        ) {
          setOrder(null);
          latestOrder.current = null;
          setLoadError(failure.message);
        }
      }
    } finally {
      lock.current = false;

      if (mounted.current) {
        setSubmitting(false);
      }
    }
  }

  const displayId =
    order?.orderNumber ||
    order?.id ||
    orderId;

  const routeId = encodeURIComponent(displayId);
  const detailsPath = `/orders/${routeId}`;

  if (loading && !order) {
    return (
      <div className="page narrow">
        <div
          className="empty-state"
          role="status"
        >
          <h3>Loading order…</h3>

          <p>
            Checking recorded delivery and request
            availability.
          </p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="page narrow">
        <EmptyState
          title="Order could not be loaded"
          to="/orders"
          label="View orders"
        >
          {loadError ||
            "This order is not available through your current account or private guest access."}
        </EmptyState>

        <GuestOrderAccess />

        <button
          type="button"
          className="button secondary"
          disabled={loading || submitting}
          onClick={loadOrder}
        >
          Try again
        </button>

        <Link
          className="text-link"
          to="/orders"
        >
          Orders & guest access
        </Link>
      </div>
    );
  }

  const availability =
    returnAvailability(order, now);

  const catalogue = Array.isArray(catalog.products)
    ? catalog.products
    : [];

  const ready =
    catalog.catalogReady === true ||
    (
      catalog.loaded === true &&
      !catalog.loading &&
      !catalog.error
    );

  const blocked =
    loading ||
    submitting ||
    awaiting ||
    Boolean(loadError);

  const items = Array.isArray(order.items)
    ? order.items
    : [];

  const selectable = items.some(
    (item) =>
      itemReturnAvailability(
        order,
        item,
        now,
      ).eligible,
  );

  return (
    <div className="page narrow">
      <Link
        className="text-link"
        to={detailsPath}
      >
        ← Order details
      </Link>

      <div className="page-heading">
        <div>
          <h1>Return or exchange</h1>
          <p className="order-id">{displayId}</p>
        </div>
      </div>

      {order.isGuestOrder === true && (
        <p className="notice">
          This guest order is loaded securely from
          GymDrobe. You can request an eligible return
          or exchange without creating an account.
        </p>
      )}

      {loadError && (
        <section className="panel">
          <p
            className="field-error"
            role="alert"
          >
            {loadError}
          </p>

          <button
            type="button"
            className="button secondary"
            disabled={loading || submitting}
            onClick={loadOrder}
          >
            Reload order
          </button>
        </section>
      )}

      {awaiting && (
        <section className="panel">
          <h2>Check your submitted request</h2>

          <p>
            We have an attempt awaiting confirmation.
            This page will verify it with GymDrobe
            before allowing another submission.
          </p>

          <div className="purchase-actions">
            <button
              type="button"
              className="button"
              disabled={loading || submitting}
              onClick={loadOrder}
            >
              {loading || submitting
                ? "Checking…"
                : "Check request status"}
            </button>

            <Link
              className="button secondary"
              to={detailsPath}
            >
              View order details
            </Link>
          </div>
        </section>
      )}

      {error && (
        <div
          ref={errorRef}
          className="field-error"
          role="alert"
          tabIndex={-1}
        >
          <p>{error}</p>
        </div>
      )}

      {!availability.eligible || !selectable ? (
        <section className="panel">
          <p>
            {availability.message ||
              "No items are currently available for a routine return or exchange. Contact support about your issue."}
          </p>

          <Link
            className="button"
            to={`/help?order=${routeId}`}
          >
            Contact support
          </Link>
        </section>
      ) : (
        <form
          onSubmit={submit}
          aria-busy={submitting}
        >
          <p className="notice">
            Each item's deadline and conditions come
            from this purchase. Your request goes to
            GymDrobe for review. Wait for collection or
            replacement instructions before sending
            items.
          </p>

          <p className="muted">
            Submitting does not issue a refund. Any
            approved item refund uses purchased prices
            and allocated kit and coupon savings;
            shipping is excluded from the current
            item calculation.
          </p>

          <fieldset
            className="option-field"
            disabled={blocked}
          >
            <legend>
              What would you like to do?
            </legend>

            {[
              ["return", "Return selected items"],
              ["exchange", "Exchange available options"],
            ].map(([value, name]) => (
              <label
                className="check"
                key={value}
              >
                <input
                  type="radio"
                  name="request-type"
                  value={value}
                  checked={type === value}
                  onChange={() => {
                    setType(value);
                    setError("");
                  }}
                />

                {name}
              </label>
            ))}
          </fieldset>

          {type === "exchange" && !ready && (
            <section
              className="notice"
              role="status"
            >
              <p>
                {catalog.loading
                  ? "Loading current replacement options…"
                  : "Current replacement options are unavailable. You can still choose return."}
              </p>

              {typeof catalog.refreshProducts ===
                "function" && (
                <button
                  type="button"
                  className="button secondary"
                  disabled={blocked || catalog.loading}
                  onClick={() =>
                    catalog.refreshProducts()
                  }
                >
                  Retry product options
                </button>
              )}
            </section>
          )}

          {items.map((item, index) => {
            if (!item) {
              return (
                <p
                  className="field-error"
                  key={index}
                >
                  An item needs support review.
                </p>
              );
            }

            const allowed =
              itemReturnAvailability(
                order,
                item,
                now,
              );

            const product = findReturnProduct(
              catalogue,
              item,
            );

            const row =
              chosen[index] || defaultRow(item);

            const options =
              replacementOptions(product);

            const labels = optionLabels(product);

            const stock = ready
              ? replacementStock(
                  product,
                  options.sizes.length
                    ? row.size || null
                    : null,
                  options.colors.length
                    ? row.color || null
                    : null,
                )
              : 0;

            const selectedSize =
              options.sizes.includes(String(row.size))
                ? row.size
                : "";

            const selectedColor =
              options.colors.includes(String(row.color))
                ? row.color
                : "";

            function colorAvailable(color) {
              return (
                options.sizes.length
                  ? options.sizes
                  : [null]
              ).some(
                (size) =>
                  replacementStock(
                    product,
                    size,
                    color,
                  ) > 0,
              );
            }

            function sizeAvailable(size) {
              return (
                options.colors.length
                  ? selectedColor
                    ? [selectedColor]
                    : options.colors
                  : [null]
              ).some(
                (color) =>
                  replacementStock(
                    product,
                    size,
                    color,
                  ) > 0,
              );
            }

            return (
              <section
                className="panel"
                key={`${displayId}-${index}`}
              >
                <label className="check">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    disabled={
                      blocked || !allowed.eligible
                    }
                    onChange={(event) =>
                      changeRow(index, item, {
                        selected: event.target.checked,
                      })
                    }
                  />

                  <strong>{item.name}</strong>
                </label>

                <p>
                  Purchased options:{" "}

                  {[
                    item.selectedColor,
                    item.selectedSize,
                  ]
                    .filter(
                      (value) =>
                        value != null &&
                        value !== "",
                    )
                    .join(" / ") ||
                    "Default variant"}

                  {" · "}
                  Quantity: {item.quantity}
                </p>

                {item.sku && (
                  <p className="muted">
                    Purchased SKU: {item.sku}
                  </p>
                )}

                <p>
                  Unit price before order savings:{" "}
                  {unitPrice(item.price)}
                </p>

                {allowed.eligible ? (
                  <p className="muted">
                    Request deadline:{" "}
                    {when(allowed.deadline)}

                    {!allowed.policyConfirmed &&
                      " · Return conditions need manual review."}
                  </p>
                ) : (
                  <p className="notice">
                    {allowed.message}
                  </p>
                )}

                {(item.returnPolicy ||
                  item.returnConditions) && (
                  <p className="muted">
                    {[
                      item.returnPolicy,
                      item.returnConditions,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}

                {row.selected && (
                  <fieldset
                    className="option-field"
                    disabled={blocked}
                  >
                    <legend>Selected item</legend>

                    <div className="field">
                      <label
                        htmlFor={`return-qty-${index}`}
                      >
                        Quantity
                      </label>

                      <input
                        id={`return-qty-${index}`}
                        type="number"
                        min="1"
                        max={item.quantity}
                        step="1"
                        inputMode="numeric"
                        required
                        value={row.quantity}
                        onChange={(event) =>
                          changeRow(index, item, {
                            quantity: event.target.value,
                          })
                        }
                      />
                    </div>

                    {type === "exchange" && (
                      <>
                        {options.colors.length > 0 && (
                          <div className="field">
                            <label
                              htmlFor={`return-color-${index}`}
                            >
                              Replacement{" "}
                              {labels.color.toLowerCase()}
                            </label>

                            <select
                              id={`return-color-${index}`}
                              required
                              disabled={!ready}
                              value={selectedColor}
                              onChange={(event) =>
                                changeRow(index, item, {
                                  color: event.target.value,
                                })
                              }
                            >
                              <option value="">
                                Choose{" "}
                                {labels.color.toLowerCase()}
                              </option>

                              {options.colors.map(
                                (color) => (
                                  <option
                                    key={color}
                                    value={color}
                                    disabled={
                                      ready &&
                                      !colorAvailable(color)
                                    }
                                  >
                                    {color}

                                    {ready &&
                                    !colorAvailable(color)
                                      ? " — unavailable"
                                      : ""}
                                  </option>
                                ),
                              )}
                            </select>
                          </div>
                        )}

                        {options.sizes.length > 0 && (
                          <div className="field">
                            <label
                              htmlFor={`return-size-${index}`}
                            >
                              Replacement{" "}
                              {labels.size.toLowerCase()}
                            </label>

                            <select
                              id={`return-size-${index}`}
                              required
                              disabled={!ready}
                              value={selectedSize}
                              onChange={(event) =>
                                changeRow(index, item, {
                                  size: event.target.value,
                                })
                              }
                            >
                              <option value="">
                                Choose{" "}
                                {labels.size.toLowerCase()}
                              </option>

                              {options.sizes.map(
                                (size) => (
                                  <option
                                    key={size}
                                    value={size}
                                    disabled={
                                      ready &&
                                      !sizeAvailable(size)
                                    }
                                  >
                                    {size}

                                    {ready &&
                                    !sizeAvailable(size)
                                      ? " — unavailable"
                                      : ""}
                                  </option>
                                ),
                              )}
                            </select>
                          </div>
                        )}

                        <p className="muted">
                          {ready
                            ? `${stock} currently available for the selected replacement.`
                            : "Load current options before choosing a replacement."}

                          {" "}
                          Choose a different option.
                          Request submission does not
                          reserve replacement stock.
                        </p>
                      </>
                    )}
                  </fieldset>
                )}
              </section>
            );
          })}

          <div className="field">
            <label htmlFor="return-reason">
              Reason
            </label>

            <textarea
              id="return-reason"
              rows={4}
              required
              minLength={5}
              maxLength={1000}
              disabled={blocked}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setError("");
              }}
            />

            <small className="muted">
              Describe the issue in 5–1,000 characters.
            </small>
          </div>

          <div className="purchase-actions">
            <button
              type="submit"
              className="button"
              disabled={
                blocked ||
                (type === "exchange" && !ready)
              }
            >
              {submitting
                ? "Submitting…"
                : "Submit request for review"}
            </button>

            <Link
              className="button secondary"
              to={detailsPath}
            >
              View order details
            </Link>
          </div>
        </form>
      )}

      <p>
        <Link
          className="text-link"
          to={`/help?order=${routeId}`}
        >
          Need help with a damaged or incorrect item?
          Contact GymDrobe support.
        </Link>
      </p>
    </div>
  );
}

export default function ReturnPage() {
  useOrderUpdates();

  const { orderId = "" } = useParams();

  const {
    user,
    token,
    loading,
    authError,
    retrySession,
  } = useAuth();

  const login =
    `/login?${new URLSearchParams({
      next:
        `/orders/${encodeURIComponent(orderId)}/return`,
    })}`;

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

  const accountId = String(
    user?.id || user?._id || "",
  );

  const guest = guestAccess();

  if (
    user?.isActive === false ||
    (user && (!accountId || !token)) ||
    (token && !accountId)
  ) {
    return (
      <div className="page narrow panel">
        <h1>Account unavailable</h1>

        <p>
          Sign in again to access account orders, or
          contact GymDrobe support for help.
        </p>

        <div className="purchase-actions">
          <Link
            className="button"
            to={login}
          >
            Check sign-in
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

  if (!accountId && !guest) {
    const preview = getLocalOrder(orderId, null);

    return (
      <div className="page narrow panel">
        <h1>Return or exchange</h1>

        <p>
          {preview
            ? "This device contains a preview order. It cannot send a real return or exchange request to GymDrobe."
            : "Restore the private access code saved after guest checkout, or sign in for an order placed with your account."}
        </p>

        <GuestOrderAccess />

        <div className="purchase-actions">
          <Link
            className="button"
            to={login}
          >
            Sign in for account orders
          </Link>

          <Link
            className="button secondary"
            to={`/help?order=${encodeURIComponent(orderId)}`}
          >
            Contact support
          </Link>
        </div>
      </div>
    );
  }

  const userId = accountId || "guest";

  return (
    <ReturnForm
      key={`${userId}:${orderId}:${token || ""}:${guest?.token || ""}`}
      orderId={orderId}
      userId={userId}
      token={token || ""}
    />
  );
}