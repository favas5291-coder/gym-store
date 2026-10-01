import {
  checkoutSignature,
  commitCheckout,
} from "../utils/checkout.js";

import {
  readSession,
  writeSession,
} from "../utils/shopperStorage.js";

import { useShoppingTools } from "../context/ShoppingToolsContext.jsx";

import { selectedBag } from "../utils/commerce.js";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";

import { useStore } from "../context/StoreContext.jsx";

import { useCatalog } from "../context/CatalogContext.jsx";

import {
  getCartItemKey,
  revalidateCart,
} from "../utils/cartUtils.js";

import {
  calculateOrderPricing,
  resolveCoupon,
} from "../utils/orderCalculations.js";

import {
  addressErrors,
  EMPTY_ADDRESS,
  normalizeAddress,
  ownerKey,
  persistOrder,
} from "../utils/customerData.js";

import {
  makeId,
  readStorage,
  userKey,
  writeStorage,
} from "../utils/storage.js";

import {
  createAddress as createSavedAddress,
  getAddresses as getSavedAddresses,
} from "../services/addressApi.js";

import AddressForm from "../components/AddressForm.jsx";

import CouponBox from "../components/CouponBox.jsx";

import PriceSummary from "../components/PriceSummary.jsx";

import EmptyState from "../components/EmptyState.jsx";


// ======================================================
// ADDRESS PAYLOAD
// ======================================================

function addressPayload(address) {
  return {
    fullName: String(
      address?.fullName || ""
    ).trim(),

    email: String(
      address?.email || ""
    )
      .trim()
      .toLowerCase(),

    phone: String(
      address?.phone || ""
    ).trim(),

    addressLine: String(
      address?.addressLine || ""
    ).trim(),

    landmark: String(
      address?.landmark || ""
    ).trim(),

    city: String(
      address?.city || ""
    ).trim(),

    state: String(
      address?.state || ""
    ).trim(),

    pincode: String(
      address?.pincode || ""
    ).trim(),

    label:
      String(
        address?.label || "Home"
      ).trim() || "Home",

    isDefault:
      Boolean(
        address?.isDefault
      ),
  };
}


// ======================================================
// CHECK IF ADDRESS ALREADY EXISTS
// ======================================================

function sameAddress(a, b) {
  return (
    String(
      a?.addressLine || ""
    )
      .trim()
      .toLowerCase() ===
      String(
        b?.addressLine || ""
      )
        .trim()
        .toLowerCase() &&

    String(
      a?.pincode || ""
    ).trim() ===
      String(
        b?.pincode || ""
      ).trim() &&

    String(
      a?.phone || ""
    ).trim() ===
      String(
        b?.phone || ""
      ).trim()
  );
}


// ======================================================
// CHECKOUT PAGE
// ======================================================

