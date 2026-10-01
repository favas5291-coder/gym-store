const express =
  require("express");

const {
  createOrder,
  getOrders,
  getOrderById,
  cancelOrder,
  requestReturn,
} =
  require("../controllers/orderController");

const {
  protect,
} =
  require("../middleware/authMiddleware");


const router =
  express.Router();


// ======================================================
// ALL ORDER ROUTES REQUIRE LOGIN
// ======================================================

router.use(
  protect
);


// ======================================================
// ORDERS
// ======================================================

router
  .route("/")
  .get(
    getOrders
  )
  .post(
    createOrder
  );


// ======================================================
// CANCEL ORDER
//
// PUT /api/orders/:id/cancel
// ======================================================

router.put(
  "/:id/cancel",
  cancelOrder
);


// ======================================================
// REQUEST RETURN / EXCHANGE
//
// POST /api/orders/:id/return
// ======================================================

router.post(
  "/:id/return",
  requestReturn
);


// ======================================================
// GET ONE ORDER
// ======================================================

router.get(
  "/:id",
  getOrderById
);


module.exports =
  router;