const express =
  require("express");

const {
  createOrder,
  getOrders,
  getOrderById,
  cancelOrder,
  requestReturn,

  getAdminReturnRequests,
  reviewReturnRequest,
  completeReturnRequest,
  recordReturnRefund,
} =
  require(
    "../controllers/orderController"
  );

const {
  protect,
  adminOnly,
} =
  require(
    "../middleware/authMiddleware"
  );


const router =
  express.Router();


// ======================================================
// ALL ORDER ROUTES REQUIRE LOGIN
// ======================================================

router.use(
  protect
);


// ======================================================
// CUSTOMER ORDERS
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
// ADMIN — RETURNS / EXCHANGES
//
// IMPORTANT:
// Keep these admin routes ABOVE "/:id"
// so Express does not treat "admin" as an order ID.
// ======================================================

router.get(
  "/admin/returns",
  adminOnly,
  getAdminReturnRequests
);


// ======================================================
// ADMIN — APPROVE / REJECT
// ======================================================

router.put(
  "/admin/returns/:id/review",
  adminOnly,
  reviewReturnRequest
);


// ======================================================
// ADMIN — COMPLETE RETURN / EXCHANGE
// ======================================================

router.put(
  "/admin/returns/:id/complete",
  adminOnly,
  completeReturnRequest
);


// ======================================================
// ADMIN — RECORD MANUAL REFUND
// ======================================================

router.put(
  "/admin/returns/:id/refund",
  adminOnly,
  recordReturnRefund
);


// ======================================================
// CUSTOMER — CANCEL ORDER
// ======================================================

router.put(
  "/:id/cancel",
  cancelOrder
);


// ======================================================
// CUSTOMER — REQUEST RETURN / EXCHANGE
// ======================================================

router.post(
  "/:id/return",
  requestReturn
);


// ======================================================
// CUSTOMER — GET ONE ORDER
//
// Keep this LAST because "/:id" matches almost anything.
// ======================================================

router.get(
  "/:id",
  getOrderById
);


// ======================================================
// EXPORT
// ======================================================

module.exports =
  router;