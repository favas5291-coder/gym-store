import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { setNativePaymentFlowActive } from "../src/native/payment.js";
import { transformWithOxc } from "vite";

import * as payment from "../src/utils/checkoutPayment.js";
import * as kit from "../src/utils/kitPaymentReview.js";

import {
  reviewCart,
} from "../src/utils/cartReview.js";

import {
  getCartItemKey,
  getKitGroup,
} from "../src/utils/cartUtils.js";

import {
  EMPTY_ADDRESS,
  normalizeAddress,
} from "../src/utils/customerData.js";

import {
  calculateOrderPricing,
  resolveCoupon,
  FREE_SHIPPING_LIMIT,
} from "../src/utils/orderCalculations.js";

import {
  userKey,
} from "../src/utils/storage.js";

const clone = (value) =>
  JSON.parse(JSON.stringify(value));

const tick = async () => {
  for (let i = 0; i < 40; i++) {
    await Promise.resolve();
  }
};

function deferred() {
  let resolve;
  let reject;

  const promise = new Promise(
    (yes, no) => {
      resolve = yes;
      reject = no;
    },
  );

  return {
    promise,
    resolve,
    reject,
  };
}

function storage() {
  const entries = new Map();

  return {
    getItem: (key) =>
      entries.get(key) ?? null,

    setItem: (key, value) =>
      entries.set(
        key,
        String(value),
      ),

    removeItem: (key) =>
      entries.delete(key),
  };
}

const h = (
  type,
  props,
  ...children
) => ({
  type,
  props: props || {},
  children: children.flat(Infinity),
});

const nodes = (node) =>
  node && typeof node === "object"
    ? [
        node,
        ...node.children.flatMap(nodes),
      ]
    : [];

const content = (node) =>
  node && typeof node === "object"
    ? node.children
        .map(content)
        .join(" ")
    : String(node ?? "");

const delivery = {
  ...EMPTY_ADDRESS,
  fullName: "Guest Customer",
  email: "guest@example.test",
  phone: "9876543210",
  addressLine: "12 Workout Street",
  city: "Kozhikode",
  state: "Kerala",
  pincode: "673001",
};

