import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import useOrderUpdates from "../hooks/useOrderUpdates.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";

import {
  getOrder as getLocalOrder,
  updateOrder,
} from "../utils/customerData.js";

import { returnEligibility } from "../utils/commerce.js";
import { validateCartItem } from "../utils/cartUtils.js";
import { makeId } from "../utils/storage.js";

import {
  getOrderById,
  requestReturn as requestRemoteReturn,
} from "../services/orderApi.js";

import EmptyState from "../components/EmptyState.jsx";

function findProduct(products, item) {
  const identifiers = [item.id, item.productId]
    .filter((value) => value != null)
    .map(String);

  return products.find((product) => {
    const ids = [product.id, product._id]
      .filter((value) => value != null)
      .map(String);

    return (
      ids.some((value) => identifiers.includes(value)) ||
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

function variantLabel(size, color) {
  return [
    color,
    size != null && size !== "" ? `Size ${size}` : "",
  ].filter(Boolean).join(" · ") || "Default variant";
}

function ReturnForm({ orderId }) {
  const revision = useOrderUpdates();

  const {
    user,
    token,
    loading: authLoading,
    authError,
    retrySession,
  } = useAuth();

  const {
    products,
    loading: catalogLoading,
    error: catalogError,
    refreshProducts,
  } = useCatalog();

  const catalogue = Array.isArray(products) ? products : [];
  const { notify } = useStore();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [loadError, setLoadError] = useState("");

  const [type, setType] = useState("return");
  const [chosen, setChosen] = useState({});
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const mounted = useRef(false);
  const submitLock = useRef(false);
  const errorRef = useRef(null);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    async function loadOrder() {
      setLoading(true);
      setLoadError("");

      try {
        if (authError) {
          throw new Error(authError);
        }

        let next;

        if (user) {
          if (!token) {
            throw new Error(
              "Your session has expired. Please sign in again.",
            );
          }

          next = await getOrderById(token, orderId);
        } else {
          next = getLocalOrder(orderId, null);
        }

        if (!cancelled) setOrder(next || null);
      } catch (loadFailure) {
        if (!cancelled) {
          setOrder(null);
          setLoadError(
            loadFailure.message || "Unable to load this order.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOrder();

    return () => {
      cancelled = true;
    };
  }, [
    orderId,
    user?.id,
    user?._id,
    token,
    authLoading,
    authError,
    revision,
    retry,
  ]);

  function defaultRow(item) {
    return {
      selected: false,
      quantity: 1,
      size: item.selectedSize ?? "",
      color: item.selectedColor ?? "",
    };
  }

  function changeRow(index, item, update) {
    setChosen((previous) => ({
      ...previous,
      [index]: {
        ...defaultRow(item),
        ...previous[index],
        ...update,
      },
    }));
  }

  async function retryProducts() {
    if (typeof refreshProducts !== "function") return;

    try {
      await refreshProducts();
    } catch {
      if (mounted.current) {
        setError(
          "Replacement options could not be refreshed. Please retry or contact support.",
        );
      }
    }
  }

  async function submit(event) {
    event.preventDefault();

    if (
      submitLock.current ||
      authLoading ||
      loading ||
      authError
    ) {
      return;
    }

    setError("");

    try {
      if (user && !token) {
        throw new Error("Please sign in again.");
      }

      const current = user
        ? order
        : getLocalOrder(orderId, null);

      if (!current) {
        throw new Error("This order could not be found.");
      }

      const eligibility = returnEligibility(current);

      if (!eligibility.eligible) {
        throw new Error(
          eligibility.message || "This request is unavailable.",
        );
      }

      const cleanReason = reason.trim();

      if (cleanReason.length < 5 || cleanReason.length > 1000) {
        throw new Error("Enter a reason of 5–1,000 characters.");
      }

      if (
        type === "exchange" &&
        (catalogLoading || catalogError)
      ) {
        throw new Error(
          "Load current product options before submitting an exchange. You can still request a return.",
        );
      }

      const selected = Object.entries(chosen)
        .filter(([, row]) => row.selected);

      if (!selected.length) {
        throw new Error("Select at least one item.");
      }

      if (selected.length > 50) {
        throw new Error("Select no more than 50 items.");
      }

      const items = selected.map(([key, row]) => {
        const index = Number(key);
        const quantity = Number(row.quantity);
        const item = current.items?.[index];

        if (
          !Number.isSafeInteger(index) ||
          index < 0 ||
          !item ||
          !Number.isSafeInteger(quantity) ||
          quantity < 1 ||
          quantity > Number(item.quantity)
        ) {
          throw new Error("Choose valid item quantities.");
        }

        if (type === "return") {
          return { index, quantity, size: null, color: null };
        }

        const product = findProduct(catalogue, item);

        if (!product || product.isActive === false) {
          throw new Error(
            `${item.name}: This product is unavailable for exchange.`,
          );
        }

        const size = product.sizes?.length
          ? String(row.size ?? "") || null
          : null;

        const color = product.colors?.length
          ? String(row.color ?? "") || null
          : null;

        const validation = validateCartItem(
          product,
          quantity,
          size,
          color,
        );

        if (!validation.valid) {
          throw new Error(`${item.name}: ${validation.message}`);
        }

        const originalSize = item.selectedSize == null
          ? null
          : String(item.selectedSize);

        const originalColor = item.selectedColor == null
          ? null
          : String(item.selectedColor);

        if (size === originalSize && color === originalColor) {
          throw new Error(
            `${item.name}: Choose a different size or colour for exchange.`,
          );
        }

        return { index, quantity, size, color };
      });

      submitLock.current = true;
      setSubmitting(true);

      let updated;

      if (user) {
        updated = await requestRemoteReturn(token, orderId, {
          type,
          items,
          reason: cleanReason,
        });
      } else {
        updated = updateOrder(orderId, null, (old) => ({
          ...old,
          returnRequest: {
            id: makeId("RET"),
            type,
            status: "requested",
            items,
            reason: cleanReason,
            requestedAt: new Date().toISOString(),
          },
        }));
      }

      if (!updated) {
        throw new Error(
          "The updated order was not returned. Open order details to check whether the request was saved before retrying.",
        );
      }

      if (!mounted.current) return;

      notify(
        user
          ? `Your ${type} request was submitted for review.`
          : "Preview request saved on this device. It has not been sent to GymDrobe.",
        user ? "success" : "info",
      );

      navigate(
        `/orders/${encodeURIComponent(
          updated.orderNumber || updated.id || orderId,
        )}`,
        { replace: true },
      );
    } catch (failure) {
      if (mounted.current) {
        setError(
          failure.message || "Unable to submit your request.",
        );
      }
    } finally {
      submitLock.current = false;

      if (mounted.current) setSubmitting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="page narrow">
        <div className="empty-state" role="status">
          <h3>Loading order…</h3>
          <p>Checking your order and request availability.</p>
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
          label="View orders"
        >
          {loadError}
        </EmptyState>

        <button
          type="button"
          className="button secondary"
          onClick={() => {
            if (authError && retrySession) retrySession();
            setRetry((value) => value + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!order) {
    return (
      <EmptyState
        title="Order not found"
        to="/orders"
        label="View orders"
      />
    );
  }

  const eligibility = returnEligibility(order);
  const displayId = order.orderNumber || order.id || orderId;
  const routeId = encodeURIComponent(displayId);
  const orderItems = Array.isArray(order.items) ? order.items : [];

  return (
    <div className="page narrow">
      <Link className="text-link" to={`/orders/${routeId}`}>
        ← Order details
      </Link>

      <div className="page-heading">
        <div>
          <h1>Return or exchange</h1>
          <p className="order-id">{displayId}</p>
        </div>
      </div>

      {!eligibility.eligible ? (
        <section className="panel">
          <p>{eligibility.message}</p>
          <Link
            className="button"
            to={`/help?order=${routeId}`}
          >
            Contact support
          </Link>
        </section>
      ) : (
        <form onSubmit={submit} aria-busy={submitting}>
          <p className="notice">
            Submit by{" "}
            {new Date(eligibility.deadline).toLocaleString("en-IN")}.
            {" "}
            {user
              ? "Your request will be sent to GymDrobe for review. Check the store response for collection or replacement instructions."
              : "This guest preview saves requests only on this device. Contact support to request help with a real order."}
          </p>

          <p className="muted">
            Return refund calculations account for the selected quantities
            and their share of coupon savings. Shipping is excluded from
            the current calculation. Refund approval and completion are
            recorded separately; submitting this form does not issue a refund.
          </p>

          <fieldset className="option-field" disabled={submitting}>
            <legend>WHAT WOULD YOU LIKE TO DO?</legend>

            {[
              ["return", "Return selected items"],
              ["exchange", "Exchange size or colour"],
            ].map(([value, label]) => (
              <label className="check" key={value}>
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
                {label}
              </label>
            ))}
          </fieldset>

          {type === "exchange" &&
            (catalogLoading || catalogError) && (
              <div className="notice" role="status">
                <p>
                  {catalogLoading
                    ? "Loading replacement options…"
                    : "Replacement options could not be loaded."}
                </p>

                {catalogError && (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={submitting || catalogLoading}
                    onClick={retryProducts}
                  >
                    Retry product options
                  </button>
                )}
              </div>
            )}

          {orderItems.map((item, index) => {
            const product = findProduct(catalogue, item);
            const row = chosen[index] || defaultRow(item);

            const sizes = Array.isArray(product?.sizes)
              ? [...new Set(product.sizes.map(String))]
              : [];

            const colors = Array.isArray(product?.colors)
              ? [...new Set(product.colors.map(String))]
              : [];

            const exchangeUnavailable =
              !product || product.isActive === false;

            return (
              <section
                className="panel"
                key={`${displayId}-${index}`}
              >
                <label className="check">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    disabled={submitting}
                    onChange={(event) =>
                      changeRow(index, item, {
                        selected: event.target.checked,
                      })
                    }
                  />
                  <strong>{item.name}</strong>
                </label>

                <p>
                  {variantLabel(
                    item.selectedSize,
                    item.selectedColor,
                  )}
                  {" "}· Ordered quantity {item.quantity}
                </p>

                {row.selected && (
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor={`return-qty-${index}`}>
                        Quantity
                      </label>
                      <input
                        id={`return-qty-${index}`}
                        type="number"
                        min={1}
                        max={item.quantity}
                        step={1}
                        inputMode="numeric"
                        required
                        disabled={submitting}
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
                        {sizes.length > 0 && (
                          <div className="field">
                            <label htmlFor={`return-size-${index}`}>
                              Replacement size
                            </label>
                            <select
                              id={`return-size-${index}`}
                              required
                              disabled={submitting || catalogLoading}
                              value={
                                sizes.includes(String(row.size))
                                  ? row.size
                                  : ""
                              }
                              onChange={(event) =>
                                changeRow(index, item, {
                                  size: event.target.value,
                                })
                              }
                            >
                              <option value="">Choose a size</option>
                              {sizes.map((size) => (
                                <option key={size} value={size}>
                                  {size}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {colors.length > 0 && (
                          <div className="field">
                            <label htmlFor={`return-color-${index}`}>
                              Replacement colour
                            </label>
                            <select
                              id={`return-color-${index}`}
                              required
                              disabled={submitting || catalogLoading}
                              value={
                                colors.includes(String(row.color))
                                  ? row.color
                                  : ""
                              }
                              onChange={(event) =>
                                changeRow(index, item, {
                                  color: event.target.value,
                                })
                              }
                            >
                              <option value="">Choose a colour</option>
                              {colors.map((color) => (
                                <option key={color} value={color}>
                                  {color}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {exchangeUnavailable && !catalogLoading && (
                          <p className="field-error">
                            This product is unavailable for exchange.
                            Choose return or contact support.
                          </p>
                        )}

                        <p className="muted">
                          Choose a different size or colour.
                          Availability is checked when you submit.
                          A request does not reserve replacement stock.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </section>
            );
          })}

          <div className="field">
            <label htmlFor="return-reason">Reason</label>
            <textarea
              id="return-reason"
              required
              minLength={5}
              maxLength={1000}
              rows={4}
              value={reason}
              disabled={submitting}
              onChange={(event) => setReason(event.target.value)}
            />
            <small className="muted">
              Describe the issue in 5–1,000 characters.
            </small>
          </div>

          {error && (
            <div
              ref={errorRef}
              id="return-form-error"
              role="alert"
              tabIndex={-1}
              className="field-error"
            >
              <p>{error}</p>
              <p>
                If your connection was interrupted during submission,
                check order details before trying again.
              </p>
            </div>
          )}

          <div className="purchase-actions">
            <button
              className="button"
              type="submit"
              disabled={
                submitting ||
                (
                  type === "exchange" &&
                  Boolean(catalogLoading || catalogError)
                )
              }
            >
              {submitting
                ? "Submitting…"
                : user
                  ? "Submit request for review"
                  : "Save guest preview request"}
            </button>

            <Link
              className="button secondary"
              to={`/orders/${routeId}`}
              onClick={(event) => {
                if (submitting) event.preventDefault();
              }}
              aria-disabled={submitting || undefined}
            >
              View order details
            </Link>
          </div>

          {submitting && (
            <p className="muted" role="status">
              Saving your request. Please wait…
            </p>
          )}
        </form>
      )}
    </div>
  );
}

export default function ReturnPage() {
  const { orderId } = useParams();
  const { user, token } = useAuth();

  return (
    <ReturnForm
      key={`${user?.id || user?._id || "guest"}:${orderId}:${token || ""}`}
      orderId={orderId}
    />
  );
}