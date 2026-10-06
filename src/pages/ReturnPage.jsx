import {
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

import {
  useAuth,
} from "../context/AuthContext.jsx";

import {
  useStore,
} from "../context/StoreContext.jsx";

import {
  useCatalog,
} from "../context/CatalogContext.jsx";

import {
  getOrder as getLocalOrder,
  updateOrder,
} from "../utils/customerData.js";

import {
  returnEligibility,
  validateReturnItems,
} from "../utils/commerce.js";

import {
  makeId,
} from "../utils/storage.js";

import {
  getOrderById,
  requestReturn as requestRemoteReturn,
} from "../services/orderApi.js";

import EmptyState from "../components/EmptyState.jsx";

// ======================================================
// RETURN / EXCHANGE FORM
// ======================================================

function ReturnForm({ orderId }) {
  const revision = useOrderUpdates();

  const {
    user,
    token,
    authLoading = false,
  } = useAuth();

  const {
    products,
    loading: catalogLoading,
    error: catalogError,
    refreshProducts,
  } = useCatalog();

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

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  // ====================================================
  // LOAD ORDER
  // ====================================================

  useEffect(() => {
    let cancelled = false;

    async function loadOrder() {
      setLoadError("");
      setLoading(true);

      if (authLoading) {
        return;
      }

      if (!user) {
        const localOrder = getLocalOrder(
          orderId,
          null
        );

        if (!cancelled) {
          setOrder(localOrder);
          setLoading(false);
        }

        return;
      }

      if (!token) {
        if (!cancelled) {
          setOrder(null);
          setLoading(false);

          setLoadError(
            "Your sign-in session has expired. Please sign in again."
          );
        }

        return;
      }

      try {
        const remoteOrder = await getOrderById(
          token,
          orderId
        );

        if (cancelled) {
          return;
        }

        setOrder(remoteOrder || null);
      } catch (fetchError) {
        if (cancelled) {
          return;
        }

        console.error(
          "Load return order error:",
          fetchError
        );

        setOrder(null);

        setLoadError(
          fetchError.message ||
          "Unable to load this order."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadOrder();

    return () => {
      cancelled = true;
    };
  }, [
    orderId,
    user?.id,
    token,
    authLoading,
    revision,
    retry,
  ]);

  // ====================================================
  // FIND CURRENT PRODUCT
  // ====================================================

  function findProduct(item) {
    return products.find(
      (product) =>
        String(product.id) === String(item.id) ||
        String(product.id) === String(item.productId) ||
        (
          item.legacyId != null &&
          String(product.legacyId) ===
            String(item.legacyId)
        ) ||
        (
          item.slug &&
          String(product.slug) ===
            String(item.slug)
        )
    );
  }

  // ====================================================
  // SUBMIT REQUEST
  // ====================================================

  async function submit(event) {
    event.preventDefault();

    if (
      submitting ||
      submitLock.current ||
      authLoading ||
      loading
    ) {
      return;
    }

    setError("");

    if (
      type === "exchange" &&
      (catalogLoading || catalogError)
    ) {
      setError(
        "Load the current product options before submitting an exchange. Returns can still be requested."
      );

      return;
    }

    const items = Object.entries(chosen)
      .filter(([, row]) => row.selected)
      .map(([index, row]) => ({
        index: Number(index),
        quantity: Number(row.quantity),
        size: row.size || null,
        color: row.color || null,
      }));

    const cleanReason = reason.trim();

    // Signed-in customer: submit to the backend.
    if (user) {
      if (!token) {
        setError(
          "Your sign-in session has expired. Please sign in again."
        );

        return;
      }

      if (!order) {
        setError(
          "This order could not be loaded."
        );

        return;
      }

      const eligibility =
        returnEligibility(order);

      if (!eligibility.eligible) {
        setError(eligibility.message);
        return;
      }

      const invalid = validateReturnItems(
        order,
        items,
        products,
        type
      );

      if (invalid || cleanReason.length < 5) {
        setError(
          invalid ||
          "Please describe the reason in at least 5 characters."
        );

        return;
      }

      submitLock.current = true;
      setSubmitting(true);

      try {
        const updatedOrder =
          await requestRemoteReturn(
            token,
            orderId,
            {
              type,
              items,
              reason: cleanReason,
            }
          );

        if (!updatedOrder) {
          throw new Error(
            "The server did not return the updated order."
          );
        }

        if (!mounted.current) {
          return;
        }

        setOrder(updatedOrder);

        notify(
          type === "exchange"
            ? "Your exchange request was submitted successfully."
            : "Your return request was submitted successfully.",
          "success"
        );

        navigate(
          `/orders/${encodeURIComponent(orderId)}`
        );
      } catch (submitError) {
        console.error(
          "Submit return request error:",
          submitError
        );

        if (mounted.current) {
          setError(
            submitError.message ||
            "Unable to submit your request."
          );
        }
      } finally {
        submitLock.current = false;

        if (mounted.current) {
          setSubmitting(false);
        }
      }

      return;
    }

    // Guest preview: save only on this device.
    const current = getLocalOrder(
      orderId,
      null
    );

    if (!current) {
      setError(
        "This order could not be found."
      );

      return;
    }

    const eligibility =
      returnEligibility(current);

    if (!eligibility.eligible) {
      setError(eligibility.message);
      return;
    }

    const invalid = validateReturnItems(
      current,
      items,
      products,
      type
    );

    if (invalid || cleanReason.length < 5) {
      setError(
        invalid ||
        "Please describe the reason in at least 5 characters."
      );

      return;
    }

    const next = updateOrder(
      orderId,
      null,
      (old) => ({
        ...old,

        returnRequest: {
          id: makeId("RET"),
          type,
          status: "requested",
          items,
          reason: cleanReason,
          requestedAt:
            new Date().toISOString(),
        },
      })
    );

    if (!next) {
      setError(
        "Unable to save your request. Please try again."
      );

      return;
    }

    notify(
      "Preview request saved on this device. It has not been sent to GymDrobe.",
      "info"
    );

    navigate(
      `/orders/${encodeURIComponent(orderId)}`
    );
  }

  // ====================================================
  // LOADING
  // ====================================================

  if (authLoading || loading) {
    return (
      <div className="page narrow">
        <div
          className="empty-state"
          role="status"
        >
          <h3>Loading order…</h3>

          <p>
            Checking your order and return
            eligibility.
          </p>
        </div>
      </div>
    );
  }

  // ====================================================
  // LOAD ERROR
  // ====================================================

  if (loadError) {
    return (
      <div className="page narrow">
        <EmptyState
          title="Order could not be loaded"
          to="/orders"
          label="View orders"
        >
          <p>{loadError}</p>

          <button
            type="button"
            className="button secondary"
            onClick={() =>
              setRetry((value) => value + 1)
            }
          >
            Try again
          </button>
        </EmptyState>
      </div>
    );
  }

  // ====================================================
  // ORDER NOT FOUND
  // ====================================================

  if (!order) {
    return (
      <EmptyState
        title="Order not found"
        to="/orders"
        label="View orders"
      />
    );
  }

  const eligibility =
    returnEligibility(order);

  // ====================================================
  // PAGE
  // ====================================================

  return (
    <div className="page narrow">
      <Link
        className="text-link"
        to={`/orders/${encodeURIComponent(orderId)}`}
      >
        ← Order details
      </Link>

      <div className="page-heading">
        <h1>Return or exchange</h1>
      </div>

      {!eligibility.eligible ? (
        <div className="panel">
          <p>{eligibility.message}</p>

          <Link
            className="button"
            to={`/help?order=${encodeURIComponent(orderId)}`}
          >
            Contact support
          </Link>
        </div>
      ) : (
        <form
          onSubmit={submit}
          aria-busy={submitting}
        >
          {/* Request notice */}

          <p className="notice">
            Submit by{" "}
            {new Date(
              eligibility.deadline
            ).toLocaleString("en-IN")}
            .{" "}

            {user
              ? "Your request will be sent to GymDrobe for review. Collection and replacement dispatch are arranged after approval. Return refunds are processed manually and recorded separately."
              : "This guest preview saves requests only on this device. It does not send a request to GymDrobe or process a refund. Contact support for a real order."}
          </p>

          <p className="muted">
            Refunds are based on selected items
            after their share of coupon savings.
            Shipping is excluded from this
            calculation. A refund cannot exceed
            the payment recorded as collected,
            including any COD balance recorded
            after delivery. Submitting a request
            does not issue a refund.
          </p>

          {type === "exchange" &&
            (catalogLoading || catalogError) && (
              <div
                className="notice"
                role="status"
              >
                <p>
                  {catalogLoading
                    ? "Loading replacement options…"
                    : "Replacement options could not be loaded."}
                </p>

                {catalogError && (
                  <button
                    type="button"
                    className="button secondary"
                    onClick={refreshProducts}
                  >
                    Retry product options
                  </button>
                )}
              </div>
            )}

          {/* Request type */}

          <fieldset className="option-field">
            <legend>
              WHAT WOULD YOU LIKE TO DO?
            </legend>

            <label className="check">
              <input
                type="radio"
                name="request-type"
                checked={type === "return"}
                disabled={submitting}
                onChange={() => {
                  setType("return");
                  setError("");
                }}
              />

              Return selected items
            </label>

            <label className="check">
              <input
                type="radio"
                name="request-type"
                checked={type === "exchange"}
                disabled={submitting}
                onChange={() => {
                  setType("exchange");
                  setError("");
                }}
              />

              Exchange size or colour
            </label>
          </fieldset>

          {/* Order items */}

          {order.items.map((item, index) => {
            const product =
              findProduct(item);

            const row = chosen[index] || {
              selected: false,
              quantity: 1,
              size: item.selectedSize || "",
              color: item.selectedColor || "",
            };

            const change = (update) =>
              setChosen((old) => ({
                ...old,

                [index]: {
                  ...row,
                  ...update,
                },
              }));

            return (
              <section
                className="panel"
                key={`${order.id}-${index}`}
              >
                <label className="check">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    disabled={submitting}
                    onChange={(event) =>
                      change({
                        selected:
                          event.target.checked,
                      })
                    }
                  />

                  <strong>
                    {item.name}
                  </strong>
                </label>

                <p>
                  {[
                    item.selectedColor,
                    item.selectedSize,
                  ]
                    .filter(Boolean)
                    .join(" / ")}
                  {" "}
                  · Ordered quantity{" "}
                  {item.quantity}
                </p>

                {row.selected && (
                  <div className="form-grid">
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
                        disabled={submitting}
                        value={row.quantity}
                        onChange={(event) =>
                          change({
                            quantity:
                              event.target.value,
                          })
                        }
                      />
                    </div>

                    {type === "exchange" && (
                      <>
                        {product?.sizes?.length > 0 && (
                          <div className="field">
                            <label
                              htmlFor={`return-size-${index}`}
                            >
                              Replacement size
                            </label>

                            <select
                              id={`return-size-${index}`}
                              value={row.size}
                              disabled={submitting}
                              onChange={(event) =>
                                change({
                                  size:
                                    event.target.value,
                                })
                              }
                            >
                              <option value="">
                                Choose a size
                              </option>

                              {product.sizes.map(
                                (size) => (
                                  <option
                                    key={size}
                                    value={size}
                                  >
                                    {size}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                        )}

                        {product?.colors?.length > 0 && (
                          <div className="field">
                            <label
                              htmlFor={`return-color-${index}`}
                            >
                              Replacement colour
                            </label>

                            <select
                              id={`return-color-${index}`}
                              value={row.color}
                              disabled={submitting}
                              onChange={(event) =>
                                change({
                                  color:
                                    event.target.value,
                                })
                              }
                            >
                              <option value="">
                                Choose a colour
                              </option>

                              {product.colors.map(
                                (color) => (
                                  <option
                                    key={color}
                                    value={color}
                                  >
                                    {color}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                        )}

                        {!product && (
                          <p className="field-error">
                            This product is unavailable
                            for exchange. Choose return
                            or contact support.
                          </p>
                        )}

                        <p className="muted">
                          Availability is checked when
                          you submit. A request does
                          not reserve replacement stock.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </section>
            );
          })}

          {/* Request reason */}

          <div className="field">
            <label htmlFor="return-reason">
              Reason
            </label>

            <textarea
              id="return-reason"
              aria-describedby={
                error
                  ? "return-form-error"
                  : undefined
              }
              required
              minLength="5"
              maxLength="1000"
              rows="4"
              value={reason}
              disabled={submitting}
              onChange={(event) =>
                setReason(event.target.value)
              }
            />
          </div>

          {error && (
            <p
              id="return-form-error"
              role="alert"
              className="field-error"
            >
              {error}
            </p>
          )}

          <button
            className="button"
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? "Submitting..."
              : "Submit request for review"}
          </button>
        </form>
      )}
    </div>
  );
}

// Reset form state when the order or customer changes.
export default function ReturnPage() {
  const { orderId } = useParams();
  const { user } = useAuth();

  return (
    <ReturnForm
      key={`${
        user?.id || user?._id || "guest"
      }:${orderId}`}
      orderId={orderId}
    />
  );
}