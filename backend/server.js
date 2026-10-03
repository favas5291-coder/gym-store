const express =
  require("express");

const dotenv =
  require("dotenv");

const cors =
  require("cors");


dotenv.config();


const connectDB =
  require("./config/db");

const productRoutes =
  require(
    "./routes/productRoutes"
  );

const authRoutes =
  require(
    "./routes/authRoutes"
  );

const addressRoutes =
  require(
    "./routes/addressRoutes"
  );

const orderRoutes =
  require(
    "./routes/orderRoutes"
  );

const paymentRoutes =
  require(
    "./routes/paymentRoutes"
  );

const paymentWebhookRoutes =
  require(
    "./routes/paymentWebhookRoutes"
  );


const app =
  express();


// ======================================================
// CORS
// ======================================================

app.use(
  cors()
);


// ======================================================
// RAZORPAY WEBHOOK RAW BODY
//
// IMPORTANT:
//
// This MUST be before express.json().
//
// Razorpay signs the exact raw request body.
// If express.json() parses it first, webhook signature
// verification will fail.
// ======================================================

app.use(
  "/api/payment-webhooks",

  express.raw({
    type:
      "application/json",

    limit:
      "1mb",
  }),

  paymentWebhookRoutes
);


// ======================================================
// NORMAL JSON API BODY PARSER
//
// All normal GymDrobe API routes below this point use
// req.body as a JavaScript object.
// ======================================================

app.use(
  express.json({
    limit:
      "1mb",
  })
);


// ======================================================
// HEALTH CHECK
// ======================================================

app.get(
  "/api/health",

  (
    req,
    res
  ) => {
    res
      .status(
        200
      )
      .json({
        success:
          true,

        message:
          "GymDrobe API is running",
      });
  }
);


// ======================================================
// PRODUCT ROUTES
// ======================================================

app.use(
  "/api/products",
  productRoutes
);


// ======================================================
// AUTH ROUTES
// ======================================================

app.use(
  "/api/auth",
  authRoutes
);


// ======================================================
// ADDRESS ROUTES
// ======================================================

app.use(
  "/api/addresses",
  addressRoutes
);


// ======================================================
// ORDER ROUTES
// ======================================================

app.use(
  "/api/orders",
  orderRoutes
);


// ======================================================
// PAYMENT ROUTES
//
// POST /api/payments/razorpay/order
// POST /api/payments/razorpay/verify
// ======================================================

app.use(
  "/api/payments",
  paymentRoutes
);


// ======================================================
// WEBHOOK ROUTE
//
// POST /api/payment-webhooks/razorpay
//
// Already mounted ABOVE express.json()
// ======================================================


// ======================================================
// 404
// ======================================================

app.use(
  (
    req,
    res
  ) => {
    res
      .status(
        404
      )
      .json({
        success:
          false,

        message:
          "API route not found.",
      });
  }
);


// ======================================================
// START SERVER
// ======================================================

const PORT =
  process.env.PORT ||
  5000;


async function startServer() {
  try {
    console.log(
      "Connecting to MongoDB..."
    );


    await connectDB();


    app.listen(
      PORT,

      () => {
        console.log(
          `🚀 GymDrobe server running on http://localhost:${PORT}`
        );
      }
    );

  } catch (
    error
  ) {
    console.error(
      "❌ Server was not started because MongoDB could not connect."
    );


    console.error(
      error
    );


    process.exit(
      1
    );
  }
}


startServer();