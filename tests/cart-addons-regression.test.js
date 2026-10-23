import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

import { transformWithOxc } from "vite";

import {
  rankCartAddons,
  rankRelated,
} from "../src/utils/commerce.js";

import * as purchase from "../src/utils/productPurchase.js";
import * as inventory from "../src/utils/cartUtils.js";
import * as pricing from "../src/utils/productPricing.js";

import {
  optionLabels,
} from "../src/utils/productInformation.js";

import {
  selectedProductImage,
} from "../src/utils/productImages.js";

import {
  bagEditSignature,
} from "../src/utils/bagVariantEditing.js";

import {
  reviewCart,
} from "../src/utils/cartReview.js";

import {
  resolveCoupon,
} from "../src/utils/orderCalculations.js";

const product = (
  id,
  category,
  extra = {},
) => ({
  id,
  name: id,
  category,
  price: 200,
  discount: 0,
  stock: 5,
  sizes: [],
  colors: [],
  isActive: true,
  ...extra,
});

const protein = product(
  "protein",
  "Protein",
);

const shaker = product(
  "shaker",
  "Shaker Bottles",
);

const bottle = product(
  "bottle",
  "Water Bottles",
);

const bag = [
  {
    id: "protein",
    quantity: 1,
  },
];

const ids = (rows) =>
  rows.map((row) => row.product.id);

test(
  "protein recommends existing complementary categories without same-category fallback",
  () => {
    const rows = rankCartAddons(
      bag,
      [
        protein,
        bottle,
        shaker,
        product("other-protein", "Protein"),
      ],
    );

    assert.deepEqual(
      ids(rows),
      ["shaker", "bottle"],
    );

    assert.equal(
      rows[0].pricePaise,
      20000,
    );

    assert.equal(
      rows[0].recommendationType,
      "category",
    );

    assert.match(
      rows[0].reason,
      /protein/,
    );
  },
);

test(
  "clothing recommendations reuse the existing towel relationship",
  () => {
    const clothing = product(
      "shirt",
      "Workout Clothes",
    );

    const towel = product(
      "towel",
      "Gym Towels",
    );

    const rows = rankCartAddons(
      [{ id: "shirt", quantity: 1 }],
      [clothing, towel],
    );

    assert.deepEqual(
      ids(rows),
      ["towel"],
    );
  },
);

test(
  "cart aliases, other variants and kit components exclude the whole product",
  () => {
    const current = product(
      "shaker",
      "Shaker Bottles",
      {
        _id: "mongo-shaker",
        legacyId: "old-shaker",
      },
    );

    for (const row of [
      {
        id: "old-shaker",
        quantity: 1,
        kitGroup: { id: "kit" },
      },
      {
        product: "mongo-shaker",
        quantity: 1,
      },
      {
        product: {
          _id: "mongo-shaker",
        },
        quantity: 1,
      },
    ]) {
      assert.deepEqual(
        ids(
          rankCartAddons(
            [...bag, row],
            [protein, current, bottle],
          ),
        ),
        ["bottle"],
      );
    }
  },
);

test(
  "catalogue aliases cannot produce duplicate suggestion cards",
  () => {
    const first = {
      ...shaker,
      _id: "mongo-shaker",
    };

    const duplicate = {
      ...shaker,
      id: "mongo-shaker",
    };

    assert.deepEqual(
      ids(
        rankCartAddons(
          bag,
          [protein, first, duplicate],
        ),
      ),
      ["shaker"],
    );
  },
);

test(
  "inactive, undeliverable, retired and invalid-price candidates are omitted",
  () => {
    const candidates = [
      product(
        "inactive",
        "Shaker Bottles",
        { isActive: false },
      ),

      product(
        "blocked",
        "Shaker Bottles",
        {
          delivery: {
            available: false,
          },
        },
      ),

      product(
        "empty",
        "Shaker Bottles",
        { stock: 0 },
      ),

      product(
        "bad-price",
        "Shaker Bottles",
        { price: "" },
      ),

      product(
        "bad-discount",
        "Shaker Bottles",
        { discount: 101 },
      ),

      product(
        "overflow",
        "Shaker Bottles",
        {
          price: Number.MAX_SAFE_INTEGER,
        },
      ),

      product(
        "nan",
        "Shaker Bottles",
        { price: NaN },
      ),
    ];

    assert.deepEqual(
      rankCartAddons(
        bag,
        [protein, ...candidates],
      ),
      [],
    );
  },
);

