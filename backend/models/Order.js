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

        ref:
          "Product",

        required:
          true,
      },


      legacyId: {
        type:
          Number,

        default:
          null,
      },


      slug: {
        type:
          String,

        default:
          "",
      },


      sku: {
        type:
          String,

        default:
          "",
      },


      name: {
        type:
          String,

        required:
          true,
      },


      brand: {
        type:
          String,

        default:
          "",
      },


      image: {
        type:
          String,

        default:
          "",
      },


      originalPrice: {
        type:
          Number,

        required:
          true,

        min:
          0,
      },


      price: {
        type:
          Number,

        required:
          true,

        min:
          0,
      },


      discount: {
        type:
          Number,

        default:
          0,

        min:
          0,

        max:
          100,
      },


      quantity: {
        type:
          Number,

        required:
          true,

        min:
          1,
      },


      selectedSize: {
        type:
          String,

        default:
          null,
      },


      selectedColor: {
        type:
          String,

        default:
          null,
      },


      returnPolicy: {
        type:
          String,

        default:
          "",
      },
    },

    {
      _id:
        false,
    }
  );


// ======================================================
// SHIPPING ADDRESS
// ======================================================

const shippingAddressSchema =
  new mongoose.Schema(
    {
      fullName: {
        type:
          String,

        required:
          true,
      },


      name: {
        type:
          String,

        required:
          true,
      },


      email: {
        type:
          String,

        required:
          true,
      },


      phone: {
        type:
          String,

        required:
          true,
      },


      addressLine: {
        type:
          String,

        required:
          true,
      },


      landmark: {
        type:
          String,

        default:
          "",
      },


      city: {
        type:
          String,

        required:
          true,
      },


      state: {
        type:
          String,

        required:
          true,
      },


      pincode: {
        type:
          String,

        required:
          true,
      },


      label: {
        type:
          String,

        default:
          "Home",
      },
    },

    {
      _id:
        false,
    }
  );


// ======================================================
// PRICING
// ======================================================

const pricingSchema =
  new mongoose.Schema(
    {
      subtotal: {
        type:
          Number,

        required:
          true,

        min:
          0,
      },


      couponDiscount: {
        type:
          Number,

        default:
          0,

        min:
          0,
      },


      totalAfterCoupon: {
        type:
          Number,

        required:
          true,

        min:
          0,
      },


      shipping: {
        type:
          Number,

        required:
          true,

        min:
          0,
      },


      finalTotal: {
        type:
          Number,

        required:
          true,

        min:
          0,
      },


      currency: {
        type:
          String,

        default:
          "INR",
      },
    },

    {
      _id:
        false,
    }
  );


// ======================================================
// TRACKING EVENT
// ======================================================

const trackingEventSchema =
  new mongoose.Schema(
    {
      status: {
        type:
          String,

        required:
          true,
      },


      description: {
        type:
          String,

        default:
          "",
      },


      timestamp: {
        type:
          Date,

        default:
          Date.now,
      },
    },

    {
      _id:
        false,
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
        type:
          Number,

        required:
          true,

        min:
          0,
      },


      quantity: {
        type:
          Number,

        required:
          true,

        min:
          1,
      },


      /*
        For exchange requests these contain
        the requested replacement variant.

        For normal returns they remain null.
      */

      size: {
        type:
          String,

        default:
          null,
      },


      color: {
        type:
          String,

        default:
          null,
      },
    },

    {
      _id:
        false,
    }
  );


// ======================================================
// ORDER
// ======================================================

