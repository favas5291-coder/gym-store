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
  useAuth,
} from "../context/AuthContext.jsx";

import {
  getOrder as getLocalOrder,
  orderTotal,
} from "../utils/customerData.js";

import {
  getOrderById,
} from "../services/orderApi.js";

import {
  money,
} from "../utils/productPricing.js";

import {
  csvCell,
  downloadText,
} from "../utils/commerce.js";

import EmptyState from "../components/EmptyState.jsx";


// ======================================================
// RECEIPT PAGE
// ======================================================

export default function ReceiptPage() {
  const revision =
    useOrderUpdates();


  const {
    orderId,
  } = useParams();


  const {
    user,
    token,
  } = useAuth();


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
    error,
    setError,
  ] = useState("");


  // ====================================================
  // LOAD ORDER
  //
  // Signed-in:
  // MongoDB
  //
  // Guest:
  // localStorage
  // ====================================================

  useEffect(() => {
    let cancelled =
      false;


    async function loadOrder() {
      setError("");


      // -----------------------------------------------
      // GUEST
      // -----------------------------------------------

      if (!user) {
        const localOrder =
          getLocalOrder(
            orderId,
            null
          );


        if (!cancelled) {
          setOrder(
            localOrder
          );

          setLoading(
            false
          );
        }


        return;
      }


      // -----------------------------------------------
      // USER WITHOUT TOKEN
      // -----------------------------------------------

      if (!token) {
        if (!cancelled) {
          setOrder(
            null
          );

          setLoading(
            false
          );

          setError(
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
            orderId
          );


        if (cancelled) {
          return;
        }


        setOrder(
          remoteOrder ||
            null
        );

      } catch (
        loadError
      ) {
        if (cancelled) {
          return;
        }


        console.error(
          "Receipt load error:",
          loadError
        );


        setOrder(
          null
        );


        setError(
          loadError.message ||
            "The receipt could not be loaded."
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
    orderId,
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
      <div className="page narrow receipt-page">

        <div className="empty-state">

          <h3>
            Loading receipt…
          </h3>

          <p>
            Getting your GymDrobe order information.
          </p>

        </div>

      </div>
    );
  }


  // ====================================================
  // ERROR
  // ====================================================

  if (error) {
    return (
      <EmptyState
        title="Receipt could not be loaded"
        to="/orders"
        label="View orders"
      >
        {error}
      </EmptyState>
    );
  }


  // ====================================================
  // ORDER NOT FOUND
  // ====================================================

  if (!order) {
    return (
      <EmptyState
        title="Receipt not found"
        to="/orders"
        label="View orders"
      >
        This order is not available for your current account or guest session.
      </EmptyState>
    );
  }


  const address =
    order.shippingAddress ||
    {};


  // ====================================================
  // PAYMENT DETAILS
  // ====================================================

  const paymentMethod =
    order.payment?.method ||
    order.paymentMethod ||
    "cod";


  const paymentStatus =
    order.payment?.status ||
    "pending";


  // ====================================================
  // DOWNLOAD CSV
  // ====================================================

  function csv() {
    const rows = [
      [
        "Order",
        order.id,
      ],

      [
        "Date",
        order.createdAt,
      ],

      [
        "Status",
        order.status,
      ],

      [],

      [
        "Product",
        "Size",
        "Colour",
        "Quantity",
        "Unit INR",
        "Line INR",
      ],

      ...(
        order.items ||
        []
      ).map(
        (item) => [
          item.name,

          item.selectedSize ||
            "",

          item.selectedColor ||
            "",

          item.quantity,

          item.price,

          Number(
            item.quantity ||
              0
          ) *
            Number(
              item.price ||
                0
            ),
        ]
      ),

      [],

      [
        "Items subtotal INR",
        order.pricing
          ?.subtotal ??
          0,
      ],

      [
        "Coupon savings INR",
        order.pricing
          ?.couponDiscount ??
          0,
      ],

      [
        "Delivery INR",
        order.pricing
          ?.shipping ??
          0,
      ],

      [
        "Order total INR",
        orderTotal(
          order
        ),
      ],

      [
        "Payment",
        `${paymentMethod} / ${paymentStatus}`,
      ],
    ];


    downloadText(
      `${order.id}-receipt.csv`,

      rows
        .map(
          (row) =>
            row
              .map(
                csvCell
              )
              .join(",")
        )
        .join(
          "\r\n"
        ),

      "text/csv;charset=utf-8"
    );
  }


  // ====================================================
  // PAGE
  // ====================================================

  return (
    <div className="page narrow receipt-page">

      {/* =================================================
          ACTIONS
      ================================================= */}

      <div className="receipt-actions">

        <Link
          className="text-link"
          to={`/orders/${encodeURIComponent(
            order.id
          )}`}
        >
          ← Order details
        </Link>


        <div className="purchase-actions">

          <button
            className="button secondary"
            type="button"
            onClick={
              csv
            }
          >
            Download CSV
          </button>


          <button
            className="button"
            type="button"
            onClick={() =>
              window.print()
            }
          >
            Print / save PDF
          </button>

        </div>

      </div>


      {/* =================================================
          RECEIPT
      ================================================= */}

      <article className="receipt-sheet">

        <div className="page-heading">

          <div>

            <p className="eyebrow">
              GYMDROBE
            </p>

            <h1>
              Order receipt
            </h1>

          </div>


          <span
            className={`status-pill ${
              order.status ===
              "cancelled"
                ? "cancelled"
                : ""
            }`}
          >
            {String(
              order.status ||
                "confirmed"
            ).replaceAll(
              "-",
              " "
            )}
          </span>

        </div>


        {/* =================================================
            ORDER ID
        ================================================= */}

        <p className="order-id">
          {order.id}
        </p>


        <p>
          {new Date(
            order.createdAt
          ).toLocaleString(
            "en-IN"
          )}
        </p>


        {/* =================================================
            NOTICE
        ================================================= */}

        <p className="notice">
          {user
            ? "This receipt is generated from your GymDrobe account order. It is an order summary, not a tax invoice or proof of payment."
            : "This is a guest preview order summary stored on this device. It is not a tax invoice or proof of payment."}
        </p>


        {/* =================================================
            DELIVERY ADDRESS
        ================================================= */}

        <h2>
          DELIVER TO
        </h2>


        <p>
          {address.fullName ||
            address.name}

          <br />

          {address.addressLine ||
            address.address}

          {address.landmark
            ? `, ${address.landmark}`
            : ""}

          <br />

          {address.city},{" "}
          {address.state}{" "}
          {address.pincode}

          <br />

          {address.phone}

          {address.email && (
            <>
              <br />
              {address.email}
            </>
          )}
        </p>


        {/* =================================================
            ITEMS TABLE
        ================================================= */}

        <div className="comparison-scroll">

          <table className="data-table">

            <thead>

              <tr>

                <th scope="col">
                  Item
                </th>

                <th scope="col">
                  Qty
                </th>

                <th scope="col">
                  Unit price
                </th>

                <th scope="col">
                  Total
                </th>

              </tr>

            </thead>


            <tbody>

              {(order.items || []).map(
                (
                  item,
                  index
                ) => (
                  <tr
                    key={`${item.id || item.productId || item.slug || "item"}-${index}`}
                  >

                    <td>

                      {item.name}

                      <small>
                        {[
                          item.selectedColor,

                          item.selectedSize &&
                            `Size ${item.selectedSize}`,
                        ]
                          .filter(
                            Boolean
                          )
                          .join(
                            " / "
                          )}
                      </small>

                    </td>


                    <td>
                      {item.quantity}
                    </td>


                    <td>
                      {money(
                        item.price
                      )}
                    </td>


                    <td>
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
                    </td>

                  </tr>
                )
              )}

            </tbody>

          </table>

        </div>


        {/* =================================================
            TOTALS
        ================================================= */}

        <dl className="receipt-totals">

          <div>

            <dt>
              Subtotal
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


          <div>

            <dt>
              <strong>
                Total
              </strong>
            </dt>

            <dd>
              <strong>
                {money(
                  orderTotal(
                    order
                  )
                )}
              </strong>
            </dd>

          </div>

        </dl>


        {/* =================================================
            PAYMENT
        ================================================= */}

        <p>
          Payment:{" "}

          {paymentMethod ===
          "cod"
            ? "Cash on delivery"
            : paymentMethod}{" "}
          ·{" "}
          {paymentStatus}
        </p>


        {/* =================================================
            DELIVERY METHOD
        ================================================= */}

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


        {/* =================================================
            GIFT MESSAGE
        ================================================= */}

        {order.giftMessage && (
          <p>

            <strong>
              Gift message:
            </strong>{" "}

            {
              order.giftMessage
            }

          </p>
        )}


        {/* =================================================
            DELIVERY INSTRUCTIONS
        ================================================= */}

        {order.orderNote && (
          <p>

            <strong>
              Delivery instructions:
            </strong>{" "}

            {
              order.orderNote
            }

          </p>
        )}

      </article>

    </div>
  );
}