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


const app =
  express();


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(
  cors()
);

app.use(
  express.json({
    limit: "1mb",
  })
);


// ======================================================
// HEALTH CHECK
// ======================================================

app.get(
  "/api/health",

  (req, res) => {
    res
      .status(200)
      .json({
        success: true,

        message:
          "GymDrobe API is running",
      });
  }
);


// ======================================================
// ROUTES
// ======================================================

app.use(
  "/api/products",
  productRoutes
);

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/addresses",
  addressRoutes
);

app.use(
  "/api/orders",
  orderRoutes
);


// ======================================================
// 404
// ======================================================

app.use(
  (req, res) => {
    res
      .status(404)
      .json({
        success: false,

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

  } catch (error) {
    console.error(
      "❌ Server was not started because MongoDB could not connect."
    );

    process.exit(1);
  }
}


startServer();