const orderSchema =
  new mongoose.Schema(
    {
      // ==================================================
      // ORDER ID
      // ==================================================

      orderNumber: {
        type:
          String,

        required:
          true,

        unique:
          true,

        index:
          true,
      },


      // ==================================================
      // OWNER
      // ==================================================

      user: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          "User",

        required:
          true,

        index:
          true,
      },


      // ==================================================
      // CHECKOUT IDEMPOTENCY
      // ==================================================

      checkoutToken: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },


      // ==================================================
      // SOURCE
      // ==================================================

      source: {
        type:
          String,

        enum: [
          "cart",
          "selection",
          "buy-now",
        ],

        default:
          "cart",
      },


      // ==================================================
      // ORDER STATUS
      // ==================================================

      status: {
        type:
          String,

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

        index:
          true,
      },


      // ==================================================
      // OPTIONAL ORDER DETAILS
      // ==================================================

      giftMessage: {
        type:
          String,

        default:
          "",

        maxlength:
          250,
      },


      orderNote: {
        type:
          String,

        default:
          "",

        maxlength:
          300,
      },


      // ==================================================
      // CUSTOMER SNAPSHOT
      // ==================================================

      customer: {
        name: {
          type:
            String,

          required:
            true,
        },


        email: {
          type:
            String,

          required:
            true,
        },


        phone: {
          type:
            String,

          required:
            true,
        },
      },


      // ==================================================
      // SHIPPING ADDRESS
      // ==================================================

      shippingAddress: {
        type:
          shippingAddressSchema,

        required:
          true,
      },


      // ==================================================
      // ORDER ITEMS
      // ==================================================

      items: {
        type: [
          orderItemSchema,
        ],

        required:
          true,

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

        required:
          true,
      },


      // ==================================================
      // COUPON
      // ==================================================

      coupon: {
        code: {
          type:
            String,

          default:
            null,
        },


        type: {
          type:
            String,

          default:
            null,
        },


        value: {
          type:
            Number,

          default:
            null,
        },


        minimum: {
          type:
            Number,

          default:
            null,
        },
      },


      // ==================================================
      // PAYMENT
      // ==================================================

      payment: {
        method: {
          type:
            String,

          enum: [
            "cod",
          ],

          default:
            "cod",
        },


        status: {
          type:
            String,

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
          type:
            String,

          default:
            null,
        },
      },


      paymentMethod: {
        type:
          String,

        default:
          "cod",
      },


      // ==================================================
      // DELIVERY
      // ==================================================

      delivery: {
        method: {
          type:
            String,

          enum: [
            "standard",
            "express",
          ],

          default:
            "standard",
        },


        status: {
          type:
            String,

          default:
            "pending",
        },


        label: {
          type:
            String,

          default:
            "Standard delivery",
        },


        estimatedTime: {
          type:
            String,

          default:
            null,
        },


        /*
          Real delivery timestamp.

          This is important because the
          7-day return/exchange window starts
          from delivery, not order creation.
        */

        deliveredAt: {
          type:
            Date,

          default:
            null,
        },
      },


      deliveryMethod: {
        type:
          String,

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
          type:
            String,

          default:
            null,
        },


        trackingNumber: {
          type:
            String,

          default:
            null,
        },


        estimatedDelivery: {
          type:
            Date,

          default:
            null,
        },


        events: {
          type: [
            trackingEventSchema,
          ],

          default:
            [],
        },
      },


      // ==================================================
      // CANCELLATION
      // ==================================================

      cancellation: {
        status: {
          type:
            String,

          enum: [
            "not-cancelled",
            "cancelled",
          ],

          default:
            "not-cancelled",
        },


        reason: {
          type:
            String,

          default:
            "",

          maxlength:
            500,
        },


        cancelledAt: {
          type:
            Date,

          default:
            null,
        },


        /*
          Prevents cancellation stock from
          accidentally being restored twice.
        */

        inventoryRestoredAt: {
          type:
            Date,

          default:
            null,
        },
      },


      // ==================================================
      // RETURN / EXCHANGE REQUEST
      // ==================================================

      returnRequest: {
        /*
          Example:
          RET-MABC123-9F12AA
        */

        id: {
          type:
            String,

          default:
            null,
        },


        /*
          null before any request exists.
        */

        type: {
          type:
            String,

          default:
            null,

          validate: {
            validator(
              value
            ) {
              return (
                value ==
                  null ||
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


        /*
          Lifecycle:

          not-requested
                ↓
             requested
             ↙      ↘
        approved   rejected
            ↓
        completed
        */

        status: {
          type:
            String,

          enum: [
            "not-requested",
            "requested",
            "approved",
            "rejected",
            "completed",
          ],

          default:
            "not-requested",

          index:
            true,
        },


        items: {
          type: [
            returnItemSchema,
          ],

          default:
            [],
        },


        reason: {
          type:
            String,

          default:
            "",

          maxlength:
            1000,
        },


        // Customer submitted request.

        requestedAt: {
          type:
            Date,

          default:
            null,
        },


        // Admin message shown to customer.

        response: {
          type:
            String,

          default:
            "",

          maxlength:
            1000,
        },


        /*
          Latest time admin responded to
          this request.
        */

        respondedAt: {
          type:
            Date,

          default:
            null,
        },


        // ==================================================
        // ADMIN DECISION TIMESTAMPS
        // ==================================================

        approvedAt: {
          type:
            Date,

          default:
            null,
        },


        rejectedAt: {
          type:
            Date,

          default:
            null,
        },


        completedAt: {
          type:
            Date,

          default:
            null,
        },


        // ==================================================
        // INVENTORY SAFETY
        // ==================================================

        /*
          Set when the customer's original
          returned variant has been put back
          into inventory.

          This prevents stock being restored twice.
        */

        originalInventoryRestoredAt: {
          type:
            Date,

          default:
            null,
        },


        /*
          Exchange only.

          Set after the replacement variant
          has been successfully reserved/deducted.

          This prevents the replacement stock
          being deducted more than once.
        */

        exchangeInventoryReservedAt: {
          type:
            Date,

          default:
            null,
        },
      },


      // ==================================================
      // REFUND
      // ==================================================

      refund: {
        /*
          Refund lifecycle:

          not-requested
                ↓
              pending
                ↓
          manual-required
                ↓
             refunded

          Exchanges use:
          not-applicable
        */

        status: {
          type:
            String,

          enum: [
            "not-requested",
            "pending",
            "manual-required",
            "refunded",
            "not-applicable",
          ],

          default:
            "not-requested",
        },


        /*
          Merchandise refund amount.

          Shipping is not automatically
          included in this amount.
        */

        amount: {
          type:
            Number,

          default:
            0,

          min:
            0,
        },


        /*
          When GymDrobe created the refund
          requirement.
        */

        requestedAt: {
          type:
            Date,

          default:
            null,
        },


        /*
          Reference entered by admin after the
          real/manual refund has actually been made.

          Example:
          UTR number / bank reference / internal reference.
        */

        reference: {
          type:
            String,

          default:
            "",

          maxlength:
            200,
        },


        /*
          Only set when the real refund has
          actually been recorded as completed.
        */

        refundedAt: {
          type:
            Date,

          default:
            null,
        },
      },


      // ==================================================
      // METADATA
      // ==================================================

      metadata: {
        version: {
          type:
            String,

          default:
            "5.0",
        },


        demo: {
          type:
            Boolean,

          default:
            true,
        },


        /*
          True while the original order's
          inventory reservation belongs to
          this order.

          Cancellation changes this to false
          after restoring stock.
        */

        inventoryReserved: {
          type:
            Boolean,

          default:
            true,
        },
      },
    },

    {
      timestamps:
        true,
    }
  );


// ======================================================
// INDEXES
// ======================================================

/*
  One checkout token can create only one
  order for the same customer.

  This protects against duplicate checkout
  submissions.
*/

orderSchema.index(
  {
    user:
      1,

    checkoutToken:
      1,
  },

  {
    unique:
      true,
  }
);


/*
  Customer orders page.
*/

orderSchema.index({
  user:
    1,

  createdAt:
    -1,
});


/*
  Admin Returns page.

  Makes it faster to find requested,
  approved, rejected and completed requests.
*/

orderSchema.index({
  "returnRequest.status":
    1,

  "returnRequest.requestedAt":
    -1,
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