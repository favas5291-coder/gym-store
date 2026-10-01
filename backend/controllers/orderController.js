const crypto = require("crypto");
const mongoose = require("mongoose");

const Order = require("../models/Order");
const Product = require("../models/Product");

const {
  getDiscountedPrice,
  getOriginalPrice,
  resolveCoupon,
  calculateOrderPricing,
  roundMoney,
} = require("../utils/orderPricing");

const {
  getVariantStock,
  reserveVariantStock,
  restoreVariantStock,
} = require("../utils/orderInventory");


// ======================================================
// ERROR HELPER
// ======================================================

function httpError(status, message) {
  const error = new Error(message);

  error.status = status;

  return error;
}


// ======================================================
// ORDER NUMBER
// ======================================================

function generateOrderNumber() {
  const time = Date.now()
    .toString(36)
    .toUpperCase();

  const random = crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase();

  return `GD-${time}-${random}`;
}


// ======================================================
// RETURN REQUEST NUMBER
// ======================================================

function generateReturnNumber() {
  const time = Date.now()
    .toString(36)
    .toUpperCase();

  const random = crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase();

  return `RET-${time}-${random}`;
}


// ======================================================
// CLEAN STRING
// ======================================================

function cleanString(
  value,
  maxLength = 300
) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}


// ======================================================
// CLEAN + VALIDATE ADDRESS
// ======================================================

function cleanAddress(value = {}) {
  const address = {
    fullName: cleanString(
      value.fullName ||
        value.name,
      100
    ),

    email: cleanString(
      value.email,
      150
    ).toLowerCase(),

    phone: cleanString(
      value.phone,
      20
    ),

    addressLine: cleanString(
      value.addressLine ||
        value.address,
      200
    ),

    landmark: cleanString(
      value.landmark,
      150
    ),

    city: cleanString(
      value.city,
      100
    ),

    state: cleanString(
      value.state,
      100
    ),

    pincode: cleanString(
      value.pincode,
      10
    ),

    label:
      cleanString(
        value.label ||
          "Home",
        30
      ) ||
      "Home",
  };


  if (
    address.fullName.length <
    2
  ) {
    throw httpError(
      400,
      "Enter your full name."
    );
  }


  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      address.email
    )
  ) {
    throw httpError(
      400,
      "Enter a valid email."
    );
  }


  if (
    !/^[6-9]\d{9}$/.test(
      address.phone
    )
  ) {
    throw httpError(
      400,
      "Enter a valid 10-digit Indian mobile number."
    );
  }


  if (
    address.addressLine.length <
    5
  ) {
    throw httpError(
      400,
      "Enter your house number and street."
    );
  }


  if (!address.city) {
    throw httpError(
      400,
      "Enter your city."
    );
  }


  if (!address.state) {
    throw httpError(
      400,
      "Enter your state."
    );
  }


  if (
    !/^[1-9]\d{5}$/.test(
      address.pincode
    )
  ) {
    throw httpError(
      400,
      "Enter a valid 6-digit pincode."
    );
  }


  return {
    ...address,
    name: address.fullName,
  };
}


// ======================================================
// CLEAN ORDER ITEMS
// ======================================================

function normalizeRequestedItems(items) {
  if (
    !Array.isArray(items) ||
    !items.length
  ) {
    throw httpError(
      400,
      "Your order is empty."
    );
  }


  if (
    items.length >
    50
  ) {
    throw httpError(
      400,
      "Too many order items."
    );
  }


  const rows = new Map();


  for (const raw of items) {
    const id = cleanString(
      raw?.id ||
        raw?.productId ||
        raw?.product,
      100
    );


    const quantity =
      Number(
        raw?.quantity
      );


    if (!id) {
      throw httpError(
        400,
        "An order item is missing its product ID."
      );
    }


    if (
      !Number.isSafeInteger(
        quantity
      ) ||
      quantity < 1 ||
      quantity > 99
    ) {
      throw httpError(
        400,
        "Choose a whole-number quantity between 1 and 99."
      );
    }


    const selectedSize =
      raw?.selectedSize ==
      null
        ? null
        : cleanString(
            raw.selectedSize,
            50
          );


    const selectedColor =
      raw?.selectedColor ==
      null
        ? null
        : cleanString(
            raw.selectedColor,
            50
          );


    const key =
      JSON.stringify([
        id,
        selectedSize,
        selectedColor,
      ]);


    const previous =
      rows.get(key);


    if (previous) {
      const total =
        previous.quantity +
        quantity;


      if (total > 99) {
        throw httpError(
          400,
          "Quantity is too large."
        );
      }


      previous.quantity =
        total;

    } else {
      rows.set(
        key,
        {
          id,
          quantity,
          selectedSize,
          selectedColor,
        }
      );
    }
  }


  return [
    ...rows.values(),
  ];
}


