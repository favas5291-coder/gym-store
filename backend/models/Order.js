const mongoose =
  require("mongoose");


// ======================================================
// ORDER ITEM
// ======================================================

const orderItemSchema =
  new mongoose.Schema(
    {
      product: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Product",

        required: true,
      },

      legacyId: {
        type: Number,

        default: null,
      },

      slug: {
        type: String,

        default: "",
      },

      sku: {
        type: String,

        default: "",
      },

      name: {
        type: String,

        required: true,
      },

      brand: {
        type: String,

        default: "",
      },

      image: {
        type: String,

        default: "",
      },

      originalPrice: {
        type: Number,

        required: true,

        min: 0,
      },

      price: {
        type: Number,

        required: true,

        min: 0,
      },

      discount: {
        type: Number,

        default: 0,

        min: 0,

        max: 100,
      },

      quantity: {
        type: Number,

        required: true,

        min: 1,
      },

      selectedSize: {
        type: String,

        default: null,
      },

      selectedColor: {
        type: String,

        default: null,
      },

      returnPolicy: {
        type: String,

        default: "",
      },
    },

    {
      _id: false,
    }
  );


// ======================================================
// SHIPPING ADDRESS
// ======================================================

const shippingAddressSchema =
  new mongoose.Schema(
    {
      fullName: {
        type: String,

        required: true,
      },

      name: {
        type: String,

        required: true,
      },

      email: {
        type: String,

        required: true,
      },

      phone: {
        type: String,

        required: true,
      },

      addressLine: {
        type: String,

        required: true,
      },

      landmark: {
        type: String,

        default: "",
      },

      city: {
        type: String,

        required: true,
      },

      state: {
        type: String,

        required: true,
      },

      pincode: {
        type: String,

        required: true,
      },

      label: {
        type: String,

        default: "Home",
      },
    },

    {
      _id: false,
    }
  );


// ======================================================
// PRICING
// ======================================================

const pricingSchema =
  new mongoose.Schema(
    {
      subtotal: {
        type: Number,

        required: true,

        min: 0,
      },

      couponDiscount: {
        type: Number,

        default: 0,

        min: 0,
      },

      totalAfterCoupon: {
        type: Number,

        required: true,

        min: 0,
      },

      shipping: {
        type: Number,

        required: true,

        min: 0,
      },

      finalTotal: {
        type: Number,

        required: true,

        min: 0,
      },

      currency: {
        type: String,

        default: "INR",
      },
    },

    {
      _id: false,
    }
  );


// ======================================================
// TRACKING EVENT
// ======================================================

const trackingEventSchema =
  new mongoose.Schema(
    {
      status: {
        type: String,

        required: true,
      },

      description: {
        type: String,

        default: "",
      },

      timestamp: {
        type: Date,

        default: Date.now,
      },
    },

    {
      _id: false,
    }
  );


// ======================================================
// RETURN / EXCHANGE ITEM
// ======================================================

const returnItemSchema =
  new mongoose.Schema(
    {
      /*
        Index of the item inside the original
        order.items array.
      */

      index: {
        type: Number,

        required: true,

        min: 0,
      },


      quantity: {
        type: Number,

        required: true,

        min: 1,
      },


      /*
        For exchange requests these contain
        the requested replacement variant.

        For normal returns they can remain null.
      */

      size: {
        type: String,

        default: null,
      },


      color: {
        type: String,

        default: null,
      },
    },

    {
      _id: false,
    }
  );


// ======================================================
// ORDER
// ======================================================

