import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import {
  transformWithOxc,
} from "vite";

const h = (type, props, ...children) => ({
  type,
  props: props || {},
  children: children.flat(Infinity),
});

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(value);

function text(tree) {
  return tree && typeof tree === "object"
    ? tree.children.map(text).join(" ")
    : String(tree ?? "");
}

function nodes(tree) {
  return tree && typeof tree === "object"
    ? [
        tree,
        ...tree.children.flatMap(nodes),
      ]
    : [];
}

async function component(
  filename,
  dependencies,
  name,
) {
  const source = (
    await fs.readFile(
      new URL(
        `../src/${filename}`,
        import.meta.url,
      ),
      "utf8",
    )
  )
    .replace(/^import[\s\S]*?;\n/gm, "")
    .replace(
      "export default function",
      "function",
    );

  const result = await transformWithOxc(
    source,
    filename,
    {
      jsx: {
        runtime: "classic",
        pragma: "h",
        pragmaFrag: "Fragment",
      },
    },
  );

  return new Function(
    ...Object.keys(dependencies),
    "h",
    "Fragment",
    result.code + `\nreturn ${name};`,
  )(
    ...Object.values(dependencies),
    h,
    "fragment",
  );
}

const Summary = await component(
  "components/PurchasedKitSummary.jsx",
  { money },
  "PurchasedKitSummary",
);

const order = {
  id: "GD-TEST",
  status: "payment-pending",

  pricing: {
    subtotal: 300,
    kitDiscount: 30,
    couponDiscount: 0.01,
    shipping: 99,
    finalTotal: 368.99,
  },

  items: [
    {
      name: "Training shirt",
      selectedSize: "M",
      selectedColor: "Black",
      quantity: 3,
      price: 100,

      kit: {
        groupId: "kit-group-1",
        slotKey: "clothing",
      },

      priceAllocation: {
        lineSubtotalPaise: 30000,
        kitDiscountPaise: 3000,
        couponDiscountPaise: 1,
        linePaidPaise: 26999,
      },
    },
  ],

  kitSnapshots: [
    {
      groupId: "kit-group-1",
      name: "Beginner kit",
      kitDiscountPaise: 3000,
      couponDiscountPaise: 1,
      linePaidPaise: 26999,
    },
  ],

  shippingSnapshot: {
    packageCount: 1,
    paymentMethod: "cod-partial",

    shipments: [
      {
        key: "package-1",
        label: "Your kit",
        carrier: "Verified courier",
        service: "Standard",
        shippingPaise: 9900,
        amountDuePaise: 34199,

        contents: [
          {
            itemIndex: 0,
            name: "Training shirt",
            selectedSize: "M",
            selectedColor: "Black",
            quantity: 3,
          },
        ],

        estimatedDays: {
          minimum: 3,
          maximum: 6,
        },
      },
    ],
  },
};

test(
  "ordinary orders keep the existing screen without an empty kit panel",
  () => {
    assert.equal(
      Summary({
        order: {
          items: [],
        },
      }),
      null,
    );
  },
);

test(
  "purchased kits show exact allocated component totals and distinguish them from money collected",
  () => {
    const value = text(Summary({ order }));

    assert.match(value, /Beginner kit/);
    assert.match(value, /₹269\.99/);
    assert.match(value, /₹30\.00/);
    assert.match(value, /₹0\.01/);
    assert.match(value, /Black \/ M/);
    assert.match(value, /Allocated item total/);

    assert.match(
      value,
      /payment details show what has been collected/,
    );
  },
);

test(
  "package COD figures are labelled as original balances rather than the current payable balance",
  () => {
    const value = text(Summary({ order }));

    assert.match(
      value,
      /Delivery terms recorded at checkout/,
    );

    assert.match(
      value,
      /Original balance assigned to this package/,
    );

    assert.match(
      value,
      /current remaining balance/,
    );

    assert.match(value, /₹341\.99/);

    assert.match(
      value,
      /current delivery progress/,
    );
  },
);

test(
  "missing component allocations stay unknown and genuine zero savings stay zero",
  () => {
    const input = structuredClone(order);

    input.items[0].priceAllocation = {
      kitDiscountPaise: 0,
    };

    const value = text(
      Summary({ order: input }),
    );

    assert.match(value, /Not recorded/);
    assert.match(value, /₹0\.00/);
  },
);

test(
  "online package summaries omit the COD collection instruction",
  () => {
    const input = structuredClone(order);

    input.shippingSnapshot.paymentMethod = "razorpay";

    assert.doesNotMatch(
      text(Summary({ order: input })),
      /Original balance assigned/,
    );
  },
);

let csv;

const Receipt = await component(
  "pages/ReceiptPage.jsx",

  {
    money,

    Link: "Link",

    useParams: () => ({
      orderId: "GD-TEST",
    }),

    useCustomerOrder: () => ({
      order,
      loading: false,
      isAccountOrder: true,
    }),

    orderTotal: (order) =>
      order.pricing.finalTotal,

    csvCell: (value) =>
      String(value ?? ""),

    downloadText: (_name, value) => {
      csv = value;
    },

    EmptyState: "EmptyState",
    OrderPaymentDetails: "OrderPaymentDetails",
    PurchasedKitSummary: Summary,

    formatOrderDate: (value) =>
      String(value || "Not recorded"),

    formatOrderStatus: (value) => value,

    getPaymentRows: () => [],
  },

  "ReceiptPage",
);

test(
  "receipt CSV includes the kit name, exact allocated item total and kit savings",
  () => {
    const tree = Receipt();

    nodes(tree)
      .find(
        (row) =>
          row.type === "button" &&
          text(row) === "Download CSV",
      )
      .props.onClick();

    assert.match(
      csv,
      /Kit savings INR,30/,
    );

    assert.match(
      csv,
      /Training shirt,M,Black,3,100,300,Beginner kit,269\.99/,
    );

    assert.match(
      csv,
      /before order savings/,
    );
  },
);

test(
  "receipt shows kit savings and labels list prices before order discounts",
  () => {
    const tree = Receipt();

    assert.match(
      text(tree),
      /Kit savings/,
    );

    assert.match(
      text(tree),
      /before kit and coupon savings/,
    );

    assert.ok(
      nodes(tree).some(
        (row) =>
          row.type === Summary &&
          row.props.order === order,
      ),
    );
  },
);