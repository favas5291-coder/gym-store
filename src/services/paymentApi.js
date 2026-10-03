const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";


// ======================================================
// SUPPORTED PAYMENT METHODS
// ======================================================

const PAYMENT_METHODS = [
  "razorpay",
  "cod-partial",
];


// ======================================================
// REQUEST HELPER
// ======================================================

async function request(
  path,
  {
    token,
    method = "GET",
    body,
  } = {}
) {
  if (
    !token
  ) {
    throw new Error(
      "You must be logged in to continue payment."
    );
  }


  let response;


  try {
    response =
      await fetch(
        `${API_URL}${path}`,
        {
          method,

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          body:
            body !==
            undefined
              ? JSON.stringify(
                  body
                )
              : undefined,
        }
      );

  } catch (
    networkError
  ) {
    console.error(
      "Payment network error:",
      networkError
    );


    throw new Error(
      "Unable to connect to the GymDrobe payment server."
    );
  }


  let data =
    {};


  try {
    data =
      await response.json();

  } catch {
    data =
      {};
  }


  if (
    !response.ok
  ) {
    const error =
      new Error(
        data.message ||
          "Payment request failed."
      );


    error.status =
      response.status;


    error.data =
      data;


    throw error;
  }


  return data;
}


// ======================================================
// VALIDATE CHECKOUT PAYMENT DATA
// ======================================================

function validateCheckoutData(
  checkoutData
) {
  if (
    !checkoutData ||
    typeof checkoutData !==
      "object"
  ) {
    throw new Error(
      "Checkout information is missing."
    );
  }


  if (
    !checkoutData
      .checkoutToken
  ) {
    throw new Error(
      "Checkout token is missing."
    );
  }


  if (
    !PAYMENT_METHODS.includes(
      checkoutData
        .paymentMethod
    )
  ) {
    throw new Error(
      "Choose a valid GymDrobe payment method."
    );
  }


  if (
    !Array.isArray(
      checkoutData.items
    ) ||
    !checkoutData.items.length
  ) {
    throw new Error(
      "Your checkout has no products."
    );
  }


  if (
    !checkoutData
      .shippingAddress ||
    typeof checkoutData
      .shippingAddress !==
      "object"
  ) {
    throw new Error(
      "Shipping address is missing."
    );
  }


  return true;
}


// ======================================================
// CREATE RAZORPAY ORDER
//
// Backend:
// POST /api/payments/razorpay/order
//
// paymentMethod:
//
// "razorpay"
// → full online payment
//
// "cod-partial"
// → 10% Razorpay advance
// → remaining amount on delivery
// ======================================================

export async function createRazorpayPaymentOrder(
  token,
  checkoutData
) {
  validateCheckoutData(
    checkoutData
  );


  const payload = {
    ...checkoutData,

    paymentMethod:
      checkoutData
        .paymentMethod,
  };


  return request(
    "/payments/razorpay/order",
    {
      token,

      method:
        "POST",

      body:
        payload,
    }
  );
}


// ======================================================
// VERIFY RAZORPAY PAYMENT
//
// Backend:
// POST /api/payments/razorpay/verify
//
// This works for BOTH:
//
// Full payment
// COD 10% advance
//
// The backend determines which type it is from the
// stored GymDrobe order.
// ======================================================

export async function verifyRazorpayPayment(
  token,
  {
    checkoutToken,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = {}
) {
  if (
    !checkoutToken
  ) {
    throw new Error(
      "Checkout token is missing."
    );
  }


  if (
    !razorpay_order_id
  ) {
    throw new Error(
      "Razorpay order ID is missing."
    );
  }


  if (
    !razorpay_payment_id
  ) {
    throw new Error(
      "Razorpay payment ID is missing."
    );
  }


  if (
    !razorpay_signature
  ) {
    throw new Error(
      "Razorpay payment signature is missing."
    );
  }


  return request(
    "/payments/razorpay/verify",
    {
      token,

      method:
        "POST",

      body: {
        checkoutToken,

        razorpay_order_id,

        razorpay_payment_id,

        razorpay_signature,
      },
    }
  );
}