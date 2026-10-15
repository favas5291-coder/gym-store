import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const text = fs
  .readFileSync(
    new URL(
      "../src/services/checkoutQuoteApi.js",
      import.meta.url,
    ),
    "utf8",
  )
  .replace(/^import[^\n]+;\n/gm, "")
  .replace(
    "import.meta.env.VITE_API_URL",
    "undefined",
  )
  .replace(/export /g, "");

const serviceModule = {
  exports: {},
};

let sent;

const context = {
  module: serviceModule,
  console,
  URL,
  Date,
  AbortController,
  setTimeout,
  clearTimeout,

  getKitGroup: (item) => item.kitGroup || null,

  fetch: async (url, options) => {
    sent = {
      url,
      body: JSON.parse(options.body),
    };

    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        quote: fixture(),
      }),
    };
  },
};

vm.runInNewContext(
  text +
    "\nmodule.exports = { verify, validShippingReview, getCheckoutQuote };",
  context,
);

const api = serviceModule.exports;

function fixture() {
  return {
    previewOnly: true,
    purchaseEnabled: false,
    inventoryReserved: false,
    shippingIsEstimate: false,
    method: "standard",

    items: [
      {
        product: "507f1f77bcf86cd799439011",
        name: "Shirt",
        price: 100,
        quantity: 2,
        kit: {
          groupId: "kit-group-1",
          slotKey: "clothing",
        },
        priceAllocation: {
          quantity: 2,
          lineSubtotalPaise: 20000,
          kitDiscountPaise: 2000,
          couponDiscountPaise: 0,
          linePaidPaise: 18000,
          unitBasePaise: 9000,
          extraPaiseUnits: 0,
        },
      },
    ],

    kitSnapshots: [
      {
        groupId: "kit-group-1",
        template: "507f1f77bcf86cd799439012",
        templateVersion: 0,
        name: "Beginner kit",
        subtotalPaise: 20000,
        kitDiscountPaise: 2000,
        couponDiscountPaise: 0,
        linePaidPaise: 18000,
      },
    ],

    pricing: {
      subtotal: 200,
      kitDiscount: 20,
      couponDiscount: 0,
      totalAfterCoupon: 180,
      shipping: 114,
      finalTotal: 294,
      currency: "INR",
    },

    payment: {
      method: "cod-partial",
      amountToPayNow: 18,
      amountDue: 276,
      advancePercentage: 10,
    },

    shippingReview: {
      ready: true,
      shippingPaise: 11400,
      packageCount: 1,

      validUntil: new Date(
        Date.now() + 86400000,
      ).toISOString(),

      shipments: [
        {
          key: "package-1",
          carrier: "Verified courier",
          shipping: 114,
          amountDueOnDelivery: 276,
          contents: [
            {
              itemIndex: 0,
              quantity: 2,
            },
          ],
        },
      ],
    },
  };
}

test(
  "client accepts confirmed kit shipping and verifies discounted COD advance",
  () => {
    const data = fixture();

    assert.equal(
      api.verify(data, "cod-partial", "standard"),
      data,
    );
  },
);

test(
  "client refuses missing packages, duplicate keys, wrong quantities and altered balances",
  () => {
    const changes = [
      (data) => {
        data.shippingReview.packageCount = 2;
      },
      (data) => {
        data.shippingReview.shipments[0].contents[0].quantity = 1;
      },
      (data) => {
        data.shippingReview.shipments[0].contents[0].itemIndex = 4;
      },
      (data) => {
        data.shippingReview.shipments[0].shipping = 0;
      },
      (data) => {
        data.shippingReview.shipments[0].amountDueOnDelivery = 275;
      },
      (data) => {
        data.payment.amountToPayNow = 20;
      },
      (data) => {
        data.shippingReview.validUntil = "2000-01-01";
      },
      (data) => {
        data.shippingReview.shipments.push(
          structuredClone(data.shippingReview.shipments[0]),
        );
      },
    ];

    for (const change of changes) {
      const data = fixture();

      change(data);

      assert.throws(() =>
        api.verify(data, "cod-partial", "standard"),
      );
    }
  },
);

test(
  "estimated quotes remain readable without pretending shipping is confirmed",
  () => {
    const data = fixture();

    data.shippingIsEstimate = true;

    delete data.shippingReview;

    assert.equal(
      api.verify(data, "cod-partial", "standard"),
      data,
    );
  },
);

test(
  "kit shipping request sends pincode and selection metadata, excluding client prices and sourcing",
  async () => {
    await api.getCheckoutQuote(
      "test-token",
      {
        items: [
          {
            id: "507f1f77bcf86cd799439011",
            quantity: 2,
            selectedSize: "M",
            selectedColor: "Black",
            price: 1,
            meeshoProductLink: "private",
            kitGroup: {
              id: "kit-group-1",
              kitId: "507f1f77bcf86cd799439012",
              version: 0,
              slotKey: "clothing",
            },
          },
        ],
        paymentMethod: "cod-partial",
        pincode: "682001",
      },
    );

    assert.equal(sent.body.pincode, "682001");

    assert.equal(
      sent.body.items[0].kitGroup.id,
      "kit-group-1",
    );

    assert.equal(
      Object.hasOwn(sent.body.items[0], "price"),
      false,
    );

    assert.equal(
      Object.hasOwn(
        sent.body.items[0],
        "meeshoProductLink",
      ),
      false,
    );
  },
);

test(
  "invalid destination pincode is rejected before calling the backend",
  async () => {
    sent = null;

    await assert.rejects(
      api.getCheckoutQuote(
        "test-token",
        {
          items: [
            {
              id: "507f1f77bcf86cd799439011",
              quantity: 1,
            },
          ],
          pincode: "123",
        },
      ),
    );

    assert.equal(sent, null);
  },
);