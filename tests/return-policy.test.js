import test from "node:test";
import assert from "node:assert/strict";

import {
  returnPolicyMarkup,
  returnRequestTypes,
} from "../src/utils/returnPolicy.js";

import {
  buyingInformation,
} from "../src/utils/productInformation.js";

import {
  draftFor,
  payloadFor,
  validateDraft,
} from "../src/utils/adminProductDraft.js";

import {
  itemReturnAvailability,
  returnPayload,
} from "../src/utils/customerReturns.js";

import {
  calculateOrderPricing,
} from "../src/utils/orderCalculations.js";

const productUrl =
  "https://www.gymdrobe.com/product/6ad2351ed8f991271e3d1a8b";

const product = {
  id: "6ad2351ed8f991271e3d1a8b",
  name: "Training shirt",
  category: "Clothing",
  brand: "GymDrobe",
  price: 699,
  stock: 5,
  discount: 0,
  isActive: false,
  returnsEligible: "yes",
  returnWindowDays: 7,
  returnRequestTypes: ["return", "exchange"],
  returnConditions: "Unused, unwashed, original tags.",
};

const delivered = Date.parse(
  "2026-10-01T12:00:00Z",
);

function order(item = product) {
  return {
    status: "delivered",

    items: [
      {
        ...item,
        quantity: 1,
      },
    ],

    delivery: {
      deliveredAt: new Date(delivered).toISOString(),
    },

    pricing: {
      finalTotal: 699,
    },

    payment: {
      method: "razorpay",
      status: "paid",
      totalAmount: 699,
      amountPaid: 699,
      amountDue: 0,
      verifiedAt: "2026-09-28T12:00:00Z",
      razorpayPaymentId: "pay_fixture",
    },
  };
}

test(
  "shipping uses 500 after coupons, 99 below it, and leaves express separate",
  () => {
    for (const [price, expected] of [
      [499, 99],
      [500, 0],
      [699, 0],
    ]) {
      const pricing = calculateOrderPricing({
        cart: [
          {
            price,
            quantity: 1,
          },
        ],
      });

      assert.equal(pricing.shipping, expected);
    }

    const express = calculateOrderPricing({
      cart: [
        {
          price: 500,
          quantity: 1,
        },
      ],
      deliveryMethod: "express",
    });

    assert.equal(express.shipping, 199);
  },
);

test(
  "admin loads the store shipping threshold and retains explicit supplier exceptions",
  () => {
    const draft = draftFor({
      ...product,

      delivery: {
        freeDeliveryAbove: 700,
      },

      returnWindowDays: 3,
      returnRequestTypes: ["exchange"],
    });

    assert.equal(
      draft.freeDeliveryAbove,
      "500",
    );

    assert.equal(
      draft.returnWindowDays,
      "3",
    );

    assert.deepEqual(
      draft.returnRequestTypes,
      ["exchange"],
    );

    assert.equal(
      validateDraft(draft),
      "",
    );

    assert.deepEqual(
      payloadFor(draft).returnRequestTypes,
      ["exchange"],
    );
  },
);

test(
  "new drafts suggest seven days without promising eligibility or allowing actions",
  () => {
    const draft = draftFor();

    assert.equal(
      draft.returnWindowDays,
      "7",
    );

    assert.equal(
      draft.returnsEligible,
      "unconfirmed",
    );

    assert.deepEqual(
      draft.returnRequestTypes,
      [],
    );
  },
);

test(
  "admin requires supported actions when confirming eligibility",
  () => {
    assert.match(
      validateDraft({
        ...draftFor(product),
        returnRequestTypes: [],
      }),
      /Confirm whether/,
    );

    assert.match(
      validateDraft({
        ...draftFor(product),
        returnRequestTypes: [
          "exchange",
          "exchange",
        ],
      }),
      /Confirm whether/,
    );
  },
);

