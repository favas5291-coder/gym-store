import {
  checkoutSignature,
  commitCheckout,
} from "../utils/checkout.js";

import {
  readSession,
  writeSession,
} from "../utils/shopperStorage.js";

import {
  useShoppingTools,
} from "../context/ShoppingToolsContext.jsx";

import {
  selectedBag,
} from "../utils/commerce.js";

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
// CONSTANTS
// ======================================================

const PAYMENT_METHOD =
  "cod";


// ======================================================
// ADDRESS ID
// ======================================================

function addressId(
  address
) {
  return (
    address?.id ||
    address?._id ||
    ""
  );
}


// ======================================================
// ADDRESS PAYLOAD
// ======================================================

function addressPayload(
  address
) {
  return {
    fullName:
      String(
        address?.fullName ||
          ""
      ).trim(),

    email:
      String(
        address?.email ||
          ""
      )
        .trim()
        .toLowerCase(),

    phone:
      String(
        address?.phone ||
          ""
      ).replace(
        /\D/g,
        ""
      ),

    addressLine:
      String(
        address?.addressLine ||
          ""
      ).trim(),

    landmark:
      String(
        address?.landmark ||
          ""
      ).trim(),

    city:
      String(
        address?.city ||
          ""
      ).trim(),

    state:
      String(
        address?.state ||
          ""
      ).trim(),

    pincode:
      String(
        address?.pincode ||
          ""
      ).replace(
        /\D/g,
        ""
      ),

    label:
      String(
        address?.label ||
          "Home"
      ).trim() ||
      "Home",

    isDefault:
      Boolean(
        address?.isDefault
      ),
  };
}


// ======================================================
// SAME ADDRESS
// ======================================================

function sameAddress(
  first,
  second
) {
  return (
    String(
      first?.addressLine ||
        ""
    )
      .trim()
      .toLowerCase() ===
      String(
        second?.addressLine ||
          ""
      )
        .trim()
        .toLowerCase() &&

    String(
      first?.pincode ||
        ""
    ).trim() ===
      String(
        second?.pincode ||
          ""
      ).trim() &&

    String(
      first?.phone ||
        ""
    ).replace(
      /\D/g,
      ""
    ) ===
      String(
        second?.phone ||
          ""
      ).replace(
        /\D/g,
        ""
      )
  );
}


// ======================================================
// CHECK WHETHER ADDRESS HAS BEEN ENTERED
// ======================================================