// ======================================================
// FIND PRODUCT
// ======================================================

async function findProduct(
  id,
  session
) {
  const text =
    String(id);


  if (
    mongoose.Types
      .ObjectId
      .isValid(text)
  ) {
    const byId =
      await Product
        .findById(text)
        .session(session);


    if (byId) {
      return byId;
    }
  }


  const legacyId =
    Number(text);


  if (
    Number.isSafeInteger(
      legacyId
    )
  ) {
    const byLegacy =
      await Product
        .findOne({
          legacyId,
        })
        .session(session);


    if (byLegacy) {
      return byLegacy;
    }
  }


  return Product
    .findOne({
      slug:
        text.toLowerCase(),
    })
    .session(session);
}


// ======================================================
// ORDER LOOKUP CONDITIONS
// ======================================================

function orderLookupConditions(id) {
  const conditions = [
    {
      orderNumber: id,
    },
  ];


  if (
    mongoose.Types
      .ObjectId
      .isValid(id)
  ) {
    conditions.push({
      _id: id,
    });
  }


  return conditions;
}


// ======================================================
// DELIVERY DATE
//
// Matches the frontend commerce.js rule:
// actual delivery time is required.
// ======================================================

function getDeliveredAt(order) {
  if (
    order?.delivery
      ?.deliveredAt
  ) {
    return order.delivery
      .deliveredAt;
  }


  const events =
    Array.isArray(
      order?.tracking
        ?.events
    )
      ? order.tracking
          .events
      : [];


  for (
    let index =
      events.length - 1;
    index >= 0;
    index--
  ) {
    if (
      events[index]
        ?.status ===
      "delivered"
    ) {
      return events[index]
        .timestamp ||
        null;
    }
  }


  return null;
}


// ======================================================
// COUPON FOR DATABASE
// ======================================================

function safeCoupon(coupon) {
  if (!coupon) {
    return {
      code: null,
      type: null,
      value: null,
      minimum: null,
    };
  }


  return {
    code:
      coupon.code,

    type:
      coupon.type,

    value:
      coupon.value,

    minimum:
      coupon.minimum,
  };
}


// ======================================================
// ORDER SENT TO FRONTEND
// ======================================================

