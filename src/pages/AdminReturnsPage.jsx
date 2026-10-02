import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext.jsx";

import {
  useStore,
} from "../context/StoreContext.jsx";

import {
  getAdminReturnRequests,
  reviewReturnRequest,
  completeReturnRequest,
  recordReturnRefund,
} from "../services/adminOrderApi.js";

import {
  money,
} from "../utils/productPricing.js";


// ======================================================
// ADMIN RETURNS / EXCHANGES
// ======================================================

export default function AdminReturnsPage() {
  const {
    user,
    token,
  } = useAuth();


  const {
    notify,
  } = useStore();


  const [
    orders,
    setOrders,
  ] = useState([]);


  const [
    filter,
    setFilter,
  ] = useState(
    "requested"
  );


  const [
    loading,
    setLoading,
  ] = useState(
    true
  );


  const [
    error,
    setError,
  ] = useState(
    ""
  );


  const [
    workingId,
    setWorkingId,
  ] = useState(
    ""
  );


  const [
    responses,
    setResponses,
  ] = useState(
    {}
  );


  const [
    refundReferences,
    setRefundReferences,
  ] = useState(
    {}
  );


  // ====================================================
  // LOAD REQUESTS
  // ====================================================

  const loadRequests =
    useCallback(
      async () => {
        if (
          !token
        ) {
          setOrders(
            []
          );

          setLoading(
            false
          );

          return;
        }


        setLoading(
          true
        );

        setError(
          ""
        );


        try {
          const rows =
            await getAdminReturnRequests(
              token,

              filter ===
                "all"
                ? ""
                : filter
            );


          setOrders(
            rows
          );

        } catch (
          loadError
        ) {
          console.error(
            "Load admin return requests error:",
            loadError
          );


          setOrders(
            []
          );


          setError(
            loadError.message ||
              "Unable to load return requests."
          );

        } finally {
          setLoading(
            false
          );
        }
      },

      [
        token,
        filter,
      ]
    );


  useEffect(
    () => {
      loadRequests();
    },

    [
      loadRequests,
    ]
  );


  // ====================================================
  // ADMIN RESPONSE
  // ====================================================

  function getResponse(
    order
  ) {
    return (
      responses[
        order.id
      ] ??
      order.returnRequest
        ?.response ??
      ""
    );
  }


  function changeResponse(
    orderId,
    value
  ) {
    setResponses(
      (
        current
      ) => ({
        ...current,

        [orderId]:
          value,
      })
    );
  }


  // ====================================================
  // REFUND REFERENCE
  // ====================================================

  function getRefundReference(
    order
  ) {
    return (
      refundReferences[
        order.id
      ] ??
      order.refund
        ?.reference ??
      ""
    );
  }


  function changeRefundReference(
    orderId,
    value
  ) {
    setRefundReferences(
      (
        current
      ) => ({
        ...current,

        [orderId]:
          value,
      })
    );
  }


  // ====================================================
  // APPROVE / REJECT
  // ====================================================

  async function review(
    order,
    decision
  ) {
    if (
      workingId
    ) {
      return;
    }


    setWorkingId(
      order.id
    );


    setError(
      ""
    );


    try {
      await reviewReturnRequest(
        token,
        order.id,
        {
          decision,

          response:
            getResponse(
              order
            ).trim(),
        }
      );


      notify(
        decision ===
          "approve"
          ? "Request approved successfully."
          : "Request rejected successfully.",
        "success"
      );


      await loadRequests();

    } catch (
      reviewError
    ) {
      console.error(
        "Review return request error:",
        reviewError
      );


      setError(
        reviewError.message ||
          "Unable to review this request."
      );

    } finally {
      setWorkingId(
        ""
      );
    }
  }


  // ====================================================
  // COMPLETE RETURN / EXCHANGE
  // ====================================================

  async function complete(
    order
  ) {
    if (
      workingId
    ) {
      return;
    }


    setWorkingId(
      order.id
    );


    setError(
      ""
    );


    try {
      await completeReturnRequest(
        token,
        order.id,
        {
          response:
            getResponse(
              order
            ).trim(),
        }
      );


      notify(
        order.returnRequest
          ?.type ===
          "exchange"
          ? "Exchange completed successfully."
          : "Return completed successfully.",
        "success"
      );


      await loadRequests();

    } catch (
      completeError
    ) {
      console.error(
        "Complete return request error:",
        completeError
      );


      setError(
        completeError.message ||
          "Unable to complete this request."
      );

    } finally {
      setWorkingId(
        ""
      );
    }
  }


  // ====================================================
  // RECORD REFUND
  // ====================================================

  async function recordRefund(
    order
  ) {
    if (
      workingId
    ) {
      return;
    }


    const reference =
      getRefundReference(
        order
      ).trim();


    if (
      reference.length <
      3
    ) {
      setError(
        "Enter the refund transaction or reference number."
      );

      return;
    }


    setWorkingId(
      order.id
    );


    setError(
      ""
    );


    try {
      await recordReturnRefund(
        token,
        order.id,
        {
          reference,
        }
      );


      notify(
        "Refund recorded successfully.",
        "success"
      );


      setRefundReferences(
        (
          current
        ) => {
          const next = {
            ...current,
          };


          delete next[
            order.id
          ];


          return next;
        }
      );


      await loadRequests();

    } catch (
      refundError
    ) {
      console.error(
        "Record refund error:",
        refundError
      );


      setError(
        refundError.message ||
          "Unable to record this refund."
      );

    } finally {
      setWorkingId(
        ""
      );
    }
  }


  // ====================================================
  // ACCESS
  // ====================================================

  if (
    !user
  ) {
    return (
      <div className="page narrow">

        <div className="panel">

          <h1>
            Admin returns
          </h1>

          <p>
            Sign in with an admin account to continue.
          </p>

          <Link
            className="button"
            to="/login"
          >
            Sign in
          </Link>

        </div>

      </div>
    );
  }


  if (
    user.role !==
    "admin"
  ) {
    return (
      <div className="page narrow">

        <div className="panel">

          <h1>
            Admin access required
          </h1>

          <p>
            This page is available only to GymDrobe administrators.
          </p>

          <Link
            className="button"
            to="/"
          >
            Go home
          </Link>

        </div>

      </div>
    );
  }


  // ====================================================
  // PAGE
  // ====================================================

  return (
    <div className="page narrow">

      <div className="page-heading">

        <div>

          <h1>
            Returns & exchanges
          </h1>

          <p className="muted">
            Review, complete and refund customer requests.
          </p>

        </div>

      </div>


      {/* =================================================
          FILTERS
      ================================================= */}

      <div className="panel">

        <div className="purchase-actions">

          {[
            [
              "requested",
              "Requested",
            ],

            [
              "approved",
              "Approved",
            ],

            [
              "rejected",
              "Rejected",
            ],

            [
              "completed",
              "Completed",
            ],

            [
              "all",
              "All",
            ],
          ].map(
            ([
              value,
              label,
            ]) => (
              <button
                key={
                  value
                }
                type="button"
                className={
                  filter ===
                  value
                    ? "button"
                    : "button secondary"
                }
                disabled={
                  loading ||
                  Boolean(
                    workingId
                  )
                }
                onClick={() =>
                  setFilter(
                    value
                  )
                }
              >
                {label}
              </button>
            )
          )}

        </div>

      </div>


      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <p
          className="field-error"
          role="alert"
        >
          {error}
        </p>
      )}


      {/* =================================================
          LOADING
      ================================================= */}

      {loading ? (
        <div className="panel">

          <p>
            Loading requests…
          </p>

        </div>

      ) : orders.length ===
        0 ? (
        <div className="panel">

          <h2>
            No requests found
          </h2>

          <p className="muted">
            There are no return or exchange requests in this section.
          </p>

        </div>

      ) : (
        orders.map(
          (
            order
          ) => {
            const request =
              order.returnRequest ||
              {};


            const refund =
              order.refund ||
              {};


            const isWorking =
              workingId ===
              order.id;


            const isReturn =
              request.type ===
              "return";


            const isExchange =
              request.type ===
              "exchange";


            const needsRefund =
              isReturn &&
              request.status ===
                "completed" &&
              refund.status ===
                "manual-required" &&
              Number(
                refund.amount ||
                0
              ) >
                0;


            const isRefunded =
              isReturn &&
              refund.status ===
                "refunded";


            return (
              <section
                className="panel"
                key={
                  order.id
                }
              >

                {/* =====================================
                    HEADER
                ===================================== */}

                <div className="page-heading">

                  <div>

                    <h2>
                      {isExchange
                        ? "Exchange request"
                        : "Return request"}
                    </h2>


                    <p className="order-id">
                      {request.id ||
                        "No request ID"}
                    </p>


                    <p className="muted">
                      Order:{" "}

                      <Link
                        className="text-link"
                        to={`/orders/${encodeURIComponent(
                          order.id
                        )}`}
                      >
                        {
                          order.id
                        }
                      </Link>
                    </p>

                  </div>


                  <span className="status-pill">
                    {request.status ||
                      "unknown"}
                  </span>

                </div>


                {/* =====================================
                    CUSTOMER
                ===================================== */}

                <div className="panel">

                  <h3>
                    Customer
                  </h3>


                  <p>
                    <strong>
                      {order.customer
                        ?.name ||
                        order.user
                          ?.name ||
                        order.shippingAddress
                          ?.fullName ||
                        "Customer"}
                    </strong>
                  </p>


                  {(order.customer
                    ?.email ||
                    order.user
                      ?.email) && (
                    <p>
                      {order.customer
                        ?.email ||
                        order.user
                          ?.email}
                    </p>
                  )}


                  {order.customer
                    ?.phone && (
                    <p>
                      {
                        order.customer
                          .phone
                      }
                    </p>
                  )}

                </div>


                {/* =====================================
                    REQUEST DETAILS
                ===================================== */}

                <div className="panel">

                  <h3>
                    Request details
                  </h3>


                  <p>
                    <strong>
                      Type:
                    </strong>{" "}

                    {isExchange
                      ? "Exchange"
                      : "Return"}
                  </p>


                  <p>
                    <strong>
                      Reason:
                    </strong>{" "}

                    {request.reason ||
                      "No reason provided."}
                  </p>


                  {request.requestedAt && (
                    <p className="muted">

                      Requested:{" "}

                      {new Date(
                        request.requestedAt
                      ).toLocaleString(
                        "en-IN"
                      )}

                    </p>
                  )}


                  {request.approvedAt && (
                    <p className="muted">

                      Approved:{" "}

                      {new Date(
                        request.approvedAt
                      ).toLocaleString(
                        "en-IN"
                      )}

                    </p>
                  )}


                  {request.rejectedAt && (
                    <p className="muted">

                      Rejected:{" "}

                      {new Date(
                        request.rejectedAt
                      ).toLocaleString(
                        "en-IN"
                      )}

                    </p>
                  )}


                  {request.completedAt && (
                    <p className="muted">

                      Completed:{" "}

                      {new Date(
                        request.completedAt
                      ).toLocaleString(
                        "en-IN"
                      )}

                    </p>
                  )}

                </div>


                {/* =====================================
                    ITEMS
                ===================================== */}

                <div className="panel">

                  <h3>
                    Items
                  </h3>


                  {(
                    request.items ||
                    []
                  ).map(
                    (
                      row,
                      requestIndex
                    ) => {
                      const item =
                        order.items?.[
                          row.index
                        ];


                      if (
                        !item
                      ) {
                        return (
                          <p
                            key={
                              requestIndex
                            }
                            className="field-error"
                          >
                            Original order item could not be found.
                          </p>
                        );
                      }


                      return (
                        <div
                          key={`${order.id}-${row.index}-${requestIndex}`}
                          className="bag-item"
                        >

                          <div className="bag-copy">

                            <strong>
                              {
                                item.name
                              }
                            </strong>


                            <p>
                              Quantity:{" "}
                              {
                                row.quantity
                              }
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


                            {isReturn && (
                              <p>

                                Item value:{" "}

                                <strong>
                                  {money(
                                    Number(
                                      item.price ||
                                        0
                                    ) *
                                      Number(
                                        row.quantity ||
                                          0
                                      )
                                  )}
                                </strong>

                              </p>
                            )}

                          </div>

                        </div>
                      );
                    }
                  )}

                </div>


                {/* =====================================
                    INVENTORY PROCESSING
                ===================================== */}

                {isExchange && (
                  <div className="panel">

                    <h3>
                      Exchange inventory
                    </h3>


                    <p>

                      Replacement reserved:{" "}

                      <strong>
                        {request.exchangeInventoryReservedAt
                          ? "Yes"
                          : "No"}
                      </strong>

                    </p>


                    {request.exchangeInventoryReservedAt && (
                      <p className="muted">

                        Reserved:{" "}

                        {new Date(
                          request.exchangeInventoryReservedAt
                        ).toLocaleString(
                          "en-IN"
                        )}

                      </p>
                    )}


                    <p>

                      Original item restored:{" "}

                      <strong>
                        {request.originalInventoryRestoredAt
                          ? "Yes"
                          : "No"}
                      </strong>

                    </p>

                  </div>
                )}


                {isReturn &&
                  request.status ===
                    "completed" && (
                    <div className="panel">

                      <h3>
                        Returned inventory
                      </h3>


                      <p>

                        Original stock restored:{" "}

                        <strong>
                          {request.originalInventoryRestoredAt
                            ? "Yes"
                            : "No"}
                        </strong>

                      </p>


                      {request.originalInventoryRestoredAt && (
                        <p className="muted">

                          Restored:{" "}

                          {new Date(
                            request.originalInventoryRestoredAt
                          ).toLocaleString(
                            "en-IN"
                          )}

                        </p>
                      )}

                    </div>
                  )}


                {/* =====================================
                    REFUND
                ===================================== */}

                {isReturn && (
                  <div className="panel">

                    <h3>
                      Refund
                    </h3>


                    <p>

                      Status:{" "}

                      <strong>
                        {refund.status ||
                          "not-requested"}
                      </strong>

                    </p>


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


                    {refund.requestedAt && (
                      <p className="muted">

                        Refund created:{" "}

                        {new Date(
                          refund.requestedAt
                        ).toLocaleString(
                          "en-IN"
                        )}

                      </p>
                    )}


                    {/* =================================
                        MANUAL REFUND FORM
                    ================================= */}

                    {needsRefund && (
                      <div>

                        <p className="notice">
                          The returned item has been processed. Complete the real COD refund outside GymDrobe, then enter its transaction or reference number here.
                        </p>


                        <div className="field">

                          <label
                            htmlFor={`refund-reference-${order.id}`}
                          >
                            Refund reference
                          </label>


                          <input
                            id={`refund-reference-${order.id}`}
                            type="text"
                            maxLength="200"
                            autoComplete="off"
                            disabled={
                              isWorking
                            }
                            placeholder="Example: UTR123456789"
                            value={
                              getRefundReference(
                                order
                              )
                            }
                            onChange={(
                              event
                            ) =>
                              changeRefundReference(
                                order.id,
                                event.target
                                  .value
                              )
                            }
                          />

                        </div>


                        <button
                          type="button"
                          className="button"
                          disabled={
                            isWorking
                          }
                          onClick={() =>
                            recordRefund(
                              order
                            )
                          }
                        >
                          {isWorking
                            ? "Recording refund..."
                            : "Record refund"}
                        </button>

                      </div>
                    )}


                    {/* =================================
                        REFUND COMPLETED
                    ================================= */}

                    {isRefunded && (
                      <div className="notice">

                        <p>
                          <strong>
                            Refund completed
                          </strong>
                        </p>


                        {refund.reference && (
                          <p>
                            Reference:{" "}
                            <strong>
                              {
                                refund.reference
                              }
                            </strong>
                          </p>
                        )}


                        {refund.refundedAt && (
                          <p className="muted">

                            Recorded:{" "}

                            {new Date(
                              refund.refundedAt
                            ).toLocaleString(
                              "en-IN"
                            )}

                          </p>
                        )}

                      </div>
                    )}

                  </div>
                )}


                {/* =====================================
                    ADMIN RESPONSE
                ===================================== */}

                {[
                  "requested",
                  "approved",
                ].includes(
                  request.status
                ) && (
                  <div className="field">

                    <label
                      htmlFor={`admin-return-response-${order.id}`}
                    >
                      Admin response / note
                    </label>


                    <textarea
                      id={`admin-return-response-${order.id}`}
                      rows="3"
                      maxLength="1000"
                      disabled={
                        isWorking
                      }
                      placeholder={
                        request.status ===
                        "requested"
                          ? "Optional message for the customer"
                          : "Optional completion note"
                      }
                      value={
                        getResponse(
                          order
                        )
                      }
                      onChange={(
                        event
                      ) =>
                        changeResponse(
                          order.id,
                          event.target
                            .value
                        )
                      }
                    />

                  </div>
                )}


                {/* =====================================
                    REQUESTED ACTIONS
                ===================================== */}

                {request.status ===
                  "requested" && (
                  <div className="purchase-actions">

                    <button
                      type="button"
                      className="button"
                      disabled={
                        isWorking
                      }
                      onClick={() =>
                        review(
                          order,
                          "approve"
                        )
                      }
                    >
                      {isWorking
                        ? "Processing..."
                        : "Approve"}
                    </button>


                    <button
                      type="button"
                      className="button secondary"
                      disabled={
                        isWorking
                      }
                      onClick={() =>
                        review(
                          order,
                          "reject"
                        )
                      }
                    >
                      {isWorking
                        ? "Processing..."
                        : "Reject"}
                    </button>

                  </div>
                )}


                {/* =====================================
                    APPROVED ACTION
                ===================================== */}

                {request.status ===
                  "approved" && (
                  <div>

                    <p className="notice">

                      {isExchange
                        ? "The replacement stock is reserved. Complete the exchange only after receiving the customer's original item."
                        : "Complete the return only after the customer's returned item has been received and accepted."}

                    </p>


                    <button
                      type="button"
                      className="button"
                      disabled={
                        isWorking
                      }
                      onClick={() =>
                        complete(
                          order
                        )
                      }
                    >
                      {isWorking
                        ? "Completing..."
                        : isExchange
                          ? "Complete exchange"
                          : "Complete return"}
                    </button>

                  </div>
                )}


                {/* =====================================
                    ADMIN RESPONSE DISPLAY
                ===================================== */}

                {[
                  "rejected",
                  "completed",
                ].includes(
                  request.status
                ) &&
                  request.response && (
                  <div className="notice">

                    <strong>
                      Admin response:
                    </strong>{" "}

                    {
                      request.response
                    }

                  </div>
                )}

              </section>
            );
          }
        )
      )}

    </div>
  );
}