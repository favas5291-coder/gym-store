import {
  getCartItemKey,
  revalidateCart,
} from "./cartUtils.js";

import {
  calculateOrderPricing,
} from "./orderCalculations.js";

import {
  allOrders,
  ownerKey,
  persistOrder,
} from "./customerData.js";

import {
  readStorage,
} from "./storage.js";

import {
  createOrder,
} from "../services/orderApi.js";


// ======================================================
// CHECKOUT SIGNATURE
// ======================================================

export function checkoutSignature(
  items,
  coupon,
  deliveryMethod
) {
  return JSON.stringify({
    items: items
      .map((item) => [
        getCartItemKey(item),
        item.quantity,
        item.price,
      ])
      .sort((a, b) =>
        a[0].localeCompare(
          b[0]
        )
      ),

    pricing:
      calculateOrderPricing({
        cart: items,
        coupon,
        deliveryMethod,
      }),

    deliveryMethod,
  });
}


// ======================================================
// CREATE SERVER ORDER PAYLOAD
// ======================================================

function createServerPayload(
  order
) {
  return {
    checkoutToken:
      order.metadata
        ?.checkoutToken,

    source:
      order.source ||
      "cart",

    items:
      (
        order.items || []
      ).map((item) => ({
        id:
          item.id ||
          item.productId ||
          item._id ||
          item.slug,

        quantity:
          item.quantity,

        selectedSize:
          item.selectedSize ??
          item.size ??
          null,

        selectedColor:
          item.selectedColor ??
          item.color ??
          null,
      })),

    shippingAddress:
      order.shippingAddress ||
      order.address ||
      {},

    coupon:
      order.coupon
        ? {
            code:
              typeof order.coupon ===
              "string"
                ? order.coupon
                : order.coupon.code,
          }
        : null,

    deliveryMethod:
      order.deliveryMethod ||
      "standard",

    expectedTotal:
      order.pricing
        ?.finalTotal,

    giftMessage:
      order.giftMessage ||
      "",

    orderNote:
      order.orderNote ||
      "",
  };
}


// ======================================================
// SERVER CHECKOUT — LOGGED-IN CUSTOMER
// ======================================================

async function commitServerCheckout(
  order,
  getLatestProducts,
  {
    token,
    user,
  }
) {
  if (
    !token ||
    !user
  ) {
    throw new Error(
      "You must be logged in to place this order."
    );
  }


  // ------------------------------------------
  // CHECK CURRENT PRODUCT DATA FIRST
  // ------------------------------------------

  const checked =
    revalidateCart(
      order.items,
      getLatestProducts()
    );


  if (
    !checked.cart.length ||
    checked.changes.length
  ) {
    return {
      cart:
        checked.cart,

      error:
        "Prices or availability changed. Your selection is updated below. Review it before placing your order.",
    };
  }


  // ------------------------------------------
  // CHECK CURRENT FRONTEND TOTAL
  // ------------------------------------------

  const pricing =
    calculateOrderPricing({
      cart:
        checked.cart,

      coupon:
        order.coupon,

      deliveryMethod:
        order.deliveryMethod,
    });


  if (
    pricing.finalTotal !==
    order.pricing.finalTotal
  ) {
    return {
      cart:
        checked.cart,

      error:
        "Your total changed. Please review the updated order.",
    };
  }


  // ------------------------------------------
  // SEND ORDER TO EXPRESS / MONGODB
  // ------------------------------------------

  const response =
    await createOrder(
      token,
      createServerPayload({
        ...order,

        items:
          checked.cart,

        pricing,
      })
    );


  if (
    !response?.order
  ) {
    throw new Error(
      "The order could not be created."
    );
  }


  return {
    order:
      response.order,

    existing:
      Boolean(
        response.existing
      ),
  };
}


// ======================================================
// LOCAL CHECKOUT — GUEST CUSTOMER
// ======================================================

function commitGuestCheckout(
  order,
  getLatestProducts
) {
  const commit = () => {

    // ------------------------------------------
    // CHECK THAT GUEST SESSION DID NOT CHANGE
    // ------------------------------------------

    if (
      order.ownerKey !==
      ownerKey(
        readStorage(
          "gymdrobe-user",
          null
        )
      )
    ) {
      throw new Error(
        "Your sign-in changed. Review checkout again with the current account."
      );
    }


    // ------------------------------------------
    // PREVENT DUPLICATE LOCAL ORDERS
    // ------------------------------------------

    const existing =
      allOrders().find(
        (item) =>
          item.ownerKey ===
            order.ownerKey &&
          item.metadata
            ?.checkoutToken ===
            order.metadata
              ?.checkoutToken
      );


    if (existing) {
      return {
        order:
          existing,

        existing:
          true,
      };
    }


    // ------------------------------------------
    // REVALIDATE CART
    // ------------------------------------------

    const checked =
      revalidateCart(
        order.items,
        getLatestProducts()
      );


    if (
      !checked.cart.length ||
      checked.changes.length
    ) {
      return {
        cart:
          checked.cart,

        error:
          "Prices or availability changed. Your selection is updated below. Review it before placing your order.",
      };
    }


    // ------------------------------------------
    // RECALCULATE TOTAL
    // ------------------------------------------

    const pricing =
      calculateOrderPricing({
        cart:
          checked.cart,

        coupon:
          order.coupon,

        deliveryMethod:
          order.deliveryMethod,
      });


    if (
      pricing.finalTotal !==
      order.pricing.finalTotal
    ) {
      return {
        cart:
          checked.cart,

        error:
          "Your total changed. Please review the updated order.",
      };
    }


    // ------------------------------------------
    // SAVE GUEST ORDER LOCALLY
    // ------------------------------------------

    if (
      !persistOrder(
        order
      )
    ) {
      throw new Error(
        "Your order could not be saved. Your bag has been kept. Enable browser storage and try again."
      );
    }


    return {
      order,
    };
  };


  if (
    globalThis.navigator
      ?.locks?.request
  ) {
    return navigator.locks
      .request(
        "gymdrobe-order-checkout",
        commit
      );
  }


  return commit();
}


// ======================================================
// MAIN CHECKOUT
// ======================================================

export async function commitCheckout(
  order,
  getLatestProducts,
  {
    token = null,
    user = null,
  } = {}
) {

  // Logged-in customers:
  // Express + MongoDB

  if (
    token &&
    user
  ) {
    return commitServerCheckout(
      order,
      getLatestProducts,
      {
        token,
        user,
      }
    );
  }


  // Guests:
  // existing localStorage flow

  return commitGuestCheckout(
    order,
    getLatestProducts
  );
}