test(
  "variant stock overrides stale totals and one valid combination is required",
  () => {
    const unavailable = product(
      "unavailable",
      "Shaker Bottles",
      {
        sizes: ["M"],
        colors: ["Black"],
        variants: {
          Black: { M: 0 },
        },
        stock: 100,
      },
    );

    const available = product(
      "available",
      "Shaker Bottles",
      {
        sizes: ["M", "L"],
        colors: ["Black"],
        variants: {
          Black: {
            M: 0,
            L: 2,
          },
        },
        stock: 0,
      },
    );

    const rows = rankCartAddons(
      bag,
      [protein, unavailable, available],
    );

    assert.deepEqual(
      ids(rows),
      ["available"],
    );

    assert.equal(
      rows[0].requiresOptions,
      true,
    );

    assert.equal(
      Object.hasOwn(
        rows[0],
        "selectedSize",
      ),
      false,
    );

    assert.equal(
      Object.hasOwn(
        rows[0],
        "selectedColor",
      ),
      false,
    );
  },
);

test(
  "an enabled configured pair outranks category suggestions and can cover equipment",
  () => {
    const equipment = product(
      "equipment",
      "Training Equipment",
    );

    const accessory = product(
      "accessory",
      "Equipment Accessories",
    );

    const catalogue = [
      equipment,
      accessory,
    ];

    const cart = [
      {
        id: "equipment",
        quantity: 1,
      },
    ];

    assert.deepEqual(
      rankCartAddons(
        cart,
        catalogue,
      ),
      [],
    );

    const rows = rankCartAddons(
      cart,
      catalogue,
      {
        configuredPairs: [
          {
            sourceId: "equipment",
            productId: "accessory",
            enabled: true,
          },
        ],
      },
    );

    assert.deepEqual(
      ids(rows),
      ["accessory"],
    );

    assert.equal(
      rows[0].recommendationType,
      "configured",
    );

    const ranked = rankCartAddons(
      bag,
      [protein, shaker, bottle],
      {
        configuredPairs: [
          {
            sourceId: "protein",
            productId: "bottle",
            enabled: true,
          },
        ],
      },
    );

    assert.deepEqual(
      ids(ranked),
      ["bottle", "shaker"],
    );
  },
);

test(
  "a disabled configured pair suppresses its category relationship",
  () => {
    const rows = rankCartAddons(
      bag,
      [protein, shaker, bottle],
      {
        configuredPairs: [
          {
            sourceId: "protein",
            productId: "shaker",
            enabled: false,
          },
        ],
      },
    );

    assert.deepEqual(
      ids(rows),
      ["bottle"],
    );
  },
);

test(
  "malformed configured pairs cannot make unrelated products relevant",
  () => {
    const unrelated = product(
      "unrelated",
      "Unrelated",
    );

    assert.deepEqual(
      rankCartAddons(
        bag,
        [protein, unrelated],
        {
          configuredPairs: [
            null,
            {
              sourceId: "protein",
              productId: "unrelated",
              enabled: "true",
            },
          ],
        },
      ),
      [],
    );
  },
);

test(
  "server-supplied delivery filters use aliases and fail closed when empty or malformed",
  () => {
    const current = {
      ...shaker,
      _id: "mongo-shaker",
    };

    const catalogue = [
      protein,
      current,
      bottle,
    ];

    assert.deepEqual(
      ids(
        rankCartAddons(
          bag,
          catalogue,
          {
            eligibleProductIds: [
              "mongo-shaker",
            ],
          },
        ),
      ),
      ["shaker"],
    );

    for (const eligibleProductIds of [
      [],
      null,
      "shaker",
    ]) {
      assert.deepEqual(
        rankCartAddons(
          bag,
          catalogue,
          { eligibleProductIds },
        ),
        [],
      );
    }
  },
);