function safeOrder(order) {
  const value =
    typeof order.toObject ===
    "function"
      ? order.toObject()
      : order;


  return {
    id:
      value.orderNumber,

    orderNumber:
      value.orderNumber,

    createdAt:
      value.createdAt,

    updatedAt:
      value.updatedAt,

    status:
      value.status,

    source:
      value.source,

    giftMessage:
      value.giftMessage ||
      "",

    orderNote:
      value.orderNote ||
      "",

    user: {
      id: String(
        value.user
      ),
    },

    customer:
      value.customer,

    shippingAddress:
      value.shippingAddress,

    items:
      (
        value.items ||
        []
      ).map(
        (item) => ({
          id:
            String(
              item.product
            ),

          productId:
            String(
              item.product
            ),

          legacyId:
            item.legacyId,

          slug:
            item.slug,

          sku:
            item.sku,

          name:
            item.name,

          brand:
            item.brand,

          image:
            item.image,

          originalPrice:
            item.originalPrice,

          price:
            item.price,

          discount:
            item.discount,

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

    pricing:
      value.pricing,

    coupon:
      value.coupon,

    payment:
      value.payment,

    paymentMethod:
      value.paymentMethod,

    delivery:
      value.delivery,

    deliveryMethod:
      value.deliveryMethod,

    tracking:
      value.tracking,

    cancellation:
      value.cancellation,

    returnRequest:
      value.returnRequest,

    refund:
      value.refund,

    metadata: {
      ...value.metadata,

      checkoutToken:
        value.checkoutToken,
    },
  };
}


// ======================================================
// CREATE ORDER
// ======================================================

async function createOrder(
  req,
  res
) {
  const userId =
    req.user._id;


  const checkoutToken =
    cleanString(
      req.body
        ?.checkoutToken,
      200
    );


  if (!checkoutToken) {
    return res
      .status(400)
      .json({
        success: false,

        message:
          "Checkout token is missing. Refresh checkout and try again.",
      });
  }


  try {
    const existing =
      await Order.findOne({
        user:
          userId,

        checkoutToken,
      });


    if (existing) {
      return res
        .status(200)
        .json({
          success: true,

          existing: true,

          order:
            safeOrder(
              existing
            ),
        });
    }


    const requestedItems =
      normalizeRequestedItems(
        req.body?.items
      );


    const shippingAddress =
      cleanAddress(
        req.body
          ?.shippingAddress
      );


    const deliveryMethod =
      req.body
        ?.deliveryMethod ===
      "express"
        ? "express"
        : "standard";


    const source =
      [
        "cart",
        "selection",
        "buy-now",
      ].includes(
        req.body?.source
      )
        ? req.body.source
        : "cart";


    const coupon =
      resolveCoupon(
        req.body?.coupon
      );


    const expectedTotal =
      Number(
        req.body
          ?.expectedTotal
      );


    const giftMessage =
      cleanString(
        req.body
          ?.giftMessage,
        250
      );


    const orderNote =
      cleanString(
        req.body
          ?.orderNote,
        300
      );


    const session =
      await mongoose
        .startSession();


    let savedOrder =
      null;


    let wasExisting =
      false;


    try {
      await session
        .withTransaction(
          async () => {
            const duplicate =
              await Order
                .findOne({
                  user:
                    userId,

                  checkoutToken,
                })
                .session(
                  session
                );


            if (duplicate) {
              savedOrder =
                duplicate;

              wasExisting =
                true;

              return;
            }


            const productCache =
              new Map();


            const touchedProducts =
              new Map();


            const orderItems =
              [];


            for (
              const requested
              of requestedItems
            ) {
              let product =
                productCache.get(
                  requested.id
                );


              if (!product) {
                product =
                  await findProduct(
                    requested.id,
                    session
                  );


                if (!product) {
                  throw httpError(
                    409,
                    "A product in your bag is no longer available."
                  );
                }


                productCache.set(
                  requested.id,
                  product
                );
              }


              if (
                product.isActive ===
                false
              ) {
                throw httpError(
                  409,
                  `${product.name} is no longer available.`
                );
              }


              const sizes =
                (
                  product.sizes ||
                  []
                ).map(String);


              const colors =
                (
                  product.colors ||
                  []
                ).map(String);


              const selectedSize =
                sizes.length
                  ? requested
                      .selectedSize
                  : null;


              const selectedColor =
                colors.length
                  ? requested
                      .selectedColor
                  : null;


              const available =
                getVariantStock(
                  product,
                  selectedSize,
                  selectedColor
                );


              if (
                available <
                requested.quantity
              ) {
                throw httpError(
                  409,

                  available > 0
                    ? `Only ${available} available for ${product.name}.`
                    : `${product.name} is out of stock for this selection.`
                );
              }


              const originalPrice =
                getOriginalPrice(
                  product
                );


              const price =
                getDiscountedPrice(
                  product
                );


              orderItems.push({
                product:
                  product._id,

                legacyId:
                  product.legacyId ??
                  null,

                slug:
                  product.slug ||
                  "",

                sku:
                  product.sku ||
                  "",

                name:
                  product.name,

                brand:
                  product.brand ||
                  "",

                image:
                  product.image ||
                  "",

                originalPrice,

                price,

                discount:
                  Math.max(
                    0,
                    Math.min(
                      100,
                      Number(
                        product.discount ||
                          0
                      )
                    )
                  ),

                quantity:
                  requested.quantity,

                selectedSize,

                selectedColor,

                returnPolicy:
                  product.returnPolicy ||
                  "",
              });


              reserveVariantStock(
                product,
                requested.quantity,
                selectedSize,
                selectedColor
              );


              touchedProducts.set(
                String(
                  product._id
                ),
                product
              );
            }


            const pricing =
              calculateOrderPricing({
                cart:
                  orderItems,

                coupon,

                deliveryMethod,
              });


            if (
              Number.isFinite(
                expectedTotal
              ) &&
              Math.abs(
                roundMoney(
                  expectedTotal
                ) -
                  pricing.finalTotal
              ) >
                0.01
            ) {
              throw httpError(
                409,
                "Your order total changed. Review the latest total and place the order again."
              );
            }


            for (
              const product
              of touchedProducts
                .values()
            ) {
              await product.save({
                session,
              });
            }


            const orderNumber =
              generateOrderNumber();


            const created =
              await Order.create(
                [
                  {
                    orderNumber,

                    user:
                      userId,

                    checkoutToken,

                    source,

                    status:
                      "confirmed",

                    giftMessage,

                    orderNote,

                    customer: {
                      name:
                        shippingAddress.fullName,

                      email:
                        shippingAddress.email,

                      phone:
                        shippingAddress.phone,
                    },

                    shippingAddress,

                    items:
                      orderItems,

                    pricing: {
                      ...pricing,

                      currency:
                        "INR",
                    },

                    coupon:
                      safeCoupon(
                        coupon
                      ),

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
                      method:
                        deliveryMethod,

                      status:
                        "pending",

                      label:
                        deliveryMethod ===
                        "express"
                          ? "Express delivery"
                          : "Standard delivery",

                      estimatedTime:
                        null,

                      deliveredAt:
                        null,
                    },

                    deliveryMethod,

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
                            "Order confirmed by GymDrobe.",

                          timestamp:
                            new Date(),
                        },
                      ],
                    },

                    cancellation: {
                      status:
                        "not-cancelled",

                      reason:
                        "",

                      cancelledAt:
                        null,

                      inventoryRestoredAt:
                        null,
                    },

                    returnRequest: {
                      id:
                        null,

                      type:
                        null,

                      status:
                        "not-requested",

                      items:
                        [],

                      reason:
                        "",

                      requestedAt:
                        null,

                      response:
                        "",

                      respondedAt:
                        null,
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
                    },
                  },
                ],

                {
                  session,
                }
              );


            savedOrder =
              created[0];
          }
        );

    } finally {
      await session
        .endSession();
    }


    if (!savedOrder) {
      throw new Error(
        "Order was not created."
      );
    }


    return res
      .status(
        wasExisting
          ? 200
          : 201
      )
      .json({
        success: true,

        existing:
          wasExisting,

        order:
          safeOrder(
            savedOrder
          ),
      });

  } catch (error) {
    console.error(
      "Create order error:",
      error
    );


    if (
      error?.code ===
      11000
    ) {
      const existing =
        await Order.findOne({
          user:
            userId,

          checkoutToken,
        });


      if (existing) {
        return res
          .status(200)
          .json({
            success: true,

            existing: true,

            order:
              safeOrder(
                existing
              ),
          });
      }
    }


    return res
      .status(
        error.status ||
        500
      )
      .json({
        success: false,

        message:
          error.message ||
          "Unable to place order.",
      });
  }
}


