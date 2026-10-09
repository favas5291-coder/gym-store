const SCRIPT_URL =
  "https://checkout.razorpay.com/v1/checkout.js";

let loadingPromise;

function paymentError(message, code, data) {
  const error = new Error(message);
  error.code = code;

  if (data) {
    error.data = data;
  }

  return error;
}

export function loadRazorpay() {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined"
  ) {
    return Promise.reject(
      paymentError(
        "Open payment in your browser.",
        "RAZORPAY_BROWSER_REQUIRED",
      ),
    );
  }

  if (window.Razorpay) {
    return Promise.resolve(window.Razorpay);
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = new Promise((resolve, reject) => {
    let script = document.querySelector(
      `script[src="${SCRIPT_URL}"]`,
    );

    const created = !script;
    let settled = false;

    if (!script) {
      script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
    }

    const timer = setTimeout(() => {
      finish(
        window.Razorpay
          ? null
          : paymentError(
              "The payment window took too long to load. Check your connection and retry.",
              "RAZORPAY_LOAD_FAILED",
            ),
      );
    }, 20000);

    function finish(error) {
      if (settled) return;
      settled = true;

      clearTimeout(timer);

      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);

      if (error) {
        if (created) {
          script.remove();
        }

        reject(error);
      } else {
        resolve(window.Razorpay);
      }
    }

    function onLoad() {
      finish(
        window.Razorpay
          ? null
          : paymentError(
              "The payment window could not start. Please retry.",
              "RAZORPAY_LOAD_INVALID",
            ),
      );
    }

    function onError() {
      finish(
        paymentError(
          "Could not load Razorpay. Check your connection and retry.",
          "RAZORPAY_LOAD_FAILED",
        ),
      );
    }

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);

    if (!script.isConnected) {
      document.head.appendChild(script);
    }
  }).catch((error) => {
    loadingPromise = undefined;
    throw error;
  });

  return loadingPromise;
}

export async function openRazorpayCheckout(options) {
  const amount = Number(options?.amount);

  if (
    !options?.key ||
    !options?.order_id ||
    !Number.isSafeInteger(amount) ||
    amount < 1
  ) {
    throw paymentError(
      "Payment details are incomplete. Please retry.",
      "RAZORPAY_OPTIONS_INVALID",
    );
  }

  if (
    String(options.currency || "INR").toUpperCase() !==
    "INR"
  ) {
    throw paymentError(
      "GymDrobe currently accepts payments in INR.",
      "RAZORPAY_CURRENCY_INVALID",
    );
  }

  const Razorpay = await loadRazorpay();

  return new Promise((resolve, reject) => {
    let settled = false;
    let lastFailure;
    let checkout;

    function succeed(response) {
      if (settled) return;
      settled = true;
      resolve(response);
    }

    function fail(error) {
      if (settled) return;
      settled = true;
      reject(error);
    }

    try {
      checkout = new Razorpay({
        ...options,
        amount,
        currency: "INR",

        handler(response) {
          // A successful retry must still reach backend verification.
          succeed(response);

          try {
            options.handler?.(response);
          } catch {
            // Optional callback.
          }
        },

        modal: {
          ...options.modal,

          ondismiss() {
            fail(
              lastFailure ||
                paymentError(
                  "Payment was cancelled. If money was deducted, check My orders before paying again.",
                  "RAZORPAY_CANCELLED",
                ),
            );

            try {
              options.modal?.ondismiss?.();
            } catch {
              // Optional callback.
            }
          },
        },
      });

      checkout.on("payment.failed", (response) => {
        const details = response?.error || {};

        lastFailure = paymentError(
          details.description ||
            "Payment failed. Choose another payment method or retry.",
          details.code || "RAZORPAY_PAYMENT_FAILED",
          {
            reason: details.reason || null,
          },
        );

        // Keep listening when Razorpay offers a retry
        // inside the same payment window.
        if (options.retry?.enabled === false) {
          fail(lastFailure);

          try {
            checkout.close();
          } catch {
            // Already closed.
          }
        }
      });

      checkout.open();
    } catch {
      fail(
        paymentError(
          "The payment window could not open. Please retry.",
          "RAZORPAY_OPEN_FAILED",
        ),
      );
    }
  });
}