const orderSchema =
  new mongoose.Schema(
    {
      orderNumber: {
        type: String,

        required: true,

        unique: true,

        index: true,
      },


      user: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "User",

        required: true,

        index: true,
      },


      checkoutToken: {
        type: String,

        required: true,

        trim: true,
      },


      source: {
        type: String,

        enum: [
          "cart",
          "selection",
          "buy-now",
        ],

        default:
          "cart",
      },


      status: {
        type: String,

        enum: [
          "confirmed",
          "processing",
          "shipped",
          "out-for-delivery",
          "delivered",
          "cancelled",
        ],

        default:
          "confirmed",

        index: true,
      },


      giftMessage: {
        type: String,

        default: "",

        maxlength: 250,
      },


      orderNote: {
        type: String,

        default: "",

        maxlength: 300,
      },


      // ==================================================
      // CUSTOMER SNAPSHOT
      // ==================================================

      customer: {
        name: {
          type: String,

          required: true,
        },

        email: {
          type: String,

          required: true,
        },

        phone: {
          type: String,

          required: true,
        },
      },


      // ==================================================
      // SHIPPING ADDRESS
      // ==================================================

      shippingAddress: {
        type:
          shippingAddressSchema,

        required: true,
      },


      // ==================================================
      // ORDER ITEMS
      // ==================================================

      items: {
        type: [
          orderItemSchema,
        ],

        required: true,

        validate: {
          validator(
            value
          ) {
            return (
              Array.isArray(
                value
              ) &&
              value.length >
                0
            );
          },

          message:
            "Order must contain at least one item.",
        },
      },


      // ==================================================
      // PRICING
      // ==================================================

      pricing: {
        type:
          pricingSchema,

        required: true,
      },


      // ==================================================
      // COUPON
      // ==================================================

      coupon: {
        code: {
          type: String,

          default: null,
        },

        type: {
          type: String,

          default: null,
        },

        value: {
          type: Number,

          default: null,
        },

        minimum: {
          type: Number,

          default: null,
        },
      },


      // ==================================================
      // PAYMENT
      // ==================================================

      payment: {
        method: {
          type: String,

          enum: [
            "cod",
          ],

          default:
            "cod",
        },

        status: {
          type: String,

          enum: [
            "pending",
            "paid",
            "failed",
            "refunded",
          ],

          default:
            "pending",
        },

        transactionId: {
          type: String,

          default: null,
        },
      },


      paymentMethod: {
        type: String,

        default:
          "cod",
      },


      // ==================================================
      // DELIVERY
      // ==================================================

      delivery: {
        method: {
          type: String,

          enum: [
            "standard",
            "express",
          ],

          default:
            "standard",
        },

        status: {
          type: String,

          default:
            "pending",
        },

        label: {
          type: String,

          default:
            "Standard delivery",
        },

        estimatedTime: {
          type: String,

          default: null,
        },


        /*
          Actual delivery time.

          Returns use the real delivery date,
          never the order creation date.
        */

        deliveredAt: {
          type: Date,

          default: null,
        },
      },


      deliveryMethod: {
        type: String,

        enum: [
          "standard",
          "express",
        ],

        default:
          "standard",
      },


      // ==================================================
      // TRACKING
      // ==================================================

      tracking: {
        carrier: {
          type: String,

          default: null,
        },

        trackingNumber: {
          type: String,

          default: null,
        },

        estimatedDelivery: {
          type: Date,

          default: null,
        },

        events: {
          type: [
            trackingEventSchema,
          ],

          default: [],
        },
      },


      // ==================================================
      // CANCELLATION
      // ==================================================

      cancellation: {
        status: {
          type: String,

          enum: [
            "not-cancelled",
            "cancelled",
          ],

          default:
            "not-cancelled",
        },

        reason: {
          type: String,

          default: "",

          maxlength: 500,
        },

        cancelledAt: {
          type: Date,

          default: null,
        },

        inventoryRestoredAt: {
          type: Date,

          default: null,
        },
      },


      // ==================================================
      // RETURN / EXCHANGE REQUEST
      // ==================================================

      returnRequest: {
        id: {
          type: String,

          default: null,
        },


        type: {
          type: String,

          default: null,

          validate: {
            validator(
              value
            ) {
              return (
                value == null ||
                [
                  "return",
                  "exchange",
                ].includes(
                  value
                )
              );
            },

            message:
              "Invalid return request type.",
          },
        },


        status: {
          type: String,

          enum: [
            "not-requested",
            "requested",
            "approved",
            "rejected",
            "completed",
          ],

          default:
            "not-requested",
        },


        items: {
          type: [
            returnItemSchema,
          ],

          default: [],
        },


        reason: {
          type: String,

          default: "",

          maxlength: 1000,
        },


        requestedAt: {
          type: Date,

          default: null,
        },


        response: {
          type: String,

          default: "",

          maxlength: 1000,
        },


        respondedAt: {
          type: Date,

          default: null,
        },
      },


      // ==================================================
      // REFUND
      // ==================================================

      refund: {
        status: {
          type: String,

          default:
            "not-requested",
        },

        amount: {
          type: Number,

          default: 0,
        },
      },


      // ==================================================
      // METADATA
      // ==================================================

      metadata: {
        version: {
          type: String,

          default:
            "5.0",
        },

        demo: {
          type: Boolean,

          default: true,
        },

        inventoryReserved: {
          type: Boolean,

          default: true,
        },
      },
    },

    {
      timestamps: true,
    }
  );


// ======================================================
// INDEXES
// ======================================================

orderSchema.index(
  {
    user: 1,
    checkoutToken: 1,
  },

  {
    unique: true,
  }
);


orderSchema.index({
  user: 1,
  createdAt: -1,
});


// ======================================================
// MODEL
// ======================================================

const Order =
  mongoose.model(
    "Order",
    orderSchema
  );


module.exports =
  Order;