import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { transformWithOxc } from "vite";

import {
  buyingInformation,
} from "../src/utils/productInformation.js";

import {
  validPincode,
} from "../src/utils/deliveryPincode.js";

const storage = () => {
  const rows = new Map();

  return {
    getItem: (key) => rows.get(key) ?? null,
    setItem: (key, value) => rows.set(key, value),
    removeItem: (key) => rows.delete(key),
  };
};

let revision = 0;

const freshStorage = () =>
  import(
    `../src/utils/deliveryPincode.js?revision=${++revision}`
  );

async function browserStores(local, session, run) {
  const names = [
    "localStorage",
    "sessionStorage",
  ];

  const previous = names.map((name) =>
    Object.getOwnPropertyDescriptor(
      globalThis,
      name,
    ),
  );

  for (const [i, value] of [local, session].entries()) {
    Object.defineProperty(globalThis, names[i], {
      configurable: true,

      get: () => {
        if (value instanceof Error) {
          throw value;
        }

        return value;
      },
    });
  }

  try {
    await run();
  } finally {
    names.forEach((name, i) => {
      if (previous[i]) {
        Object.defineProperty(
          globalThis,
          name,
          previous[i],
        );
      } else {
        delete globalThis[name];
      }
    });
  }
}

test(
  "pincode validation accepts only six digits with a nonzero first digit",
  () => {
    for (const value of [
      "",
      "012345",
      "12345",
      "1234567",
      "67300x",
      null,
      {},
    ]) {
      assert.equal(
        validPincode(value),
        false,
      );
    }

    assert.equal(
      validPincode("673001"),
      true,
    );
  },
);

test(
  "saved pincodes restore after reload, can change, and keep guest/account keys separate",
  () =>
    browserStores(
      storage(),
      storage(),
      async () => {
        let api = await freshStorage();

        assert.equal(
          api.savePincode("pin", "673001"),
          true,
        );

        api = await freshStorage();

        assert.equal(
          api.savedPincode("pin"),
          "673001",
        );

        assert.equal(
          api.savedPincode("pin:user-a"),
          "",
        );

        api.savePincode(
          "pin:user-a",
          "682001",
        );

        api.savePincode(
          "pin",
          "695001",
        );

        api = await freshStorage();

        assert.equal(
          api.savedPincode("pin"),
          "695001",
        );

        assert.equal(
          api.savedPincode("pin:user-a"),
          "682001",
        );
      },
    ),
);

test(
  "blocked local storage and malformed values fall back to a valid tab copy",
  async () => {
    const local = storage();
    const tab = storage();

    local.setItem(
      "pin",
      "[malformed",
    );

    tab.setItem(
      "pin",
      JSON.stringify("673001"),
    );

    await browserStores(
      local,
      tab,
      async () => {
        const api = await freshStorage();

        assert.equal(
          api.savedPincode("pin"),
          "673001",
        );
      },
    );

    await browserStores(
      new Error("blocked"),
      tab,
      async () => {
        let api = await freshStorage();

        assert.equal(
          api.savePincode("pin", "682001"),
          true,
        );

        api = await freshStorage();

        assert.equal(
          api.savedPincode("pin"),
          "682001",
        );
      },
    );
  },
);

test(
  "fully blocked storage keeps the current visit usable and reports nonpersistent saving",
  () =>
    browserStores(
      new Error("blocked"),
      new Error("blocked"),
      async () => {
        const api = await freshStorage();

        assert.equal(
          api.savePincode("pin", "673001"),
          false,
        );

        assert.equal(
          api.savedPincode("pin"),
          "673001",
        );

        const reloaded = await freshStorage();

        assert.equal(
          reloaded.savedPincode("pin"),
          "",
        );
      },
    ),
);

