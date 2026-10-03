const RAZORPAY_SCRIPT_URL =
  "https://checkout.razorpay.com/v1/checkout.js";


// ======================================================
// SHARED SCRIPT LOADER
//
// Prevents multiple checkout components from trying to
// load Razorpay at the same time.
// ======================================================

let razorpayLoadPromise =
  null;


// ======================================================
// CREATE PAYMENT ERROR
// ======================================================

function paymentError(
  message,
  {
    code = "",
    data = null,
  } = {}
) {
  const error =
    new Error(
      message
    );


  if (
    code
  ) {
    error.code =
      code;
  }


  if (
    data
  ) {
    error.data =
      data;
  }


  return error;
}


// ======================================================
// LOAD RAZORPAY CHECKOUT SCRIPT
// ======================================================

export function loadRazorpay() {
  // ====================================================
  // BROWSER CHECK
  // ====================================================

  if (
    typeof window ===
      "undefined" ||
    typeof document ===
      "undefined"
  ) {
    return Promise.reject(
      paymentError(
        "Razorpay Checkout can only run in the browser.",
        {
          code:
            "RAZORPAY_BROWSER_REQUIRED",
        }
      )
    );
  }


  // ====================================================
  // ALREADY AVAILABLE
  // ====================================================

  if (
    window.Razorpay
  ) {
    return Promise.resolve(
      window.Razorpay
    );
  }


  // ====================================================
  // LOAD ALREADY IN PROGRESS
  // ====================================================

  if (
    razorpayLoadPromise
  ) {
    return razorpayLoadPromise;
  }


  // ====================================================
  // START LOADING
  // ====================================================

  razorpayLoadPromise =
    new Promise(
      (
        resolve,
        reject
      ) => {
        let settled =
          false;


        let timeoutId =
          null;


        function finishSuccess() {
          if (
            settled
          ) {
            return;
          }


          settled =
            true;


          if (
            timeoutId
          ) {
            clearTimeout(
              timeoutId
            );
          }


          if (
            window.Razorpay
          ) {
            resolve(
              window.Razorpay
            );

            return;
          }


          razorpayLoadPromise =
            null;


          reject(
            paymentError(
              "Razorpay Checkout loaded incorrectly.",
              {
                code:
                  "RAZORPAY_LOAD_INVALID",
              }
            )
          );
        }


        function finishError(
          message =
            "Unable to load Razorpay Checkout."
        ) {
          if (
            settled
          ) {
            return;
          }


          settled =
            true;


          if (
            timeoutId
          ) {
            clearTimeout(
              timeoutId
            );
          }


          razorpayLoadPromise =
            null;


          reject(
            paymentError(
              message,
              {
                code:
                  "RAZORPAY_LOAD_FAILED",
              }
            )
          );
        }


        // ==============================================
        // EXISTING SCRIPT
        // ==============================================

        const existing =
          document.querySelector(
            `script[src="${RAZORPAY_SCRIPT_URL}"]`
          );


        if (
          existing
        ) {
          existing.addEventListener(
            "load",
            finishSuccess,
            {
              once:
                true,
            }
          );


          existing.addEventListener(
            "error",
            () =>
              finishError(
                "Unable to load Razorpay Checkout. Check your internet connection and try again."
              ),
            {
              once:
                true,
            }
          );


          /*
            The script may have finished loading before
            the event listener above was attached.
          */

          if (
            window.Razorpay
          ) {
            finishSuccess();

            return;
          }


          timeoutId =
            window.setTimeout(
              () => {
                if (
                  window.Razorpay
                ) {
                  finishSuccess();

                } else {
                  finishError(
                    "Razorpay Checkout took too long to load."
                  );
                }
              },
              15000
            );


          return;
        }


        // ==============================================
        // CREATE SCRIPT
        // ==============================================

        const script =
          document.createElement(
            "script"
          );


        script.src =
          RAZORPAY_SCRIPT_URL;


        script.async =
          true;


        script.onload =
          finishSuccess;


        script.onerror =
          () => {
            script.remove();


            finishError(
              "Unable to load Razorpay Checkout. Check your internet connection and try again."
            );
          };


        timeoutId =
          window.setTimeout(
            () => {
              if (
                window.Razorpay
              ) {
                finishSuccess();

              } else {
                finishError(
                  "Razorpay Checkout took too long to load."
                );
              }
            },
            15000
          );


        document.head.appendChild(
          script
        );
      }
    );


  return razorpayLoadPromise;
}


// ======================================================
// VALIDATE CHECKOUT OPTIONS
// ======================================================