test(
  "current catalogue prices replace old bag copies and preserve catalogue discount rounding",
  () => {
    const changed = {
      ...shaker,
      price: 199,
      discount: 10,
    };

    const rows = rankCartAddons(
      [
        {
          ...bag[0],
          category: "Wrong",
        },
      ],
      [protein, changed],
    );

    assert.equal(
      rows[0].pricePaise,
      17900,
    );
  },
);

test(
  "selection is stable, capped at three, and does not mutate inputs or add products",
  () => {
    const catalogue = [
      protein,
      ...["d", "c", "b", "a"].map(
        (id) =>
          product(
            id,
            "Shaker Bottles",
          ),
      ),
    ];

    const before = JSON.stringify({
      bag,
      catalogue,
    });

    assert.deepEqual(
      ids(
        rankCartAddons(
          bag,
          catalogue,
          { limit: 99 },
        ),
      ),
      ["d", "c", "b"],
    );

    assert.equal(
      rankCartAddons(
        bag,
        catalogue,
        { limit: 1 },
      ).length,
      1,
    );

    assert.deepEqual(
      rankCartAddons(
        bag,
        catalogue,
        { limit: 0 },
      ),
      [],
    );

    assert.equal(
      JSON.stringify({
        bag,
        catalogue,
      }),
      before,
    );

    assert.deepEqual(
      rankCartAddons(bag, catalogue),
      rankCartAddons(bag, catalogue),
    );
  },
);

test(
  "unavailable sources, missing products and malformed quantities do not create suggestions",
  () => {
    for (const cart of [
      null,
      [],
      [null],
      [
        {
          id: "retired",
          quantity: 1,
        },
      ],
      [
        {
          id: "protein",
          quantity: 0,
        },
      ],
      [
        {
          id: "protein",
          quantity: true,
        },
      ],
    ]) {
      assert.deepEqual(
        rankCartAddons(
          cart,
          [protein, shaker],
        ),
        [],
      );
    }

    assert.deepEqual(
      rankCartAddons(bag, null),
      [],
    );

    assert.deepEqual(
      rankCartAddons(
        bag,
        [
          {
            ...protein,
            isActive: false,
          },
          shaker,
        ],
      ),
      [],
    );

    assert.deepEqual(
      ids(
        rankCartAddons(
          bag,
          [protein, shaker],
          null,
        ),
      ),
      ["shaker"],
    );
  },
);

test(
  "existing related-product API retains product objects and ordering",
  () => {
    const rows = rankRelated(
      protein,
      [protein, shaker, bottle],
    );

    assert.equal(
      rows[0],
      shaker,
    );

    assert.equal(
      rows[1],
      bottle,
    );
  },
);

const source = {
  id: "507f1f77bcf86cd799439011",
  name: "Protein",
  category: "Protein",
  price: 500,
  stock: 5,
  discount: 0,
  sizes: [],
  colors: [],
};

const target = {
  id: "507f1f77bcf86cd799439012",
  name: "Shaker",
  category: "Shaker Bottles",
  price: 250,
  stock: 3,
  discount: 0,
  sizes: [],
  colors: ["Black", "Blue"],
  variants: {
    Black: 3,
    Blue: 0,
  },
};

const clone = (value) =>
  JSON.parse(JSON.stringify(value));

const h = (
  type,
  props,
  ...children
) => ({
  type,
  props: props || {},
  children: children.flat(Infinity),
});

const nodes = (tree) =>
  tree && typeof tree === "object"
    ? [
        tree,
        ...tree.children.flatMap(nodes),
      ]
    : [];

function deferred() {
  let resolve;
  let reject;

  const promise = new Promise(
    (onResolve, onReject) => {
      resolve = onResolve;
      reject = onReject;
    },
  );

  return {
    promise,
    resolve,
    reject,
  };
}

