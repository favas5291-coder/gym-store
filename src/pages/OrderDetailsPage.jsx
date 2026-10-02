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
// DATE FORMATTER
// ======================================================

function formatDate(
  value
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleString(
    "en-IN"
  );
}


// ======================================================
// RETURN STATUS TEXT
// ======================================================

function returnStatusText(
  order,
  signedIn
) {
  const request =
    order.returnRequest ||
    {};

  const refund =
    order.refund ||
    {};

  const type =
    request.type;

  const status =
    request.status;


  if (!signedIn) {
    if (
      status ===
      "requested"
    ) {
      return type ===
        "exchange"
        ? "Your guest preview exchange request has been saved on this device."
        : "Your guest preview return request has been saved on this device.";
    }

    if (
      status ===
      "approved"
    ) {
      return "This guest preview request is marked as approved.";
    }

    if (
      status ===
      "rejected"
    ) {
      return "This guest preview request is marked as rejected.";
    }

    if (
      status ===
      "completed"
    ) {
      return "This guest preview request is marked as completed.";
    }

    return "";
  }


  // ====================================================
  // REQUESTED
  // ====================================================

  if (
    status ===
    "requested"
  ) {
    return type ===
      "exchange"
      ? "Your exchange request has been submitted and is waiting for GymDrobe review."
      : "Your return request has been submitted and is waiting for GymDrobe review.";
  }


  // ====================================================
  // APPROVED
  // ====================================================

  if (
    status ===
    "approved"
  ) {
    if (
      type ===
      "exchange"
    ) {
      return request.exchangeInventoryReservedAt
        ? "Your exchange is approved and the replacement stock has been reserved. The original returned item will be restored to inventory when the exchange is completed."
        : "Your exchange is approved. GymDrobe is preparing the replacement process.";
    }

    if (
      refund.status ===
      "pending" &&
      Number(
        refund.amount ||
        0
      ) >
        0
    ) {
      return `Your return is approved. The expected refund is ${money(
        refund.amount
      )}. The refund will move to processing after the returned item is received and the return is completed.`;
    }

    return "Your return is approved. The returned item will be checked before the return is completed.";
  }


  // ====================================================
  // REJECTED
  // ====================================================

  if (
    status ===
    "rejected"
  ) {
    return type ===
      "exchange"
      ? "Your exchange request was not approved."
      : "Your return request was not approved.";
  }


  // ====================================================
  // COMPLETED EXCHANGE
  // ====================================================

  if (
    status ===
      "completed" &&
    type ===
      "exchange"
  ) {
    return "Your exchange has been completed. The replacement stock was reserved during approval and the returned original item has been restored to inventory.";
  }


  // ====================================================
  // COMPLETED RETURN
  // ====================================================

  if (
    status ===
      "completed" &&
    type ===
      "return"
  ) {
    if (
      refund.status ===
      "refunded"
    ) {
      return `Your return is complete and a refund of ${money(
        refund.amount
      )} has been recorded.`;
    }

    if (
      refund.status ===
      "manual-required"
    ) {
      return `Your return is complete. A refund of ${money(
        refund.amount
      )} is awaiting or undergoing manual COD refund processing.`;
    }

    if (
      refund.status ===
      "pending"
    ) {
      return `Your return is complete and the refund of ${money(
        refund.amount
      )} is pending processing.`;
    }

    if (
      refund.status ===
      "not-applicable"
    ) {
      return "Your return has been completed. No refund is required for this request.";
    }

    return "Your return has been completed.";
  }


  return "";
}


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
  ] = useState(
    null
  );


  const [
    loading,
    setLoading,
  ] = useState(
    Boolean(
      user
    )
  );


  const [
    loadError,
    setLoadError,
  ] = useState(
    ""
  );


  const [
    action,
    setAction,
  ] = useState(
    null
  );


  const [
    reason,
    setReason,
  ] = useState(
    ""
  );


  const [
    error,
    setError,
  ] = useState(
    ""
  );


  const [
    actionLoading,
    setActionLoading,
  ] = useState(
    false
  );


  // ====================================================
  // LOAD ORDER
  // ====================================================

  useEffect(
    () => {
      let cancelled =
        false;


      async function loadOrder() {
        setLoadError(
          ""
        );


        // -----------------------------------------------
        // GUEST ORDER
        // -----------------------------------------------

        if (!user) {
          const local =
            getLocalOrder(
              id,
              null
            );


          if (
            !cancelled
          ) {
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
        // SIGNED-IN WITHOUT JWT
        // -----------------------------------------------

        if (!token) {
          if (
            !cancelled
          ) {
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


          if (
            cancelled
          ) {
            return;
          }


          setOrder(
            remoteOrder ||
              null
          );

        } catch (
          fetchError
        ) {
          if (
            cancelled
          ) {
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
          if (
            !cancelled
          ) {
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
    },

    [
      id,
      user?.id,
      token,
      revision,
    ]
  );


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

  if (
    loadError
  ) {
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
  // NOT FOUND
  // ====================================================

  if (
    !order
  ) {
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
  // HELPERS
  // ====================================================

  const address =
    order.shippingAddress ||
    {};


  const request =
    order.returnRequest ||
    {};


  const refund =
    order.refund ||
    {};


  const signedIn =
    Boolean(
      user
    );


  const isReturn =
    request.type ===
    "return";


  const isExchange =
    request.type ===
    "exchange";


  const hasRequest =
    request.status &&
    request.status !==
      "not-requested";


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


  const canReturn =
    returnEligibility(
      order
    ).eligible;


  // ====================================================
  // FIND PRODUCT
  // ====================================================

  function findProductForOrderItem(
    item
  ) {
    return products.find(
      (
        product
      ) =>
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
          item.legacyId !=
            null &&
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


      if (
        !product
      ) {
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
          (
            row
          ) =>
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
          (
            row
          ) =>
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
          ? ` Unavailable: ${skipped.join(
              ", "
            )}.`
          : ""
      }`,

      skipped.length
        ? "info"
        : "success"
    );
  }


  // ====================================================
  // CANCEL ORDER
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


    setError(
      ""
    );


    // ==================================================
    // SIGNED-IN MONGODB CANCELLATION
    // ==================================================

    if (
      user &&
      action ===
        "cancel"
    ) {
      if (
        !token
      ) {
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


        if (
          !updatedOrder
        ) {
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
    // SIGNED-IN UNKNOWN ACTION
    // ==================================================

    if (
      user
    ) {
      setError(
        "This account action is not available here."
      );

      return;
    }


    // ==================================================
    // GUEST LOCAL CANCELLATION
    // ==================================================

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
        (
          old
        ) => ({
          ...old,

          status:
            "cancelled",

          cancellation: {
            ...old.cancellation,

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
                old.tracking
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
        })
      );


    if (
      !next
    ) {
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
      "Preview order cancelled.",
      "success"
    );
  }


  // ====================================================
  // RETURN STATUS MESSAGE
  // ====================================================

  const requestMessage =
    hasRequest
      ? returnStatusText(
          order,
          signedIn
        )
      : "";


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

          {(
            order.items ||
            []
          ).map(
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
                      {item.name}
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
                      {item.quantity}
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

              {order.giftMessage}

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

              {order.orderNote}

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
              CANCELLATION
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

                {order
                  .cancellation
                  .reason}
              </p>


              {order.cancellation
                ?.cancelledAt && (
                <p className="muted">
                  Cancelled on{" "}

                  {formatDate(
                    order
                      .cancellation
                      .cancelledAt
                  )}
                </p>
              )}


              {order.cancellation
                ?.inventoryRestoredAt && (
                <p className="muted">
                  Reserved stock was restored on{" "}

                  {formatDate(
                    order
                      .cancellation
                      .inventoryRestoredAt
                  )}
                </p>
              )}

            </section>
          )}


          {/* =============================================
              RETURN / EXCHANGE
          ============================================= */}

          {hasRequest && (
            <section className="panel">

              <div className="page-heading">

                <div>

                  <h3>
                    {isExchange
                      ? "Exchange"
                      : "Return"}{" "}
                    request
                  </h3>


                  {request.id && (
                    <p className="order-id">
                      {request.id}
                    </p>
                  )}

                </div>


                <span className="status-pill">
                  {request.status}
                </span>

              </div>


              {requestMessage && (
                <div className="notice">
                  {requestMessage}
                </div>
              )}


              {request.reason && (
                <p>

                  <strong>
                    Reason:
                  </strong>{" "}

                  {request.reason}

                </p>
              )}


              {/* =========================================
                  REQUEST ITEMS
              ========================================= */}

              {Array.isArray(
                request.items
              ) &&
                request.items.length >
                  0 && (
                <div>

                  <h4>
                    Requested items
                  </h4>


                  {request.items.map(
                    (
                      row,
                      index
                    ) => {
                      const item =
                        order.items?.[
                          row.index
                        ];


                      if (!item) {
                        return null;
                      }


                      return (
                        <div
                          className="bag-item"
                          key={`${order.id}-return-${row.index}-${index}`}
                        >

                          <div className="bag-copy">

                            <strong>
                              {item.name}
                            </strong>


                            <p>
                              Quantity:{" "}
                              {row.quantity}
                            </p>


                            <p className="muted">
                              Original:{" "}

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
                                ) ||
                                "Default variant"}
                            </p>


                            {isExchange && (
                              <p>
                                <strong>
                                  Replacement:
                                </strong>{" "}

                                {[
                                  row.color,

                                  row.size &&
                                    `Size ${row.size}`,
                                ]
                                  .filter(
                                    Boolean
                                  )
                                  .join(
                                    " · "
                                  ) ||
                                  "Default variant"}
                              </p>
                            )}

                          </div>

                        </div>
                      );
                    }
                  )}

                </div>
              )}


              {/* =========================================
                  ADMIN RESPONSE
              ========================================= */}

              {request.response && (
                <div className="notice">

                  <strong>
                    GymDrobe response:
                  </strong>{" "}

                  {request.response}

                </div>
              )}


              {/* =========================================
                  DATES
              ========================================= */}

              {request.requestedAt && (
                <p className="muted">
                  Requested on{" "}

                  {formatDate(
                    request.requestedAt
                  )}
                </p>
              )}


              {request.approvedAt && (
                <p className="muted">
                  Approved on{" "}

                  {formatDate(
                    request.approvedAt
                  )}
                </p>
              )}


              {request.rejectedAt && (
                <p className="muted">
                  Rejected on{" "}

                  {formatDate(
                    request.rejectedAt
                  )}
                </p>
              )}


              {request.completedAt && (
                <p className="muted">
                  Completed on{" "}

                  {formatDate(
                    request.completedAt
                  )}
                </p>
              )}


              {/* =========================================
                  EXCHANGE STATUS
              ========================================= */}

              {signedIn &&
                isExchange && (
                <div className="panel">

                  <h4>
                    Exchange progress
                  </h4>


                  <p>
                    Replacement reserved:{" "}

                    <strong>
                      {request.exchangeInventoryReservedAt
                        ? "Yes"
                        : request.status ===
                            "approved" ||
                          request.status ===
                            "completed"
                          ? "Processing"
                          : "Not yet"}
                    </strong>
                  </p>


                  {request.exchangeInventoryReservedAt && (
                    <p className="muted">
                      Reserved on{" "}

                      {formatDate(
                        request.exchangeInventoryReservedAt
                      )}
                    </p>
                  )}


                  {request.status ===
                    "completed" && (
                    <>
                      <p>
                        Original item restored to inventory:{" "}

                        <strong>
                          {request.originalInventoryRestoredAt
                            ? "Yes"
                            : "Processing"}
                        </strong>
                      </p>


                      {request.originalInventoryRestoredAt && (
                        <p className="muted">
                          Restored on{" "}

                          {formatDate(
                            request.originalInventoryRestoredAt
                          )}
                        </p>
                      )}
                    </>
                  )}

                </div>
              )}


              {/* =========================================
                  RETURN REFUND
              ========================================= */}

              {signedIn &&
                isReturn &&
                refund.status &&
                refund.status !==
                  "not-requested" && (
                <div className="panel">

                  <h4>
                    Refund
                  </h4>


                  <p>
                    Amount:{" "}

                    <strong>
                      {money(
                        Number(
                          refund.amount ||
                            0
                        )
                      )}
                    </strong>
                  </p>


                  <p>
                    Status:{" "}

                    <strong>
                      {refund.status ===
                      "manual-required"
                        ? "Manual refund processing"
                        : refund.status ===
                            "refunded"
                          ? "Refunded"
                          : refund.status ===
                              "pending"
                            ? "Pending"
                            : refund.status ===
                                "not-applicable"
                              ? "Not applicable"
                              : refund.status}
                    </strong>
                  </p>


                  {refund.status ===
                    "pending" && (
                    <p className="muted">
                      The refund amount has been calculated. The returned item must be completed before manual COD refund processing.
                    </p>
                  )}


                  {refund.status ===
                    "manual-required" && (
                    <p className="muted">
                      GymDrobe has completed the return. The COD refund must now be processed manually and recorded by an administrator.
                    </p>
                  )}


                  {refund.status ===
                    "refunded" && (
                    <div className="notice">

                      <strong>
                        Refund completed
                      </strong>


                      {refund.reference && (
                        <p>
                          Reference:{" "}

                          <strong>
                            {refund.reference}
                          </strong>
                        </p>
                      )}


                      {refund.refundedAt && (
                        <p className="muted">
                          Recorded on{" "}

                          {formatDate(
                            refund.refundedAt
                          )}
                        </p>
                      )}

                    </div>
                  )}

                </div>
              )}


              {/* =========================================
                  REJECTED — TRY AGAIN
              ========================================= */}

              {request.status ===
                "rejected" &&
                canReturn && (
                <div className="purchase-actions">

                  <Link
                    className="button secondary"
                    to={`/orders/${encodeURIComponent(
                      order.id
                    )}/return`}
                  >
                    Submit a new request
                  </Link>

                </div>
              )}


              {!signedIn && (
                <p className="muted">
                  This is a guest preview request stored only on this device. It is not connected to the GymDrobe admin return system.
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
          CANCEL MODAL
      ================================================= */}

      {action ===
        "cancel" && (
        <Modal
          title="Cancel this order?"
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
              {user
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
                : "Confirm cancellation"}
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