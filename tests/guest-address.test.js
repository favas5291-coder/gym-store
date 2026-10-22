import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { transformWithOxc } from "vite";

import {
  EMPTY_ADDRESS,
  normalizeAddress,
} from "../src/utils/customerData.js";

import {
  checkoutAddress,
} from "../src/utils/checkoutPayment.js";

import {
  userKey,
} from "../src/utils/storage.js";

const guestKey = "gymdrobe-checkout-address:guest";

const delivery = {
  ...EMPTY_ADDRESS,
  fullName: "Guest Customer",
  email: "guest@example.test",
  phone: "9876543210",
  addressLine: "12 Workout Street",
  landmark: "Near the gym",
  city: "Kozhikode",
  state: "Kerala",
  pincode: "673001",
};

const clone = (value) =>
  JSON.parse(JSON.stringify(value));

function storage(blocked = false) {
  const data = new Map();

  return {
    getItem(key) {
      if (blocked) {
        throw Error("Storage blocked");
      }

      return data.get(key) ?? null;
    },

    setItem(key, value) {
      if (blocked) {
        throw Error("Storage blocked");
      }

      data.set(key, String(value));
    },

    removeItem(key) {
      if (blocked) {
        throw Error("Storage blocked");
      }

      data.delete(key);
    },
  };
}