async function application() {
  const sourceCode = (
    await fs.readFile(
      new URL(
        "../src/components/CartAddons.jsx",
        import.meta.url,
      ),
      "utf8",
    )
  )
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(
      /^import[\s\S]*?;(?:\n|$)/gm,
      "",
    )
    .replace(
      /export default function/g,
      "function",
    );

  const output =
    await transformWithOxc(
      sourceCode,
      "CartAddons.jsx",
      {
        jsx: {
          runtime: "classic",
          pragma: "h",
        },
      },
    );

  const state = {
    products: clone([
      source,
      target,
    ]),

    cart: [
      inventory.normalizeCartItem(
        source,
        1,
        null,
        null,
      ),
    ],

    coupon: null,
    authLoading: false,
    adds: 0,
    quotes: 0,
    refreshes: 0,
    notifications: [],
    refresh: null,
    quote: null,
    quoteEntered: deferred(),
  };

  const states = [];
  const refs = [];
  const effects = [];
  const listeners = new Map();

  let si = 0;
  let ri = 0;
  let ei = 0;

  const module = {
    exports: {},
  };

  const quoteFor = (items) => ({
    items: items.map((row) => ({
      product: row.id,
      quantity: row.quantity,
      price: row.price,
      selectedSize: row.selectedSize,
      selectedColor: row.selectedColor,
    })),

    deliveryReview: {
      available: true,

      validUntil: new Date(
        Date.now() + 600000,
      ).toISOString(),
    },
  });

  const props = {
    configuredPairs: [],
  };

  vm.runInNewContext(
    output.code +
      "\nmodule.exports={ScopedCartAddons,AddonCard,matchesQuote};",

    {
      module,
      h,
      ...purchase,
      ...inventory,
      ...pricing,
      optionLabels,
      selectedProductImage,
      bagEditSignature,
      reviewCart,
      rankCartAddons,
      resolveCoupon,
      AbortController,

      ProductImage: "ProductImage",
      Link: "Link",

      productPath: (id) =>
        `/product/${id}`,

      savedPincode: () =>
        "673001",

      validPincode: (value) =>
        /^[1-9]\d{5}$/.test(
          String(value || ""),
        ),

      useAuth: () => ({
        loading: state.authLoading,
      }),

      useCatalog: () => ({
        products: state.products,
        loading: false,
        error: "",

        getLatestProducts: () =>
          state.products,

        refreshProducts: async () => {
          state.refreshes++;

          return state.refresh
            ? state.refresh()
            : state.products;
        },
      }),

      useStore: () => ({
        cart: state.cart,

        latestCart: () =>
          state.cart,

        coupon: state.coupon,
        catalogReady: true,

        shoppingKey: (key) =>
          key,

        notify: (message) =>
          state.notifications.push(
            message,
          ),

        addToCart: (
          product,
          quantity,
          size,
          color,
        ) => {
          state.adds++;

          state.cart = [
            ...state.cart,

            inventory.normalizeCartItem(
              product,
              quantity,
              size,
              color,
            ),
          ];

          return true;
        },
      }),

      getCheckoutQuote: async (
        token,
        payload,
        options,
      ) => {
        state.quotes++;

        state.quoteEntered.resolve();

        state.lastPayload = payload;
        state.lastSignal = options.signal;

        return state.quote
          ? state.quote(payload)
          : quoteFor(payload.items);
      },

      window: {
        addEventListener: (
          name,
          fn,
        ) => listeners.set(name, fn),

        removeEventListener: (
          name,
        ) => listeners.delete(name),
      },

      useState(value) {
        const index = si++;

        if (!(index in states)) {
          states[index] =
            typeof value === "function"
              ? value()
              : value;
        }

        return [
          states[index],

          (next) => {
            states[index] =
              typeof next === "function"
                ? next(states[index])
                : next;
          },
        ];
      },

      useRef: (value) =>
        (refs[ri++] ||= {
          current: value,
        }),

      useMemo: (fn) =>
        fn(),

      useEffect(fn, deps) {
        const index = ei++;
        const before = effects[index];

        if (
          !before ||
          deps.some(
            (value, i) =>
              !Object.is(
                value,
                before.deps[i],
              ),
          )
        ) {
          effects[index] = {
            fn,
            deps,
            old: before?.cleanup,
            pending: true,
          };
        }
      },
    },
  );

  const render = () => {
    si = 0;
    ri = 0;
    ei = 0;

    const tree =
      module.exports.ScopedCartAddons(
        props,
      );

    for (const effect of effects) {
      if (effect.pending) {
        effect.old?.();
        effect.pending = false;
        effect.cleanup = effect.fn();
      }
    }

    return tree;
  };

  const getCard = () =>
    nodes(render()).find(
      (node) =>
        typeof node.type === "function" &&
        node.type.name === "AddonCard",
    );

  render();

  const card = getCard();

  return {
    state,
    render,
    quoteFor,

    waitQuote: () =>
      state.quoteEntered.promise,

    matchesQuote:
      module.exports.matchesQuote,

    add: (
      size = null,
      color = "Black",
    ) =>
      card.props.onAdd(
        card.props.row,
        size,
        color,
      ),

    event: (
      type,
      data,
    ) =>
      listeners.get(type)?.({
        type,
        ...data,
      }),

    unmount: () =>
      effects.forEach(
        (effect) =>
          effect.cleanup?.(),
      ),

    getCard,
  };
}

