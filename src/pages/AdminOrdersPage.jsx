import {
  useEffect,
  useMemo,
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
  getAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,
} from "../services/adminOrderApi.js";


// ======================================================
// STATUS SETTINGS
// ======================================================

const STATUS_FLOW = [
  "confirmed",
  "processing",
  "shipped",
  "out-for-delivery",
  "delivered",
];


const STATUS_OPTIONS = [
  {
    value: "all",
    label: "All",
  },

  {
    value: "payment-pending",
    label: "Payment pending",
  },

  {
    value: "confirmed",
    label: "Confirmed",
  },

  {
    value: "processing",
    label: "Processing",
  },

  {
    value: "shipped",
    label: "Shipped",
  },

  {
    value: "out-for-delivery",
    label: "Out for delivery",
  },

  {
    value: "delivered",
    label: "Delivered",
  },

  {
    value: "cancelled",
    label: "Cancelled",
  },
];


// ======================================================
// HELPERS
// ======================================================

function statusLabel(
  value
) {
  const match =
    STATUS_OPTIONS.find(
      (item) =>
        item.value ===
        value
    );


  if (
    match
  ) {
    return match.label;
  }


  return String(
    value ||
      "Unknown"
  )
    .replaceAll(
      "-",
      " "
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}


function money(
  value
) {
  const amount =
    Number(
      value ||
        0
    );


  return new Intl.NumberFormat(
    "en-IN",
    {
      style:
        "currency",

      currency:
        "INR",

      maximumFractionDigits:
        0,
    }
  ).format(
    amount
  );
}


function formatDate(
  value
) {
  if (
    !value
  ) {
    return "—";
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
    return "—";
  }


  return date.toLocaleString(
    "en-IN",
    {
      dateStyle:
        "medium",

      timeStyle:
        "short",
    }
  );
}


function dateInputValue(
  value
) {
  if (
    !value
  ) {
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


  const year =
    date.getFullYear();


  const month =
    String(
      date.getMonth() +
        1
    ).padStart(
      2,
      "0"
    );


  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${day}`;
}


function orderIdOf(
  order
) {
  return (
    order?.orderNumber ||
    order?.id ||
    ""
  );
}


function customerName(
  order
) {
  return (
    order?.customer?.name ||
    order?.user?.name ||
    "Customer"
  );
}


function customerEmail(
  order
) {
  return (
    order?.customer?.email ||
    order?.user?.email ||
    ""
  );
}


function createDraft(
  order
) {
  return {
    status:
      order?.status ||
      "confirmed",

    carrier:
      order?.tracking
        ?.carrier ||
      "",

    trackingNumber:
      order?.tracking
        ?.trackingNumber ||
      "",

    estimatedDelivery:
      dateInputValue(
        order?.tracking
          ?.estimatedDelivery
      ),

    codBalanceCollected:
      false,
  };
}


// ======================================================
// STATUS BADGE
// ======================================================

function StatusBadge({
  status,
}) {
  const styles = {
    "payment-pending": {
      background:
        "#fff7ed",

      color:
        "#9a3412",
    },

    confirmed: {
      background:
        "#eef2ff",

      color:
        "#3730a3",
    },

    processing: {
      background:
        "#fff7ed",

      color:
        "#9a3412",
    },

    shipped: {
      background:
        "#eff6ff",

      color:
        "#1d4ed8",
    },

    "out-for-delivery": {
      background:
        "#fefce8",

      color:
        "#854d0e",
    },

    delivered: {
      background:
        "#ecfdf5",

      color:
        "#047857",
    },

    cancelled: {
      background:
        "#fef2f2",

      color:
        "#b91c1c",
    },
  };


  const selectedStyle =
    styles[
      status
    ] || {
      background:
        "#f4f4f5",

      color:
        "#3f3f46",
    };


  return (
    <span
      style={{
        display:
          "inline-flex",

        alignItems:
          "center",

        padding:
          "6px 10px",

        borderRadius:
          "999px",

        fontSize:
          "12px",

        fontWeight:
          800,

        ...selectedStyle,
      }}
    >
      {statusLabel(
        status
      )}
    </span>
  );
}


// ======================================================
// ADMIN ORDER CARD
// ======================================================

function AdminOrderCard({
  order,
  token,
  notify,
  onUpdated,
}) {
  const id =
    orderIdOf(
      order
    );


  const [
    expanded,
    setExpanded,
  ] =
    useState(
      false
    );


  const [
    detailedOrder,
    setDetailedOrder,
  ] =
    useState(
      order
    );


  const [
    loadingDetails,
    setLoadingDetails,
  ] =
    useState(
      false
    );


  const [
    saving,
    setSaving,
  ] =
    useState(
      false
    );


  const [
    error,
    setError,
  ] =
    useState(
      ""
    );


  const [
    draft,
    setDraft,
  ] =
    useState(
      () =>
        createDraft(
          order
        )
    );


  useEffect(
    () => {
      setDetailedOrder(
        order
      );


      setDraft(
        createDraft(
          order
        )
      );
    },
    [
      order,
    ]
  );


  // ====================================================
  // DETAILS
  // ====================================================

  async function toggleDetails() {
    if (
      expanded
    ) {
      setExpanded(
        false
      );

      return;
    }


    setExpanded(
      true
    );


    setError(
      ""
    );


    if (
      !token ||
      !id
    ) {
      return;
    }


    setLoadingDetails(
      true
    );


    try {
      const fresh =
        await getAdminOrderById(
          token,
          id
        );


      setDetailedOrder(
        fresh
      );


      setDraft(
        createDraft(
          fresh
        )
      );

    } catch (
      loadError
    ) {
      console.error(
        "Load admin order error:",
        loadError
      );


      setError(
        loadError.message ||
          "Unable to load this order."
      );

    } finally {
      setLoadingDetails(
        false
      );
    }
  }


  // ====================================================
  // CURRENT ORDER
  // ====================================================

  const current =
    detailedOrder ||
    order;


  const cancelled =
    current?.status ===
    "cancelled";


  const delivered =
    current?.status ===
    "delivered";


  const paymentPending =
    current?.status ===
    "payment-pending";


  const currentIndex =
    STATUS_FLOW.indexOf(
      current?.status
    );


  // ====================================================
  // PAYMENT INFORMATION
  // ====================================================

  const isPartialCod =
    current?.payment
      ?.method ===
      "cod-partial" ||
    current?.paymentMethod ===
      "cod-partial";


  const isFullOnline =
    current?.payment
      ?.method ===
      "razorpay" ||
    current?.paymentMethod ===
      "razorpay";


  const advancePercentage =
    Number(
      current?.payment
        ?.advancePercentage ||
      0
    );


  const advanceAmount =
    Number(
      current?.payment
        ?.advanceAmount ||
      0
    );


  const amountPaid =
    Number(
      current?.payment
        ?.amountPaid ||
      0
    );


  const amountDue =
    Number(
      current?.payment
        ?.amountDue ||
      0
    );


  const totalAmount =
    Number(
      current?.payment
        ?.totalAmount ||
      current?.pricing
        ?.finalTotal ||
      0
    );


  const codBalancePending =
    isPartialCod &&
    current?.payment
      ?.balanceStatus ===
      "pending" &&
    amountDue >
      0;


  const deliveryNeedsCodConfirmation =
    draft.status ===
      "delivered" &&
    codBalancePending;


  // ====================================================
  // SAVE ORDER
  // ====================================================

  async function saveOrder(
    event
  ) {
    event.preventDefault();


    if (
      !token ||
      !id
    ) {
      return;
    }


    if (
      draft.status ===
        "delivered" &&
      codBalancePending &&
      !draft.codBalanceCollected
    ) {
      setError(
        `Confirm that ${money(
          amountDue
        )} was collected from the customer before marking this order delivered.`
      );

      return;
    }


    setSaving(
      true
    );


    setError(
      ""
    );


    try {
      const updated =
        await updateAdminOrderStatus(
          token,
          id,
          {
            status:
              draft.status,

            carrier:
              draft.carrier,

            trackingNumber:
              draft.trackingNumber,

            estimatedDelivery:
              draft.estimatedDelivery,

            codBalanceCollected:
              draft.status ===
                "delivered" &&
              codBalancePending
                ? Boolean(
                    draft.codBalanceCollected
                  )
                : false,
          }
        );


      setDetailedOrder(
        updated
      );


      setDraft(
        createDraft(
          updated
        )
      );


      onUpdated(
        updated
      );


      notify?.(
        isPartialCod &&
        draft.status ===
          "delivered" &&
        codBalancePending
          ? `Order ${id} delivered and COD balance recorded.`
          : `Order ${id} updated.`
      );

    } catch (
      saveError
    ) {
      console.error(
        "Update admin order error:",
        saveError
      );


      setError(
        saveError.message ||
          "Unable to update this order."
      );

    } finally {
      setSaving(
        false
      );
    }
  }


  // ====================================================
  // PAGE
  // ====================================================

  return (
    <article
      className="panel"
      style={{
        padding:
          "20px",

        display:
          "grid",

        gap:
          "18px",
      }}
    >
      {/* ===============================================
          ORDER HEADER
      =============================================== */}

      <div
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "flex-start",

          gap:
            "16px",

          flexWrap:
            "wrap",
        }}
      >
        <div>
          <div
            style={{
              display:
                "flex",

              alignItems:
                "center",

              gap:
                "10px",

              flexWrap:
                "wrap",

              marginBottom:
                "8px",
            }}
          >
            <strong>
              {id}
            </strong>


            <StatusBadge
              status={
                current?.status
              }
            />
          </div>


          <p
            className="muted"
            style={{
              margin:
                0,
            }}
          >
            {formatDate(
              current
                ?.createdAt
            )}
          </p>
        </div>


        <div
          style={{
            textAlign:
              "right",
          }}
        >
          <strong
            style={{
              fontSize:
                "18px",
            }}
          >
            {money(
              current
                ?.pricing
                ?.finalTotal
            )}
          </strong>


          <p
            className="muted"
            style={{
              margin:
                "4px 0 0",
            }}
          >
            {current
              ?.items
              ?.length ||
              0}{" "}
            item
            {(
              current
                ?.items
                ?.length ||
              0
            ) ===
            1
              ? ""
              : "s"}
          </p>
        </div>
      </div>


      {/* ===============================================
          SUMMARY
      =============================================== */}

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",

          gap:
            "14px",
        }}
      >
        {/* CUSTOMER */}

        <div>
          <span
            className="muted"
          >
            Customer
          </span>


          <div>
            <strong>
              {customerName(
                current
              )}
            </strong>
          </div>


          {customerEmail(
            current
          ) && (
            <div
              className="muted"
            >
              {customerEmail(
                current
              )}
            </div>
          )}
        </div>


        {/* PAYMENT */}

        <div>
          <span
            className="muted"
          >
            Payment
          </span>


          <div>
            <strong>
              {isPartialCod
                ? "CASH ON DELIVERY"
                : isFullOnline
                  ? "FULL ONLINE PAYMENT"
                  : String(
                      current
                        ?.payment
                        ?.method ||
                      current
                        ?.paymentMethod ||
                      "Unknown"
                    ).toUpperCase()}
            </strong>
          </div>


          <div
            className="muted"
          >
            {statusLabel(
              current
                ?.payment
                ?.status ||
              "pending"
            )}
          </div>


          {isPartialCod && (
            <div
              style={{
                display:
                  "grid",

                gap:
                  "3px",

                marginTop:
                  "8px",
              }}
            >
              <span>
                Advance{" "}
                {advancePercentage >
                0
                  ? `(${advancePercentage}%)`
                  : ""}
                :{" "}

                <strong>
                  {money(
                    advanceAmount
                  )}
                </strong>
              </span>


              <span>
                Paid:{" "}

                <strong>
                  {money(
                    amountPaid
                  )}
                </strong>
              </span>


              <span>
                Remaining COD:{" "}

                <strong>
                  {money(
                    amountDue
                  )}
                </strong>
              </span>


              <span
                className="muted"
              >
                Balance:{" "}
                {statusLabel(
                  current
                    ?.payment
                    ?.balanceStatus ||
                  "pending"
                )}
              </span>
            </div>
          )}


          {isFullOnline && (
            <div
              style={{
                marginTop:
                  "8px",
              }}
            >
              <span>
                Paid:{" "}

                <strong>
                  {money(
                    amountPaid
                  )}
                </strong>
              </span>
            </div>
          )}
        </div>


        {/* DELIVERY */}

        <div>
          <span
            className="muted"
          >
            Delivery
          </span>


          <div>
            <strong>
              {current
                ?.delivery
                ?.label ||
                "Standard delivery"}
            </strong>
          </div>


          <div
            className="muted"
          >
            {current
              ?.shippingAddress
              ?.city ||
              "—"}

            {" · "}

            {current
              ?.shippingAddress
              ?.pincode ||
              "—"}
          </div>
        </div>
      </div>


      {/* ===============================================
          ACTIONS
      =============================================== */}

      <div
        style={{
          display:
            "flex",

          gap:
            "10px",

          flexWrap:
            "wrap",
        }}
      >
        <button
          type="button"
          className="button secondary"
          onClick={
            toggleDetails
          }
        >
          {expanded
            ? "Hide details"
            : "Manage order"}
        </button>


        <Link
          className="button secondary"
          to={`/orders/${encodeURIComponent(
            id
          )}`}
        >
          Customer view
        </Link>
      </div>


      {/* ===============================================
          EXPANDED DETAILS
      =============================================== */}

      {expanded && (
        <div
          style={{
            display:
              "grid",

            gap:
              "22px",

            borderTop:
              "1px solid #e4e4e7",

            paddingTop:
              "20px",
          }}
        >
          {loadingDetails ? (
            <p
              className="muted"
            >
              Loading order…
            </p>

          ) : (
            <>
              {/* =======================================
                  ITEMS
              ======================================== */}

              <section>
                <h3>
                  Items
                </h3>


                <div
                  style={{
                    display:
                      "grid",

                    gap:
                      "12px",
                  }}
                >
                  {(
                    current
                      ?.items ||
                    []
                  ).map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        key={`${item.productId || item.id}-${index}`}
                        style={{
                          display:
                            "flex",

                          justifyContent:
                            "space-between",

                          gap:
                            "16px",

                          padding:
                            "12px 0",

                          borderBottom:
                            "1px solid #f1f1f1",
                        }}
                      >
                        <div>
                          <strong>
                            {item.name}
                          </strong>


                          <div
                            className="muted"
                          >
                            Qty:{" "}
                            {item.quantity}

                            {item.selectedSize
                              ? ` · Size: ${item.selectedSize}`
                              : ""}

                            {item.selectedColor
                              ? ` · Colour: ${item.selectedColor}`
                              : ""}
                          </div>
                        </div>


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
                      </div>
                    )
                  )}
                </div>
              </section>


              {/* =======================================
                  PRICE / PAYMENT DETAILS
              ======================================== */}

              <section>
                <h3>
                  Payment details
                </h3>


                <div
                  className="panel"
                  style={{
                    padding:
                      "16px",

                    display:
                      "grid",

                    gap:
                      "10px",

                    maxWidth:
                      "620px",
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",

                      justifyContent:
                        "space-between",

                      gap:
                        "16px",
                    }}
                  >
                    <span>
                      Order total
                    </span>

                    <strong>
                      {money(
                        totalAmount
                      )}
                    </strong>
                  </div>


                  {isPartialCod && (
                    <>
                      <div
                        style={{
                          display:
                            "flex",

                          justifyContent:
                            "space-between",

                          gap:
                            "16px",
                        }}
                      >
                        <span>
                          Advance paid online
                          {advancePercentage >
                          0
                            ? ` (${advancePercentage}%)`
                            : ""}
                        </span>

                        <strong>
                          {money(
                            advanceAmount
                          )}
                        </strong>
                      </div>


                      <div
                        style={{
                          display:
                            "flex",

                          justifyContent:
                            "space-between",

                          gap:
                            "16px",
                        }}
                      >
                        <span>
                          Remaining COD
                        </span>

                        <strong>
                          {money(
                            amountDue
                          )}
                        </strong>
                      </div>


                      <div
                        style={{
                          display:
                            "flex",

                          justifyContent:
                            "space-between",

                          gap:
                            "16px",
                        }}
                      >
                        <span>
                          COD balance status
                        </span>

                        <strong>
                          {statusLabel(
                            current
                              ?.payment
                              ?.balanceStatus ||
                            "pending"
                          )}
                        </strong>
                      </div>


                      {current
                        ?.payment
                        ?.advancePaidAt && (
                        <p
                          className="muted"
                          style={{
                            margin:
                              0,
                          }}
                        >
                          Advance paid:{" "}
                          {formatDate(
                            current
                              .payment
                              .advancePaidAt
                          )}
                        </p>
                      )}


                      {current
                        ?.payment
                        ?.balanceCollectedAt && (
                        <p
                          className="muted"
                          style={{
                            margin:
                              0,
                          }}
                        >
                          COD balance collected:{" "}
                          {formatDate(
                            current
                              .payment
                              .balanceCollectedAt
                          )}
                        </p>
                      )}
                    </>
                  )}


                  {isFullOnline && (
                    <>
                      <div
                        style={{
                          display:
                            "flex",

                          justifyContent:
                            "space-between",

                          gap:
                            "16px",
                        }}
                      >
                        <span>
                          Online amount paid
                        </span>

                        <strong>
                          {money(
                            amountPaid
                          )}
                        </strong>
                      </div>


                      <div
                        style={{
                          display:
                            "flex",

                          justifyContent:
                            "space-between",

                          gap:
                            "16px",
                        }}
                      >
                        <span>
                          Amount due
                        </span>

                        <strong>
                          {money(
                            amountDue
                          )}
                        </strong>
                      </div>
                    </>
                  )}


                  {current
                    ?.payment
                    ?.razorpayPaymentId && (
                    <p
                      className="muted"
                      style={{
                        margin:
                          0,
                      }}
                    >
                      Razorpay payment ID:{" "}
                      {current
                        .payment
                        .razorpayPaymentId}
                    </p>
                  )}
                </div>
              </section>


              {/* =======================================
                  SHIPPING ADDRESS
              ======================================== */}

              <section>
                <h3>
                  Shipping address
                </h3>


                <p>
                  <strong>
                    {current
                      ?.shippingAddress
                      ?.fullName ||
                      current
                        ?.shippingAddress
                        ?.name ||
                      customerName(
                        current
                      )}
                  </strong>

                  <br />

                  {current
                    ?.shippingAddress
                    ?.addressLine ||
                    ""}

                  <br />

                  {current
                    ?.shippingAddress
                    ?.landmark
                    ? `${current.shippingAddress.landmark}, `
                    : ""}

                  {current
                    ?.shippingAddress
                    ?.city ||
                    ""}

                  {", "}

                  {current
                    ?.shippingAddress
                    ?.state ||
                    ""}

                  {" - "}

                  {current
                    ?.shippingAddress
                    ?.pincode ||
                    ""}

                  <br />

                  {current
                    ?.shippingAddress
                    ?.phone ||
                    ""}
                </p>
              </section>


              {/* =======================================
                  FULFILMENT
              ======================================== */}

              <section>
                <h3>
                  Fulfilment
                </h3>


                {cancelled ? (
                  <p
                    className="notice"
                  >
                    This order was cancelled and cannot move through fulfilment.
                  </p>

                ) : paymentPending ? (
                  <p
                    className="notice"
                  >
                    Payment is still pending. Fulfilment will unlock only after GymDrobe verifies the required Razorpay payment.
                  </p>

                ) : (
                  <form
                    onSubmit={
                      saveOrder
                    }
                    style={{
                      display:
                        "grid",

                      gap:
                        "16px",

                      maxWidth:
                        "720px",
                    }}
                  >
                    {/* STATUS */}

                    <div
                      className="field"
                    >
                      <label
                        htmlFor={`status-${id}`}
                      >
                        Order status
                      </label>


                      <select
                        id={`status-${id}`}
                        value={
                          draft.status
                        }
                        disabled={
                          delivered
                        }
                        onChange={(
                          event
                        ) =>
                          setDraft(
                            (
                              currentDraft
                            ) => ({
                              ...currentDraft,

                              status:
                                event
                                  .target
                                  .value,

                              codBalanceCollected:
                                false,
                            })
                          )
                        }
                      >
                        {STATUS_FLOW.map(
                          (
                            flowStatus,
                            index
                          ) => (
                            <option
                              key={
                                flowStatus
                              }
                              value={
                                flowStatus
                              }
                              disabled={
                                currentIndex >=
                                  0 &&
                                (
                                  index <
                                    currentIndex ||
                                  index >
                                    currentIndex +
                                      1
                                )
                              }
                            >
                              {statusLabel(
                                flowStatus
                              )}
                            </option>
                          )
                        )}
                      </select>


                      {!delivered &&
                        currentIndex >=
                          0 &&
                        currentIndex <
                          STATUS_FLOW.length -
                            1 && (
                          <p
                            className="muted"
                          >
                            Next step:{" "}
                            <strong>
                              {statusLabel(
                                STATUS_FLOW[
                                  currentIndex +
                                    1
                                ]
                              )}
                            </strong>
                          </p>
                        )}
                    </div>


                    {/* TRACKING */}

                    <div
                      style={{
                        display:
                          "grid",

                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(200px, 1fr))",

                        gap:
                          "14px",
                      }}
                    >
                      <div
                        className="field"
                      >
                        <label
                          htmlFor={`carrier-${id}`}
                        >
                          Courier / carrier
                        </label>


                        <input
                          id={`carrier-${id}`}
                          type="text"
                          placeholder="Example: Delhivery"
                          value={
                            draft.carrier
                          }
                          onChange={(
                            event
                          ) =>
                            setDraft(
                              (
                                currentDraft
                              ) => ({
                                ...currentDraft,

                                carrier:
                                  event
                                    .target
                                    .value,
                              })
                            )
                          }
                        />
                      </div>


                      <div
                        className="field"
                      >
                        <label
                          htmlFor={`tracking-${id}`}
                        >
                          Tracking number
                        </label>


                        <input
                          id={`tracking-${id}`}
                          type="text"
                          placeholder="Tracking number"
                          value={
                            draft.trackingNumber
                          }
                          onChange={(
                            event
                          ) =>
                            setDraft(
                              (
                                currentDraft
                              ) => ({
                                ...currentDraft,

                                trackingNumber:
                                  event
                                    .target
                                    .value,
                              })
                            )
                          }
                        />
                      </div>


                      <div
                        className="field"
                      >
                        <label
                          htmlFor={`delivery-${id}`}
                        >
                          Estimated delivery
                        </label>


                        <input
                          id={`delivery-${id}`}
                          type="date"
                          value={
                            draft.estimatedDelivery
                          }
                          onChange={(
                            event
                          ) =>
                            setDraft(
                              (
                                currentDraft
                              ) => ({
                                ...currentDraft,

                                estimatedDelivery:
                                  event
                                    .target
                                    .value,
                              })
                            )
                          }
                        />
                      </div>
                    </div>


                    {/* =================================
                        COD COLLECTION CONFIRMATION
                    ================================== */}

                    {deliveryNeedsCodConfirmation && (
                      <div
                        className="notice"
                        style={{
                          display:
                            "grid",

                          gap:
                            "12px",
                        }}
                      >
                        <div>
                          <strong>
                            Remaining COD balance:{" "}
                            {money(
                              amountDue
                            )}
                          </strong>


                          <p
                            style={{
                              margin:
                                "6px 0 0",
                            }}
                          >
                            The customer already paid{" "}
                            {money(
                              amountPaid
                            )}{" "}
                            online.
                          </p>
                        </div>


                        <label
                          className="check"
                          style={{
                            alignItems:
                              "flex-start",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={
                              Boolean(
                                draft.codBalanceCollected
                              )
                            }
                            disabled={
                              saving
                            }
                            onChange={(
                              event
                            ) =>
                              setDraft(
                                (
                                  currentDraft
                                ) => ({
                                  ...currentDraft,

                                  codBalanceCollected:
                                    event
                                      .target
                                      .checked,
                                })
                              )
                            }
                          />


                          <span>
                            <strong>
                              I confirm {money(
                                amountDue
                              )} was collected from the customer.
                            </strong>

                            <br />

                            <small
                              className="muted"
                            >
                              Only confirm this after the delivery payment has actually been received.
                            </small>
                          </span>
                        </label>
                      </div>
                    )}


                    {/* DELIVERED */}

                    {delivered && (
                      <div
                        className="notice"
                      >
                        <strong>
                          Delivered
                        </strong>

                        <br />

                        Delivered on{" "}
                        {formatDate(
                          current
                            ?.delivery
                            ?.deliveredAt
                        )}


                        {isPartialCod &&
                          current
                            ?.payment
                            ?.balanceStatus ===
                            "collected" && (
                            <>
                              <br />

                              COD balance collected successfully.
                            </>
                          )}
                      </div>
                    )}


                    {/* ERROR */}

                    {error && (
                      <p
                        className="field-error"
                        role="alert"
                      >
                        {error}
                      </p>
                    )}


                    {/* SAVE BUTTON */}

                    <div>
                      <button
                        type="submit"
                        className="button"
                        disabled={
                          saving ||
                          (
                            deliveryNeedsCodConfirmation &&
                            !draft.codBalanceCollected
                          )
                        }
                      >
                        {saving
                          ? "Saving…"
                          : deliveryNeedsCodConfirmation
                            ? `Mark delivered · collect ${money(
                                amountDue
                              )}`
                            : delivered
                              ? "Update tracking"
                              : "Update order"}
                      </button>
                    </div>
                  </form>
                )}
              </section>


              {/* =======================================
                  TRACKING HISTORY
              ======================================== */}

              <section>
                <h3>
                  Tracking history
                </h3>


                {(
                  current
                    ?.tracking
                    ?.events ||
                  []
                ).length ? (
                  <div
                    style={{
                      display:
                        "grid",

                      gap:
                        "12px",
                    }}
                  >
                    {[
                      ...(
                        current
                          ?.tracking
                          ?.events ||
                        []
                      ),
                    ]
                      .reverse()
                      .map(
                        (
                          event,
                          index
                        ) => (
                          <div
                            key={`${event.status}-${event.timestamp}-${index}`}
                            style={{
                              borderLeft:
                                "3px solid #18181b",

                              paddingLeft:
                                "14px",
                            }}
                          >
                            <strong>
                              {statusLabel(
                                event.status
                              )}
                            </strong>


                            <p
                              style={{
                                margin:
                                  "4px 0",
                              }}
                            >
                              {event.description ||
                                "Order update"}
                            </p>


                            <span
                              className="muted"
                            >
                              {formatDate(
                                event.timestamp
                              )}
                            </span>
                          </div>
                        )
                      )}
                  </div>

                ) : (
                  <p
                    className="muted"
                  >
                    No tracking events yet.
                  </p>
                )}
              </section>


              {/* =======================================
                  RETURN / EXCHANGE
              ======================================== */}

              {current
                ?.returnRequest
                ?.status &&
                current
                  .returnRequest
                  .status !==
                  "not-requested" && (
                  <section>
                    <h3>
                      Return / exchange
                    </h3>


                    <p>
                      <strong>
                        {String(
                          current
                            .returnRequest
                            .type ||
                          ""
                        ).toUpperCase()}
                      </strong>

                      {" · "}

                      {statusLabel(
                        current
                          .returnRequest
                          .status
                      )}
                    </p>


                    <Link
                      className="text-link"
                      to="/admin/returns"
                    >
                      Open returns dashboard →
                    </Link>
                  </section>
                )}
            </>
          )}
        </div>
      )}
    </article>
  );
}


// ======================================================
// MAIN PAGE
// ======================================================

export default function AdminOrdersPage() {
  const {
    user,
    token,
  } =
    useAuth();


  const {
    notify,
  } =
    useStore();


  const [
    orders,
    setOrders,
  ] =
    useState(
      []
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  const [
    error,
    setError,
  ] =
    useState(
      ""
    );


  const [
    status,
    setStatus,
  ] =
    useState(
      "all"
    );


  const [
    searchInput,
    setSearchInput,
  ] =
    useState(
      ""
    );


  const [
    search,
    setSearch,
  ] =
    useState(
      ""
    );


  const [
    page,
    setPage,
  ] =
    useState(
      1
    );


  const [
    pages,
    setPages,
  ] =
    useState(
      1
    );


  const [
    total,
    setTotal,
  ] =
    useState(
      0
    );


  // ====================================================
  // LOAD ORDERS
  // ====================================================

  useEffect(
    () => {
      let cancelled =
        false;


      async function load() {
        if (
          !token ||
          user?.role !==
            "admin"
        ) {
          if (
            !cancelled
          ) {
            setOrders(
              []
            );


            setLoading(
              false
            );
          }


          return;
        }


        setLoading(
          true
        );


        setError(
          ""
        );


        try {
          const result =
            await getAdminOrders(
              token,
              {
                status,

                search,

                page,

                limit:
                  25,
              }
            );


          if (
            cancelled
          ) {
            return;
          }


          setOrders(
            Array.isArray(
              result.orders
            )
              ? result.orders
              : []
          );


          setTotal(
            Number(
              result.total ||
              0
            )
          );


          setPages(
            Math.max(
              1,

              Number(
                result.pages ||
                1
              )
            )
          );


          if (
            Number(
              result.page
            ) !==
            page
          ) {
            setPage(
              Number(
                result.page ||
                1
              )
            );
          }

        } catch (
          loadError
        ) {
          console.error(
            "Load admin orders error:",
            loadError
          );


          if (
            !cancelled
          ) {
            setOrders(
              []
            );


            setError(
              loadError.message ||
                "Unable to load orders."
            );
          }

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


      load();


      return () => {
        cancelled =
          true;
      };
    },
    [
      token,
      user?.role,
      status,
      search,
      page,
    ]
  );


  // ====================================================
  // DASHBOARD TOTALS FOR CURRENT RESULT PAGE
  // ====================================================

  const stats =
    useMemo(
      () => {
        const values = {
          "payment-pending":
            0,

          confirmed:
            0,

          processing:
            0,

          shipped:
            0,

          "out-for-delivery":
            0,

          delivered:
            0,

          cancelled:
            0,
        };


        for (
          const order
          of orders
        ) {
          if (
            Object.prototype
              .hasOwnProperty.call(
                values,
                order.status
              )
          ) {
            values[
              order.status
            ] +=
              1;
          }
        }


        return values;
      },
      [
        orders,
      ]
    );


  // ====================================================
  // SEARCH
  // ====================================================

  function submitSearch(
    event
  ) {
    event.preventDefault();


    setPage(
      1
    );


    setSearch(
      searchInput.trim()
    );
  }


  function clearSearch() {
    setSearchInput(
      ""
    );


    setSearch(
      ""
    );


    setPage(
      1
    );
  }


  function changeStatus(
    nextStatus
  ) {
    setStatus(
      nextStatus
    );


    setPage(
      1
    );
  }


  function replaceOrder(
    updated
  ) {
    const id =
      orderIdOf(
        updated
      );


    setOrders(
      (
        current
      ) =>
        current.map(
          (
            item
          ) =>
            orderIdOf(
              item
            ) ===
            id
              ? updated
              : item
        )
    );
  }


  // ====================================================
  // PAGE
  // ====================================================

  return (
    <div
      className="page"
      style={{
        display:
          "grid",

        gap:
          "24px",
      }}
    >
      {/* ===============================================
          HEADING
      =============================================== */}

      <div
        className="page-heading"
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "flex-start",

          gap:
            "16px",

          flexWrap:
            "wrap",
        }}
      >
        <div>
          <p
            className="muted"
            style={{
              marginBottom:
                "6px",
            }}
          >
            GymDrobe Admin
          </p>


          <h1>
            Order management
          </h1>


          <p
            className="muted"
          >
            Manage payment verification, COD balances, fulfilment, courier tracking and delivery updates from one place.
          </p>
        </div>


        <Link
          to="/admin/returns"
          className="button secondary"
        >
          Returns & exchanges
        </Link>
      </div>


      {/* ===============================================
          STATS
      =============================================== */}

      <section
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "repeat(auto-fit, minmax(130px, 1fr))",

          gap:
            "12px",
        }}
      >
        {[
          [
            "Total results",
            total,
          ],

          [
            "Payment pending",
            stats[
              "payment-pending"
            ],
          ],

          [
            "Confirmed",
            stats.confirmed,
          ],

          [
            "Processing",
            stats.processing,
          ],

          [
            "Shipped",
            stats.shipped,
          ],

          [
            "Out for delivery",
            stats[
              "out-for-delivery"
            ],
          ],

          [
            "Delivered",
            stats.delivered,
          ],
        ].map(
          ([
            label,
            value,
          ]) => (
            <div
              key={
                label
              }
              className="panel"
              style={{
                padding:
                  "16px",
              }}
            >
              <strong
                style={{
                  display:
                    "block",

                  fontSize:
                    "22px",
                }}
              >
                {value}
              </strong>


              <span
                className="muted"
              >
                {label}
              </span>
            </div>
          )
        )}
      </section>


      {/* ===============================================
          FILTERS
      =============================================== */}

      <section
        className="panel"
        style={{
          padding:
            "18px",

          display:
            "grid",

          gap:
            "16px",
        }}
      >
        <form
          onSubmit={
            submitSearch
          }
          style={{
            display:
              "flex",

            gap:
              "10px",

            flexWrap:
              "wrap",
          }}
        >
          <input
            type="search"
            aria-label="Search orders"
            placeholder="Search order, customer, email, phone, city or pincode"
            value={
              searchInput
            }
            onChange={(
              event
            ) =>
              setSearchInput(
                event
                  .target
                  .value
              )
            }
            style={{
              flex:
                "1 1 280px",

              minHeight:
                "44px",
            }}
          />


          <button
            type="submit"
            className="button"
          >
            Search
          </button>


          {search && (
            <button
              type="button"
              className="button secondary"
              onClick={
                clearSearch
              }
            >
              Clear
            </button>
          )}
        </form>


        <div
          style={{
            display:
              "flex",

            gap:
              "8px",

            flexWrap:
              "wrap",
          }}
        >
          {STATUS_OPTIONS.map(
            (
              item
            ) => (
              <button
                key={
                  item.value
                }
                type="button"
                className={
                  status ===
                  item.value
                    ? "button"
                    : "button secondary"
                }
                onClick={
                  () =>
                    changeStatus(
                      item.value
                    )
                }
              >
                {item.label}
              </button>
            )
          )}
        </div>
      </section>


      {/* ===============================================
          ERROR
      =============================================== */}

      {error && (
        <p
          className="field-error"
          role="alert"
        >
          {error}
        </p>
      )}


      {/* ===============================================
          ORDER RESULTS
      =============================================== */}

      {loading ? (
        <div
          className="panel"
          style={{
            padding:
              "24px",
          }}
        >
          <p
            className="muted"
          >
            Loading orders…
          </p>
        </div>

      ) : orders.length ===
        0 ? (
        <div
          className="panel"
          style={{
            padding:
              "28px",
          }}
        >
          <h2>
            No orders found
          </h2>


          <p
            className="muted"
          >
            Try another status filter or search.
          </p>
        </div>

      ) : (
        <section
          style={{
            display:
              "grid",

            gap:
              "16px",
          }}
        >
          {orders.map(
            (
              order
            ) => (
              <AdminOrderCard
                key={
                  orderIdOf(
                    order
                  )
                }
                order={
                  order
                }
                token={
                  token
                }
                notify={
                  notify
                }
                onUpdated={
                  replaceOrder
                }
              />
            )
          )}
        </section>
      )}


      {/* ===============================================
          PAGINATION
      =============================================== */}

      {pages >
        1 && (
        <div
          style={{
            display:
              "flex",

            justifyContent:
              "center",

            alignItems:
              "center",

            gap:
              "12px",

            marginTop:
              "8px",
          }}
        >
          <button
            type="button"
            className="button secondary"
            disabled={
              page <=
                1 ||
              loading
            }
            onClick={
              () =>
                setPage(
                  (
                    current
                  ) =>
                    Math.max(
                      1,

                      current -
                        1
                    )
                )
            }
          >
            Previous
          </button>


          <strong>
            Page {page} of{" "}
            {pages}
          </strong>


          <button
            type="button"
            className="button secondary"
            disabled={
              page >=
                pages ||
              loading
            }
            onClick={
              () =>
                setPage(
                  (
                    current
                  ) =>
                    Math.min(
                      pages,

                      current +
                        1
                    )
                )
            }
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}