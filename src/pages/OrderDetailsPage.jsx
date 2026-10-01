import useOrderUpdates from "../hooks/useOrderUpdates.js";

import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useParams,
} from "react-router-dom";

import {
  useCatalog,
} from "../context/CatalogContext.jsx";

import {
  useAuth,
} from "../context/AuthContext.jsx";

import {
  useStore,
} from "../context/StoreContext.jsx";

import {
  returnEligibility,
} from "../utils/commerce.js";

import {
  getCartItemKey,
  normalizeCartItem,
  validateCartItem,
} from "../utils/cartUtils.js";

import {
  getOrder as getLocalOrder,
  orderStatus,
  orderTotal,
  updateOrder,
} from "../utils/customerData.js";

import {
  getOrderById,
  cancelOrder as cancelRemoteOrder,
} from "../services/orderApi.js";

import {
  money,
} from "../utils/productPricing.js";

import {
  ProductImage,
  productPath,
} from "../components/StorefrontShared.jsx";

import EmptyState from "../components/EmptyState.jsx";

import Modal from "../components/Modal.jsx";


// ======================================================
// ORDER DETAIL
// ======================================================

function OrderDetail({
  id,
}) {
  const revision =
    useOrderUpdates();


  const {
    products,
    refreshProducts,
  } = useCatalog();


  const {
    user,
    token,
  } = useAuth();


  const store =
    useStore();


  const {
    notify,
  } = store;


  const [
    order,
    setOrder,
  ] = useState(null);


  const [
    loading,
    setLoading,
  ] = useState(
    Boolean(user)
  );


  const [
    loadError,
    setLoadError,
  ] = useState("");


  const [
    action,
    setAction,
  ] = useState(null);


  const [
    reason,
    setReason,
  ] = useState("");


  const [
    error,
    setError,
  ] = useState("");


  const [
    actionLoading,
    setActionLoading,
  ] = useState(false);


  // ====================================================
  // LOAD ORDER
  // ====================================================

  useEffect(() => {
    let cancelled =
      false;


    async function loadOrder() {
      setLoadError("");


      // -----------------------------------------------
      // GUEST
      // -----------------------------------------------

      if (!user) {
        const local =
          getLocalOrder(
            id,
            null
          );


        if (!cancelled) {
          setOrder(
            local
          );

          setLoading(
            false
          );
        }


        return;
      }


      // -----------------------------------------------
      // SIGNED-IN WITHOUT TOKEN
      // -----------------------------------------------

      if (!token) {
        if (!cancelled) {
          setOrder(
            null
          );

          setLoading(
            false
          );

          setLoadError(
            "Your sign-in session has expired. Please sign in again."
          );
        }


        return;
      }


      // -----------------------------------------------
      // MONGODB ORDER
      // -----------------------------------------------

      setLoading(
        true
      );


      try {
        const remoteOrder =
          await getOrderById(
            token,
            id
          );


        if (cancelled) {
          return;
        }


        setOrder(
          remoteOrder ||
            null
        );

      } catch (
        fetchError
      ) {
        if (cancelled) {
          return;
        }


        console.error(
          "Load order details error:",
          fetchError
        );


        setOrder(
          null
        );


        setLoadError(
          fetchError.message ||
            "Your order could not be loaded."
        );

      } finally {
        if (!cancelled) {
          setLoading(
            false
          );
        }
      }
    }


    loadOrder();


    return () => {
      cancelled =
        true;
    };

  }, [
    id,
    user?.id,
    token,
    revision,
  ]);


  // ====================================================
  // LOADING
  // ====================================================

  if (
    loading &&
    user
  ) {
    return (
      <div className="page narrow">

        <div className="empty-state">

          <h3>
            Loading order…
          </h3>

          <p>
            Getting the latest order details from your GymDrobe account.
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
          label="View my orders"
        >
          {loadError}
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
        label="View my orders"
      >
        This order is not available for the current account or guest session.
      </EmptyState>
    );
  }


  // ====================================================
  // ORDER HELPERS
  // ====================================================

  const address =
    order.shippingAddress ||
    {};


  const canCancel =
    user
      ? [
          "confirmed",
          "processing",
        ].includes(
          order.status
        )
      : [
          "confirmed",
          "pending",
          "processing",
        ].includes(
          order.status
        );


  // Signed-in returns will be connected later.
  const canReturn =
    !user &&
    returnEligibility(
      order
    ).eligible;


  // ====================================================
  // FIND CURRENT PRODUCT
  // ====================================================

  function findProductForOrderItem(
    item
  ) {
    return products.find(
      (product) =>
        String(
          product.id
        ) ===
          String(
            item.id
          ) ||
        String(
          product.id
        ) ===
          String(
            item.productId
          ) ||
        (
          item.legacyId != null &&
          String(
            product.legacyId
          ) ===
            String(
              item.legacyId
            )
        ) ||
        (
          item.slug &&
          String(
            product.slug
          ) ===
            String(
              item.slug
            )
        )
    );
  }


  // ====================================================
  // PRODUCT LINK
  // ====================================================

  function orderItemProductPath(
    item
  ) {
    const product =
      findProductForOrderItem(
        item
      );


    return product
      ? productPath(
          product.id
        )
      : "/shop";
  }


  // ====================================================
  // BUY AGAIN
  // ====================================================

  function reorder() {
    let next = [
      ...store.cart,
    ];


    let added =
      0;


    const skipped =
      [];


    for (
      const item
      of order.items ||
      []
    ) {
      const product =
        findProductForOrderItem(
          item
        );


      if (!product) {
        skipped.push(
          item.name
        );

        continue;
      }


      const candidate = {
        ...product,

        id:
          product.id,

        selectedSize:
          item.selectedSize ??
          null,

        selectedColor:
          item.selectedColor ??
          null,
      };


      const key =
        getCartItemKey(
          candidate
        );


      const existing =
        next.find(
          (row) =>
            getCartItemKey(
              row
            ) ===
            key
        );


      const quantity =
        Number(
          item.quantity
        ) +
        (
          existing
            ?.quantity ||
          0
        );


      const check =
        validateCartItem(
          product,
          quantity,
          item.selectedSize,
          item.selectedColor
        );


      if (
        !check.valid
      ) {
        skipped.push(
          item.name
        );

        continue;
      }


      next = [
        ...next.filter(
          (row) =>
            getCartItemKey(
              row
            ) !==
            key
        ),

        normalizeCartItem(
          product,
          quantity,
          item.selectedSize,
          item.selectedColor
        ),
      ];


      added++;
    }


    store.setCart(
      next
    );


    notify(
      `${added} selections added at current prices.${
        skipped.length
          ? ` Unavailable: ${skipped.join(", ")}.`
          : ""
      }`,
      skipped.length
        ? "info"
        : "success"
    );
  }


  // ====================================================
  // CANCEL / RETURN
  // ====================================================

  async function confirm(
    event
  ) {
    event.preventDefault();


    if (
      actionLoading
    ) {
      return;
    }


    const cleanReason =
      reason.trim();


    if (
      cleanReason.length <
      5
    ) {
      setError(
        "Please tell us the reason in at least 5 characters."
      );

      return;
    }


    setError("");


    // ==================================================
    // SIGNED-IN MONGODB CANCELLATION
    // ==================================================

    if (
      user &&
      action ===
        "cancel"
    ) {
      if (!token) {
        setError(
          "Your sign-in session has expired. Please sign in again."
        );

        return;
      }


      setActionLoading(
        true
      );


      try {
        const updatedOrder =
          await cancelRemoteOrder(
            token,
            id,
            cleanReason
          );


        if (!updatedOrder) {
          throw new Error(
            "The cancelled order was not returned by the server."
          );
        }


        setOrder(
          updatedOrder
        );


        setAction(
          null
        );


        setReason(
          ""
        );


        notify(
          "Order cancelled successfully.",
          "success"
        );


        /*
          Cancellation restores inventory in MongoDB.
          Refresh the catalogue so the restored stock
          appears immediately on the storefront.
        */

        if (
          typeof refreshProducts ===
          "function"
        ) {
          try {
            await refreshProducts();
          } catch (
            refreshError
          ) {
            console.warn(
              "Order cancelled, but product refresh failed:",
              refreshError
            );
          }
        }

      } catch (
        cancelError
      ) {
        console.error(
          "Cancel order error:",
          cancelError
        );


        setError(
          cancelError.message ||
            "Unable to cancel this order."
        );

      } finally {
        setActionLoading(
          false
        );
      }


      return;
    }


    // ==================================================
    // GUEST LOCAL PREVIEW ACTION
    // ==================================================

    if (user) {
      setError(
        "This account action is not available yet."
      );

      return;
    }


    const current =
      getLocalOrder(
        id,
        null
      );


    if (
      !current ||
      (
        action ===
          "cancel" &&
        ![
          "confirmed",
          "pending",
          "processing",
        ].includes(
          current.status
        )
      ) ||
      (
        action ===
          "return" &&
        (
          current.status !==
            "delivered" ||
          (
            current
              .returnRequest
              ?.status &&
            current
              .returnRequest
              .status !==
              "not-requested"
          )
        )
      )
    ) {
      setError(
        "The order status changed. Please reload the order."
      );

      return;
    }


    const now =
      new Date()
        .toISOString();


    const next =
      updateOrder(
        id,
        null,
        (old) =>
          action ===
          "cancel"
            ? {
                ...old,

                status:
                  "cancelled",

                cancellation: {
                  status:
                    "cancelled",

                  reason:
                    cleanReason,

                  cancelledAt:
                    now,
                },

                tracking: {
                  ...old.tracking,

                  events: [
                    ...(
                      old
                        .tracking
                        ?.events ||
                      []
                    ),

                    {
                      status:
                        "cancelled",

                      description:
                        "Preview cancellation saved",

                      timestamp:
                        now,
                    },
                  ],
                },
              }
            : {
                ...old,

                returnRequest: {
                  status:
                    "requested",

                  reason:
                    cleanReason,

                  requestedAt:
                    now,
                },
              }
      );


    if (!next) {
      setError(
        "Unable to save this change. Please try again."
      );

      return;
    }


    setOrder(
      next
    );


    setAction(
      null
    );


    setReason(
      ""
    );


    notify(
      action ===
        "cancel"
        ? "Preview order cancelled."
        : "Preview return request saved."
    );
  }


  // ====================================================
  // PAGE
  // ====================================================

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

          <h1>
            Order details
          </h1>

          <p className="order-id">
            {order.id}
          </p>

        </div>


        <span
          className={`status-pill ${
            order.status ===
            "cancelled"
              ? "cancelled"
              : ""
          }`}
        >
          {orderStatus(
            order
          )}
        </span>

      </div>


      {/* =================================================
          SOURCE NOTICE
      ================================================= */}

      <div className="notice">
        {user
          ? "This order is loaded from your GymDrobe account."
          : "Guest preview order. This order is stored on this device."}
      </div>


      <div className="checkout-layout">

        <div>

          {/* =============================================
              PRODUCTS
          ============================================= */}

          {(order.items || []).map(
            (
              item,
              index
            ) => {
              const path =
                orderItemProductPath(
                  item
                );


              return (
                <article
                  className="bag-item"
                  key={`${order.id}-${item.id || item.productId || index}`}
                >

                  <Link
                    className="bag-photo"
                    to={path}
                  >
                    <ProductImage
                      product={
                        item
                      }
                    />
                  </Link>


                  <div className="bag-copy">

                    <h2>
                      {
                        item.name
                      }
                    </h2>


                    <p>
                      {[
                        item.selectedColor,

                        item.selectedSize &&
                          `Size ${item.selectedSize}`,
                      ]
                        .filter(
                          Boolean
                        )
                        .join(
                          " · "
                        )}
                    </p>


                    <p>
                      Quantity:{" "}
                      {
                        item.quantity
                      }
                    </p>


                    <strong>
                      {money(
                        Number(
                          item.price ||
                            0
                        ) *
                          Number(
                            item.quantity ||
                              0
                          )
                      )}
                    </strong>


                    <p>
                      <Link
                        className="text-link"
                        to={path}
                      >
                        View product
                      </Link>
                    </p>

                  </div>

                </article>
              );
            }
          )}


          {/* =============================================
              ADDRESS
          ============================================= */}

          <div className="panel">

            <h2>
              DELIVERY ADDRESS
            </h2>


            <strong>
              {address.fullName ||
                address.name}
            </strong>


            <p>
              {address.addressLine ||
                address.address}

              {address.landmark
                ? `, ${address.landmark}`
                : ""}

              <br />

              {address.city},{" "}
              {address.state} –{" "}
              {address.pincode}
            </p>


            <p>
              {address.phone}
            </p>


            {address.email && (
              <p>
                {address.email}
              </p>
            )}

          </div>


          {/* =============================================
              GIFT MESSAGE
          ============================================= */}

          {order.giftMessage && (
            <p className="panel">
              <strong>
                Gift message:
              </strong>{" "}
              {
                order.giftMessage
              }
            </p>
          )}


          {/* =============================================
              ORDER NOTE
          ============================================= */}

          {order.orderNote && (
            <p className="panel">
              <strong>
                Delivery instructions:
              </strong>{" "}
              {
                order.orderNote
              }
            </p>
          )}


          {/* =============================================
              ACTIONS
          ============================================= */}

          <div className="purchase-actions">

            <Link
              className="button secondary"
              to={`/orders/${encodeURIComponent(
                order.id
              )}/receipt`}
            >
              View receipt
            </Link>


            <button
              type="button"
              className="button secondary"
              onClick={
                reorder
              }
            >
              Buy again
            </button>


            <Link
              className="button secondary"
              to={`/help?order=${encodeURIComponent(
                order.id
              )}`}
            >
              Get order help
            </Link>


            <Link
              className="button secondary"
              to={`/orders/${encodeURIComponent(
                order.id
              )}/track`}
            >
              Track order
            </Link>


            {canCancel && (
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setAction(
                    "cancel"
                  );

                  setReason(
                    ""
                  );

                  setError(
                    ""
                  );
                }}
              >
                Cancel order
              </button>
            )}


            {canReturn && (
              <Link
                className="button secondary"
                to={`/orders/${encodeURIComponent(
                  order.id
                )}/return`}
              >
                Return / exchange items
              </Link>
            )}

          </div>


          {/* =============================================
              CANCELLATION INFO
          ============================================= */}

          {order.cancellation
            ?.reason && (
            <section className="panel">

              <h3>
                Order cancelled
              </h3>


              <p>
                <strong>
                  Reason:
                </strong>{" "}
                {
                  order
                    .cancellation
                    .reason
                }
              </p>


              {order.cancellation
                ?.cancelledAt && (
                <p className="muted">
                  Cancelled on{" "}
                  {new Date(
                    order
                      .cancellation
                      .cancelledAt
                  ).toLocaleString(
                    "en-IN"
                  )}
                </p>
              )}

            </section>
          )}


          {/* =============================================
              RETURN INFO
          ============================================= */}

          {order.returnRequest
            ?.status &&
            order.returnRequest
              .status !==
              "not-requested" && (
              <section className="panel">

                <h3>
                  {order
                    .returnRequest
                    .type ===
                  "exchange"
                    ? "Exchange"
                    : "Return"}{" "}
                  request ·{" "}
                  {
                    order
                      .returnRequest
                      .status
                  }
                </h3>


                {order.returnRequest
                  .reason && (
                  <p>
                    {
                      order
                        .returnRequest
                        .reason
                    }
                  </p>
                )}

              </section>
            )}

        </div>


        {/* ===============================================
            PAYMENT DETAILS
        =============================================== */}

        <aside className="panel order-totals">

          <h2>
            PAYMENT DETAILS
          </h2>


          <dl>

            <div>
              <dt>
                Items subtotal
              </dt>

              <dd>
                {money(
                  order.pricing
                    ?.subtotal
                )}
              </dd>
            </div>


            <div>
              <dt>
                Coupon savings
              </dt>

              <dd>
                −
                {money(
                  order.pricing
                    ?.couponDiscount
                )}
              </dd>
            </div>


            <div>
              <dt>
                Delivery
              </dt>

              <dd>
                {money(
                  order.pricing
                    ?.shipping
                )}
              </dd>
            </div>


            <div className="total">
              <dt>
                Total
              </dt>

              <dd>
                {money(
                  orderTotal(
                    order
                  )
                )}
              </dd>
            </div>

          </dl>


          <p>
            Method:{" "}

            {order.payment
              ?.method ===
              "cod" ||
            order.paymentMethod ===
              "cod"
              ? "Cash on delivery"
              : order.payment
                  ?.method ||
                "Not recorded"}
          </p>


          <p>
            Status:{" "}
            {order.payment
              ?.status ||
              "pending"}
          </p>


          <p>
            Delivery:{" "}
            {order.delivery
              ?.label ||
              (
                order.deliveryMethod ===
                "express"
                  ? "Express delivery"
                  : "Standard delivery"
              )}
          </p>

        </aside>

      </div>


      {/* =================================================
          CANCEL / GUEST RETURN MODAL
      ================================================= */}

      {action && (
        <Modal
          title={
            action ===
            "cancel"
              ? "Cancel this order?"
              : "Request a return"
          }
          onClose={() => {
            if (
              !actionLoading
            ) {
              setAction(
                null
              );

              setError(
                ""
              );
            }
          }}
        >

          <form
            onSubmit={
              confirm
            }
          >

            <p>
              {user &&
              action ===
                "cancel"
                ? "Cancelling this order will update your GymDrobe account and restore the reserved product stock."
                : "This action updates your guest preview order stored on this device."}
            </p>


            <div className="field">

              <label htmlFor="order-action-reason">
                Reason
              </label>


              <textarea
                id="order-action-reason"
                rows="4"
                required
                minLength="5"
                maxLength="500"
                value={
                  reason
                }
                disabled={
                  actionLoading
                }
                onChange={(
                  event
                ) =>
                  setReason(
                    event.target
                      .value
                  )
                }
              />

            </div>


            {error && (
              <p
                className="field-error"
                role="alert"
              >
                {error}
              </p>
            )}


            <button
              type="submit"
              className="button full"
              disabled={
                actionLoading
              }
            >
              {actionLoading
                ? "Cancelling..."
                : action ===
                    "cancel"
                  ? "Confirm cancellation"
                  : "Submit return request"}
            </button>

          </form>

        </Modal>
      )}

    </div>
  );
}


// ======================================================
// PAGE WRAPPER
// ======================================================

export default function OrderDetailsPage() {
  const {
    orderId,
  } = useParams();


  const {
    user,
  } = useAuth();


  return (
    <OrderDetail
      key={`${orderId}-${user?.id || "guest"}`}
      id={
        orderId
      }
    />
  );
}