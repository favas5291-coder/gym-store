import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs
  .readFileSync(
    new URL(
      "../src/services/packagePlanApi.js",
      import.meta.url,
    ),
    "utf8",
  )
  .replace(
    "import.meta.env.VITE_API_URL",
    "undefined",
  )
  .replace(/export /g, "");

let sent;
let response;
let transportFailure;

const context = {
  URLSearchParams,
  DOMException,
  AbortController,
  Date,
  setTimeout,
  clearTimeout,

  module: {
    exports: {},
  },

  fetch: async (url, options) => {
    sent = {
      url,
      method: options.method,
      body:
        options.body &&
        JSON.parse(options.body),
      headers: options.headers,
    };

    if (transportFailure) {
      throw transportFailure;
    }

    return {
      ok: response.status < 400,
      status: response.status,
      json: async () => response.data,
    };
  },
};

vm.runInNewContext(
  source +
    "\nmodule.exports = { packagePlanBody, packageAllocationIssues, getPackagePlans, getPackagePlan, savePackagePlan, confirmPackagePlan };",
  context,
);

const api = context.module.exports;

const id = "507f1f77bcf86cd799439011";
const productId = "507f1f77bcf86cd799439012";

function plan() {
  return {
    id,
    version: 4,
    name: "Measured kit",
    status: "draft",

    origin: {
      kind: "gymdrobe",
      name: "Actual stock room",
      pickupPincode: "682001",
      packingLocation: null,
      supplier: null,
    },

    components: [
      {
        key: "shirt",
        product: productId,
        selectedSize: "M",
        selectedColor: "Black",
        quantity: 2,
      },
    ],

    parcels: [
      {
        key: "parcel-one",
        label: "Kit parcel",
        weightGrams: 1200,
        lengthMm: 350,
        widthMm: 250,
        heightMm: 100,

        contents: [
          {
            componentKey: "shirt",
            quantity: 2,
          },
        ],
      },
    ],

    notes: "Internal",

    verification: {
      confirmedAt: null,
      confirmedBy: null,
      measurementReference: "",
      validUntil: null,
    },

    ready: false,
    purchaseEnabled: false,
    packageCount: 1,

    readinessIssues: [
      "Measurements not confirmed",
    ],
  };
}

function reset(value = plan()) {
  sent = null;
  transportFailure = null;

  response = {
    status: 200,

    data: {
      success: true,
      plan: value,
    },
  };
}

test(
  "editable payload strips server audit, stale versions, sourcing links and unknown properties",
  () => {
    const input = plan();

    input.verification.confirmedBy = id;
    input.meeshoProductLink = "private";
    input.components[0].price = 1;

    const output = api.packagePlanBody(input);

    for (const key of [
      "id",
      "version",
      "verification",
      "meeshoProductLink",
      "ready",
    ]) {
      assert.equal(
        Object.hasOwn(output, key),
        false,
      );
    }

    assert.equal(
      Object.hasOwn(
        output.components[0],
        "price",
      ),
      false,
    );

    assert.equal(
      output.parcels[0].weightGrams,
      1200,
    );
  },
);

test(
  "draft accepts unknown dimensions but confirmation readiness identifies them",
  () => {
    const input = plan();

    input.parcels[0].weightGrams = null;

    assert.equal(
      api.packagePlanBody(input)
        .parcels[0]
        .weightGrams,
      null,
    );

    assert.ok(
      api.packageAllocationIssues(input).some(
        (issue) => issue.includes("weight"),
      ),
    );
  },
);

test(
  "parcel allocation catches missing, over-allocated and duplicate physical units",
  () => {
    for (const quantity of [0, 1, 3]) {
      const input = plan();

      input.parcels[0]
        .contents[0]
        .quantity = quantity;

      assert.ok(
        api.packageAllocationIssues(input).length,
      );
    }

    const input = plan();

    input.parcels.push({
      ...structuredClone(input.parcels[0]),
      key: "parcel-two",
    });

    assert.ok(
      api.packageAllocationIssues(input).some(
        (issue) => issue.includes("4 of 2"),
      ),
    );

    assert.equal(
      api.packageAllocationIssues(plan()).length,
      0,
    );
  },
);

test(
  "invalid and duplicate component variants, unknown allocations and measurements cannot be saved",
  () => {
    const changes = [
      (input) => {
        input.components[0].product = "invalid";
      },

      (input) => {
        input.components[0].quantity = 1.5;
      },

      (input) => {
        input.components.push({
          ...input.components[0],
          key: "shirt-two",
        });
      },

      (input) => {
        input.parcels[0]
          .contents[0]
          .componentKey = "unknown";
      },

      (input) => {
        input.parcels[0].contents.push({
          ...input.parcels[0].contents[0],
        });
      },

      (input) => {
        input.parcels[0].weightGrams = -1;
      },

      (input) => {
        input.parcels[0].widthMm = 10001;
      },
    ];

    for (const change of changes) {
      const input = plan();

      change(input);

      assert.throws(() =>
        api.packagePlanBody(input),
      );
    }
  },
);