// ======================================================
// GET CURRENT CUSTOMER'S ORDERS
// ======================================================

async function getOrders(
  req,
  res
) {
  try {
    const orders =
      await Order
        .find({
          user:
            req.user._id,
        })
        .sort({
          createdAt:
            -1,
        });


    return res
      .status(200)
      .json({
        success: true,

        count:
          orders.length,

        orders:
          orders.map(
            safeOrder
          ),
      });

  } catch (error) {
    console.error(
      "Get orders error:",
      error
    );


    return res
      .status(500)
      .json({
        success: false,

        message:
          "Unable to load orders.",
      });
  }
}


// ======================================================
// GET ONE CURRENT CUSTOMER ORDER
// ======================================================

async function getOrderById(
  req,
  res
) {
  try {
    const id =
      cleanString(
        req.params.id,
        150
      );


    const order =
      await Order.findOne({
        user:
          req.user._id,

        $or:
          orderLookupConditions(
            id
          ),
      });


    if (!order) {
      return res
        .status(404)
        .json({
          success: false,

          message:
            "Order not found.",
        });
    }


    return res
      .status(200)
      .json({
        success: true,

        order:
          safeOrder(
            order
          ),
      });

  } catch (error) {
    console.error(
      "Get order error:",
      error
    );


    return res
      .status(500)
      .json({
        success: false,

        message:
          "Unable to load order.",
      });
  }
}