test(
  "the panel makes no unsolicited pricing requests and starts with unselected variants",
  async () => {
    const app = await application();

    assert.equal(
      app.state.refreshes,
      0,
    );

    assert.equal(
      app.state.quotes,
      0,
    );

    assert.equal(
      app.getCard().props.row.requiresOptions,
      true,
    );

    assert.equal(
      app.state.cart.length,
      1,
    );

    app.unmount();
  },
);

test(
  "missing or unavailable variants never contact the backend or add an item",
  async () => {
    const app = await application();

    await app.add(null, null);
    await app.add(null, "Blue");

    assert.equal(
      app.state.quotes,
      0,
    );

    assert.equal(
      app.state.refreshes,
      0,
    );

    assert.equal(
      app.state.adds,
      0,
    );

    app.unmount();
  },
);

test(
  "duplicate clicks share one in-flight check and add exactly one selected variant",
  async () => {
    const app = await application();
    const gate = deferred();

    app.state.quote = () =>
      gate.promise;

    const first = app.add();

    await app.waitQuote();
    await app.add();

    assert.equal(
      app.state.quotes,
      1,
    );

    assert.equal(
      app.state.adds,
      0,
    );

    assert.equal(
      app.getCard().props.disabled,
      true,
    );

    gate.resolve(
      app.quoteFor(
        app.state.lastPayload.items,
      ),
    );

    await first;

    assert.equal(
      app.state.adds,
      1,
    );

    assert.equal(
      app.state.cart[1].selectedColor,
      "Black",
    );

    assert.equal(
      app.state.cart[0].id,
      source.id,
    );

    await app.add();

    assert.equal(
      app.state.adds,
      1,
    );

    app.unmount();
  },
);

test(
  "quote failure preserves the bag and releases the lock for a successful retry",
  async () => {
    const app = await application();

    const before = JSON.stringify(
      app.state.cart,
    );

    app.state.quote = () => {
      throw new Error(
        "Delivery unavailable",
      );
    };

    await app.add();

    assert.equal(
      JSON.stringify(
        app.state.cart,
      ),
      before,
    );

    app.state.quote = null;

    await app.add();

    assert.equal(
      app.state.adds,
      1,
    );

    app.unmount();
  },
);

test(
  "cart changes during a quote preserve the newer cart without adding",
  async () => {
    const app = await application();
    const gate = deferred();

    app.state.quote = () =>
      gate.promise;

    const pending = app.add();

    await app.waitQuote();

    app.state.cart[0].quantity = 2;

    gate.resolve(
      app.quoteFor(
        app.state.lastPayload.items,
      ),
    );

    await pending;

    assert.equal(
      app.state.cart[0].quantity,
      2,
    );

    assert.equal(
      app.state.adds,
      0,
    );

    app.unmount();
  },
);

