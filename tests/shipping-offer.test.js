import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

import { transformWithOxc } from "vite";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const defaultShippingSettings = () => ({
  version: 0,
  freeShipping: {
    enabled: true,
    minimumSubtotalPaise: 50000,
    eligibleProductIds: [],
    eligibleCategories: [],
    eligiblePincodes: [],
    excludedProductIds: [],
    excludedCategories: [],
    excludedPincodes: [],
    additionalChargesNotice:
      "Express delivery is charged separately.",
  },
});

// Customer-safe quote snapshots from the backend shipping helper.
const backendQuoteFixtures = {
  "below-minimum": {
    pricing: {
      subtotal: 400,
      couponDiscount: 0,
      totalAfterCoupon: 400,
      shipping: 99,
      finalTotal: 499,
    },
    payment: {
      method: "razorpay",
      amountToPayNow: 499,
      amountDue: 0,
      advancePercentage: 0,
    },
    freeShipping: {
      version: 0,
      enabled: true,
      scope: "ordinary-standard-basket",
      minimumSubtotalPaise: 50000,
      qualifyingSubtotalPaise: 40000,
      remainingPaise: 10000,
      progressPercent: 80,
      qualified: false,
      reason: "below-minimum",
      allItemsMustQualify: true,
      additionalChargesNotice:
        "Express delivery is charged separately.",
    },
    method: "standard",
  },

  qualified: {
    pricing: {
      subtotal: 600,
      couponDiscount: 0,
      totalAfterCoupon: 600,
      shipping: 0,
      finalTotal: 600,
    },
    payment: {
      method: "razorpay",
      amountToPayNow: 600,
      amountDue: 0,
      advancePercentage: 0,
    },
    freeShipping: {
      version: 0,
      enabled: true,
      scope: "ordinary-standard-basket",
      minimumSubtotalPaise: 50000,
      qualifyingSubtotalPaise: 60000,
      remainingPaise: 0,
      progressPercent: 100,
      qualified: true,
      reason: "qualified",
      allItemsMustQualify: true,
      additionalChargesNotice:
        "Express delivery is charged separately.",
    },
    method: "standard",
  },

  disabled: {
    pricing: {
      subtotal: 600,
      couponDiscount: 0,
      totalAfterCoupon: 600,
      shipping: 99,
      finalTotal: 699,
    },
    payment: {
      method: "razorpay",
      amountToPayNow: 699,
      amountDue: 0,
      advancePercentage: 0,
    },
    freeShipping: {
      version: 0,
      enabled: false,
      scope: "ordinary-standard-basket",
      minimumSubtotalPaise: 50000,
      qualifyingSubtotalPaise: 0,
      remainingPaise: null,
      progressPercent: null,
      qualified: false,
      reason: "disabled",
      allItemsMustQualify: true,
      additionalChargesNotice:
        "Express delivery is charged separately.",
    },
    method: "standard",
  },

  "products-excluded": {
    pricing: {
      subtotal: 600,
      couponDiscount: 0,
      totalAfterCoupon: 600,
      shipping: 99,
      finalTotal: 699,
    },
    payment: {
      method: "razorpay",
      amountToPayNow: 699,
      amountDue: 0,
      advancePercentage: 0,
    },
    freeShipping: {
      version: 0,
      enabled: true,
      scope: "ordinary-standard-basket",
      minimumSubtotalPaise: 50000,
      qualifyingSubtotalPaise: 0,
      remainingPaise: null,
      progressPercent: null,
      qualified: false,
      reason: "products-excluded",
      allItemsMustQualify: true,
      additionalChargesNotice:
        "Express delivery is charged separately.",
    },
    method: "standard",
  },

  "pincode-required": {
    pricing: {
      subtotal: 600,
      couponDiscount: 0,
      totalAfterCoupon: 600,
      shipping: 99,
      finalTotal: 699,
    },
    payment: {
      method: "razorpay",
      amountToPayNow: 699,
      amountDue: 0,
      advancePercentage: 0,
    },
    freeShipping: {
      version: 0,
      enabled: true,
      scope: "ordinary-standard-basket",
      minimumSubtotalPaise: 50000,
      qualifyingSubtotalPaise: 0,
      remainingPaise: null,
      progressPercent: null,
      qualified: false,
      reason: "pincode-required",
      allItemsMustQualify: true,
      additionalChargesNotice:
        "Express delivery is charged separately.",
    },
    method: "standard",
  },

  "outside-eligible-region": {
    pricing: {
      subtotal: 600,
      couponDiscount: 0,
      totalAfterCoupon: 600,
      shipping: 99,
      finalTotal: 699,
    },
    payment: {
      method: "razorpay",
      amountToPayNow: 699,
      amountDue: 0,
      advancePercentage: 0,
    },
    freeShipping: {
      version: 0,
      enabled: true,
      scope: "ordinary-standard-basket",
      minimumSubtotalPaise: 50000,
      qualifyingSubtotalPaise: 0,
      remainingPaise: null,
      progressPercent: null,
      qualified: false,
      reason: "outside-eligible-region",
      allItemsMustQualify: true,
      additionalChargesNotice:
        "Express delivery is charged separately.",
    },
    method: "standard",
  },

  "pincode-excluded": {
    pricing: {
      subtotal: 600,
      couponDiscount: 0,
      totalAfterCoupon: 600,
      shipping: 99,
      finalTotal: 699,
    },
    payment: {
      method: "razorpay",
      amountToPayNow: 699,
      amountDue: 0,
      advancePercentage: 0,
    },
    freeShipping: {
      version: 0,
      enabled: true,
      scope: "ordinary-standard-basket",
      minimumSubtotalPaise: 50000,
      qualifyingSubtotalPaise: 0,
      remainingPaise: null,
      progressPercent: null,
      qualified: false,
      reason: "pincode-excluded",
      allItemsMustQualify: true,
      additionalChargesNotice:
        "Express delivery is charged separately.",
    },
    method: "standard",
  },

  "express-delivery": {
    pricing: {
      subtotal: 600,
      couponDiscount: 0,
      totalAfterCoupon: 600,
      shipping: 199,
      finalTotal: 799,
    },
    payment: {
      method: "razorpay",
      amountToPayNow: 799,
      amountDue: 0,
      advancePercentage: 0,
    },
    freeShipping: {
      version: 0,
      enabled: true,
      scope: "ordinary-standard-basket",
      minimumSubtotalPaise: 50000,
      qualifyingSubtotalPaise: 0,
      remainingPaise: null,
      progressPercent: null,
      qualified: false,
      reason: "express-delivery",
      allItemsMustQualify: true,
      additionalChargesNotice:
        "Express delivery is charged separately.",
    },
    method: "express",
  },
};