test(
  "unrelated edits do not silently add return actions to legacy products",
  () => {
    const legacy = {
      ...product,
    };

    delete legacy.returnRequestTypes;

    const original = draftFor(legacy);

    const body = payloadFor(
      {
        ...original,
        name: "Renamed training shirt",
      },
      original,
    );

    assert.equal(
      body.returnRequestTypes,
      undefined,
    );
  },
);

test(
  "storefront describes a real three-day exchange-only policy without promising a refund",
  () => {
    const text = buyingInformation({
      ...product,
      returnWindowDays: 3,
      returnRequestTypes: ["exchange"],
    }).returns;

    assert.match(
      text,
      /Exchange requests.*3 days \(72 hours\)/,
    );

    assert.match(
      text,
      /Routine returns for a refund are not included/,
    );
  },
);

test(
  "legacy or unconfirmed catalogue fields do not create a Google return promise",
  () => {
    const legacy = {
      ...product,
    };

    delete legacy.returnRequestTypes;

    assert.equal(
      returnPolicyMarkup(
        legacy,
        productUrl,
      ),
      null,
    );

    assert.equal(
      returnPolicyMarkup(
        {
          ...product,
          returnsEligible: "unconfirmed",
        },
        productUrl,
      ),
      null,
    );

    assert.equal(
      returnPolicyMarkup(
        {
          ...product,
          returnConditions: "",
        },
        productUrl,
      ),
      null,
    );

    assert.match(
      buyingInformation(legacy).returns,
      /not been confirmed/,
    );
  },
);

test(
  "Google gets the recorded return window without invented return fees",
  () => {
    const schema = returnPolicyMarkup(
      product,
      productUrl,
    );

    assert.equal(
      schema.merchantReturnDays,
      7,
    );

    assert.equal(
      schema.applicableCountry,
      "IN",
    );

    assert.equal(
      schema.merchantReturnLink,
      `${productUrl}#delivery-returns`,
    );

    assert.equal(
      schema.returnFees,
      undefined,
    );

    assert.equal(
      schema.returnShippingFeesAmount,
      undefined,
    );
  },
);

test(
  "exchange-only metadata does not advertise a return-for-refund window",
  () => {
    const schema = returnPolicyMarkup(
      {
        ...product,
        returnWindowDays: 3,
        returnRequestTypes: ["exchange"],
      },
      productUrl,
    );

    assert.equal(
      schema.returnPolicyCategory,
      "https://schema.org/MerchantReturnNotPermitted",
    );

    assert.equal(
      schema.merchantReturnDays,
      undefined,
    );
  },
);

test(
  "customer requests enforce purchased action and the exact 72-hour deadline",
  () => {
    const purchase = order({
      ...product,
      returnWindowDays: 3,
      returnRequestTypes: ["exchange"],
    });

    const deadline =
      delivered + 3 * 86400000;

    assert.equal(
      itemReturnAvailability(
        purchase,
        purchase.items[0],
        deadline,
        "exchange",
      ).eligible,
      true,
    );

    assert.equal(
      itemReturnAvailability(
        purchase,
        purchase.items[0],
        deadline + 1,
        "exchange",
      ).eligible,
      false,
    );

    assert.equal(
      itemReturnAvailability(
        purchase,
        purchase.items[0],
        delivered + 86400000,
        "return",
      ).eligible,
      false,
    );

    assert.throws(
      () =>
        returnPayload(
          purchase,
          {
            0: {
              selected: true,
              quantity: 1,
            },
          },
          "return",
          "Wrong size received",
          [],
          true,
          delivered + 86400000,
        ),
      /exchanges only/,
    );
  },
);

test(
  "old purchases keep their original request behaviour",
  () => {
    const legacy = {
      ...product,
    };

    delete legacy.returnRequestTypes;

    assert.deepEqual(
      returnRequestTypes(
        legacy,
        {
          historical: true,
        },
      ),
      ["return", "exchange"],
    );

    const purchase = order(legacy);

    assert.equal(
      itemReturnAvailability(
        purchase,
        purchase.items[0],
        delivered + 86400000,
        "return",
      ).eligible,
      true,
    );
  },
);