// ======================================================
// CANCEL CURRENT CUSTOMER ORDER
// ======================================================

async function cancelOrder(
  req,
  res
) {
  const userId =
    req.user._id;


  const id =
    cleanString(
      req.params.id,
      150
    );


  const reason =
    cleanString(
      req.body?.reason,
      500
    );


  if (
    reason.length <
    5
  ) {
    return res
      .status(400)
      .json({
        success: false,

        message:
          "Please enter a cancellation reason of at least 5 characters.",
      });
  }


  const session =
    await mongoose
      .startSession();


  let savedOrder =
    null;


  let alreadyCancelled =
    false;


  try {
    await session
      .withTransaction(
        async () => {
          const order =
            await Order
              .findOne({
                user:
                  userId,

                $or:
                  orderLookupConditions(
                    id
                  ),
              })
              .session(
                session
              );


          if (!order) {
            throw httpError(
              404,
              "Order not found."
            );
          }


          if (
            order.status ===
              "cancelled" ||
            order.cancellation
              ?.status ===
              "cancelled"
          ) {
            alreadyCancelled =
              true;

            savedOrder =
              order;

            return;
          }


          if (
            ![
              "confirmed",
              "processing",
            ].includes(
              order.status
            )
          ) {
            throw httpError(
              409,
              "This order can no longer be cancelled because shipping has already started."
            );
          }


          const now =
            new Date();


          if (
            order.metadata
              ?.inventoryReserved !==
            false
          ) {
            const productCache =
              new Map();


            const touchedProducts =
              new Map();


            for (
              const item
              of order.items ||
              []
            ) {
              const productId =
                String(
                  item.product
                );


              let product =
                productCache.get(
                  productId
                );


              if (!product) {
                product =
                  await Product
                    .findById(
                      item.product
                    )
                    .session(
                      session
                    );


                if (!product) {
                  throw httpError(
                    409,
                    `Unable to restore inventory for ${item.name}. The product no longer exists.`
                  );
                }


                productCache.set(
                  productId,
                  product
                );
              }


              restoreVariantStock(
                product,
                item.quantity,
                item.selectedSize,
                item.selectedColor
              );


              touchedProducts.set(
                productId,
                product
              );
            }


            for (
              const product
              of touchedProducts
                .values()
            ) {
              await product.save({
                session,
              });
            }


            order.metadata
              .inventoryReserved =
              false;
          }


          order.status =
            "cancelled";


          order.cancellation = {
            status:
              "cancelled",

            reason,

            cancelledAt:
              now,

            inventoryRestoredAt:
              now,
          };


          if (
            order.delivery
          ) {
            order.delivery.status =
              "cancelled";
          }


          if (
            !order.tracking
          ) {
            order.tracking = {
              carrier:
                null,

              trackingNumber:
                null,

              estimatedDelivery:
                null,

              events:
                [],
            };
          }


          if (
            !Array.isArray(
              order.tracking
                .events
            )
          ) {
            order.tracking.events =
              [];
          }


          order.tracking
            .events.push({
              status:
                "cancelled",

              description:
                "Order cancelled by customer.",

              timestamp:
                now,
            });


          await order.save({
            session,
          });


          savedOrder =
            order;
        }
      );


    if (!savedOrder) {
      throw new Error(
        "Order cancellation failed."
      );
    }


    return res
      .status(200)
      .json({
        success: true,

        existing:
          alreadyCancelled,

        message:
          alreadyCancelled
            ? "This order is already cancelled."
            : "Order cancelled successfully.",

        order:
          safeOrder(
            savedOrder
          ),
      });

  } catch (error) {
    console.error(
      "Cancel order error:",
      error
    );


    return res
      .status(
        error.status ||
        500
      )
      .json({
        success: false,

        message:
          error.message ||
          "Unable to cancel order.",
      });

  } finally {
    await session
      .endSession();
  }
}