test(
  "pincode changes abort the check and late responses cannot add",
  async () => {
    const app = await application();
    const gate = deferred();

    app.state.quote = () =>
      gate.promise;

    const pending = app.add();

    await app.waitQuote();

    app.event(
      "gymdrobe-delivery-changed",
      {
        detail: {
          key: "gymdrobe-delivery-pincode",
          pincode: "682001",
        },
      },
    );

    assert.equal(
      app.state.lastSignal.aborted,
      true,
    );

    gate.resolve(
      app.quoteFor(
        app.state.lastPayload.items,
      ),
    );

    await pending;

    assert.equal(
      app.state.adds,
      0,
    );

    app.unmount();
  },
);

test(
  "unmounting aborts and never mutates the previous shopper's bag",
  async () => {
    const app = await application();
    const gate = deferred();

    app.state.quote = () =>
      gate.promise;

    const pending = app.add();

    await app.waitQuote();

    app.unmount();

    gate.resolve(
      app.quoteFor(
        app.state.lastPayload.items,
      ),
    );

    await pending;

    assert.equal(
      app.state.lastSignal.aborted,
      true,
    );

    assert.equal(
      app.state.adds,
      0,
    );
  },
);

test(
  "changed server prices, quantities, selections and expired quotes refuse addition",
  async () => {
    const changes = [
      (quote) => {
        quote.items[1].price++;
      },

      (quote) => {
        quote.items[1].quantity++;
      },

      (quote) => {
        quote.items[1].selectedColor =
          "Blue";
      },

      (quote) => {
        quote.items[1].product =
          source.id;
      },

      (quote) => {
        quote.deliveryReview.validUntil =
          new Date(0).toISOString();
      },

      (quote) => {
        quote.deliveryReview.available =
          false;
      },
    ];

    for (const change of changes) {
      const app = await application();

      app.state.quote = (payload) => {
        const result = app.quoteFor(
          payload.items,
        );

        change(result);

        return result;
      };

      await app.add();

      assert.equal(
        app.state.adds,
        0,
      );

      app.unmount();
    }
  },
);

test(
  "price changes during catalogue refresh require review before a quote",
  async () => {
    const app = await application();

    app.state.refresh = () => {
      app.state.products[1].price++;

      return app.state.products;
    };

    await app.add();

    assert.equal(
      app.state.quotes,
      0,
    );

    assert.equal(
      app.state.adds,
      0,
    );

    app.unmount();
  },
);

test(
  "coupon changes during the check prevent applying a quote to a different basket",
  async () => {
    const app = await application();
    const gate = deferred();

    app.state.quote = () =>
      gate.promise;

    const pending = app.add();

    await app.waitQuote();

    app.state.coupon = "GYM10";

    app.render();

    gate.resolve(
      app.quoteFor(
        app.state.lastPayload.items,
      ),
    );

    await pending;

    assert.equal(
      app.state.adds,
      0,
    );

    app.unmount();
  },
);

test(
  "stock changes while the quote is pending are checked again before adding",
  async () => {
    const app = await application();
    const gate = deferred();

    app.state.quote = () =>
      gate.promise;

    const pending = app.add();

    await app.waitQuote();

    app.state.products[1].variants.Black =
      0;

    gate.resolve(
      app.quoteFor(
        app.state.lastPayload.items,
      ),
    );

    await pending;

    assert.equal(
      app.state.adds,
      0,
    );

    app.unmount();
  },
);

test(
  "restoring authentication during a check cannot add against an old account state",
  async () => {
    const app = await application();
    const gate = deferred();

    app.state.quote = () =>
      gate.promise;

    const pending = app.add();

    await app.waitQuote();

    app.state.authLoading = true;

    app.render();

    gate.resolve(
      app.quoteFor(
        app.state.lastPayload.items,
      ),
    );

    await pending;

    assert.equal(
      app.state.adds,
      0,
    );

    app.unmount();
  },
);