const h = (type, props, ...children) => ({
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

const text = (tree) =>
  tree && typeof tree === "object"
    ? tree.children.map(text).join(" ")
    : String(tree ?? "");

const product = {
  id: "a".repeat(24),

  delivery: {
    available: true,
    estimatedDays: "3–5 days",
  },
};

async function component({
  load = async () => product,
  initial = "",
  persistent = true,
} = {}) {
  const states = [];
  const refs = [];
  const cleanups = [];
  const saved = [];

  let si = 0;
  let ri = 0;

  const source = (
    await fs.readFile(
      new URL(
        "../src/components/DeliveryPincode.jsx",
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
      "export default function",
      "function",
    );

  const output = await transformWithOxc(
    source,
    "DeliveryPincode.jsx",
    {
      jsx: {
        runtime: "classic",
        pragma: "h",
        pragmaFrag: "Fragment",
      },
    },
  );

  const module = {
    exports: {},
  };

  vm.runInNewContext(
    output.code +
      "\nmodule.exports=DeliveryPincode;",
    {
      h,
      Fragment: "fragment",
      module,
      AbortController,
      buyingInformation,
      validPincode,

      useId: () => "pin",

      useState: (value) => {
        const i = si++;

        if (!(i in states)) {
          states[i] =
            typeof value === "function"
              ? value()
              : value;
        }

        return [
          states[i],

          (next) =>
            (states[i] =
              typeof next === "function"
                ? next(states[i])
                : next),
        ];
      },

      useRef: (value) =>
        (refs[ri++] ||= {
          current: value,
        }),

      useEffect: (fn) => {
        if (!cleanups.length) {
          cleanups.push(fn());
        }
      },

      savedPincode: () => initial,

      savePincode: (key, code) => {
        saved.push({
          key,
          code,
        });

        return persistent;
      },

      getProductById: load,
    },
  );

  const render = () => {
    si = 0;
    ri = 0;

    return module.exports({
      product,
      storageKey: "pin",
    });
  };

  const find = (type) =>
    nodes(render()).find(
      (node) => node.type === type,
    );

  return {
    render,
    saved,
    find,

    input: (value) =>
      find("input").props.onChange({
        target: {
          value,
        },
      }),

    save: () =>
      find("button").props.onClick({
        preventDefault() {},
        stopPropagation() {},
      }),

    unmount: () =>
      cleanups.forEach((fn) => fn?.()),
  };
}

test(
  "invalid input makes no request and the save control cannot submit checkout",
  async () => {
    let calls = 0;

    const c = await component({
      load: async () => {
        calls++;
        return product;
      },
    });

    c.input("012345");

    await c.save();

    assert.equal(calls, 0);
    assert.equal(c.saved.length, 0);

    assert.equal(
      c.find("input").props["aria-invalid"],
      true,
    );

    assert.match(
      text(c.render()),
      /six-digit/,
    );

    assert.equal(
      c.find("button").props.type,
      "button",
    );
  },
);

test(
  "rapid repeated save clicks share one delivery check and save before the request finishes",
  async () => {
    let resolve;
    let calls = 0;

    const c = await component({
      load: () => {
        calls++;

        return new Promise((done) => {
          resolve = done;
        });
      },
    });

    c.input("673001");

    const first = c.save();
    const second = c.save();

    assert.equal(c.saved.length, 1);
    assert.equal(c.saved[0].code, "673001");
    assert.equal(calls, 1);

    assert.equal(
      c.find("button").props.disabled,
      true,
    );

    resolve(product);

    await Promise.all([
      first,
      second,
    ]);

    assert.equal(
      c.find("button").props.disabled,
      false,
    );

    assert.match(
      text(c.render()),
      /673001 saved/,
    );
  },
);

test(
  "a failed delivery refresh preserves the saved code and permits retry",
  async () => {
    let calls = 0;

    const c = await component({
      load: async () => {
        if (++calls === 1) {
          throw Error("offline");
        }

        return product;
      },
    });

    c.input("673001");

    await c.save();

    assert.match(
      text(c.render()),
      /could not be refreshed/,
    );

    assert.equal(
      c.find("input").props.value,
      "673001",
    );

    await c.save();

    assert.equal(calls, 2);

    assert.match(
      text(c.render()),
      /listed as available/,
    );
  },
);

test(
  "unavailable products still allow changing the pincode and do not claim delivery coverage",
  async () => {
    const c = await component({
      initial: "673001",

      load: async () => ({
        ...product,

        delivery: {
          available: false,
        },
      }),
    });

    c.input("682001");

    await c.save();

    assert.equal(
      c.saved[0].code,
      "682001",
    );

    assert.match(
      text(c.render()),
      /unavailable for delivery/,
    );

    assert.match(
      text(c.render()),
      /does not check live courier coverage/,
    );
  },
);

test(
  "leaving a product page aborts its check and ignores a late response",
  async () => {
    let resolve;
    let signal;

    const c = await component({
      load: (id, options) => {
        signal = options.signal;

        return new Promise((done) => {
          resolve = done;
        });
      },
    });

    c.input("673001");

    const pending = c.save();

    c.unmount();

    assert.equal(
      signal.aborted,
      true,
    );

    const before = text(c.render());

    resolve(product);

    await pending;

    assert.equal(
      text(c.render()),
      before,
    );
  },
);

test(
  "legacy saved addresses keep their pincode until a customer explicitly saves a replacement",
  () =>
    browserStores(
      storage(),
      storage(),
      async () => {
        localStorage.setItem(
          "pin",
          JSON.stringify("673001"),
        );

        let api = await freshStorage();

        assert.equal(
          api.pincodeForCheckout(
            "pin",
            "682001",
          ),
          "682001",
        );

        assert.equal(
          api.pincodeForCheckout("pin", ""),
          "673001",
        );

        api.savePincode(
          "pin",
          "695001",
        );

        api = await freshStorage();

        assert.equal(
          api.pincodeForCheckout(
            "pin",
            "682001",
          ),
          "695001",
        );
      },
    ),
);