const express =
  require("express");

const {
  createOrder,
  getOrders,
  getOrderById,
  cancelOrder,
  requestReturn,

  getAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,

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
// ADMIN — ALL ORDERS
//
// IMPORTANT:
// Keep every "/admin/..." route ABOVE "/:id".
// ======================================================

router.get(
  "/admin/orders",
  adminOnly,
  getAdminOrders
);


// ======================================================
// ADMIN — UPDATE ORDER STATUS / TRACKING
// ======================================================

router.put(
  "/admin/orders/:id/status",
  adminOnly,
  updateAdminOrderStatus
);


// ======================================================
// ADMIN — GET ONE ORDER
// ======================================================

router.get(
  "/admin/orders/:id",
  adminOnly,
  getAdminOrderById
);


// ======================================================
// ADMIN — RETURNS / EXCHANGES
// ======================================================

router.get(
  "/admin/returns",
  adminOnly,
  getAdminReturnRequests
);


// ======================================================
// ADMIN — APPROVE / REJECT RETURN / EXCHANGE
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