const h = (type, props, ...children) => ({
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
    ? node.children.map(content).join(" ")
    : String(node ?? "");

async function application({
  local = storage(),
  session = storage(),
  user = null,
  mode = "cart",
  attempt = null,
  file = null,
} = {}) {
  const filename =
    file ||
    new URL(
      "../src/pages/CheckoutPaymentPage.jsx",
      import.meta.url,
    );

  const source = (
    await fs.readFile(filename, "utf8")
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

  const output = await transformWithOxc(
    source,
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

  let si = 0;
  let ri = 0;
  let ei = 0;
  let nextTimer = 0;

  const read = (target, key, fallback) => {
    try {
      return (
        JSON.parse(
          target.getItem(key) || "null",
        ) ?? fallback
      );
    } catch {
      return fallback;
    }
  };

  const write = (target, key, value) => {
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

  const shoppingKey = (base) =>
    user
      ? userKey(base, user)
      : base;

  if (attempt) {
    session.setItem(
      shoppingKey(
        "gymdrobe-active-checkout-v2",
      ),
      JSON.stringify(attempt),
    );
  }

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
      EMPTY_ADDRESS,
      normalizeAddress,
      checkoutAddress,
      userKey,
      localStorage: local,
      sessionStorage: session,
      AbortController,

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
        (refs[ri++] ||= {
          current: value,
        }),

      useEffect(fn, deps) {
        const i = ei++;
        const previous = effects[i];

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
            previous: previous?.cleanup,
            pending: true,
          };
        }
      },

      setTimeout(fn) {
        const id = ++nextTimer;

        timers.set(id, fn);

        return id;
      },

      clearTimeout: (id) =>
        timers.delete(id),

      window: {
        addEventListener() {},
        removeEventListener() {},
      },

      useNavigate: () => () => {},

      useStore: () => ({
        shoppingKey,
        catalogReady: true,
        coupon: null,

        cart: [
          {
            id: "product",
            quantity: 1,
          },
        ],

        buyNowItem: {
          id: "product",
          quantity: 1,
        },
      }),

      useCatalog: () => ({
        products: [],
        loading: false,
        error: null,
      }),

      useShoppingTools: () => ({
        checkoutKeys: [],
      }),

      selectedBag: (rows) => rows,

      reviewCart: () => ({
        rows: [],
        canCheckout: false,
        totalsKnown: false,
        itemCount: 1,
      }),

      containsKit: () => false,
      kitSelectionIssue: () => "",

      readStorage: (key, fallback) =>
        read(local, key, fallback),

      writeStorage: (key, value) =>
        write(local, key, value),

      readSession: (key, fallback) =>
        read(session, key, fallback),

      writeSession: (key, value) =>
        write(session, key, value),

      pincodeForCheckout: (key, value) =>
        value || "",

      validPincode: (value) =>
        /^[1-9]\d{5}$/.test(
          String(value || ""),
        ),

      savedPincode: () => "",

      savePincode() {},

      clearPincode(key) {
        try {
          local.removeItem(key);
          local.removeItem(
            `${key}:selected`,
          );
        } catch {}

        try {
          session.removeItem(key);
          session.removeItem(
            `${key}:selected`,
          );
        } catch {}
      },

      getAddresses: async () => [],

      Link: "Link",
      AddressForm: "AddressForm",
      EmptyState: "EmptyState",
      ProductImage: "ProductImage",
      CouponBox: "CouponBox",
      CheckoutKitReview: "CheckoutKitReview",

      FREE_SHIPPING_LIMIT: 500,

      money: (value) => String(value),
    },
  );

  const render = () => {
    si = 0;
    ri = 0;
    ei = 0;

    const tree = module.exports.Checkout({
      auth: {
        user,
        token: user
          ? "account-token"
          : null,
      },
      mode,
    });

    for (const effect of effects) {
      if (effect.pending) {
        effect.previous?.();
        effect.pending = false;
        effect.cleanup = effect.fn();
      }
    }

    return tree;
  };

  const address = () =>
    clone(
      nodes(render()).find(
        (node) =>
          node.type === "AddressForm",
      ).props.value,
    );

  render();

  return {
    render,
    address,
    local,
    session,

    edit(value) {
      nodes(render())
        .find(
          (node) =>
            node.type === "AddressForm",
        )
        .props.onChange(value);
    },

    clear() {
      const button = nodes(render()).find(
        (node) =>
          node.type === "button" &&
          /Clear saved delivery details/.test(
            content(node),
          ),
      );

      assert.ok(
        button,
        "Guest details must have a clear control",
      );

      assert.equal(
        button.props.type,
        "button",
      );

      button.props.onClick();
    },

    unmount() {
      effects.forEach(
        (effect) =>
          effect.cleanup?.(),
      );
    },

    timers,
  };
}

test(
  "guest address survives immediate refresh before the old 300ms autosave could run",
  async () => {
    const local = storage();
    const session = storage();

    const app = await application({
      local,
      session,
      file:
        process.env.GYMDROBE_CHECKOUT_TEST_SOURCE,
    });

    app.edit(delivery);
    app.unmount();

    const refreshed = await application({
      local,
      session,
      file:
        process.env.GYMDROBE_CHECKOUT_TEST_SOURCE,
    });

    assert.deepEqual(
      refreshed.address(),
      delivery,
    );

    refreshed.unmount();
  },
);

test(
  "initial empty form and Strict Mode cleanup never overwrite a stored guest address",
  async () => {
    const local = storage();
    const session = storage();

    local.setItem(
      guestKey,
      JSON.stringify(delivery),
    );

    const before = local.getItem(guestKey);

    const app = await application({
      local,
      session,
    });

    assert.deepEqual(
      app.address(),
      delivery,
    );

    app.unmount();

    assert.equal(
      local.getItem(guestKey),
      before,
    );

    const remounted = await application({
      local,
      session,
    });

    assert.deepEqual(
      remounted.address(),
      delivery,
    );

    remounted.unmount();
  },
);

test(
  "guest details restore in every checkout mode and later edits replace the saved draft",
  async () => {
    const local = storage();
    const session = storage();

    const first = await application({
      local,
      session,
    });

    first.edit(delivery);
    first.unmount();

    for (const mode of [
      "buy-now",
      "selection",
      "cart",
    ]) {
      const app = await application({
        local,
        session,
        mode,
      });

      assert.deepEqual(
        app.address(),
        delivery,
      );

      app.unmount();
    }

    const editor = await application({
      local,
      session,
    });

    editor.edit({
      ...delivery,
      fullName: "Updated Guest",
      city: "Kochi",
      pincode: "682001",
    });

    editor.unmount();

    const latest = await application({
      local,
      session,
    });

    assert.equal(
      latest.address().fullName,
      "Updated Guest",
    );

    assert.equal(
      latest.address().city,
      "Kochi",
    );

    assert.equal(
      latest.address().pincode,
      "682001",
    );

    latest.unmount();
  },
);

test(
  "a blocked local store falls back to the tab copy after a full remount",
  async () => {
    const local = storage(true);
    const session = storage();

    const app = await application({
      local,
      session,
    });

    app.edit(delivery);

    assert.match(
      content(app.render()),
      /saved in this tab/,
    );

    app.unmount();

    const restored = await application({
      local,
      session,
    });

    assert.deepEqual(
      restored.address(),
      delivery,
    );

    restored.unmount();
  },
);

test(
  "malformed stored shapes and unexpected fields do not crash or enter checkout",
  async () => {
    for (const invalid of [
      "[broken",
      "null",
      "42",
      '"address"',
      "[]",
    ]) {
      const local = storage();
      const session = storage();

      local.setItem(
        guestKey,
        invalid,
      );

      session.setItem(
        guestKey,
        JSON.stringify(delivery),
      );

      const app = await application({
        local,
        session,
      });

      assert.deepEqual(
        app.address(),
        delivery,
      );

      app.unmount();
    }

    const local = storage();
    const session = storage();

    local.setItem(
      guestKey,
      JSON.stringify({
        ...delivery,
        admin: true,
        phone: {
          secret: "ignore",
        },
        city: "Kozhikode\u0000",
      }),
    );

    const app = await application({
      local,
      session,
    });

    assert.equal(
      app.address().phone,
      "",
    );

    assert.equal(
      app.address().city,
      "Kozhikode",
    );

    assert.equal(
      Object.hasOwn(
        app.address(),
        "admin",
      ),
      false,
    );

    app.unmount();
  },
);

test(
  "guest drafts and signed-in account drafts remain separate, including _id-only accounts",
  async () => {
    const local = storage();
    const session = storage();

    local.setItem(
      guestKey,
      JSON.stringify(delivery),
    );

    for (const user of [
      {
        id: "account-a",
        email: "account@example.test",
      },
      {
        _id: "account-b",
      },
    ]) {
      const account = await application({
        local,
        session,
        user,
      });

      assert.equal(
        account.address().addressLine,
        "",
      );

      account.edit({
        ...delivery,
        fullName: "Account Customer",
      });

      account.unmount();

      const restored = await application({
        local,
        session,
        user,
      });

      assert.equal(
        restored.address().fullName,
        "Account Customer",
      );

      restored.unmount();
    }

    const guest = await application({
      local,
      session,
    });

    assert.equal(
      guest.address().fullName,
      "Guest Customer",
    );

    guest.unmount();
  },
);

test(
  "clearing a guest address removes its legacy copy and cannot resurrect it on refresh",
  async () => {
    const local = storage();
    const session = storage();

    local.setItem(
      guestKey,
      JSON.stringify(delivery),
    );

    local.setItem(
      "gymdrobe-delivery-pincode",
      JSON.stringify("673001"),
    );

    const app = await application({
      local,
      session,
    });

    app.clear();

    assert.deepEqual(
      app.address(),
      EMPTY_ADDRESS,
    );

    assert.equal(
      local.getItem(guestKey),
      null,
    );

    assert.equal(
      local.getItem(
        "gymdrobe-delivery-pincode",
      ),
      null,
    );

    app.unmount();

    const restored = await application({
      local,
      session,
    });

    assert.deepEqual(
      restored.address(),
      EMPTY_ADDRESS,
    );

    restored.unmount();
  },
);

test(
  "blocked storage keeps editing usable and warns that refresh cannot be guaranteed",
  async () => {
    const app = await application({
      local: storage(true),
      session: storage(true),
    });

    app.edit(delivery);

    assert.deepEqual(
      app.address(),
      delivery,
    );

    assert.match(
      content(app.render()),
      /may be lost after refreshing/,
    );

    app.clear();

    assert.deepEqual(
      app.address(),
      EMPTY_ADDRESS,
    );

    assert.match(
      content(app.render()),
      /prevented permanently clearing/,
    );

    app.unmount();
  },
);

test(
  "a newer tab draft wins over an older browser draft",
  async () => {
    const local = storage();
    const session = storage();

    const record = (savedAt, address) =>
      JSON.stringify({
        version: 1,
        savedAt,
        address,
      });

    local.setItem(
      `${guestKey}:draft-v2`,
      record(
        Date.now() - 2000,
        delivery,
      ),
    );

    session.setItem(
      `${guestKey}:draft-v2`,
      record(
        Date.now() - 1000,
        {
          ...delivery,
          city: "Kochi",
          pincode: "682001",
        },
      ),
    );

    const app = await application({
      local,
      session,
    });

    assert.equal(
      app.address().city,
      "Kochi",
    );

    app.unmount();
  },
);

test(
  "payment recovery retains the reviewed address and prevents clearing it during confirmation",
  async () => {
    const local = storage();
    const session = storage();

    local.setItem(
      guestKey,
      JSON.stringify({
        ...delivery,
        city: "Kochi",
      }),
    );

    const app = await application({
      local,
      session,

      attempt: {
        phase: "starting",

        payload: {
          shippingAddress: delivery,
        },
      },
    });

    assert.deepEqual(
      app.address(),
      delivery,
    );

    const control = nodes(
      app.render(),
    ).find(
      (node) =>
        node.type === "button" &&
        /Clear saved delivery details/.test(
          content(node),
        ),
    );

    assert.equal(
      control.props.disabled,
      true,
    );

    control.props.onClick();

    assert.deepEqual(
      app.address(),
      delivery,
    );

    app.unmount();
  },
);