export default function CheckoutPage() {
  const {
    getLatestProducts,
    refreshProducts,
  } = useCatalog();

  const tools =
    useShoppingTools();

  const {
    user,
    token,
  } = useAuth();

  const store =
    useStore();

  const navigate =
    useNavigate();

  const [params] =
    useSearchParams();


  // ====================================================
  // CHECKOUT MODE
  // ====================================================

  const isBuyNow =
    params.get("mode") ===
    "buy-now";

  const isSelection =
    params.get("mode") ===
    "selection";


  const checkoutMode =
    isBuyNow
      ? "buy-now"
      : isSelection
        ? "selection"
        : "cart";


  // ====================================================
  // ITEMS BEING CHECKED OUT
  // ====================================================

  const items =
    isBuyNow
      ? store.buyNowItem
        ? [
            store.buyNowItem,
          ]
        : []
      : isSelection
        ? selectedBag(
            store.cart,
            tools.checkoutKeys
          )
        : store.cart;


  // ====================================================
  // EXISTING CHECKOUT OPTIONS
  // ====================================================

  const [draftOptions] =
    useState(() =>
      readStorage(
        userKey(
          "gymdrobe-checkout-options",
          user
        ),
        {}
      )
    );


  const [
    giftMessage,
    setGiftMessage,
  ] = useState(
    draftOptions
      ?.giftMessage || ""
  );


  const [
    orderNote,
    setOrderNote,
  ] = useState(
    draftOptions
      ?.orderNote || ""
  );


  // ====================================================
  // SAVED ADDRESSES
  // ====================================================

  const [
    addresses,
    setAddresses,
  ] = useState([]);


  const [
    addressesLoading,
    setAddressesLoading,
  ] = useState(
    Boolean(user)
  );


  const [
    addressesError,
    setAddressesError,
  ] = useState("");


  // ====================================================
  // CURRENT ADDRESS
  // ====================================================

  const [
    address,
    setAddress,
  ] = useState(() => {
    const draft =
      readStorage(
        userKey(
          "gymdrobe-checkout-details",
          user
        ),
        {}
      );


    return normalizeAddress({
      ...EMPTY_ADDRESS,

      ...(
        draft &&
        typeof draft ===
          "object"
          ? draft
          : {}
      ),

      fullName:
        draft?.fullName ||
        draft?.name ||
        user?.name ||
        "",

      email:
        user?.email ||
        draft?.email ||
        "",

      phone:
        draft?.phone ||
        user?.phone ||
        "",

      pincode:
        draft?.pincode ||
        readStorage(
          store.shoppingKey(
            "gymdrobe-delivery-pincode"
          ),
          ""
        ),
    });
  });


  const [
    saveAddress,
    setSaveAddress,
  ] = useState(
    Boolean(user)
  );


  // ====================================================
  // CHECKOUT UI STATE
  // ====================================================

  const [
    step,
    setStep,
  ] = useState(
    "address"
  );


  const [
    method,
    setMethod,
  ] = useState(
    draftOptions
      ?.method ===
      "express"
      ? "express"
      : "standard"
  );


  const [
    errors,
    setErrors,
  ] = useState({});


  const [
    error,
    setError,
  ] = useState("");


  const [
    busy,
    setBusy,
  ] = useState(false);


  const submitting =
    useRef(false);


  const reviewed =
    useRef(null);


  // ====================================================
  // UNIQUE CHECKOUT ATTEMPT
  // ====================================================

  const attemptKey =
    store.shoppingKey(
      `gymdrobe-checkout-attempt-${checkoutMode}`
    );


  const [attempt] =
    useState(
      () =>
        readSession(
          attemptKey,
          null
        ) ||
        makeId(
          "checkout"
        )
    );


  useEffect(() => {
    writeSession(
      attemptKey,
      attempt
    );
  }, [
    attemptKey,
    attempt,
  ]);


  // ====================================================
  // LOAD SAVED ADDRESSES FROM MONGODB
  // ====================================================

  useEffect(() => {
    let cancelled =
      false;


    async function loadSavedAddresses() {
      if (
        !user ||
        !token
      ) {
        setAddresses([]);

        setAddressesLoading(
          false
        );

        setAddressesError(
          ""
        );

        return;
      }


      setAddressesLoading(
        true
      );

      setAddressesError(
        ""
      );


      try {
        const savedAddresses =
          await getSavedAddresses(
            token
          );


        if (cancelled) {
          return;
        }


        setAddresses(
          savedAddresses
        );


        const preferred =
          savedAddresses.find(
            (item) =>
              item.isDefault
          ) ||
          savedAddresses[0];


        if (preferred) {
          setAddress(
            normalizeAddress({
              ...preferred,

              email:
                preferred.email ||
                user.email ||
                "",
            })
          );
        }

      } catch (
        loadError
      ) {
        if (cancelled) {
          return;
        }


        console.error(
          "Checkout address load error:",
          loadError
        );


        setAddresses(
          []
        );


        setAddressesError(
          loadError.message ||
            "Saved addresses could not be loaded. You can still enter an address manually."
        );

      } finally {
        if (!cancelled) {
          setAddressesLoading(
            false
          );
        }
      }
    }


    loadSavedAddresses();


    return () => {
      cancelled =
        true;
    };

  }, [
    user?.id,
    token,
  ]);


  // ====================================================
  // SAVE CHECKOUT DRAFT LOCALLY
  // ====================================================

  useEffect(() => {
    const timer =
      setTimeout(
        () => {
          writeStorage(
            userKey(
              "gymdrobe-checkout-details",
              user
            ),
            address
          );


          writeStorage(
            userKey(
              "gymdrobe-checkout-options",
              user
            ),
            {
              method,
              giftMessage,
              orderNote,
            }
          );
        },
        300
      );


    return () => {
      clearTimeout(
        timer
      );


      writeStorage(
        userKey(
          "gymdrobe-checkout-details",
          user
        ),
        address
      );
    };

  }, [
    address,
    method,
    giftMessage,
    orderNote,
    user?.id,
  ]);


  // ====================================================
  // PRICING
  // ====================================================

  const pricing =
    calculateOrderPricing({
      cart: items,

      coupon:
        store.coupon,

      deliveryMethod:
        method,
    });


  // ====================================================
  // VALIDATE ADDRESS
  // ====================================================

  function validate() {
    const invalid =
      addressErrors(
        address
      );


    setErrors(
      invalid
    );


    if (
      Object.keys(
        invalid
      ).length
    ) {
      setStep(
        "address"
      );


      requestAnimationFrame(
        () =>
          document
            .querySelector(
              '[aria-invalid="true"]'
            )
            ?.focus()
      );


      return false;
    }


    return true;
  }


  // ====================================================
  // SAVE ADDRESS TO MONGODB
  // ====================================================

  async function saveCheckoutAddressIfNeeded() {
    if (
      !user ||
      !token ||
      !saveAddress
    ) {
      return;
    }


    const duplicate =
      addresses.some(
        (item) =>
          sameAddress(
            item,
            address
          )
      );


    if (duplicate) {
      return;
    }


    try {
      const created =
        await createSavedAddress(
          token,
          {
            ...addressPayload(
              address
            ),

            isDefault:
              addresses.length ===
              0,
          }
        );


      if (created) {
        setAddresses(
          (current) => [
            ...current.map(
              (item) =>
                created.isDefault
                  ? {
                      ...item,
                      isDefault:
                        false,
                    }
                  : item
            ),

            created,
          ]
        );
      }

    } catch (
      saveError
    ) {
      console.error(
        "Checkout saved-address error:",
        saveError
      );


      store.notify(
        "Order saved. Your address could not be added to saved addresses.",
        "warning"
      );
    }
  }


  // ====================================================
  // CHECKOUT SUBMIT
  // ====================================================

  async function submit(
    event
  ) {
    event.preventDefault();


    if (
      submitting.current
    ) {
      return;
    }


    setError("");


    if (!validate()) {
      return;
    }


    // ==================================================
    // STEP 1 → REVIEW
    // ==================================================

    if (
      step ===
      "address"
    ) {
      writeStorage(
        userKey(
          "gymdrobe-checkout-details",
          user
        ),
        address
      );


      reviewed.current =
        checkoutSignature(
          items,
          store.coupon,
          method
        );


      setStep(
        "review"
      );


      window.scrollTo({
        top: 0,
        behavior:
          "instant",
      });


      return;
    }


    // ==================================================
    // CHECK IF ORDER CHANGED AFTER REVIEW
    // ==================================================

    const signature =
      checkoutSignature(
        items,
        store.coupon,
        method
      );


    if (
      reviewed.current !==
      signature
    ) {
      reviewed.current =
        signature;


      setError(
        "Your selection or total has changed. Review the current items and total, then place your order again."
      );


      return;
    }


    // ==================================================
    // REVALIDATE PRODUCTS
    // ==================================================

    const checked =
      revalidateCart(
        items,
        getLatestProducts()
      );


    if (
      !checked.cart.length ||
      checked.changes.length
    ) {
      if (isBuyNow) {
        store.refreshBuyNow(
          checked.cart[0]
        );

      } else {
        const selectedKeys =
          items.map(
            getCartItemKey
          );


        store.setCart([
          ...store.cart.filter(
            (item) =>
              !selectedKeys.includes(
                getCartItemKey(
                  item
                )
              )
          ),

          ...checked.cart,
        ]);
      }


      setError(
        "Product availability or prices changed. Please review your selection before placing an order."
      );


      return;
    }


    // Signed-in customer should never
    // silently fall back to a guest order.

    if (
      user &&
      !token
    ) {
      setError(
        "Your sign-in session expired. Please sign in again before placing the order."
      );

      return;
    }


    submitting.current =
      true;

    setBusy(
      true
    );


    // ==================================================
    // ORDER DATA
    // ==================================================

    const now =
      new Date()
        .toISOString();


    const selectedCoupon =
      resolveCoupon(
        store.coupon
      );


    const coupon =
      selectedCoupon &&
      pricing.subtotal >=
        selectedCoupon.minimum
        ? selectedCoupon
        : null;


    const cleanShippingAddress =
      addressPayload(
        address
      );


    const order = {
      id:
        makeId("GD"),

      ownerKey:
        ownerKey(user),

      createdAt:
        now,

      updatedAt:
        now,

      status:
        "confirmed",

      source:
        checkoutMode,

      giftMessage:
        giftMessage.trim(),

      orderNote:
        orderNote.trim(),


      user: user
        ? {
            id:
              user.id,

            name:
              user.name,

            email:
              user.email,
          }
        : null,


      customer: {
        name:
          cleanShippingAddress
            .fullName,

        email:
          cleanShippingAddress
            .email,

        phone:
          cleanShippingAddress
            .phone,
      },


      shippingAddress: {
        ...cleanShippingAddress,

        name:
          cleanShippingAddress
            .fullName,
      },


      items:
        checked.cart.map(
          (item) => ({
            id:
              item.id,

            name:
              item.name,

            brand:
              item.brand,

            image:
              item.image,

            price:
              item.price,

            originalPrice:
              item.originalPrice,

            quantity:
              item.quantity,

            selectedSize:
              item.selectedSize,

            selectedColor:
              item.selectedColor,

            returnPolicy:
              item.returnPolicy,
          })
        ),


      pricing: {
        ...calculateOrderPricing({
          cart:
            checked.cart,

          coupon,

          deliveryMethod:
            method,
        }),

        currency:
          "INR",
      },


      coupon,


      payment: {
        method:
          "cod",

        status:
          "pending",

        transactionId:
          null,
      },


      paymentMethod:
        "cod",


      delivery: {
        method,

        status:
          "pending",

        label:
          method ===
          "express"
            ? "Express delivery"
            : "Standard delivery",

        estimatedTime:
          null,
      },


      deliveryMethod:
        method,


      tracking: {
        carrier:
          null,

        trackingNumber:
          null,

        estimatedDelivery:
          null,

        events: [
          {
            status:
              "confirmed",

            description:
              user
                ? "Order confirmed by GymDrobe."
                : "Preview order created on this device.",

            timestamp:
              now,
          },
        ],
      },


      cancellation: {
        status:
          "not-cancelled",
      },


      returnRequest: {
        status:
          "not-requested",
      },


      refund: {
        status:
          "not-requested",

        amount:
          0,
      },


      metadata: {
        version:
          "5.0",

        demo:
          true,

        inventoryReserved:
          true,

        checkoutToken:
          attempt,
      },
    };


    // ==================================================
    // PLACE ORDER
    // ==================================================

    try {
      const result =
        await commitCheckout(
          order,
          getLatestProducts,
          {
            token,
            user,
          }
        );


      // =================================================
      // PRODUCT/TOTAL CHANGED
      // =================================================

      if (result.error) {
        if (isBuyNow) {
          store.refreshBuyNow(
            result.cart[0]
          );

        } else {
          store.setCart(
            () =>
              result.cart ||
              revalidateCart(
                store.cart,
                getLatestProducts()
              ).cart
          );
        }


        throw new Error(
          result.error
        );
      }


      const savedOrder =
        result.order;


      if (!savedOrder) {
        throw new Error(
          "Your order could not be loaded after checkout."
        );
      }


      // =================================================
      // SAVE ADDRESS ONLY FOR NEW ORDER
      // =================================================

      if (
        !result.existing
      ) {
        await saveCheckoutAddressIfNeeded();
      }


      // =================================================
      // SIGNED-IN CUSTOMER
      // MongoDB is authoritative.
      //
      // Temporary local copy keeps your existing
      // order-success/details pages working until
      // those pages are migrated to the API.
      // =================================================

      let orderForLocalPages =
        savedOrder;


      if (
        user &&
        token
      ) {
        orderForLocalPages = {
          ...savedOrder,

          ownerKey:
            ownerKey(user),

          user: {
            id:
              user.id,

            name:
              user.name,

            email:
              user.email,
          },

          metadata: {
            ...savedOrder.metadata,

            checkoutToken:
              savedOrder
                .metadata
                ?.checkoutToken ||
              attempt,
          },
        };


        const cached =
          persistOrder(
            orderForLocalPages
          );


        if (!cached) {
          console.warn(
            "Server order was created, but the temporary local order cache could not be saved."
          );
        }


        // MongoDB stock was reduced by the backend.
        // Refresh products so the frontend immediately
        // shows the new stock.

        try {
          if (
            typeof refreshProducts ===
            "function"
          ) {
            await refreshProducts();
          }

        } catch (
          refreshError
        ) {
          console.error(
            "Product refresh after order failed:",
            refreshError
          );


          store.notify(
            "Your order was placed, but the latest stock could not be refreshed yet.",
            "warning"
          );
        }
      }


      // =================================================
      // LAST ORDER CACHE
      // =================================================

      writeStorage(
        userKey(
          "gymdrobe-last-order",
          user
        ),
        orderForLocalPages
      );


      // =================================================
      // CLEAR PURCHASED ITEMS
      // =================================================

      if (isBuyNow) {
        store.clearBuyNow();

      } else {
        const orderedKeys =
          items.map(
            getCartItemKey
          );


        store.setCart(
          (current) =>
            current.filter(
              (item) =>
                !orderedKeys.includes(
                  getCartItemKey(
                    item
                  )
                )
            )
        );


        tools.startSelection(
          []
        );


        store.setCoupon(
          null
        );
      }


      // =================================================
      // CLEAR CHECKOUT ATTEMPT
      // =================================================

      writeSession(
        attemptKey,
        null
      );


      writeStorage(
        userKey(
          "gymdrobe-checkout-options",
          user
        ),
        {
          method:
            "standard",

          giftMessage:
            "",

          orderNote:
            "",
        }
      );


      // =================================================
      // IMPORTANT:
      // use server MongoDB order ID / orderNumber
      // instead of old frontend-generated ID
      // =================================================

      navigate(
        `/order-success?orderId=${encodeURIComponent(
          savedOrder.id
        )}`,
        {
          replace:
            true,
        }
      );

    } catch (
      submitError
    ) {
      console.error(
        "Checkout error:",
        submitError
      );


      setError(
        submitError.message ||
          "Could not place your order. Please try again."
      );


      submitting.current =
        false;


      setBusy(
        false
      );
    }
  }


  // ====================================================
  // EMPTY CHECKOUT
  // ====================================================

  if (!items.length) {
    return (
      <EmptyState
        title={
          isBuyNow
            ? "Choose your Buy now selection again"
            : "Your checkout is empty"
        }
      >
        Return to a product or add something to your bag to continue.
      </EmptyState>
    );
  }


  // ====================================================
  // PAGE
  // ====================================================

  return (
    <div className="page narrow">

      <nav
        className="checkout-steps"
        aria-label="Checkout progress"
      >
        <Link to="/cart">
          1. BAG
        </Link>

        <strong>
          2. ADDRESS
        </strong>

        <strong
          className={
            step === "review"
              ? "active"
              : "muted"
          }
        >
          3. REVIEW
        </strong>
      </nav>


      <div className="page-heading">
        <h1>
          {step === "address"
            ? "Delivery address"
            : "Review your order"}
        </h1>

        <span>
          {isBuyNow
            ? "Buy now"
            : isSelection
              ? "Selected items"
              : "Bag checkout"}
        </span>
      </div>


      <div className="notice">
        {user
          ? "Signed-in orders are saved securely to your GymDrobe account. Cash on delivery is currently in preview mode; no online payment is taken."
          : "Guest orders are currently saved on this device. Sign in to save orders to your GymDrobe account."}
      </div>


      {!user && (
        <p className="checkout-signin">
          <Link
            to={`/login?next=${encodeURIComponent(
              `/checkout?mode=${checkoutMode}`
            )}`}
          >
            Sign in
          </Link>{" "}
          to save this order to your GymDrobe account, or continue as a guest.
        </p>
      )}


      <div className="checkout-layout">

        <form
          id="checkout-form"
          className="checkout-form"
          onSubmit={submit}
          noValidate
        >

          {error && (
            <p
              role="alert"
              className="error-box"
            >
              {error}
            </p>
          )}


          {step === "address" ? (
            <>

              {user &&
                addressesLoading && (
                  <p className="muted">
                    Loading your saved addresses…
                  </p>
                )}


              {user &&
                addressesError && (
                  <p
                    className="field-error"
                    role="alert"
                  >
                    {addressesError}
                  </p>
                )}


              {user &&
                !addressesLoading &&
                addresses.length >
                  0 && (
                  <div className="saved-address-choices">

                    <h2>
                      USE A SAVED ADDRESS
                    </h2>


                    {addresses.map(
                      (item) => (
                        <button
                          type="button"
                          key={
                            item.id
                          }
                          className="saved-address-choice"
                          aria-pressed={
                            String(
                              address?.id ||
                                ""
                            ) ===
                            String(
                              item.id
                            )
                          }
                          onClick={() => {
                            setAddress(
                              normalizeAddress({
                                ...item,

                                email:
                                  item.email ||
                                  user.email ||
                                  "",
                              })
                            );


                            setErrors(
                              {}
                            );


                            setError(
                              ""
                            );
                          }}
                        >
                          <strong>
                            {
                              item.fullName
                            }{" "}
                            ·{" "}
                            {item.label ||
                              "Home"}

                            {item.isDefault
                              ? " · Default"
                              : ""}
                          </strong>


                          <span>
                            {
                              item.addressLine
                            }
                            ,{" "}
                            {
                              item.city
                            }{" "}
                            {
                              item.pincode
                            }
                          </span>
                        </button>
                      )
                    )}
                  </div>
                )}


              <AddressForm
                value={
                  address
                }
                errors={
                  errors
                }
                onChange={(
                  value
                ) => {
                  setAddress(
                    value
                  );

                  setErrors(
                    {}
                  );
                }}
              />


              {user && (
                <label className="check">
                  <input
                    type="checkbox"
                    checked={
                      saveAddress
                    }
                    onChange={(
                      event
                    ) =>
                      setSaveAddress(
                        event
                          .target
                          .checked
                      )
                    }
                  />

                  Save this address for next time
                </label>
              )}

            </>
          ) : (
            <>

              <section className="panel">

                <div className="panel-heading">
                  <h2>
                    DELIVER TO
                  </h2>

                  <button
                    type="button"
                    className="text-link"
                    onClick={() =>
                      setStep(
                        "address"
                      )
                    }
                  >
                    Edit address
                  </button>
                </div>


                <strong>
                  {
                    address.fullName
                  }
                </strong>


                <p>
                  {
                    address.addressLine
                  }

                  {address.landmark
                    ? `, ${address.landmark}`
                    : ""}

                  <br />

                  {
                    address.city
                  }
                  ,{" "}
                  {
                    address.state
                  }{" "}
                  –{" "}
                  {
                    address.pincode
                  }
                </p>


                <p>
                  {
                    address.phone
                  }{" "}
                  ·{" "}
                  {
                    address.email
                  }
                </p>

              </section>


              <section className="panel">

                <h2>
                  PAYMENT METHOD
                </h2>


                <label className="check">
                  <input
                    type="radio"
                    checked
                    readOnly
                    name="payment"
                  />

                  Cash on delivery
                </label>


                <p className="muted">
                  Online payments will be available after payment integration.
                </p>

              </section>


              <section className="panel">

                <h2>
                  ORDER ITEMS
                </h2>


                {items.map(
                  (
                    item,
                    index
                  ) => (
                    <p
                      key={
                        getCartItemKey(
                          item
                        ) ||
                        index
                      }
                    >
                      {
                        item.name
                      }{" "}
                      ·{" "}

                      {[
                        item.selectedColor,
                        item.selectedSize,
                      ]
                        .filter(
                          Boolean
                        )
                        .join(
                          " / "
                        )}{" "}

                      ×{" "}
                      {
                        item.quantity
                      }
                    </p>
                  )
                )}

              </section>

            </>
          )}


          <section className="panel">

            <h2>
              MAKE IT YOURS
            </h2>


            <div className="field">

              <label htmlFor="gift-message">
                Gift message (optional, no extra charge)
              </label>


              <textarea
                id="gift-message"
                rows="3"
                maxLength="250"
                value={
                  giftMessage
                }
                onChange={(
                  event
                ) =>
                  setGiftMessage(
                    event.target
                      .value
                  )
                }
              />

            </div>


            <div className="field">

              <label htmlFor="order-note">
                Delivery instructions (optional)
              </label>


              <textarea
                id="order-note"
                rows="2"
                maxLength="300"
                value={
                  orderNote
                }
                onChange={(
                  event
                ) =>
                  setOrderNote(
                    event.target
                      .value
                  )
                }
              />

            </div>


            <p className="muted">
              These messages will be included with your order.
            </p>

          </section>


          <fieldset className="delivery-methods">

            <legend>
              DELIVERY METHOD
            </legend>


            <label className="check">
              <input
                type="radio"
                name="delivery"
                value="standard"
                checked={
                  method ===
                  "standard"
                }
                onChange={() =>
                  setMethod(
                    "standard"
                  )
                }
              />

              Standard — ₹99, free from ₹500 after coupons
            </label>


            <label className="check">
              <input
                type="radio"
                name="delivery"
                value="express"
                checked={
                  method ===
                  "express"
                }
                onChange={() =>
                  setMethod(
                    "express"
                  )
                }
              />

              Express — ₹199
            </label>


            <p className="muted">
              Delivery dates will be shown after shipping integration.
            </p>

          </fieldset>

        </form>


        <aside className="checkout-summary">

          <CouponBox
            subtotal={
              pricing.subtotal
            }
          />


          <PriceSummary
            cart={
              items
            }
            coupon={
              store.coupon
            }
            deliveryMethod={
              method
            }
          >

            <button
              type="submit"
              form="checkout-form"
              className="button full"
              disabled={
                busy
              }
            >
              {busy
                ? user
                  ? "Placing order…"
                  : "Saving order…"
                : step ===
                    "address"
                  ? "Continue to review"
                  : user
                    ? "Place order"
                    : "Place preview order"}
            </button>

          </PriceSummary>

        </aside>

      </div>

    </div>
  );
}