function hasAddressData(
  address
) {
  return Boolean(
    String(
      address?.addressLine ||
        ""
    ).trim() &&
      String(
        address?.pincode ||
          ""
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
  } =
    useCatalog();


  const tools =
    useShoppingTools();


  const {
    user,
    token,
  } =
    useAuth();


  const store =
    useStore();


  const navigate =
    useNavigate();


  const [
    params,
  ] =
    useSearchParams();


  // ====================================================
  // CHECKOUT MODE
  // ====================================================

  const isBuyNow =
    params.get(
      "mode"
    ) ===
    "buy-now";


  const isSelection =
    params.get(
      "mode"
    ) ===
    "selection";


  const checkoutMode =
    isBuyNow
      ? "buy-now"
      : isSelection
        ? "selection"
        : "cart";


  // ====================================================
  // ITEMS
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
  // PREVIOUS CHECKOUT OPTIONS
  // ====================================================

  const [
    draftOptions,
  ] =
    useState(
      () =>
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
  ] =
    useState(
      draftOptions
        ?.giftMessage ||
        ""
    );


  const [
    orderNote,
    setOrderNote,
  ] =
    useState(
      draftOptions
        ?.orderNote ||
        ""
    );


  const [
    method,
    setMethod,
  ] =
    useState(
      draftOptions
        ?.method ===
      "express"
        ? "express"
        : "standard"
    );


  // ====================================================
  // SAVED ADDRESSES
  // ====================================================

  const [
    addresses,
    setAddresses,
  ] =
    useState([]);


  const [
    addressesLoading,
    setAddressesLoading,
  ] =
    useState(
      Boolean(
        user
      )
    );


  const [
    addressesError,
    setAddressesError,
  ] =
    useState("");


  // ====================================================
  // CURRENT ADDRESS
  // ====================================================

  const [
    address,
    setAddress,
  ] =
    useState(
      () => {
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
      }
    );


  const [
    saveAddress,
    setSaveAddress,
  ] =
    useState(
      Boolean(
        user
      )
    );


  // ====================================================
  // PAGE STATE
  // ====================================================

  const [
    step,
    setStep,
  ] =
    useState(
      "address"
    );


  const [
    errors,
    setErrors,
  ] =
    useState({});


  const [
    error,
    setError,
  ] =
    useState("");


  const [
    busy,
    setBusy,
  ] =
    useState(
      false
    );


  const submitting =
    useRef(
      false
    );


  const reviewed =
    useRef(
      null
    );


  // ====================================================
  // IDEMPOTENT CHECKOUT ATTEMPT
  // ====================================================

  const attemptKey =
    store.shoppingKey(
      `gymdrobe-checkout-attempt-${checkoutMode}`
    );


  const [
    attempt,
  ] =
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


  useEffect(
    () => {
      writeSession(
        attemptKey,
        attempt
      );
    },

    [
      attemptKey,
      attempt,
    ]
  );


  // ====================================================
  // LOAD MONGODB SAVED ADDRESSES
  // ====================================================

  useEffect(
    () => {
      let cancelled =
        false;


      async function loadSavedAddresses() {
        if (
          !user ||
          !token
        ) {
          setAddresses(
            []
          );

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
          const result =
            await getSavedAddresses(
              token
            );


          if (
            cancelled
          ) {
            return;
          }


          const savedAddresses =
            Array.isArray(
              result
            )
              ? result
              : [];


          setAddresses(
            savedAddresses
          );


          /*
            Keep a checkout draft if the customer
            already entered one.

            Otherwise load the default saved address.
          */

          if (
            !hasAddressData(
              address
            )
          ) {
            const preferred =
              savedAddresses.find(
                (
                  item
                ) =>
                  item.isDefault
              ) ||
              savedAddresses[0];


            if (
              preferred
            ) {
              setAddress(
                normalizeAddress({
                  ...preferred,

                  id:
                    addressId(
                      preferred
                    ),

                  email:
                    preferred.email ||
                    user.email ||
                    "",
                })
              );
            }
          }

        } catch (
          loadError
        ) {
          if (
            cancelled
          ) {
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
          if (
            !cancelled
          ) {
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
    },

    [
      user?.id,
      token,
    ]
  );


  // ====================================================
  // SAVE CHECKOUT DRAFT
  // ====================================================

  useEffect(
    () => {
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

                paymentMethod:
                  PAYMENT_METHOD,

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
      };
    },

    [
      address,
      method,
      giftMessage,
      orderNote,
      user?.id,
    ]
  );


  // ====================================================
  // PRICING
  // ====================================================

  const pricing =
    calculateOrderPricing({
      cart:
        items,

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
  // SELECT SAVED ADDRESS
  // ====================================================

  function selectSavedAddress(
    item
  ) {
    setAddress(
      normalizeAddress({
        ...item,

        id:
          addressId(
            item
          ),

        email:
          item.email ||
          user?.email ||
          "",
      })
    );


    setErrors(
      {}
    );


    setError(
      ""
    );
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
        (
          item
        ) =>
          sameAddress(
            item,
            address
          )
      );


    if (
      duplicate
    ) {
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


      if (
        created
      ) {
        setAddresses(
          (
            current
          ) => [
            ...current.map(
              (
                item
              ) =>
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
        "Your order was placed, but this address could not be added to your saved addresses.",
        "warning"
      );
    }
  }


  // ====================================================
  // UPDATE CART AFTER REVALIDATION
  // ====================================================

  function applyRevalidatedCart(
    checked
  ) {
    if (
      isBuyNow
    ) {
      store.refreshBuyNow(
        checked.cart[0]
      );

      return;
    }


    const selectedKeys =
      items.map(
        getCartItemKey
      );


    store.setCart([
      ...store.cart.filter(
        (
          item
        ) =>
          !selectedKeys.includes(
            getCartItemKey(
              item
            )
          )
      ),

      ...checked.cart,
    ]);
  }


  // ====================================================
  // CLEAR PURCHASED ITEMS
  // ====================================================

  function clearPurchasedItems() {
    if (
      isBuyNow
    ) {
      store.clearBuyNow();

      return;
    }


    const orderedKeys =
      items.map(
        getCartItemKey
      );


    store.setCart(
      (
        current
      ) =>
        current.filter(
          (
            item
          ) =>
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


  // ====================================================
  // SUBMIT CHECKOUT
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


    setError(
      ""
    );


    // ==================================================
    // ADDRESS VALIDATION
    // ==================================================

    if (
      !validate()
    ) {
      return;
    }


    // ==================================================
    // ADDRESS → REVIEW
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
        top:
          0,

        behavior:
          "instant",
      });


      return;
    }


    // ==================================================
    // CHECK WHETHER CART/TOTAL CHANGED AFTER REVIEW
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
        "Your products, coupon or delivery total changed. Review the latest order summary and place your order again."
      );


      return;
    }


    // ==================================================
    // REVALIDATE AGAINST CURRENT CATALOG
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
      applyRevalidatedCart(
        checked
      );


      setError(
        "Product availability or prices changed. Please review your updated selection before placing the order."
      );


      return;
    }


    // ==================================================
    // AUTH SESSION CHECK
    // ==================================================

    if (
      user &&
      !token
    ) {
      setError(
        "Your sign-in session expired. Please sign in again before placing your order."
      );


      return;
    }


    // ==================================================
    // START
    // ==================================================

    submitting.current =
      true;


    setBusy(
      true
    );


    // ==================================================
    // ORDER PAYLOAD
    //
    // For signed-in orders the backend will recalculate
    // prices, verify inventory and generate the real
    // MongoDB order.
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


    const latestPricing =
      calculateOrderPricing({
        cart:
          checked.cart,

        coupon,

        deliveryMethod:
          method,
      });


    const order = {
      id:
        makeId(
          "GD"
        ),

      ownerKey:
        ownerKey(
          user
        ),

      createdAt:
        now,

      updatedAt:
        now,

      status:
        "confirmed",

      source:
        checkoutMode,

      giftMessage:
        giftMessage
          .trim(),

      orderNote:
        orderNote
          .trim(),

      user:
        user
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
          (
            item
          ) => ({
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
              item.selectedSize ??
              null,

            selectedColor:
              item.selectedColor ??
              null,

            returnPolicy:
              item.returnPolicy,
          })
        ),

      pricing: {
        ...latestPricing,

        currency:
          "INR",
      },

      coupon,

      payment: {
        method:
          PAYMENT_METHOD,

        status:
          "pending",

        transactionId:
          null,
      },

      paymentMethod:
        PAYMENT_METHOD,

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
                : "Guest checkout order created on this device.",

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
          !user,

        inventoryReserved:
          Boolean(
            user
          ),

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
      // BACKEND/CATALOG CHANGED
      // =================================================

      if (
        result.error
      ) {
        if (
          isBuyNow
        ) {
          store.refreshBuyNow(
            result.cart?.[0]
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


      if (
        !savedOrder
      ) {
        throw new Error(
          "Your order could not be loaded after checkout."
        );
      }


      // =================================================
      // SAVE NEW ADDRESS
      // =================================================

      if (
        !result.existing
      ) {
        await saveCheckoutAddressIfNeeded();
      }


      // =================================================
      // TEMPORARY LOCAL ORDER CACHE
      //
      // Keep this until every order-success/detail
      // screen is completely API-backed.
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
            ownerKey(
              user
            ),

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
                ?.metadata
                ?.checkoutToken ||
              attempt,
          },
        };


        const cached =
          persistOrder(
            orderForLocalPages
          );


        if (
          !cached
        ) {
          console.warn(
            "The MongoDB order was created, but its temporary local cache could not be saved."
          );
        }


        // ===============================================
        // BACKEND RESERVED STOCK
        // ===============================================

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
            "Product refresh after checkout failed:",
            refreshError
          );


          store.notify(
            "Your order was placed, but the latest stock could not be refreshed yet.",
            "warning"
          );
        }
      }


      // =================================================
      // LAST ORDER
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

      clearPurchasedItems();


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

          paymentMethod:
            PAYMENT_METHOD,

          giftMessage:
            "",

          orderNote:
            "",
        }
      );


      // =================================================
      // SUCCESS
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

  if (
    !items.length
  ) {
    return (
      <EmptyState
        title={
          isBuyNow
            ? "Choose your Buy now selection again"
            : "Your checkout is empty"
        }
      >
        <p>
          Return to a product or add something to your bag to continue.
        </p>

        <Link
          className="button"
          to="/shop"
        >
          Continue shopping
        </Link>
      </EmptyState>
    );
  }


  // ====================================================
  // PAGE
  // ====================================================

  return (
    <div
      className="page narrow"
    >
      {/* ===============================================
          CHECKOUT PROGRESS
      =============================================== */}

      <nav
        className="checkout-steps"
        aria-label="Checkout progress"
      >
        <Link
          to="/cart"
        >
          1. BAG
        </Link>

        <strong
          className={
            step ===
            "address"
              ? "active"
              : undefined
          }
        >
          2. ADDRESS
        </strong>

        <strong
          className={
            step ===
            "review"
              ? "active"
              : "muted"
          }
        >
          3. REVIEW
        </strong>
      </nav>


      {/* ===============================================
          HEADING
      =============================================== */}

      <div
        className="page-heading"
      >
        <h1>
          {step ===
          "address"
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


      {/* ===============================================
          ACCOUNT STATUS
      =============================================== */}

      <div
        className="notice"
      >
        {user
          ? "Your order will be saved securely to your GymDrobe account. Cash on delivery is currently available."
          : "You are checking out as a guest. This guest order is currently stored on this device. Sign in to save orders to your GymDrobe account."}
      </div>


      {!user && (
        <p
          className="checkout-signin"
        >
          <Link
            to={`/login?next=${encodeURIComponent(
              `/checkout?mode=${checkoutMode}`
            )}`}
          >
            Sign in
          </Link>

          {" "}
          to save this order to your GymDrobe account, or continue as a guest.
        </p>
      )}


      <div
        className="checkout-layout"
      >
        {/* =============================================
            CHECKOUT FORM
        ============================================== */}

        <form
          id="checkout-form"
          className="checkout-form"
          onSubmit={
            submit
          }
          noValidate
        >
          {/* ===========================================
              ERROR
          ============================================ */}

          {error && (
            <p
              role="alert"
              className="error-box"
            >
              {
                error
              }
            </p>
          )}


          {/* ===========================================
              ADDRESS STEP
          ============================================ */}

          {step ===
          "address" ? (
            <>
              {user &&
                addressesLoading && (
                  <p
                    className="muted"
                  >
                    Loading your saved addresses…
                  </p>
                )}


              {user &&
                addressesError && (
                  <p
                    className="field-error"
                    role="alert"
                  >
                    {
                      addressesError
                    }
                  </p>
                )}


              {user &&
                !addressesLoading &&
                addresses.length >
                  0 && (
                  <div
                    className="saved-address-choices"
                  >
                    <h2>
                      USE A SAVED ADDRESS
                    </h2>


                    {addresses.map(
                      (
                        item
                      ) => {
                        const id =
                          addressId(
                            item
                          );


                        return (
                          <button
                            type="button"
                            key={
                              id
                            }
                            className="saved-address-choice"
                            aria-pressed={
                              String(
                                addressId(
                                  address
                                )
                              ) ===
                              String(
                                id
                              )
                            }
                            onClick={() =>
                              selectSavedAddress(
                                item
                              )
                            }
                          >
                            <strong>
                              {
                                item.fullName
                              }

                              {" · "}

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

                              {item.landmark
                                ? `, ${item.landmark}`
                                : ""}

                              {", "}

                              {
                                item.city
                              }

                              {" "}

                              {
                                item.pincode
                              }
                            </span>
                          </button>
                        );
                      }
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
                onChange={
                  (
                    value
                  ) => {
                    setAddress(
                      value
                    );

                    setErrors(
                      {}
                    );

                    setError(
                      ""
                    );
                  }
                }
              />


              {user && (
                <label
                  className="check"
                >
                  <input
                    type="checkbox"
                    checked={
                      saveAddress
                    }
                    onChange={
                      (
                        event
                      ) =>
                        setSaveAddress(
                          event.target
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
              {/* =======================================
                  REVIEW ADDRESS
              ======================================== */}

              <section
                className="panel"
              >
                <div
                  className="panel-heading"
                >
                  <h2>
                    DELIVER TO
                  </h2>

                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      setStep(
                        "address"
                      );

                      setError(
                        ""
                      );
                    }}
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

                  {", "}

                  {
                    address.state
                  }

                  {" – "}

                  {
                    address.pincode
                  }
                </p>


                <p>
                  {
                    address.phone
                  }

                  {" · "}

                  {
                    address.email
                  }
                </p>
              </section>


              {/* =======================================
                  PAYMENT
              ======================================== */}

              <section
                className="panel"
              >
                <h2>
                  PAYMENT METHOD
                </h2>


                <label
                  className="check"
                >
                  <input
                    type="radio"
                    name="payment"
                    value="cod"
                    checked
                    readOnly
                  />

                  Cash on delivery
                </label>


                <p
                  className="muted"
                >
                  Pay when your GymDrobe order is delivered.
                </p>


                <label
                  className="check"
                  style={{
                    opacity:
                      0.55,

                    cursor:
                      "not-allowed",
                  }}
                >
                  <input
                    type="radio"
                    name="payment"
                    disabled
                  />

                  Online payment — coming soon
                </label>


                <p
                  className="muted"
                >
                  UPI, cards and other online payment methods will be connected in the payment-gateway phase.
                </p>
              </section>


              {/* =======================================
                  ORDER ITEMS
              ======================================== */}

              <section
                className="panel"
              >
                <h2>
                  ORDER ITEMS
                </h2>


                {items.map(
                  (
                    item,
                    index
                  ) => {
                    const options =
                      [
                        item.selectedColor,
                        item.selectedSize,
                      ]
                        .filter(
                          Boolean
                        )
                        .join(
                          " / "
                        );


                    return (
                      <p
                        key={
                          getCartItemKey(
                            item
                          ) ||
                          index
                        }
                      >
                        <strong>
                          {
                            item.name
                          }
                        </strong>

                        {options
                          ? ` · ${options}`
                          : ""}

                        {" × "}

                        {
                          item.quantity
                        }
                      </p>
                    );
                  }
                )}
              </section>
            </>
          )}


          {/* ===========================================
              GIFT MESSAGE / DELIVERY NOTE
          ============================================ */}

          <section
            className="panel"
          >
            <h2>
              MAKE IT YOURS
            </h2>


            <div
              className="field"
            >
              <label
                htmlFor="gift-message"
              >
                Gift message (optional, no extra charge)
              </label>

              <textarea
                id="gift-message"
                rows="3"
                maxLength="250"
                value={
                  giftMessage
                }
                onChange={
                  (
                    event
                  ) =>
                    setGiftMessage(
                      event.target
                        .value
                    )
                }
              />
            </div>


            <div
              className="field"
            >
              <label
                htmlFor="order-note"
              >
                Delivery instructions (optional)
              </label>

              <textarea
                id="order-note"
                rows="2"
                maxLength="300"
                value={
                  orderNote
                }
                onChange={
                  (
                    event
                  ) =>
                    setOrderNote(
                      event.target
                        .value
                    )
                }
              />
            </div>


            <p
              className="muted"
            >
              These messages will be included with your order.
            </p>
          </section>


          {/* ===========================================
              DELIVERY METHOD
          ============================================ */}

          <fieldset
            className="delivery-methods"
          >
            <legend>
              DELIVERY METHOD
            </legend>


            <label
              className="check"
            >
              <input
                type="radio"
                name="delivery"
                value="standard"
                checked={
                  method ===
                  "standard"
                }
                onChange={() => {
                  setMethod(
                    "standard"
                  );

                  setError(
                    ""
                  );
                }}
              />

              Standard — ₹99, free from ₹500 after coupons
            </label>


            <label
              className="check"
            >
              <input
                type="radio"
                name="delivery"
                value="express"
                checked={
                  method ===
                  "express"
                }
                onChange={() => {
                  setMethod(
                    "express"
                  );

                  setError(
                    ""
                  );
                }}
              />

              Express — ₹199
            </label>


            <p
              className="muted"
            >
              Exact delivery dates will be connected during the shipping and serviceability phase.
            </p>
          </fieldset>
        </form>


        {/* =============================================
            SUMMARY
        ============================================== */}

        <aside
          className="checkout-summary"
        >
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
            {step ===
              "review" && (
              <div
                style={{
                  marginBottom:
                    "14px",
                }}
              >
                <small
                  className="muted"
                >
                  Payment
                </small>

                <strong
                  style={{
                    display:
                      "block",
                  }}
                >
                  Cash on delivery
                </strong>
              </div>
            )}


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
                  : "Saving guest order…"
                : step ===
                    "address"
                  ? "Continue to review"
                  : "Place order"}
            </button>


            {step ===
              "review" && (
              <p
                className="muted"
                style={{
                  marginTop:
                    "10px",
                }}
              >
                By placing the order, you confirm your delivery details and order total.
              </p>
            )}
          </PriceSummary>
        </aside>
      </div>
    </div>
  );
}