async function application({
  user = null,
  method = "razorpay",
  mode = "cart",
  local = storage(),
  session = storage(),
  source,
} = {}) {
  const sourceCode = (
    await fs.readFile(
      source ||
        new URL(
          "../src/pages/CheckoutPaymentPage.jsx",
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
      "CheckoutPaymentPage.jsx",

      {
        jsx: {
          runtime: "classic",
          pragma: "h",
          pragmaFrag: "Fragment",
        },
      },
    );

  const states = [];
  const refs = [];
  const effects = [];
  const timers = new Map();
  const events = [];
  const metrics = [];
  const networkJobs = [];

  let si = 0;
  let ri = 0;
  let ei = 0;
  let timerId = 0;
  let clock = 0;

  let guestReady = false;
  let sdkReady = false;
  let guestJob;
  let sdkJob;

  const networkDelay = (duration) =>
    new Promise((resolve) => {
      networkJobs.push({
        at: clock + duration,
        resolve,
      });
    });

  const settings = {
    quoteGate: null,
    guestGate: null,
    sdkGate: null,
    orderGate: null,
    popupGate: null,
    statusGate: null,
    failCreate: null,
    failVerify: null,
    completePopup: false,
    status: "pending",
    changedQuote: false,
    warmupFails: false,
    simulateLatency: false,
  };

  const product = {
    id: "507f1f77bcf86cd799439011",
    name: "Training T-shirt",
    price: 1000,
    discount: 0,
    stock: 5,
    sizes: ["M"],
    colors: ["Black"],

    variants: {
      Black: {
        M: 5,
      },
    },

    isActive: true,
  };

  const cart = [
    {
      id: product.id,
      name: product.name,
      price: 1000,
      quantity: 1,
      selectedSize: "M",
      selectedColor: "Black",
    },
  ];

  const shoppingKey = (key) =>
    user
      ? userKey(key, user)
      : key;

  const read = (
    target,
    key,
    fallback,
  ) => {
    try {
      return (
        JSON.parse(
          target.getItem(key) ||
            "null",
        ) ?? fallback
      );
    } catch {
      return fallback;
    }
  };

  const write = (
    target,
    key,
    value,
  ) => {
    try {
      target.setItem(
        key,
        JSON.stringify(value),
      );

      return true;
    } catch {
      return false;
    }
  };

  const addressKey = userKey(
    "gymdrobe-checkout-address",
    user,
  );

  if (
    !local.getItem(addressKey)
  ) {
    write(
      local,
      addressKey,
      delivery,
    );
  }

  const store = {
    shoppingKey,
    catalogReady: true,
    coupon: null,
    cart,
    buyNowItem: cart[0],

    latestCart: () =>
      store.cart,

    notify() {},

    setCart(rows) {
      store.cart = rows;
    },

    clearBuyNow() {
      store.buyNowItem = null;
    },
  };

  const catalog = {
    products: [product],
    loading: false,
    error: null,

    getLatestProducts: () =>
      catalog.products,
  };

  function prepare(name) {
    if (name === "guest") {
      if (guestReady) {
        return Promise.resolve({
          token: "guest-access",
        });
      }

      if (guestJob) {
        return guestJob;
      }

      events.push({
        name,
        token: null,
      });

      const task =
        settings.warmupFails
          ? Promise.reject(
              Error(
                "Warmup unavailable",
              ),
            )
          : settings.guestGate
              ?.promise ||
            (
              settings.simulateLatency
                ? networkDelay(200)
                : Promise.resolve()
            );

      guestJob = task
        .then(() => {
          guestReady = true;

          return {
            token: "guest-access",
          };
        })
        .finally(() => {
          guestJob = null;
        });

      return guestJob;
    }

    if (sdkReady) {
      return Promise.resolve(
        function Razorpay() {},
      );
    }

    if (sdkJob) {
      return sdkJob;
    }

    events.push({
      name,
    });

    const task =
      settings.warmupFails
        ? Promise.reject(
            Error(
              "Warmup unavailable",
            ),
          )
        : settings.sdkGate
            ?.promise ||
          (
            settings.simulateLatency
              ? networkDelay(400)
              : Promise.resolve()
          );

    sdkJob = task
      .then(() => {
        sdkReady = true;

        return function Razorpay() {};
      })
      .finally(() => {
        sdkJob = null;
      });

    return sdkJob;
  }

  const pendingOrder = () => {
    const record = read(
      session,

      shoppingKey(
        "gymdrobe-active-checkout-v2",
      ),

      null,
    );

    return {
      orderNumber: "GD-FIXTURE",
      status: "payment-pending",
      items: clone(cart),
      isGuestOrder: !user,

      user: user
        ? {
            id:
              user.id ||
              user._id,
          }
        : null,

      pricing:
        record?.pricing ||
        calculateOrderPricing({
          cart,
          coupon: null,
          deliveryMethod: "standard",
        }),

      payment: {
        method,
        status: "pending",
        verifiedAt: null,
      },
    };
  };

  const completedOrder = () => {
    const order =
      pendingOrder();

    const amounts =
      payment.paymentAmounts(
        order.pricing,
        method,
      );

    return {
      ...order,
      status: "confirmed",

      payment: {
        method,

        status:
          method === "cod-partial"
            ? "partially-paid"
            : "paid",

        amountPaid:
          amounts.now,

        amountDue:
          amounts.due,

        verifiedAt:
          new Date().toISOString(),
      },
    };
  };

  const module = {
    exports: {},
  };

  vm.runInNewContext(
    output.code +
      "\nmodule.exports={Checkout};",

    {
      module,
      h,
      Fragment: "fragment",

      ...payment,
      ...kit,

      getCartItemKey,
      getKitGroup,
      EMPTY_ADDRESS,
      normalizeAddress,
      userKey,
      calculateOrderPricing,
      resolveCoupon,
      FREE_SHIPPING_LIMIT,
      reviewCart,

      localStorage: local,
      sessionStorage: session,
      AbortController,

      performance: {
        now: () => clock,

        getEntriesByName: () =>
          [],

        clearMeasures() {},

        measure(name) {
          metrics.push(name);
        },
      },

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

      useRef: (value) =>
        (
          refs[ri++] ||= {
            current: value,
          }
        ),

      useEffect(fn, deps) {
        const i = ei++;
        const previous =
          effects[i];

        if (
          !previous ||
          deps.some(
            (value, index) =>
              !Object.is(
                value,
                previous.deps[index],
              ),
          )
        ) {
          effects[i] = {
            fn,
            deps,

            previous:
              previous?.cleanup,

            pending: true,
          };
        }
      },

      setTimeout(fn, delay) {
        const id =
          ++timerId;

        timers.set(id, {
          fn,
          delay,
        });

        return id;
      },

      clearTimeout: (id) =>
        timers.delete(id),

      window: {
        addEventListener() {},
        removeEventListener() {},
      },

      document: {
        visibilityState:
          "visible",

        addEventListener() {},
        removeEventListener() {},
      },

      requestAnimationFrame:
        (fn) => fn(),

      useNavigate: () =>
        (url) => {
          events.push({
            name: "navigate",
            url,
          });
        },

      useStore: () =>
        store,

      useCatalog: () =>
        catalog,

      useShoppingTools: () => ({
        checkoutKeys:
          cart.map(
            getCartItemKey,
          ),
      }),

      selectedBag: (
        rows,
        keys,
      ) =>
        rows.filter(
          (row) =>
            keys.includes(
              getCartItemKey(row),
            ),
        ),

      readStorage: (
        key,
        fallback,
      ) =>
        read(
          local,
          key,
          fallback,
        ),

      writeStorage: (
        key,
        value,
      ) =>
        write(
          local,
          key,
          value,
        ),

      readSession: (
        key,
        fallback,
      ) =>
        read(
          session,
          key,
          fallback,
        ),

      writeSession: (
        key,
        value,
      ) =>
        write(
          session,
          key,
          value,
        ),

      pincodeForCheckout: (
        key,
        value,
      ) =>
        value || "",

      validPincode: (value) =>
        /^[1-9]\d{5}$/.test(
          String(value || ""),
        ),

      savedPincode: () =>
        "",

      savePincode() {},
      clearPincode() {},

      getAddresses:
        async () => [],

      createAddress:
        async () => ({}),

      buyingInformation:
        () => ({
          returns:
            "Recorded policy",

          returnDetails: [],
        }),

      ownerKey: () =>
        "fixture",

      persistOrder() {},
      trackPurchase() {},

      analyticsVisitKey:
        () => "visit",

      commercePayload:
        () => ({}),

      trackOnce() {},
      trackEvent() {},

      makeId: () =>
        "checkout-same-token",

      guestAccess: () =>
        guestReady
          ? {
              token:
                "guest-access",
            }
          : null,

      ensureGuestAccess:
        () => prepare("guest"),

      loadRazorpay:
        () => prepare("sdk"),

      async getCheckoutQuote(
        token,
        body,
      ) {
        events.push({
          name: "quote",
          token,
          body: clone(body),
        });

        if (
          settings.quoteGate
        ) {
          await settings.quoteGate
            .promise;
        }

        if (
          settings.simulateLatency
        ) {
          await networkDelay(300);
        }

        const pricing =
          calculateOrderPricing({
            cart: body.items,
            coupon: null,

            deliveryMethod:
              body.deliveryMethod,
          });

        if (
          settings.changedQuote
        ) {
          pricing.finalTotal += 1;
        }

        return {
          pricing,

          deliveryReview: {
            ready: true,
            pincode: body.pincode,

            validUntil:
              new Date(
                Date.now() +
                  60000,
              ).toISOString(),
          },

          items: [],
          kitSnapshots: [],
        };
      },

      async createRazorpayPaymentOrder(
        token,
        body,
      ) {
        events.push({
          name: "order",
          token,
          body: clone(body),
        });

        if (
          settings.orderGate
        ) {
          await settings.orderGate
            .promise;
        }

        if (
          settings.simulateLatency
        ) {
          await networkDelay(100);
        }

        if (
          settings.failCreate
        ) {
          throw settings.failCreate;
        }

        const pricing =
          read(
            session,

            shoppingKey(
              "gymdrobe-active-checkout-v2",
            ),

            null,
          ).pricing;

        const amounts =
          payment.paymentAmounts(
            pricing,
            body.paymentMethod,
          );

        return {
          keyId:
            "rzp_test_Fixture",

          razorpayOrderId:
            "order_Fixture",

          orderNumber:
            "GD-FIXTURE",

          amount:
            amounts.paise,

          currency: "INR",

          paymentMethod:
            body.paymentMethod,

          paymentSummary: {
            totalAmount:
              pricing.finalTotal,

            amountToPayNow:
              amounts.now,

            amountDue:
              amounts.due,
          },
        };
      },

      setNativePaymentFlowActive,
      async openRazorpayCheckout(
        options,
      ) {
        events.push({
          name: "popup",
          options: clone(options),
        });

        if (
          settings.popupGate
        ) {
          return settings.popupGate
            .promise;
        }

        if (
          !settings.completePopup
        ) {
          throw Object.assign(
            Error(
              "Payment cancelled",
            ),

            {
              code:
                "RAZORPAY_CANCELLED",
            },
          );
        }

        return {
          razorpay_order_id:
            "order_Fixture",

          razorpay_payment_id:
            "pay_Fixture",

          razorpay_signature:
            "a".repeat(64),
        };
      },

      async verifyRazorpayPayment(
        token,
        body,
      ) {
        events.push({
          name: "verify",
          token,
          body: clone(body),
        });

        if (
          settings.failVerify
        ) {
          throw settings.failVerify;
        }

        return {
          order:
            completedOrder(),
        };
      },

      async getOrderById(
        token,
        id,
      ) {
        events.push({
          name: "read-order",
          token,
          id,
        });

        return settings.status ===
          "verified"
          ? completedOrder()
          : pendingOrder();
      },

      async checkRazorpayPayment(
        token,
        id,
        options,
      ) {
        events.push({
          name: "status",
          token,
          id,
          signal:
            options?.signal,
        });

        if (
          settings.statusGate
        ) {
          await settings.statusGate
            .promise;
        }

        return {
          state:
            settings.status,

          message:
            `Payment ${settings.status}`,
        };
      },

      Link: "Link",
      AddressForm: "AddressForm",
      EmptyState: "EmptyState",
      ProductImage: "ProductImage",
      CouponBox: "CouponBox",
      FreeShippingProgress: "FreeShippingProgress",

      CheckoutKitReview:
        "CheckoutKitReview",

      money: (value) =>
        `₹${value}`,
    },
  );

  const render = () => {
    si = 0;
    ri = 0;
    ei = 0;

    const tree =
      module.exports.Checkout({
        auth: {
          user,

          token: user
            ? "account-token"
            : null,
        },

        mode,
      });

    for (
      const effect of
      effects
    ) {
      if (
        effect.pending
      ) {
        effect.previous?.();

        effect.pending =
          false;

        effect.cleanup =
          effect.fn();
      }
    }

    return tree;
  };

  const find = (predicate) =>
    nodes(render()).find(
      predicate,
    );

  const button = (label) =>
    find(
      (node) =>
        node.type === "button" &&
        content(node).trim() ===
          label,
    );

  render();

  if (
    method !== "razorpay"
  ) {
    find(
      (node) =>
        node.type === "input" &&
        node.props.name ===
          "payment" &&
        node.props.checked ===
          false,
    ).props.onChange();

    render();
  }

  return {
    events,
    metrics,
    settings,
    store,
    product,
    local,
    session,
    render,
    button,

    get clock() {
      return clock;
    },

    async finishNetwork() {
      await tick();

      while (
        networkJobs.length
      ) {
        clock = Math.min(
          ...networkJobs.map(
            (job) => job.at,
          ),
        );

        const ready =
          networkJobs.filter(
            (job) =>
              job.at === clock,
          );

        for (
          const job of ready
        ) {
          networkJobs.splice(
            networkJobs.indexOf(
              job,
            ),
            1,
          );
        }

        ready.forEach(
          (job) =>
            job.resolve(),
        );

        await tick();
        render();
        await tick();
      }
    },

    pending: () =>
      read(
        session,

        shoppingKey(
          "gymdrobe-active-checkout-v2",
        ),

        null,
      ),

    address: () =>
      clone(
        find(
          (node) =>
            node.type ===
            "AddressForm",
        ).props.value,
      ),

    submit: () =>
      find(
        (node) =>
          node.type === "form" &&
          node.props.id ===
            "checkout-form",
      ).props.onSubmit({
        preventDefault() {},
      }),

    async quote() {
      render();

      for (
        const [id, timer] of
        [...timers]
      ) {
        if (
          timer.delay === 350
        ) {
          timers.delete(id);
          timer.fn();
        }
      }

      await tick();
      render();
    },

    async poll() {
      render();

      for (
        const [id, timer] of
        [...timers]
      ) {
        if (
          timer.delay === 15000
        ) {
          timers.delete(id);
          timer.fn();
        }
      }

      await tick();
      render();
    },

    edit(value) {
      find(
        (node) =>
          node.type ===
          "AddressForm",
      ).props.onChange(value);

      render();
    },

    unmount() {
      effects.forEach(
        (effect) =>
          effect.cleanup?.(),
      );
    },

    cold() {
      guestReady = false;
      sdkReady = false;
      events.length = 0;
    },
  };
}

test(
  "Pay starts guest access, SDK loading and the fresh quote together without accepting another click",
  async () => {
    const app =
      await application({
        source:
          process.env
            .GYMDROBE_CHECKOUT_FLOW_TEST_SOURCE,
      });

    await app.quote();
    app.cold();

    app.settings.guestGate =
      deferred();

    app.settings.sdkGate =
      deferred();

    app.settings.quoteGate =
      deferred();

    const first =
      app.submit();

    const payButton =
      nodes(
        app.render(),
      ).find(
        (node) =>
          node.props.className ===
          "button full gd-checkout-pay",
      );

    assert.equal(
      payButton.props.disabled,
      true,
    );

    await app.submit();
    await tick();

    assert.deepEqual(
      app.events
        .map(
          (event) =>
            event.name,
        )
        .sort(),

      [
        "guest",
        "quote",
        "sdk",
      ],
    );

    assert.equal(
      app.events.filter(
        (event) =>
          event.name ===
          "order",
      ).length,

      0,
    );

    app.settings.guestGate
      .resolve();

    app.settings.sdkGate
      .resolve();

    app.settings.quoteGate
      .resolve();

    await first;
    await tick();

    assert.equal(
      app.events.filter(
        (event) =>
          event.name ===
          "order",
      ).length,

      1,
    );

    assert.ok(
      app.button(
        "Resume payment",
      ),
    );

    assert.deepEqual(
      app.address(),
      delivery,
    );

    app.unmount();
  },
);

test(
  "checkout preloads one guest credential and one SDK while delivery is being filled",
  async () => {
    const app =
      await application();

    await app.quote();

    assert.equal(
      app.events.filter(
        (event) =>
          event.name ===
          "guest",
      ).length,

      1,
    );

    assert.equal(
      app.events.filter(
        (event) =>
          event.name ===
          "sdk",
      ).length,

      1,
    );

    await app.submit();

    assert.equal(
      app.events.filter(
        (event) =>
          event.name ===
          "guest",
      ).length,

      1,
    );

    assert.equal(
      app.events.filter(
        (event) =>
          event.name ===
          "sdk",
      ).length,

      1,
    );

    app.unmount();
  },
);

test(
  "cancel and retry keep the original checkout token, address, variants and cart",
  async () => {
    const app =
      await application();

    await app.quote();
    await app.submit();
    await tick();

    const before =
      clone(
        app.pending(),
      );

    const resume =
      app.button(
        "Resume payment",
      );

    assert.ok(resume);

    await resume.props
      .onClick();

    const requests =
      app.events.filter(
        (event) =>
          event.name ===
          "order",
      );

    assert.equal(
      requests.length,
      2,
    );

    assert.deepEqual(
      requests[0].body,
      requests[1].body,
    );

    assert.equal(
      app.pending().orderId,
      before.orderId,
    );

    assert.equal(
      app.store.cart.length,
      1,
    );

    assert.deepEqual(
      app.address(),
      delivery,
    );

    app.unmount();
  },
);

test(
  "uncertain order creation stays saved and recovery reuses the same attempt",
  async () => {
    const app =
      await application();

    await app.quote();

    app.settings.failCreate =
      Object.assign(
        Error(
          "Connection interrupted",
        ),

        {
          data: {
            verificationUncertain:
              true,
          },
        },
      );

    await app.submit();

    const saved =
      clone(
        app.pending(),
      );

    assert.ok(
      saved.payload
        .checkoutToken,
    );

    assert.equal(
      saved.phase,
      "check",
    );

    app.settings.failCreate =
      null;

    await app
      .button(
        "Resume payment",
      )
      .props.onClick();

    assert.equal(
      app.pending().payload
        .checkoutToken,

      saved.payload
        .checkoutToken,
    );

    assert.equal(
      app.events.filter(
        (event) =>
          event.name ===
          "popup",
      ).length,

      1,
    );

    app.unmount();
  },
);

test(
  "verification uncertainty offers status recovery without starting another payment",
  async () => {
    const app =
      await application();

    await app.quote();

    app.settings.completePopup =
      true;

    app.settings.failVerify =
      Object.assign(
        Error(
          "Verification interrupted",
        ),

        {
          data: {
            verificationUncertain:
              true,
          },
        },
      );

    await app.submit();
    await tick();

    assert.equal(
      app.pending().phase,
      "confirming",
    );

    assert.equal(
      app.button(
        "Resume payment",
      ),

      undefined,
    );

    app.settings.status =
      "verified";

    await app
      .button(
        "Check payment status",
      )
      .props.onClick();

    assert.equal(
      app.events.filter(
        (event) =>
          event.name ===
          "order",
      ).length,

      1,
    );

    assert.equal(
      app.events.filter(
        (event) =>
          event.name ===
          "popup",
      ).length,

      1,
    );

    assert.ok(
      app.events.some(
        (event) =>
          event.name ===
          "navigate",
      ),
    );

    app.unmount();
  },
);

test(
  "an authorized result keeps verification recovery locked against another payment window",
  async () => {
    const app =
      await application();

    await app.quote();

    app.settings.completePopup =
      true;

    app.settings.failVerify =
      Error(
        "Waiting for confirmation",
      );

    await app.submit();

    app.settings.status =
      "authorized";

    await app
      .button(
        "Check payment status",
      )
      .props.onClick();

    assert.equal(
      app.pending().phase,
      "confirming",
    );

    assert.equal(
      app.button(
        "Resume payment",
      ),

      undefined,
    );

    app.unmount();
  },
);

test(
  "background and manual recovery share one payment-status request",
  async () => {
    const app =
      await application();

    await app.quote();
    await app.submit();

    app.settings.statusGate =
      deferred();

    const polling =
      app.poll();

    await tick();

    const checking =
      app.button(
        "Check payment status",
      ).props.onClick();

    await tick();

    assert.equal(
      app.events.filter(
        (event) =>
          event.name ===
          "status",
      ).length,

      1,
    );

    app.settings.statusGate
      .resolve();

    await Promise.all([
      polling,
      checking,
    ]);

    app.unmount();
  },
);

test(
  "signed-in, selected-item and Buy Now flows retain exact full and COD advance totals",
  async () => {
    for (
      const user of [
        null,

        {
          id: "account-a",
          email:
            "guest@example.test",
        },
      ]
    ) {
      for (
        const mode of [
          "cart",
          "selection",
          "buy-now",
        ]
      ) {
        for (
          const method of [
            "razorpay",
            "cod-partial",
          ]
        ) {
          const app =
            await application({
              user,
              mode,
              method,
            });

          await app.quote();

          app.settings.completePopup =
            true;

          await app.submit();

          const popup =
            app.events.find(
              (event) =>
                event.name ===
                "popup",
            );

          assert.ok(
            popup,

            content(
              app.render(),
            ),
          );

          assert.equal(
            popup.options.amount,

            method ===
              "cod-partial"
              ? 10000
              : 100000,
          );

          assert.equal(
            app.events.some(
              (event) =>
                event.name ===
                "guest",
            ),

            !user,
          );

          assert.ok(
            app.events.some(
              (event) =>
                event.name ===
                "navigate",
            ),
          );

          app.unmount();
        }
      }
    }
  },
);

test(
  "invalid address, unavailable variants and changed prices never open payment",
  async () => {
    for (
      const failure of [
        "pincode",
        "variant",
        "stock",
        "price",
      ]
    ) {
      const app =
        await application();

      await app.quote();

      if (
        failure === "pincode"
      ) {
        app.edit({
          ...delivery,
          pincode: "123",
        });
      }

      if (
        failure === "variant"
      ) {
        app.store.cart[0]
          .selectedSize = null;
      }

      if (
        failure === "stock"
      ) {
        app.product.variants
          .Black.M = 0;
      }

      if (
        failure === "price"
      ) {
        app.settings.changedQuote =
          true;
      }

      await app.submit();

      assert.equal(
        app.events.some(
          (event) =>
            event.name ===
            "order",
        ),

        false,
        failure,
      );

      assert.equal(
        app.events.some(
          (event) =>
            event.name ===
            "popup",
        ),

        false,
        failure,
      );

      app.unmount();
    }
  },
);

test(
  "warmup failure is recoverable and a fresh remount retains guest payment/address details",
  async () => {
    const local =
      storage();

    const session =
      storage();

    const app =
      await application({
        local,
        session,
      });

    app.settings.warmupFails =
      true;

    await app.quote();

    app.cold();

    app.settings.warmupFails =
      false;

    await app.submit();

    const saved =
      clone(
        app.pending(),
      );

    app.unmount();

    const restored =
      await application({
        local,
        session,
      });

    assert.deepEqual(
      restored.address(),
      delivery,
    );

    assert.equal(
      restored.pending()
        .payload.checkoutToken,

      saved.payload
        .checkoutToken,
    );

    assert.ok(
      restored.button(
        "Resume payment",
      ),
    );

    restored.unmount();
  },
);

test(
  "timing entries use fixed step names without address or payment identifiers",
  async () => {
    const app =
      await application();

    await app.quote();
    await app.submit();

    assert.ok(
      app.metrics.includes(
        "gymdrobe:checkout:fresh_quote",
      ),
    );

    assert.ok(
      app.metrics.includes(
        "gymdrobe:checkout:order_create",
      ),
    );

    assert.ok(
      app.metrics.every(
        (name) =>
          /^gymdrobe:checkout:[a-z_]+$/.test(
            name,
          ),
      ),
    );

    app.unmount();
  },
);

test(
  "the controlled cold-payment sequence takes 500ms instead of the previous serial 1000ms",
  async () => {
    const app =
      await application({
        source:
          process.env
            .GYMDROBE_CHECKOUT_FLOW_TEST_SOURCE,
      });

    await app.quote();
    app.cold();

    app.settings.simulateLatency =
      true;

    const paying =
      app.submit();

    await app.finishNetwork();
    await paying;

    assert.equal(
      app.events.filter(
        (event) =>
          event.name ===
          "order",
      ).length,

      1,
    );

    assert.equal(
      app.clock,
      500,
      "Mock guest=200ms, SDK=400ms, quote=300ms, order=100ms; these are not live timings",
    );

    app.unmount();
  },
);

test(
  "the Pay lock remains held during order creation and the payment window",
  async () => {
    const app =
      await application();

    await app.quote();

    app.settings.orderGate =
      deferred();

    app.settings.popupGate =
      deferred();

    const paying =
      app.submit();

    await tick();
    app.render();

    await app.submit();
    await tick();

    assert.equal(
      app.events.filter(
        (event) =>
          event.name ===
          "order",
      ).length,

      1,
    );

    app.settings.orderGate
      .resolve();

    await tick();
    app.render();

    const resume =
      app.button(
        "Resume payment",
      );

    assert.ok(resume);

    assert.equal(
      resume.props.disabled,
      true,
    );

    await resume.props
      .onClick();

    await app.submit();

    assert.equal(
      app.events.filter(
        (event) =>
          event.name ===
          "order",
      ).length,

      1,
    );

    assert.equal(
      app.events.filter(
        (event) =>
          event.name ===
          "popup",
      ).length,

      1,
    );

    app.settings.popupGate
      .reject(
        Object.assign(
          Error("Cancelled"),

          {
            code:
              "RAZORPAY_CANCELLED",
          },
        ),
      );

    await paying;

    app.unmount();
  },
);