function validateCheckoutOptions(
  options
) {
  if (
    !options ||
    typeof options !==
      "object"
  ) {
    throw paymentError(
      "Razorpay checkout information is missing.",
      {
        code:
          "RAZORPAY_OPTIONS_MISSING",
      }
    );
  }


  if (
    !String(
      options.key ||
        ""
    ).trim()
  ) {
    throw paymentError(
      "Razorpay public key is missing.",
      {
        code:
          "RAZORPAY_KEY_MISSING",
      }
    );
  }


  if (
    !String(
      options.order_id ||
        ""
    ).trim()
  ) {
    throw paymentError(
      "Razorpay order ID is missing.",
      {
        code:
          "RAZORPAY_ORDER_MISSING",
      }
    );
  }


  const amount =
    Number(
      options.amount
    );


  if (
    !Number.isSafeInteger(
      amount
    ) ||
    amount <
      1
  ) {
    throw paymentError(
      "Razorpay payment amount is invalid.",
      {
        code:
          "RAZORPAY_AMOUNT_INVALID",
      }
    );
  }


  if (
    String(
      options.currency ||
        "INR"
    ).toUpperCase() !==
    "INR"
  ) {
    throw paymentError(
      "GymDrobe currently supports INR payments only.",
      {
        code:
          "RAZORPAY_CURRENCY_INVALID",
      }
    );
  }
}


// ======================================================
// OPEN RAZORPAY CHECKOUT
//
// Works for BOTH:
//
// Full online payment
// → backend passes full order amount
//
// COD with 10% advance
// → backend passes only advance amount
//
// This file does NOT calculate payment amounts.
// Backend remains authoritative.
// ======================================================

export async function openRazorpayCheckout(
  options
) {
  validateCheckoutOptions(
    options
  );


  const Razorpay =
    await loadRazorpay();


  return new Promise(
    (
      resolve,
      reject
    ) => {
      let settled =
        false;


      function resolveOnce(
        value
      ) {
        if (
          settled
        ) {
          return;
        }


        settled =
          true;


        resolve(
          value
        );
      }


      function rejectOnce(
        error
      ) {
        if (
          settled
        ) {
          return;
        }


        settled =
          true;


        reject(
          error
        );
      }


      try {
        // ==============================================
        // KEEP OPTIONAL USER CALLBACKS
        // ==============================================

        const originalHandler =
          options?.handler;


        const originalDismiss =
          options
            ?.modal
            ?.ondismiss;


        // ==============================================
        // CHECKOUT INSTANCE
        // ==============================================

        const checkout =
          new Razorpay({
            ...options,

            currency:
              String(
                options.currency ||
                  "INR"
              ).toUpperCase(),


            // ==========================================
            // SUCCESS
            // ==========================================

            handler(
              response
            ) {
              try {
                originalHandler?.(
                  response
                );

              } catch (
                callbackError
              ) {
                console.error(
                  "Razorpay success callback error:",
                  callbackError
                );
              }


              resolveOnce(
                response
              );
            },


            // ==========================================
            // MODAL
            // ==========================================

            modal: {
              ...options?.modal,


              ondismiss() {
                try {
                  originalDismiss?.();

                } catch (
                  callbackError
                ) {
                  console.error(
                    "Razorpay dismiss callback error:",
                    callbackError
                  );
                }


                rejectOnce(
                  paymentError(
                    "Payment was cancelled.",
                    {
                      code:
                        "RAZORPAY_CANCELLED",
                    }
                  )
                );
              },
            },
          });


        // ==============================================
        // PAYMENT FAILED
        // ==============================================

        checkout.on(
          "payment.failed",
          (
            response
          ) => {
            const razorpayError =
              response?.error ||
              {};


            const message =
              razorpayError
                .description ||
              razorpayError
                .reason ||
              "Payment failed. Please try again.";


            rejectOnce(
              paymentError(
                message,
                {
                  code:
                    razorpayError
                      .code ||
                    "RAZORPAY_PAYMENT_FAILED",

                  data: {
                    reason:
                      razorpayError
                        .reason ||
                      null,

                    source:
                      razorpayError
                        .source ||
                      null,

                    step:
                      razorpayError
                        .step ||
                      null,

                    metadata:
                      razorpayError
                        .metadata ||
                      null,
                  },
                }
              )
            );
          }
        );


        // ==============================================
        // OPEN
        // ==============================================

        checkout.open();

      } catch (
        error
      ) {
        console.error(
          "Unable to open Razorpay Checkout:",
          error
        );


        rejectOnce(
          error instanceof
          Error
            ? error
            : paymentError(
                "Unable to open Razorpay Checkout.",
                {
                  code:
                    "RAZORPAY_OPEN_FAILED",
                }
              )
        );
      }
    }
  );
}