test(
  "create uses POST; edits include current version via PUT instead of trusting supplied version",
  async () => {
    reset();

    const input = plan();
    input.version = 999;

    await api.savePackagePlan(
      "test-token",
      null,
      input,
    );

    assert.equal(sent.method, "POST");

    assert.equal(
      Object.hasOwn(sent.body, "version"),
      false,
    );

    await api.savePackagePlan(
      "test-token",
      plan(),
      input,
    );

    assert.equal(sent.method, "PUT");
    assert.equal(sent.body.version, 4);

    assert.equal(
      sent.headers.Authorization,
      "Bearer test-token",
    );
  },
);

test(
  "version conflicts remain recoverable and are not reported as a successful write",
  async () => {
    reset();

    response = {
      status: 409,

      data: {
        success: false,
        message: "Reload the latest plan",
      },
    };

    await assert.rejects(
      api.savePackagePlan(
        "test-token",
        plan(),
        plan(),
      ),
      (error) =>
        error.status === 409 &&
        error.message.includes("Reload"),
    );
  },
);

test(
  "network failure and unreadable successful saves report an unknown result",
  async () => {
    reset();

    transportFailure = new TypeError("offline");

    await assert.rejects(
      api.savePackagePlan(
        "test-token",
        null,
        plan(),
      ),
      (error) => error.resultUnknown === true,
    );

    reset();

    response.data = {
      success: true,
    };

    await assert.rejects(
      api.savePackagePlan(
        "test-token",
        plan(),
        plan(),
      ),
      (error) => error.resultUnknown === true,
    );
  },
);

test(
  "confirmation rejects past expiry and active records without sending a request",
  async () => {
    reset();

    const input = plan();
    input.status = "active";

    await assert.rejects(
      api.confirmPackagePlan(
        "test-token",
        input,
        {},
      ),
    );

    assert.equal(sent, null);

    await assert.rejects(
      api.confirmPackagePlan(
        "test-token",
        plan(),
        {
          measurementReference: "Measured",
          validUntil: "2000-01-01T00:00:00Z",
        },
      ),
    );

    assert.equal(sent, null);
  },
);

test(
  "confirmation requires the returned server audit to match and submits only measurement reference, expiry and version",
  async () => {
    const input = plan();

    const validUntil = new Date(
      Date.now() + 86400000,
    ).toISOString();

    const confirmed = plan();

    confirmed.verification = {
      confirmedAt: new Date().toISOString(),
      confirmedBy: id,
      measurementReference: "Packing record",
      validUntil,
    };

    reset(confirmed);

    await api.confirmPackagePlan(
      "test-token",
      input,
      {
        measurementReference: " Packing record ",
        validUntil,
      },
    );

    assert.equal(sent.method, "POST");
    assert.equal(sent.body.version, 4);

    assert.equal(
      Object.hasOwn(sent.body, "confirmedBy"),
      false,
    );

    reset();

    await assert.rejects(
      api.confirmPackagePlan(
        "test-token",
        input,
        {
          measurementReference: "Packing record",
          validUntil,
        },
      ),
      (error) => error.resultUnknown === true,
    );
  },
);

test(
  "missing login, invalid IDs and cancelled reads never call the API",
  async () => {
    reset();

    await assert.rejects(
      api.getPackagePlan("", id),
    );

    assert.equal(sent, null);

    await assert.rejects(
      api.getPackagePlan(
        "test-token",
        "../bad",
      ),
    );

    assert.equal(sent, null);

    const abort = new AbortController();
    abort.abort();

    await assert.rejects(
      api.getPackagePlan(
        "test-token",
        id,
        {
          signal: abort.signal,
        },
      ),
      (error) => error.name === "AbortError",
    );

    assert.equal(sent, null);
  },
);

test(
  "list includes pagination and filters and rejects malformed server plans",
  async () => {
    reset();

    response.data = {
      success: true,
      plans: [plan()],
      page: 2,
      pages: 3,
      total: 30,
    };

    const list = await api.getPackagePlans(
      "test-token",
      {
        page: 2,
        search: "kit",
        status: "draft",
      },
    );

    assert.equal(list.total, 30);
    assert.ok(sent.url.includes("page=2"));
    assert.ok(sent.url.includes("search=kit"));

    response.data.plans[0].packageCount = 2;

    await assert.rejects(
      api.getPackagePlans("test-token"),
    );
  },
);

// Render actual page JSX without a live database.
const {
  transformWithOxc,
} = await import("vite");

const pageSource = fs
  .readFileSync(
    new URL(
      "../src/pages/AdminPackagePlansPage.jsx",
      import.meta.url,
    ),
    "utf8",
  )
  // Support Windows CRLF and Unix LF files.
  .replace(/\r\n?/g, "\n")
  .replace(/^import[\s\S]*?;\n/gm, "")
  .replace(
    "export default function",
    "function",
  );

const transformed = await transformWithOxc(
  pageSource,
  "AdminPackagePlansPage.jsx",
  {
    jsx: {
      runtime: "classic",
      pragma: "h",
      pragmaFrag: "Fragment",
    },
  },
);

