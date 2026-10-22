import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

const guestToken = `gco_${"a".repeat(64)}`;

const clone = (value) =>
  JSON.parse(JSON.stringify(value));

const payload = (method = "razorpay") => ({
  checkoutToken: "checkout-fixture",
  paymentMethod: method,

  items: [
    {
      id: "507f1f77bcf86cd799439011",
      quantity: 1,
    },
  ],

  shippingAddress: {
    fullName: "Fixture Customer",
    pincode: "673001",
  },

  expectedTotal: 123.45,
});

const verification = () => ({
  checkoutToken: "checkout-fixture",
  razorpay_order_id: "order_fixture",
  razorpay_payment_id: "pay_fixture",
  razorpay_signature: "b".repeat(64),
});

const response = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
});

const aborted = () =>
  Object.assign(
    new Error("Aborted"),
    {
      name: "AbortError",
    },
  );

async function flush() {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
  }
}

async function api({
  send = async () =>
    response({
      success: true,
    }),

  access = true,
  file = null,
} = {}) {
  const filename =
    file ||
    new URL(
      "../src/services/paymentApi.js",
      import.meta.url,
    );

  const source = (
    await fs.readFile(
      filename,
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
      /import\.meta\.env\b/g,
      '({ VITE_API_URL: "https://api.example.test/api" })',
    )
    .replace(
      /^export\s+/gm,
      "",
    );

  const timers = new Map();
  const requests = [];

  let timerId = 0;

  let guest = access
    ? {
        token: guestToken,
      }
    : null;

  const module = {
    exports: {},
  };

  vm.runInNewContext(
    source +
      `
module.exports = {
  createRazorpayPaymentOrder,
  verifyRazorpayPayment,
  checkRazorpayPayment,
};
`,

    {
      module,
      AbortController,

      guestAccess: () =>
        guest,

      customerHeaders: (token) => ({
        ...(token
          ? {
              Authorization:
                `Bearer ${token}`,
            }
          : {}),

        ...(guest
          ? {
              "X-GymDrobe-Guest":
                guest.token,
            }
          : {}),
      }),

      fetch(url, options) {
        requests.push({
          url,
          options,
        });

        return send(
          url,
          options,
        );
      },

      setTimeout(fn, delay) {
        const id = ++timerId;

        timers.set(id, {
          fn,
          delay,
        });

        return id;
      },

      clearTimeout(id) {
        timers.delete(id);
      },
    },
  );

  return {
    ...module.exports,
    timers,
    requests,

    guest(value) {
      guest = value;
    },

    fire(delay) {
      const matches = [
        ...timers.values(),
      ].filter(
        (row) =>
          row.delay === delay,
      );

      assert.ok(
        matches.length,
        `A ${delay}ms timeout must exist`,
      );

      matches.forEach(
        (row) => row.fn(),
      );
    },
  };
}

test(
  "concurrent guest payment creation shares one POST for both online and COD advance",
  async () => {
    for (
      const method of [
        "razorpay",
        "cod-partial",
      ]
    ) {
      const releases = [];

      const client = await api({
        file:
          process.env
            .GYMDROBE_PAYMENT_API_TEST_SOURCE,

        send: () =>
          new Promise((resolve) => {
            releases.push(resolve);
          }),
      });

      const input =
        payload(method);

      const first =
        client.createRazorpayPaymentOrder(
          null,
          input,
        );

      const second =
        client.createRazorpayPaymentOrder(
          null,
          clone(input),
        );

      releases.forEach(
        (resolve) =>
          resolve(
            response({
              success: true,
              orderNumber: "GD-FIXTURE",
            }),
          ),
      );

      const results =
        await Promise.all([
          first,
          second,
        ]);

      assert.equal(
        client.requests.length,
        1,
      );

      const request =
        client.requests[0];

      assert.equal(
        request.options.method,
        "POST",
      );

      assert.equal(
        request.options.headers[
          "X-GymDrobe-Guest"
        ],
        guestToken,
      );

      assert.equal(
        request.options.headers
          .Authorization,
        undefined,
      );

      assert.deepEqual(
        JSON.parse(
          request.options.body,
        ),
        input,
      );

      assert.deepEqual(
        clone(results[0]),
        clone(results[1]),
      );

      assert.equal(
        client.timers.size,
        0,
      );
    }
  },
);

test(
  "changing checkout details during creation refuses a second request for the same attempt",
  async () => {
    let release;

    const client = await api({
      send: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    });

    const first =
      client.createRazorpayPaymentOrder(
        null,
        payload(),
      );

    await assert.rejects(
      client.createRazorpayPaymentOrder(
        null,
        {
          ...payload(),
          expectedTotal: 999,
        },
      ),

      (error) => {
        assert.equal(
          error.code,
          "PAYMENT_ATTEMPT_IN_PROGRESS",
        );

        assert.equal(
          error.data
            .verificationUncertain,
          true,
        );

        return true;
      },
    );

    assert.equal(
      client.requests.length,
      1,
    );

    release(
      response({
        success: true,
      }),
    );

    await first;
  },
);

test(
  "account, guest and distinct checkout attempts never share payment responses",
  async () => {
    const releases = [];

    const client = await api({
      send: () =>
        new Promise((resolve) => {
          releases.push(resolve);
        }),
    });

    const first =
      client.createRazorpayPaymentOrder(
        "account-a",
        payload(),
      );

    const second =
      client.createRazorpayPaymentOrder(
        "account-b",
        payload(),
      );

    const guest =
      client.createRazorpayPaymentOrder(
        null,
        payload(),
      );

    const different =
      client.createRazorpayPaymentOrder(
        null,
        {
          ...payload(),
          checkoutToken: "different",
        },
      );

    assert.equal(
      client.requests.length,
      4,
    );

    assert.equal(
      client.requests[0].options
        .headers.Authorization,
      "Bearer account-a",
    );

    assert.equal(
      client.requests[1].options
        .headers.Authorization,
      "Bearer account-b",
    );

    releases.forEach(
      (resolve) =>
        resolve(
          response({
            success: true,
          }),
        ),
    );

    await Promise.all([
      first,
      second,
      guest,
      different,
    ]);
  },
);

test(
  "repeated verification shares one signed verification request and a later check is fresh",
  async () => {
    const releases = [];

    const client = await api({
      send: () =>
        new Promise((resolve) => {
          releases.push(resolve);
        }),
    });

    const details =
      verification();

    const first =
      client.verifyRazorpayPayment(
        null,
        details,
      );

    const second =
      client.verifyRazorpayPayment(
        null,
        clone(details),
      );

    assert.equal(
      client.requests.length,
      1,
    );

    assert.deepEqual(
      JSON.parse(
        client.requests[0]
          .options.body,
      ),
      details,
    );

    releases[0](
      response({
        success: true,
      }),
    );

    await Promise.all([
      first,
      second,
    ]);

    const later =
      client.verifyRazorpayPayment(
        null,
        details,
      );

    assert.equal(
      client.requests.length,
      2,
    );

    releases[1](
      response({
        success: true,
      }),
    );

    await later;
  },
);

test(
  "stalled creation and verification time out without claiming an unpaid or failed result",
  async () => {
    for (
      const operation of [
        "create",
        "verify",
      ]
    ) {
      const client = await api({
        send: (url, options) =>
          new Promise(
            (resolve, reject) => {
              options.signal
                .addEventListener(
                  "abort",

                  () =>
                    reject(
                      aborted(),
                    ),

                  {
                    once: true,
                  },
                );
            },
          ),
      });

      const pending =
        operation === "create"
          ? client.createRazorpayPaymentOrder(
              null,
              payload(),
            )
          : client.verifyRazorpayPayment(
              null,
              verification(),
            );

      const checked =
        assert.rejects(
          pending,

          (error) => {
            assert.equal(
              error.code,
              "PAYMENT_REQUEST_TIMEOUT",
            );

            assert.equal(
              error.data
                .verificationUncertain,
              true,
            );

            assert.equal(
              error.data
                .orderCreationUncertain,
              operation === "create",
            );

            return true;
          },
        );

      client.fire(45000);

      await checked;

      assert.equal(
        client.requests[0]
          .options.signal.aborted,
        true,
      );

      assert.equal(
        client.timers.size,
        0,
      );
    }
  },
);

test(
  "a stalled JSON response is covered by the same payment timeout",
  async () => {
    const client = await api({
      send: async (url, options) => ({
        ok: true,
        status: 200,

        json: () =>
          new Promise(
            (resolve, reject) => {
              options.signal
                .addEventListener(
                  "abort",

                  () =>
                    reject(
                      aborted(),
                    ),

                  {
                    once: true,
                  },
                );
            },
          ),
      }),
    });

    const pending =
      client.createRazorpayPaymentOrder(
        null,
        payload(),
      );

    const checked =
      assert.rejects(
        pending,

        (error) =>
          error.code ===
            "PAYMENT_REQUEST_TIMEOUT" &&
          error.data
            .verificationUncertain ===
            true,
      );

    await flush();

    client.fire(45000);

    await checked;

    assert.equal(
      client.timers.size,
      0,
    );
  },
);

test(
  "interrupted creation releases only its local request lock and reuses the checkout token on retry",
  async () => {
    let calls = 0;

    const client = await api({
      send: async () => {
        calls++;

        if (calls === 1) {
          throw new TypeError(
            "offline",
          );
        }

        return response({
          success: true,
        });
      },
    });

    const input =
      payload();

    await assert.rejects(
      client.createRazorpayPaymentOrder(
        null,
        input,
      ),

      (error) => {
        assert.equal(
          error.code,
          "PAYMENT_CONNECTION_FAILED",
        );

        assert.equal(
          error.data
            .verificationUncertain,
          true,
        );

        return true;
      },
    );

    await client.createRazorpayPaymentOrder(
      null,
      input,
    );

    assert.equal(
      client.requests.length,
      2,
    );

    for (
      const request of
      client.requests
    ) {
      assert.equal(
        JSON.parse(
          request.options.body,
        ).checkoutToken,
        input.checkoutToken,
      );
    }

    assert.equal(
      client.timers.size,
      0,
    );
  },
);

test(
  "unreadable and malformed creation responses remain uncertain even for an HTTP 400",
  async () => {
    for (
      const status of [
        200,
        400,
      ]
    ) {
      const cases = [
        null,
        [],
        {},
        "unexpected response",

        {
          success: "true",
        },
      ];

      for (
        const data of cases
      ) {
        const client = await api({
          send: async () =>
            response(
              data,
              status,
            ),
        });

        await assert.rejects(
          client.createRazorpayPaymentOrder(
            null,
            payload(),
          ),

          (error) => {
            assert.equal(
              error.code,
              "INVALID_PAYMENT_RESPONSE",
            );

            assert.equal(
              error.data
                .verificationUncertain,
              true,
            );

            assert.equal(
              error.data
                .orderCreationUncertain,
              true,
            );

            return true;
          },
        );
      }

      const client = await api({
        send: async () => ({
          ok:
            status >= 200 &&
            status < 300,

          status,

          json: async () => {
            throw new SyntaxError(
              "Invalid JSON",
            );
          },
        }),
      });

      await assert.rejects(
        client.createRazorpayPaymentOrder(
          null,
          payload(),
        ),

        (error) =>
          error.code ===
            "INVALID_PAYMENT_RESPONSE" &&
          error.data
            .verificationUncertain ===
            true,
      );
    }
  },
);

test(
  "structured server rejections preserve price, stock and payment-security information",
  async () => {
    const cases = [
      {
        status: 409,
        operation: "create",

        data: {
          success: false,
          code: "CHECKOUT_TOTAL_CHANGED",
          message: "Review the updated total.",
        },
      },

      {
        status: 409,
        operation: "create",

        data: {
          success: false,
          code: "STOCK_UNAVAILABLE",
          message: "This variant is unavailable.",
        },
      },

      {
        status: 400,
        operation: "verify",

        data: {
          success: false,
          code: "PAYMENT_SIGNATURE_INVALID",
          message: "Payment verification failed.",
          errorReference: "fixture-reference",
        },
      },

      {
        status: 503,
        operation: "verify",

        data: {
          success: false,
          code: "PAYMENT_UNAVAILABLE",
          message: "Retry payment confirmation.",
          paymentReceived: true,
          retryVerification: true,
          verificationUncertain: true,
        },
      },
    ];

    for (
      const item of cases
    ) {
      const client = await api({
        send: async () =>
          response(
            item.data,
            item.status,
          ),
      });

      const pending =
        item.operation === "create"
          ? client.createRazorpayPaymentOrder(
              null,
              payload(),
            )
          : client.verifyRazorpayPayment(
              null,
              verification(),
            );

      await assert.rejects(
        pending,

        (error) => {
          assert.equal(
            error.status,
            item.status,
          );

          assert.equal(
            error.code,
            item.data.code,
          );

          assert.equal(
            error.message,
            item.data.message,
          );

          assert.deepEqual(
            clone(error.data),
            item.data,
          );

          return true;
        },
      );

      assert.equal(
        client.requests.length,
        1,
      );
    }
  },
);

test(
  "missing access and invalid checkout data are rejected before contacting payment services",
  async () => {
    const inaccessible =
      await api({
        access: false,
      });

    await assert.rejects(
      inaccessible
        .createRazorpayPaymentOrder(
          null,
          payload(),
        ),

      (error) =>
        error.code ===
        "AUTH_REQUIRED",
    );

    await assert.rejects(
      inaccessible
        .verifyRazorpayPayment(
          null,
          verification(),
        ),

      (error) =>
        error.code ===
        "AUTH_REQUIRED",
    );

    await assert.rejects(
      inaccessible
        .checkRazorpayPayment(
          null,
          "GD-FIXTURE",

          {
            admin: true,
          },
        ),

      /admin/i,
    );

    assert.equal(
      inaccessible.requests.length,
      0,
    );

    const client =
      await api();

    const invalid = [
      null,

      {
        ...payload(),
        checkoutToken: "",
      },

      {
        ...payload(),
        paymentMethod: "unsupported",
      },

      {
        ...payload(),
        items: [],
      },

      {
        ...payload(),
        shippingAddress: null,
      },
    ];

    for (
      const input of invalid
    ) {
      await assert.rejects(
        client.createRazorpayPaymentOrder(
          null,
          input,
        ),
      );
    }

    await assert.rejects(
      client.verifyRazorpayPayment(
        null,

        {
          ...verification(),
          razorpay_signature: "",
        },
      ),
    );

    await assert.rejects(
      client.checkRazorpayPayment(
        null,
        "invalid order number",
      ),
    );

    assert.equal(
      client.requests.length,
      0,
    );
  },
);

test(
  "status checks retain their 55-second timeout, support cancellation and validate server confirmation",
  async () => {
    for (
      const state of [
        "verified",
        "pending",
        "authorized",
        "review",
      ]
    ) {
      const result = {
        state,
        message: `Payment ${state}`,
        orderNumber: "GD-FIXTURE",
        paymentVerified:
          state === "verified",
      };

      const client = await api({
        send: async () =>
          response({
            success: true,
            result,
          }),
      });

      const received =
        await client.checkRazorpayPayment(
          null,
          "GD-FIXTURE",
        );

      assert.deepEqual(
        clone(received),
        result,
      );

      assert.equal(
        client.timers.size,
        0,
      );
    }

    const invalidResults = [
      null,

      {
        state: "unknown",
        message: "Unknown",
        orderNumber: "GD-FIXTURE",
      },

      {
        state: "verified",
        message: "Not verified",
        orderNumber: "GD-FIXTURE",
        paymentVerified: false,
      },

      {
        state: "pending",
        message: "Wrong order",
        orderNumber: "GD-OTHER",
      },
    ];

    for (
      const result of invalidResults
    ) {
      const client = await api({
        send: async () =>
          response({
            success: true,
            result,
          }),
      });

      await assert.rejects(
        client.checkRazorpayPayment(
          null,
          "GD-FIXTURE",
        ),

        (error) =>
          error.code ===
            "INVALID_PAYMENT_RESPONSE" &&
          error.data
            .verificationUncertain ===
            true,
      );
    }

    const stalled = await api({
      send: (url, options) =>
        new Promise(
          (resolve, reject) => {
            options.signal
              .addEventListener(
                "abort",

                () =>
                  reject(
                    aborted(),
                  ),

                {
                  once: true,
                },
              );
          },
        ),
    });

    const waiting =
      stalled.checkRazorpayPayment(
        null,
        "GD-FIXTURE",
      );

    const timedOut =
      assert.rejects(
        waiting,

        (error) =>
          error.code ===
            "PAYMENT_REQUEST_TIMEOUT" &&
          error.data
            .verificationUncertain ===
            true,
      );

    stalled.fire(55000);

    await timedOut;

    assert.equal(
      stalled.timers.size,
      0,
    );

    const cancelled = await api({
      send: (url, options) =>
        new Promise(
          (resolve, reject) => {
            options.signal
              .addEventListener(
                "abort",

                () =>
                  reject(
                    aborted(),
                  ),

                {
                  once: true,
                },
              );
          },
        ),
    });

    const controller =
      new AbortController();

    const checking =
      cancelled.checkRazorpayPayment(
        null,
        "GD-FIXTURE",

        {
          signal:
            controller.signal,
        },
      );

    const cancelledCheck =
      assert.rejects(
        checking,

        (error) =>
          error.code ===
          "PAYMENT_REQUEST_CANCELLED",
      );

    controller.abort();

    await cancelledCheck;

    assert.equal(
      cancelled.timers.size,
      0,
    );

    const alreadyCancelled =
      new AbortController();

    alreadyCancelled.abort();

    const untouched =
      await api();

    await assert.rejects(
      untouched.checkRazorpayPayment(
        null,
        "GD-FIXTURE",

        {
          signal:
            alreadyCancelled.signal,
        },
      ),

      (error) =>
        error.code ===
        "PAYMENT_REQUEST_CANCELLED",
    );

    assert.equal(
      untouched.requests.length,
      0,
    );
  },
);

test(
  "payment payloads are captured before callers can mutate them or change guest access",
  async () => {
    let release;

    const client = await api({
      send: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    });

    const input =
      payload();

    const original =
      clone(input);

    const pending =
      client.createRazorpayPaymentOrder(
        null,
        input,
      );

    input.items[0].quantity =
      99;

    input.shippingAddress
      .fullName = "Changed later";

    input.checkoutToken =
      "changed-later";

    client.guest({
      token:
        `gco_${"c".repeat(64)}`,
    });

    assert.equal(
      client.requests.length,
      1,
    );

    assert.deepEqual(
      JSON.parse(
        client.requests[0]
          .options.body,
      ),
      original,
    );

    assert.equal(
      client.requests[0]
        .options.headers[
          "X-GymDrobe-Guest"
        ],

      guestToken,
    );

    release(
      response({
        success: true,
      }),
    );

    await pending;
  },
);