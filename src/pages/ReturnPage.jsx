import useOrderUpdates from "../hooks/useOrderUpdates.js";

import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

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
// RETURN / EXCHANGE PAGE
// ======================================================

export default function ReturnPage() {
  const revision =
    useOrderUpdates();


  const {
    user,
    token,
  } = useAuth();


  const {
    orderId,
  } = useParams();


  const {
    products,
  } = useCatalog();


  const {
    notify,
  } = useStore();


  const navigate =
    useNavigate();


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
    type,
    setType,
  ] = useState(
    "return"
  );


  const [
    chosen,
    setChosen,
  ] = useState({});


  const [
    reason,
    setReason,
  ] = useState("");


  const [
    error,
    setError,
  ] = useState("");


  const [
    submitting,
    setSubmitting,
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
      // GUEST ORDER
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
      // SIGNED-IN USER
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
        fetchError
      ) {
        if (cancelled) {
          return;
        }


        console.error(
          "Load return order error:",
          fetchError
        );


        setOrder(
          null
        );


        setLoadError(
          fetchError.message ||
            "Unable to load this order."
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
  // FIND CURRENT PRODUCT
  // ====================================================

  function findProduct(
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
  // SUBMIT RETURN / EXCHANGE
  // ====================================================

  async function submit(
    event
  ) {
    event.preventDefault();


    if (
      submitting
    ) {
      return;
    }


    setError("");


    // -----------------------------------------------
    // MAKE REQUESTED ITEM LIST
    // -----------------------------------------------

    const items =
      Object.entries(
        chosen
      )
        .filter(
          (
            [, row]
          ) =>
            row.selected
        )
        .map(
          (
            [
              index,
              row,
            ]
          ) => ({
            index:
              Number(
                index
              ),

            quantity:
              Number(
                row.quantity
              ),

            size:
              row.size ||
              null,

            color:
              row.color ||
              null,
          })
        );


    const cleanReason =
      reason.trim();


    // ==================================================
    // SIGNED-IN USER
    // ==================================================

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
        returnEligibility(
          order
        );


      if (
        !eligibility.eligible
      ) {
        setError(
          eligibility.message
        );

        return;
      }


      const invalid =
        validateReturnItems(
          order,
          items,
          products,
          type
        );


      if (
        invalid ||
        cleanReason.length <
          5
      ) {
        setError(
          invalid ||
            "Please describe the reason in at least 5 characters."
        );

        return;
      }


      setSubmitting(
        true
      );


      try {
        const updatedOrder =
          await requestRemoteReturn(
            token,
            orderId,
            {
              type,

              items,

              reason:
                cleanReason,
            }
          );


        if (
          !updatedOrder
        ) {
          throw new Error(
            "The server did not return the updated order."
          );
        }


        setOrder(
          updatedOrder
        );


        notify(
          type ===
            "exchange"
            ? "Your exchange request was submitted successfully."
            : "Your return request was submitted successfully.",
          "success"
        );


        navigate(
          `/orders/${encodeURIComponent(
            orderId
          )}`
        );

      } catch (
        submitError
      ) {
        console.error(
          "Submit return request error:",
          submitError
        );


        setError(
          submitError.message ||
            "Unable to submit your request."
        );

      } finally {
        setSubmitting(
          false
        );
      }


      return;
    }


    // ==================================================
    // GUEST LOCAL ORDER
    // ==================================================

    const current =
      getLocalOrder(
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
      returnEligibility(
        current
      );


    if (
      !eligibility.eligible
    ) {
      setError(
        eligibility.message
      );

      return;
    }


    const invalid =
      validateReturnItems(
        current,
        items,
        products,
        type
      );


    if (
      invalid ||
      cleanReason.length <
        5
    ) {
      setError(
        invalid ||
          "Please describe the reason in at least 5 characters."
      );

      return;
    }


    const next =
      updateOrder(
        orderId,
        null,
        (old) => ({
          ...old,

          returnRequest: {
            id:
              makeId(
                "RET"
              ),

            type,

            status:
              "requested",

            items,

            reason:
              cleanReason,

            requestedAt:
              new Date()
                .toISOString(),
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
      "Your preview request was saved for review."
    );


    navigate(
      `/orders/${encodeURIComponent(
        orderId
      )}`
    );
  }


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
            Checking your order and return eligibility.
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
        label="View orders"
      />
    );
  }


  // ====================================================
  // ELIGIBILITY
  // ====================================================

  const eligibility =
    returnEligibility(
      order
    );


  // ====================================================
  // PAGE
  // ====================================================

  return (
    <div className="page narrow">

      <Link
        className="text-link"
        to={`/orders/${encodeURIComponent(
          orderId
        )}`}
      >
        ← Order details
      </Link>


      <div className="page-heading">

        <h1>
          Return or exchange
        </h1>

      </div>


      {/* =================================================
          NOT ELIGIBLE
      ================================================= */}

      {!eligibility.eligible ? (
        <div className="panel">

          <p>
            {
              eligibility.message
            }
          </p>


          <Link
            className="button"
            to={`/help?order=${encodeURIComponent(
              orderId
            )}`}
          >
            Contact support
          </Link>

        </div>

      ) : (

        <form
          onSubmit={
            submit
          }
        >

          {/* =============================================
              NOTICE
          ============================================= */}

          <p className="notice">

            Submit by{" "}

            {new Date(
              eligibility.deadline
            ).toLocaleString(
              "en-IN"
            )}
            .

            {" "}

            {user
              ? "Your request will be saved to your GymDrobe account for review. Collection, exchange dispatch and refunds are not automatic yet."
              : "Requests are recorded for review in this guest preview. Collection, exchange dispatch and refunds are not automatic."}

          </p>


          {/* =============================================
              TYPE
          ============================================= */}

          <fieldset className="option-field">

            <legend>
              WHAT WOULD YOU LIKE TO DO?
            </legend>


            <label className="check">

              <input
                type="radio"
                name="request-type"
                checked={
                  type ===
                  "return"
                }
                disabled={
                  submitting
                }
                onChange={() => {
                  setType(
                    "return"
                  );

                  setError(
                    ""
                  );
                }}
              />

              Return selected items

            </label>


            <label className="check">

              <input
                type="radio"
                name="request-type"
                checked={
                  type ===
                  "exchange"
                }
                disabled={
                  submitting
                }
                onChange={() => {
                  setType(
                    "exchange"
                  );

                  setError(
                    ""
                  );
                }}
              />

              Exchange size or colour

            </label>

          </fieldset>


          {/* =============================================
              ITEMS
          ============================================= */}

          {order.items.map(
            (
              item,
              index
            ) => {
              const product =
                findProduct(
                  item
                );


              const row =
                chosen[
                  index
                ] || {
                  selected:
                    false,

                  quantity:
                    1,

                  size:
                    item.selectedSize ||
                    "",

                  color:
                    item.selectedColor ||
                    "",
                };


              const change =
                (
                  update
                ) =>
                  setChosen(
                    (
                      old
                    ) => ({
                      ...old,

                      [index]: {
                        ...row,
                        ...update,
                      },
                    })
                  );


              return (
                <section
                  className="panel"
                  key={`${order.id}-${index}`}
                >

                  <label className="check">

                    <input
                      type="checkbox"
                      checked={
                        row.selected
                      }
                      disabled={
                        submitting
                      }
                      onChange={(
                        event
                      ) =>
                        change({
                          selected:
                            event
                              .target
                              .checked,
                        })
                      }
                    />


                    <strong>
                      {
                        item.name
                      }
                    </strong>

                  </label>


                  <p>

                    {[
                      item.selectedColor,
                      item.selectedSize,
                    ]
                      .filter(
                        Boolean
                      )
                      .join(
                        " / "
                      )}

                    {" "}

                    · Ordered quantity{" "}

                    {
                      item.quantity
                    }

                  </p>


                  {row.selected && (
                    <div className="form-grid">

                      {/* QUANTITY */}

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
                          max={
                            item.quantity
                          }
                          required
                          disabled={
                            submitting
                          }
                          value={
                            row.quantity
                          }
                          onChange={(
                            event
                          ) =>
                            change({
                              quantity:
                                event
                                  .target
                                  .value,
                            })
                          }
                        />

                      </div>


                      {/* EXCHANGE OPTIONS */}

                      {type ===
                        "exchange" && (
                        <>

                          {product
                            ?.sizes
                            ?.length >
                            0 && (
                            <div className="field">

                              <label
                                htmlFor={`return-size-${index}`}
                              >
                                Replacement size
                              </label>


                              <select
                                id={`return-size-${index}`}
                                value={
                                  row.size
                                }
                                disabled={
                                  submitting
                                }
                                onChange={(
                                  event
                                ) =>
                                  change({
                                    size:
                                      event
                                        .target
                                        .value,
                                  })
                                }
                              >

                                {product.sizes.map(
                                  (
                                    size
                                  ) => (
                                    <option
                                      key={
                                        size
                                      }
                                      value={
                                        size
                                      }
                                    >
                                      {
                                        size
                                      }
                                    </option>
                                  )
                                )}

                              </select>

                            </div>
                          )}


                          {product
                            ?.colors
                            ?.length >
                            0 && (
                            <div className="field">

                              <label
                                htmlFor={`return-color-${index}`}
                              >
                                Replacement colour
                              </label>


                              <select
                                id={`return-color-${index}`}
                                value={
                                  row.color
                                }
                                disabled={
                                  submitting
                                }
                                onChange={(
                                  event
                                ) =>
                                  change({
                                    color:
                                      event
                                        .target
                                        .value,
                                  })
                                }
                              >

                                {product.colors.map(
                                  (
                                    color
                                  ) => (
                                    <option
                                      key={
                                        color
                                      }
                                      value={
                                        color
                                      }
                                    >
                                      {
                                        color
                                      }
                                    </option>
                                  )
                                )}

                              </select>

                            </div>
                          )}


                          <p className="muted">

                            Availability is checked when you submit. A request does not reserve replacement stock.

                          </p>

                        </>
                      )}

                    </div>
                  )}

                </section>
              );
            }
          )}


          {/* =============================================
              REASON
          ============================================= */}

          <div className="field">

            <label htmlFor="return-reason">
              Reason
            </label>


            <textarea
              id="return-reason"
              required
              minLength="5"
              maxLength="1000"
              rows="4"
              value={
                reason
              }
              disabled={
                submitting
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


          {/* =============================================
              ERROR
          ============================================= */}

          {error && (
            <p
              role="alert"
              className="field-error"
            >
              {error}
            </p>
          )}


          {/* =============================================
              SUBMIT
          ============================================= */}

          <button
            className="button"
            type="submit"
            disabled={
              submitting
            }
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