function ui(
  auth = {
    user: {
      id,
      role: "admin",
    },
    token: "test-token",
  },
  save = async () => plan(),
) {
  const cells = [];
  const refs = [];

  let cursor = 0;
  let refCursor = 0;

  const h = (type, props, ...children) => ({
    type,
    props: props || {},
    children: children.flat(Infinity),
  });

  const deps = {
    useState: (initial) => {
      const index = cursor++;

      if (!(index in cells)) {
        cells[index] =
          typeof initial === "function"
            ? initial()
            : initial;
      }

      return [
        cells[index],

        (value) => {
          cells[index] =
            typeof value === "function"
              ? value(cells[index])
              : value;
        },
      ];
    },

    useRef: (value) => {
      const index = refCursor++;

      return (
        refs[index] ||= {
          current: value,
        }
      );
    },

    useEffect: () => {},
    useCallback: (fn) => fn,
    useAuth: () => auth,

    h,
    Fragment: "fragment",
    Link: "Link",
    structuredClone,

    crypto: {
      randomUUID: () => "fixture-key",
    },

    window: {
      confirm: () => true,
    },

    MEASUREMENTS: [
      ["weightGrams", "Weight", 500000],
      ["lengthMm", "Length", 10000],
      ["widthMm", "Width", 10000],
      ["heightMm", "Height", 10000],
    ],

    packagePlanBody:
      api.packagePlanBody,

    packageAllocationIssues:
      api.packageAllocationIssues,

    getPackagePlans: async () => ({
      plans: [],
    }),

    getPackagePlan: async () => plan(),
    savePackagePlan: save,
    confirmPackagePlan: async () => plan(),

    getAdminProducts: async () => ({
      products: [],
    }),

    getAdminProductById: async () => ({}),

    getSuppliers: async () => ({
      suppliers: [],
    }),

    getPackingLocations: async () => ({
      locations: [],
    }),

    getVariantStock: () => 0,
  };

  const render = new Function(
    ...Object.keys(deps),

    transformed.code +
      "\nreturn { AdminPackagePlansPage, Editor };",
  )(
    ...Object.values(deps),
  );

  return {
    render(name, props) {
      cursor = 0;
      refCursor = 0;

      return render[name](props);
    },
  };
}

function nodes(tree) {
  return tree && typeof tree === "object"
    ? [
        tree,
        ...tree.children.flatMap(nodes),
      ]
    : [];
}

function content(tree) {
  return tree && typeof tree === "object"
    ? tree.children.map(content).join(" ")
    : String(tree ?? "");
}

function button(tree, label) {
  return nodes(tree).find(
    (row) =>
      row.type === "button" &&
      content(row) === label,
  );
}

const props = (initial) => ({
  token: "test-token",
  initial,
  onDenied() {},
  onSaved() {},
  onClose() {},
});

test(
  "admin page blocks non-admin and disabled users, and waits for restored authentication",
  () => {
    for (const user of [
      null,
      { role: "customer" },
      { role: "admin", isActive: false },
    ]) {
      assert.match(
        content(
          ui({
            user,
            token: "test-token",
          }).render("AdminPackagePlansPage"),
        ),
        /active admin session/,
      );
    }

    assert.match(
      content(
        ui({
          loading: true,
        }).render("AdminPackagePlansPage"),
      ),
      /Checking admin access/,
    );
  },
);

test(
  "editor shows exact saved variants and allocation warnings while preventing unconfirmed activation",
  () => {
    const record = plan();

    record.parcels[0]
      .contents[0]
      .quantity = 1;

    const tree = ui().render(
      "Editor",
      props(record),
    );

    assert.match(content(tree), /M.*Black/);

    assert.match(
      content(tree),
      /1 of 2 units allocated/,
    );

    assert.equal(
      button(tree, "Activate plan")
        .props.disabled,
      true,
    );
  },
);

test(
  "network-interrupted edits lock further writes; reload clears the uncertainty",
  async () => {
    const harness = ui(
      undefined,

      async () => {
        const error = new Error(
          "Unknown save result",
        );

        error.resultUnknown = true;

        throw error;
      },
    );

    const initial = plan();

    initial.components = [];
    initial.parcels = [];
    initial.packageCount = 0;

    const editorProps = props(initial);

    let tree = harness.render(
      "Editor",
      editorProps,
    );

    nodes(tree)
      .find(
        (row) =>
          row.type === "input" &&
          row.props.value === initial.name,
      )
      .props.onChange({
        target: {
          value: "Updated name",
        },
      });

    tree = harness.render(
      "Editor",
      editorProps,
    );

    nodes(tree)
      .find(
        (row) => row.type === "form",
      )
      .props.onSubmit({
        preventDefault() {},
      });

    await new Promise(
      (resolve) => setImmediate(resolve),
    );

    tree = harness.render(
      "Editor",
      editorProps,
    );

    assert.match(
      content(tree),
      /Saving is locked until you reload/,
    );

    await button(
      tree,
      "Reload saved plan",
    ).props.onClick();

    tree = harness.render(
      "Editor",
      editorProps,
    );

    assert.doesNotMatch(
      content(tree),
      /Saving is locked until you reload/,
    );
  },
);