// ======================================================
// CREATE RETURN / EXCHANGE REQUEST
// ======================================================

async function requestReturn(
  req,
  res
) {
  const userId =
    req.user._id;


  const id =
    cleanString(
      req.params.id,
      150
    );


  const type =
    cleanString(
      req.body?.type,
      20
    ).toLowerCase();


  const reason =
    cleanString(
      req.body?.reason,
      1000
    );


  const requestedItems =
    Array.isArray(
      req.body?.items
    )
      ? req.body.items
      : [];


  // ====================================================
  // BASIC REQUEST VALIDATION
  // ====================================================

  if (
    ![
      "return",
      "exchange",
    ].includes(type)
  ) {
    return res
      .status(400)
      .json({
        success: false,

        message:
          "Choose return or exchange.",
      });
  }


  if (
    reason.length <
    5
  ) {
    return res
      .status(400)
      .json({
        success: false,

        message:
          "Please describe the reason in at least 5 characters.",
      });
  }


  if (
    !requestedItems.length
  ) {
    return res
      .status(400)
      .json({
        success: false,

        message:
          "Select at least one item.",
      });
  }


  if (
    requestedItems.length >
    50
  ) {
    return res
      .status(400)
      .json({
        success: false,

        message:
          "Too many return items.",
      });
  }


  const session =
    await mongoose
      .startSession();


  let savedOrder =
    null;


  try {
    await session
      .withTransaction(
        async () => {
          // ============================================
          // FIND ONLY THE LOGGED-IN CUSTOMER'S ORDER
          // ============================================

          const order =
            await Order
              .findOne({
                user:
                  userId,

                $or:
                  orderLookupConditions(
                    id
                  ),
              })
              .session(
                session
              );


          if (!order) {
            throw httpError(
              404,
              "Order not found."
            );
          }


          // ============================================
          // ORDER MUST BE DELIVERED
          // ============================================

          if (
            order.status !==
            "delivered"
          ) {
            throw httpError(
              409,
              "Returns and exchanges open after delivery."
            );
          }


          // ============================================
          // ONLY ONE ACTIVE REQUEST
          //
          // Matches frontend commerce.js:
          // not-requested or rejected can submit.
          // ============================================

          const currentStatus =
            order.returnRequest
              ?.status ||
            "not-requested";


          if (
            currentStatus !==
              "not-requested" &&
            currentStatus !==
              "rejected"
          ) {
            throw httpError(
              409,
              "A return or exchange request is already recorded for this order."
            );
          }


          // ============================================
          // REAL DELIVERY DATE REQUIRED
          // ============================================

          const deliveredAt =
            getDeliveredAt(
              order
            );


          const deliveryTime =
            Date.parse(
              deliveredAt
            );


          const now =
            Date.now();


          if (
            !Number.isFinite(
              deliveryTime
            ) ||
            deliveryTime >
              now
          ) {
            throw httpError(
              409,
              "Contact support to confirm the delivery date and return eligibility."
            );
          }


          // ============================================
          // 7-DAY RETURN WINDOW
          // ============================================

          const deadline =
            deliveryTime +
            7 *
              86400000;


          if (
            now >
            deadline
          ) {
            throw httpError(
              409,
              "The 7-day request window has ended. Contact support for help."
            );
          }


          // ============================================
          // VALIDATE REQUESTED ITEMS
          // ============================================

          const seen =
            new Set();


          const cleanItems =
            [];


          for (
            const raw
            of requestedItems
          ) {
            const index =
              Number(
                raw?.index
              );


            const quantity =
              Number(
                raw?.quantity
              );


            if (
              !Number.isSafeInteger(
                index
              ) ||
              index < 0 ||
              seen.has(
                index
              )
            ) {
              throw httpError(
                400,
                "Choose valid item quantities."
              );
            }


            const item =
              order.items[
                index
              ];


            if (
              !item ||
              !Number.isSafeInteger(
                quantity
              ) ||
              quantity < 1 ||
              quantity >
                item.quantity
            ) {
              throw httpError(
                400,
                "Choose valid item quantities."
              );
            }


            let size =
              raw?.size ==
              null
                ? null
                : cleanString(
                    raw.size,
                    50
                  );


            let color =
              raw?.color ==
              null
                ? null
                : cleanString(
                    raw.color,
                    50
                  );


            // ==========================================
            // EXCHANGE VALIDATION
            // ==========================================

            if (
              type ===
              "exchange"
            ) {
              const product =
                await Product
                  .findById(
                    item.product
                  )
                  .session(
                    session
                  );


              if (
                !product ||
                product.isActive ===
                  false
              ) {
                throw httpError(
                  409,
                  `${item.name}: This product is no longer available.`
                );
              }


              const sizes =
                (
                  product.sizes ||
                  []
                ).map(String);


              const colors =
                (
                  product.colors ||
                  []
                ).map(String);


              size =
                sizes.length
                  ? size
                  : null;


              color =
                colors.length
                  ? color
                  : null;


              /*
                getVariantStock performs the same
                size / colour availability check
                used by checkout.

                IMPORTANT:
                We only CHECK stock here.
                We do NOT reserve replacement stock.
              */

              const available =
                getVariantStock(
                  product,
                  size,
                  color
                );


              if (
                available <
                quantity
              ) {
                throw httpError(
                  409,

                  available > 0
                    ? `${item.name}: Only ${available} available for this selection.`
                    : `${item.name}: This selection is out of stock.`
                );
              }


              const sameSize =
                (
                  size ??
                  null
                ) ===
                (
                  item.selectedSize ??
                  null
                );


              const sameColor =
                (
                  color ??
                  null
                ) ===
                (
                  item.selectedColor ??
                  null
                );


              if (
                sameSize &&
                sameColor
              ) {
                throw httpError(
                  400,
                  "Choose a different size or colour for an exchange."
                );
              }

            } else {
              // Normal returns do not need replacement variants.
              size =
                null;

              color =
                null;
            }


            cleanItems.push({
              index,
              quantity,
              size,
              color,
            });


            seen.add(
              index
            );
          }


          // ============================================
          // SAVE REQUEST
          // ============================================

          const requestedAt =
            new Date();


          order.returnRequest = {
            id:
              generateReturnNumber(),

            type,

            status:
              "requested",

            items:
              cleanItems,

            reason,

            requestedAt,

            response:
              "",

            respondedAt:
              null,
          };


          if (
            !order.tracking
          ) {
            order.tracking = {
              carrier:
                null,

              trackingNumber:
                null,

              estimatedDelivery:
                null,

              events:
                [],
            };
          }


          if (
            !Array.isArray(
              order.tracking
                .events
            )
          ) {
            order.tracking.events =
              [];
          }


          order.tracking
            .events.push({
              status:
                "return-requested",

              description:
                type ===
                "exchange"
                  ? "Exchange request submitted by customer."
                  : "Return request submitted by customer.",

              timestamp:
                requestedAt,
            });


          await order.save({
            session,
          });


          savedOrder =
            order;
        }
      );


    if (!savedOrder) {
      throw new Error(
        "Return request was not created."
      );
    }


    return res
      .status(201)
      .json({
        success: true,

        message:
          type ===
          "exchange"
            ? "Exchange request submitted successfully."
            : "Return request submitted successfully.",

        order:
          safeOrder(
            savedOrder
          ),

        returnRequest:
          savedOrder
            .returnRequest,
      });

  } catch (error) {
    console.error(
      "Return request error:",
      error
    );


    return res
      .status(
        error.status ||
        500
      )
      .json({
        success: false,

        message:
          error.message ||
          "Unable to submit return request.",
      });

  } finally {
    await session
      .endSession();
  }
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  cancelOrder,
  requestReturn,
};