const copy = (value) => JSON.parse(JSON.stringify(value));

const tick = async () => {
  for (let i = 0; i < 30; i++) {
    await Promise.resolve();
  }
};

function deferred() {
  let resolve;
  let reject;

  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

async function moduleAt(path, names, globals = {}) {
  let source = await fs.readFile(
    new URL("../" + path, import.meta.url),
    "utf8",
  );

  source = source
    .replace(/^import[\s\S]*?;(?:\n|$)/gm, "")
    .replace(/export default /g, "")
    .replace(
      /export (?:async )?function /g,
      (match) => match.replace("export ", ""),
    )
    .replace(/export const /g, "const ")
    .replaceAll("import.meta.env", "({})");

  const output = await transformWithOxc(source, path, {
    jsx: {
      runtime: "classic",
      pragma: "h",
      pragmaFrag: "Fragment",
    },
  });

  const context = {
    console,
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout,
    ...globals,
    module: {
      exports: {},
    },
  };

  vm.runInNewContext(
    output.code + `\nmodule.exports={${names}};`,
    context,
  );

  return context.module.exports;
}

const id = "a".repeat(24);

function quoteFor(reason = "below-minimum") {
  const quote = copy(backendQuoteFixtures[reason]);

  return {
    ...quote,
    deliveryReview: {
      validUntil: new Date(
        Date.now() + 600000,
      ).toISOString(),
    },
  };
}

test(
  "admin settings preserve server versions, exact paise and failed-write uncertainty",
  async () => {
    let response = {
      status: 200,
      data: {
        success: true,
        settings: defaultShippingSettings(),
      },
    };

    const calls = [];

    const api = await moduleAt(
      "src/services/shippingSettingsApi.js",
      [
        "rupeesToShippingPaise",
        "validateShippingSettings",
        "getShippingSettings",
        "saveShippingSettings",
      ].join(","),
      {
        fetch: async (url, options) => {
          calls.push({
            url,
            options,
          });

          if (response.failure) {
            throw response.failure;
          }

          return {
            ok:
              response.status >= 200 &&
              response.status < 300,
            status: response.status,
            json: async () => response.data,
          };
        },
      },
    );

    assert.equal(
      api.rupeesToShippingPaise("500.05"),
      50005,
    );

    for (const value of [
      "",
      -1,
      "1e3",
      "500.001",
      "1000000.01",
    ]) {
      assert.throws(() =>
        api.rupeesToShippingPaise(value),
      );
    }

    const settings = await api.getShippingSettings(
      "admin-token",
    );

    assert.equal(settings.version, 0);

    response = {
      status: 200,
      data: {
        success: true,
        settings: {
          ...defaultShippingSettings(),
          version: 1,
        },
      },
    };

    const saved = await api.saveShippingSettings(
      "admin-token",
      settings,
    );

    assert.equal(saved.version, 1);

    assert.equal(
      calls.at(-1).options.method,
      "PUT",
    );

    assert.equal(
      JSON.parse(calls.at(-1).options.body).version,
      0,
    );

    response = {
      status: 409,
      data: {
        success: false,
        message: "Changed",
      },
    };

    await assert.rejects(
      api.saveShippingSettings(
        "admin-token",
        settings,
      ),
      (error) =>
        error.reloadRequired === true &&
        !error.resultUnknown,
    );

    response = {
      status: 503,
      data: {
        success: false,
        message: "Unavailable",
      },
    };

    await assert.rejects(
      api.saveShippingSettings(
        "admin-token",
        settings,
      ),
      (error) => error.resultUnknown === true,
    );

    response = {
      failure: new TypeError("Offline"),
    };

    await assert.rejects(
      api.saveShippingSettings(
        "admin-token",
        settings,
      ),
      (error) => error.resultUnknown === true,
    );

    const invalid = defaultShippingSettings();

    invalid.freeShipping.eligiblePincodes = [
      "673001",
      "673001",
    ];

    assert.throws(() =>
      api.validateShippingSettings(invalid),
    );

    invalid.freeShipping.eligiblePincodes = [
      "673001",
    ];

    invalid.freeShipping.excludedPincodes = [
      "673001",
    ];

    assert.throws(() =>
      api.validateShippingSettings(invalid),
    );
  },
);

test(
  "progress renders backend results for thresholds, exclusions, regions and express delivery",
  async () => {
    const view = await moduleAt(
      "src/components/FreeShippingProgress.jsx",
      "shippingProgress,FreeShippingProgress",
      {
        h: React.createElement,
        Fragment: React.Fragment,
        money: (value) => `INR ${value}`,
      },
    );

    let quote = quoteFor();

    assert.equal(
      view.shippingProgress(quote).remainingPaise,
      10000,
    );

    let html = renderToStaticMarkup(
      React.createElement(
        view.FreeShippingProgress,
        { quote },
      ),
    );

    assert.match(html, /Add INR 100/);
    assert.match(html, /<progress/);

    quote = quoteFor("qualified");

    assert.equal(
      view.shippingProgress(quote).qualified,
      true,
    );

    for (const reason of [
      "disabled",
      "products-excluded",
      "pincode-required",
      "outside-eligible-region",
      "pincode-excluded",
      "express-delivery",
    ]) {
      quote = quoteFor(reason);

      assert.equal(
        view.shippingProgress(quote).reason,
        reason,
      );

      html = renderToStaticMarkup(
        React.createElement(
          view.FreeShippingProgress,
          { quote },
        ),
      );

      assert.doesNotMatch(html, /<progress/);
    }

    quote = quoteFor();
    quote.freeShipping.remainingPaise = 1;

    assert.equal(
      view.shippingProgress(quote),
      null,
    );

    quote = quoteFor();
    quote.freeShipping.enabled = false;

    assert.equal(
      view.shippingProgress(quote),
      null,
    );

    html = renderToStaticMarkup(
      React.createElement(
        view.FreeShippingProgress,
        {
          quote: quoteFor("qualified"),
          loading: true,
        },
      ),
    );

    assert.doesNotMatch(html, /bag qualifies/);
  },
);

function hooks() {
  const states = [];
  const refs = [];
  const effects = [];

  let si = 0;
  let ri = 0;
  let ei = 0;

  const h = (type, props, ...children) => ({
    type,
    props: props || {},
    children: children.flat(Infinity),
  });

  return {
    h,
    states,

    globals: {
      h,
      Fragment: "fragment",

      useState(value) {
        const i = si++;

        if (!(i in states)) {
          states[i] =
            typeof value === "function"
              ? value()
              : value;
        }

        return [
          states[i],
          (next) => {
            states[i] =
              typeof next === "function"
                ? next(states[i])
                : next;
          },
        ];
      },

      useRef(value) {
        return (refs[ri++] ||= {
          current: value,
        });
      },

      useEffect(fn, deps) {
        const i = ei++;
        const old = effects[i];

        if (
          !old ||
          deps.some(
            (value, j) =>
              !Object.is(value, old.deps[j]),
          )
        ) {
          effects[i] = {
            fn,
            deps,
            previous: old?.cleanup,
            pending: true,
          };
        }
      },
    },

    render(component, props) {
      si = ri = ei = 0;

      const tree = component(props);

      for (const effect of effects) {
        if (effect.pending) {
          effect.previous?.();
          effect.pending = false;
          effect.cleanup = effect.fn();
        }
      }

      return tree;
    },

    stop() {
      for (const effect of effects) {
        effect.cleanup?.();
      }
    },
  };
}

function find(tree, predicate) {
  if (!tree || typeof tree !== "object") {
    return null;
  }

  if (predicate(tree)) {
    return tree;
  }

  for (const child of tree.children || []) {
    const match = find(child, predicate);

    if (match) {
      return match;
    }
  }

  return null;
}

test(
  "an admin draft survives conflicts and duplicate save clicks do not create another write",
  async () => {
    const runtime = hooks();
    const saving = deferred();

    let writes = 0;
    let body;

    const api = await moduleAt(
      "src/services/shippingSettingsApi.js",
      "rupeesToShippingPaise,validateShippingSettings",
    );

    const {
      AdminShippingSettingsPage: Page,
    } = await moduleAt(
      "src/pages/AdminShippingSettingsPage.jsx",
      "AdminShippingSettingsPage",
      {
        ...runtime.globals,
        ...api,

        useAuth: () => ({
          token: "admin",
        }),

        Link: "Link",

        getShippingSettings: async () =>
          defaultShippingSettings(),

        getAdminProductOptions: async () => ({
          categories: ["Clothing"],
        }),

        saveShippingSettings: async (
          token,
          value,
        ) => {
          writes++;
          body = value;
          return saving.promise;
        },

        window: {
          dispatchEvent() {},
        },

        localStorage: {
          setItem() {},
        },

        Event,
      },
    );

    runtime.render(Page);
    await tick();

    let tree = runtime.render(Page);

    find(
      tree,
      (node) =>
        node.type === "input" &&
        node.props.maxLength === 10,
    ).props.onChange({
      target: {
        value: "800",
      },
    });

    tree = runtime.render(Page);

    const submit = find(
      tree,
      (node) => node.type === "form",
    ).props.onSubmit;

    const first = submit({
      preventDefault() {},
    });

    await submit({
      preventDefault() {},
    });

    assert.equal(writes, 1);

    assert.equal(
      body.freeShipping.minimumSubtotalPaise,
      80000,
    );

    saving.reject(
      Object.assign(new Error("Changed"), {
        reloadRequired: true,
      }),
    );

    await first;

    tree = runtime.render(Page);

    assert.equal(
      find(
        tree,
        (node) =>
          node.type === "input" &&
          node.props.maxLength === 10,
      ).props.value,
      "800",
    );

    assert.equal(
      find(
        tree,
        (node) =>
          node.type === "button" &&
          node.props.type === "submit",
      ).props.disabled,
      true,
    );

    runtime.stop();
  },
);

test(
  "cart changes discard late shipping quotes and disabled cart reviews cannot publish results",
  async () => {
    const runtime = hooks();
    const timers = new Map();
    const requests = [];

    let timerId = 0;

    const {
      CartShippingReview: Cart,
    } = await moduleAt(
      "src/components/CartShippingReview.jsx",
      "CartShippingReview",
      {
        ...runtime.globals,

        resolveCoupon: () => null,
        savedPincode: () => "",
        savePincode() {},

        validPincode: (value) =>
          /^[1-9]\d{5}$/.test(value),

        money: (value) => `INR ${value}`,

        FreeShippingProgress:
          "FreeShippingProgress",

        window: {
          addEventListener() {},
          removeEventListener() {},
        },

        document: {
          visibilityState: "visible",
        },

        setTimeout(fn, delay) {
          const id = ++timerId;

          timers.set(id, {
            fn,
            delay,
          });

          return id;
        },

        clearTimeout: (id) =>
          timers.delete(id),

        getCheckoutQuote: async (
          token,
          payload,
          options,
        ) => {
          const request = deferred();

          requests.push({
            ...request,
            payload,
            options,
          });

          return request.promise;
        },
      },
    );

    let props = {
      items: [
        {
          id,
          quantity: 1,
        },
      ],
      enabled: true,
      storageKey: "guest",
      expectedPricing: {
        subtotal: 400,
        couponDiscount: 0,
        totalAfterCoupon: 400,
      },
      onRefresh() {},
    };

    const flush = () => {
      for (const [id, timer] of timers) {
        if (timer.delay === 350) {
          timers.delete(id);
          timer.fn();
        }
      }
    };

    runtime.render(Cart, props);
    flush();

    await tick();

    assert.equal(requests.length, 1);

    props = {
      ...props,
      items: [
        {
          id,
          quantity: 2,
        },
      ],
    };

    runtime.render(Cart, props);

    assert.equal(
      requests[0].options.signal.aborted,
      true,
    );

    requests[0].resolve(quoteFor());

    await tick();

    let tree = runtime.render(Cart, props);

    assert.equal(
      find(
        tree,
        (node) =>
          node.type === "FreeShippingProgress",
      ).props.quote,
      null,
    );

    flush();
    await tick();

    assert.equal(requests.length, 2);

    requests[1].resolve(quoteFor());

    await tick();

    tree = runtime.render(Cart, props);

    assert.ok(
      find(
        tree,
        (node) =>
          node.type === "FreeShippingProgress",
      ).props.quote,
    );

    props = {
      ...props,
      enabled: false,
    };

    runtime.render(Cart, props);
    tree = runtime.render(Cart, props);

    assert.equal(
      find(
        tree,
        (node) =>
          node.type === "FreeShippingProgress",
      ),
      null,
    );

    runtime.stop();
  },
);